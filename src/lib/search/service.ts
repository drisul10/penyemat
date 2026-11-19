import type MiniSearch from 'minisearch';
import { mergeLocked } from '../backup/backup';
import { parseExport } from '../backup/format';
import { gunzip, gzip } from '../bytes';
import { importKey } from '../crypto/aes';
import { fingerprint } from '../crypto/fingerprint';
import {
  createLock,
  decryptRecord,
  encryptRecord,
  type LockedPayload,
  rekey,
  type UnlockedKey,
  unlock,
  verifyKey,
} from '../crypto/lock';
import type { LockMessage } from '../crypto/share';
import { buildBookmark, findByUrl } from '../db/bookmarks';
import { announce } from '../db/events';
import {
  createLockedShelf,
  deleteLockedRecord,
  getLockMeta,
  listLockedRecords,
  moveToLocked,
  replaceLock,
} from '../db/locked';
import { getDb, UNSORTED_ID } from '../db/schema';
import {
  createIndex,
  type Hit,
  INDEX_SCHEMA_VERSION,
  type IndexDoc,
  loadIndex,
  rank,
  remove,
  searchIndex,
  serialize,
  toIndexDoc,
  upsert,
} from './engine';
import type { LockedItem, LockedPage, LockState, ResultHit, SaveLockedResult, WorkerEvent } from './protocol';
import { makeSnippet } from './snippet';

// Runs inside the library page's search worker (ARCHITECTURE 5.3–5.5).
// Owns the open index, the in-memory locked index, and the key while unlocked.

/** Writers stamp updatedAt before their transaction commits, so sync looks back a little. */
const SYNC_MARGIN_MS = 2_000;
const SNAPSHOT_DELAY_MS = 1_000;
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BUILD_BATCH = 200;
const SNIPPETS = 20;
const MAX_RESULTS = 200;

interface Unlocked extends UnlockedKey {
  items: Map<string, LockedPayload>;
  index: MiniSearch<IndexDoc>;
}

export interface ServiceHooks {
  emit: (event: WorkerEvent) => void;
  broadcast: (message: LockMessage) => void;
}

export class WrongPassphrase extends Error {
  constructor() {
    super("That passphrase doesn't match. Check it and try again.");
  }
}

export class SearchService {
  private open: MiniSearch<IndexDoc> = createIndex();
  private watermark = 0;
  private applied = new Map<string, number>();
  private ready = false;
  private locked: Unlocked | null = null;
  private latestQuery = 0;
  private pendingQuery: { id: number; query: string } | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;
  private syncAgain = false;

  constructor(private hooks: ServiceHooks) {}

  async init(): Promise<void> {
    try {
      await this.loadOrBuild();
      this.ready = true;
      this.hooks.emit({ type: 'status', ready: true, building: null });
      await this.sync();
      await this.purgeTombstones();
    } catch (error) {
      this.hooks.emit({ type: 'status', ready: false, building: null, failed: String(error) });
      throw error;
    }
    await this.postLockState();
    if (await getLockMeta()) this.hooks.broadcast({ type: 'request-key' });
    if (this.pendingQuery) {
      const { id, query } = this.pendingQuery;
      this.pendingQuery = null;
      await this.search(id, query);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  // ---- Open index lifecycle (5.4) ----

  private async loadOrBuild(): Promise<void> {
    const snapshot = await getDb().indexSnapshots.get('open');
    if (snapshot && snapshot.schemaVersion === INDEX_SCHEMA_VERSION) {
      try {
        this.open = loadIndex(await gunzip(snapshot.data));
        this.watermark = snapshot.watermark;
        return;
      } catch {
        // Damaged snapshot: rebuild below.
      }
    }
    await this.rebuild();
  }

  private async rebuild(): Promise<void> {
    const db = getDb();
    const startedAt = Date.now();
    const total = await db.bookmarks.count();
    const index = createIndex();
    let done = 0;
    let lastId = '';
    this.hooks.emit({ type: 'status', ready: false, building: { done, total } });
    for (;;) {
      const batch = await db.bookmarks.where('id').above(lastId).limit(BUILD_BATCH).toArray();
      if (!batch.length) break;
      const texts = await db.texts.bulkGet(batch.map((b) => b.id));
      batch.forEach((bookmark, i) => {
        upsert(index, toIndexDoc(bookmark, texts[i]?.text ?? ''));
      });
      done += batch.length;
      lastId = batch[batch.length - 1]?.id ?? lastId;
      this.hooks.emit({ type: 'status', ready: false, building: { done, total } });
    }
    this.open = index;
    this.watermark = startedAt;
    this.scheduleSnapshot();
  }

  /** Applies saves, edits, and deletes made since the last sync, from any context. */
  sync(): Promise<void> {
    if (this.syncing) {
      this.syncAgain = true;
      return this.syncing;
    }
    this.syncing = (async () => {
      do {
        this.syncAgain = false;
        await this.syncOnce();
      } while (this.syncAgain);
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async syncOnce(): Promise<void> {
    if (!this.ready) return;
    const db = getDb();
    const since = this.watermark - SYNC_MARGIN_MS;
    const [changed, removed] = await Promise.all([
      db.bookmarks.where('updatedAt').above(since).toArray(),
      db.tombstones.where('removedAt').above(since).toArray(),
    ]);
    const fresh = changed.filter((b) => this.applied.get(b.id) !== b.updatedAt);
    const texts = await db.texts.bulkGet(fresh.map((b) => b.id));
    let dirty = false;
    let high = this.watermark;
    fresh.forEach((bookmark, i) => {
      upsert(this.open, toIndexDoc(bookmark, texts[i]?.text ?? ''));
      this.applied.set(bookmark.id, bookmark.updatedAt);
      dirty = true;
    });
    for (const b of changed) high = Math.max(high, b.updatedAt);
    for (const t of removed) {
      high = Math.max(high, t.removedAt);
      if (this.open.has(t.id) && !changed.some((b) => b.id === t.id)) {
        remove(this.open, t.id);
        this.applied.delete(t.id);
        dirty = true;
      }
    }
    this.watermark = high;
    if (dirty) this.scheduleSnapshot();
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      void this.writeSnapshot();
    }, SNAPSHOT_DELAY_MS);
  }

  async writeSnapshot(): Promise<void> {
    const data = await gzip(serialize(this.open));
    await getDb().indexSnapshots.put({
      kind: 'open',
      data,
      docCount: this.open.documentCount,
      builtAt: Date.now(),
      watermark: this.watermark,
      schemaVersion: INDEX_SCHEMA_VERSION,
    });
  }

  /** Old tombstones go once the saved snapshot has applied them. */
  private async purgeTombstones(): Promise<void> {
    const db = getDb();
    const snapshot = await db.indexSnapshots.get('open');
    if (!snapshot) return;
    const cutoff = Math.min(Date.now() - TOMBSTONE_TTL_MS, snapshot.watermark - SYNC_MARGIN_MS);
    await db.tombstones.where('removedAt').below(cutoff).delete();
  }

  // ---- Search (5.3) ----

  async search(id: number, query: string): Promise<void> {
    this.latestQuery = id;
    if (!this.ready) {
      this.pendingQuery = { id, query };
      return;
    }
    const started = performance.now();
    const hits: (Hit & { locked: boolean })[] = searchIndex(this.open, query).map((h) => ({ ...h, locked: false }));
    if (this.locked) {
      for (const h of searchIndex(this.locked.index, query)) hits.push({ ...h, locked: true });
    }
    const ranked = rank(hits).slice(0, MAX_RESULTS);
    const top = ranked.slice(0, SNIPPETS);
    const openIds = top.filter((h) => !h.locked).map((h) => h.id);
    const texts = await getDb().texts.bulkGet(openIds);
    // A newer query arrived while the texts loaded: drop this one.
    if (id !== this.latestQuery) return;
    const textById = new Map(openIds.map((tid, i) => [tid, texts[i]?.text ?? '']));
    const results: ResultHit[] = ranked.map((h, i) => {
      let snippet = null;
      if (i < SNIPPETS) {
        const text = h.locked ? (this.locked?.items.get(h.id)?.text ?? '') : (textById.get(h.id) ?? '');
        snippet = makeSnippet(text, h.terms);
      }
      return { id: h.id, locked: h.locked, score: h.score, snippet };
    });
    this.hooks.emit({ type: 'results', id, query, hits: results, tookMs: performance.now() - started });
  }

  // ---- Locked shelf (5.5) ----

  async lockState(): Promise<LockState> {
    const meta = await getLockMeta();
    if (!meta) return { state: 'none' };
    if (!this.locked) return { state: 'locked', shelfName: meta.shelfName };
    const items: LockedItem[] = [...this.locked.items.entries()]
      .map(([recordId, p]) => ({ recordId, bookmark: p.bookmark }))
      .sort((a, b) => b.bookmark.savedAt - a.bookmark.savedAt);
    return { state: 'unlocked', shelfName: meta.shelfName, items };
  }

  async postLockState(): Promise<void> {
    this.hooks.emit({ type: 'lock-state', lock: await this.lockState() });
  }

  async unlock(passphrase: string): Promise<void> {
    const meta = await getLockMeta();
    if (!meta) throw new Error('There is no locked shelf yet.');
    const key = await unlock(meta, passphrase);
    if (!key) throw new WrongPassphrase();
    await this.adoptKey(key);
    this.hooks.broadcast({ type: 'key', raw: key.raw });
  }

  /** Drops the key, decrypted records, and locked index from memory (F4.6). */
  async lock(fromOtherTab = false): Promise<void> {
    const wasUnlocked = this.locked !== null;
    this.locked = null;
    if (!fromOtherTab && wasUnlocked) this.hooks.broadcast({ type: 'lock' });
    await this.postLockState();
  }

  private async adoptKey(key: UnlockedKey): Promise<void> {
    this.locked = { ...key, items: new Map(), index: createIndex() };
    await this.refreshLocked();
  }

  /** Decrypts records added since the last look and drops deleted ones. */
  async refreshLocked(): Promise<void> {
    const state = this.locked;
    if (!state) {
      await this.postLockState();
      return;
    }
    const meta = await getLockMeta();
    if (!meta || !(await verifyKey(meta, state.key))) {
      // The passphrase changed in another tab, or the shelf is gone.
      await this.lock(true);
      return;
    }
    const records = await listLockedRecords();
    const ids = new Set(records.map((r) => r.id));
    for (const id of [...state.items.keys()]) {
      if (!ids.has(id)) {
        state.items.delete(id);
        remove(state.index, id);
      }
    }
    for (const record of records) {
      if (state.items.has(record.id)) continue;
      try {
        const payload = await decryptRecord(state.key, record);
        state.items.set(record.id, payload);
        // Records saved before fingerprints existed get one now that the key is open.
        if (!record.fingerprint && meta.fingerprintSalt) {
          const print = await fingerprint(meta.fingerprintSalt, payload.bookmark.url);
          await getDb().lockedRecords.update(record.id, { fingerprint: print });
        }
        upsert(state.index, toIndexDoc({ ...payload.bookmark, id: record.id }, payload.text));
      } catch {
        // A record this key can't open is left alone.
      }
    }
    if (this.locked === state) await this.postLockState();
  }

  async onLockMessage(message: LockMessage): Promise<void> {
    if (message.type === 'request-key' && this.locked) {
      this.hooks.broadcast({ type: 'key', raw: this.locked.raw });
    } else if (message.type === 'key') {
      const same =
        this.locked?.raw.length === message.raw.length && this.locked.raw.every((byte, i) => byte === message.raw[i]);
      if (same) return;
      const meta = await getLockMeta();
      if (!meta) return;
      const key = await importKey(message.raw);
      if (await verifyKey(meta, key)) await this.adoptKey({ raw: message.raw, key });
    } else if (message.type === 'lock') {
      await this.lock(true);
    }
  }

  async setup(passphrase: string, shelfName: string): Promise<void> {
    if (await getLockMeta()) throw new Error('A locked shelf already exists.');
    const { meta, unlocked } = await createLock(passphrase, shelfName);
    await createLockedShelf(meta);
    await this.adoptKey(unlocked);
    this.hooks.broadcast({ type: 'key', raw: unlocked.raw });
  }

  /** Re-encrypts every record in one transaction, so a failure keeps the old passphrase (F4.9). */
  async changePassphrase(current: string, next: string): Promise<void> {
    const meta = await getLockMeta();
    if (!meta) throw new Error('There is no locked shelf yet.');
    const old = await unlock(meta, current);
    if (!old) throw new WrongPassphrase();
    const records = await listLockedRecords();
    const result = await rekey(meta, old.key, records, next);
    await replaceLock(result.meta, result.records);
    this.locked = null;
    await this.adoptKey(result.unlocked);
    this.hooks.broadcast({ type: 'key', raw: result.unlocked.raw });
  }

  /**
   * Moves a saved link onto the locked shelf from the library (card menu). Uses the open key,
   * or derives one from the passphrase without unlocking the shelf.
   */
  async moveToLocked(bookmarkId: string, passphrase?: string): Promise<void> {
    await moveToLocked(bookmarkId, await this.keyFor(passphrase));
    await this.sync();
    await this.refreshLocked();
  }

  /** The open key, or one derived from the passphrase without unlocking the shelf. */
  private async keyFor(passphrase?: string): Promise<CryptoKey> {
    if (this.locked) return this.locked.key;
    const meta = await getLockMeta();
    if (!meta) throw new Error('There is no locked shelf yet.');
    const derived = passphrase ? await unlock(meta, passphrase) : null;
    if (!derived) throw new WrongPassphrase();
    return derived.key;
  }

  /**
   * Saves a pasted page straight onto the locked shelf (F4.7). The page arrives in memory and
   * is encrypted before anything is written, so no plain copy reaches disk.
   */
  async saveLocked(page: LockedPage, passphrase?: string): Promise<SaveLockedResult> {
    const key = await this.keyFor(passphrase);
    const { bookmark, text } = buildBookmark(page);
    if (await findByUrl(bookmark.url)) return { status: 'already-plain' };
    for (const record of await listLockedRecords()) {
      const payload = await decryptRecord(key, record).catch(() => null);
      if (payload?.bookmark.url === bookmark.url) return { status: 'already-locked' };
    }
    const salt = (await getLockMeta())?.fingerprintSalt;
    await getDb().lockedRecords.add(await encryptRecord(key, { bookmark, text }, salt));
    await this.refreshLocked();
    return { status: 'saved' };
  }

  /**
   * Takes a link off the locked shelf into a normal category: it is decrypted and saved as a
   * plain bookmark, and the locked record is deleted. The shelf must be unlocked.
   */
  async moveFromLocked(recordId: string, categoryId: string): Promise<{ bookmarkId: string }> {
    const payload = this.locked?.items.get(recordId);
    if (!payload) throw new Error('Unlock the shelf first.');
    const db = getDb();
    const now = Date.now();
    const bookmarkId = await db.transaction(
      'rw',
      [db.bookmarks, db.texts, db.tombstones, db.lockedRecords, db.categories],
      async () => {
        const target = (await db.categories.get(categoryId)) ? categoryId : UNSORTED_ID;
        const existing = await db.bookmarks.where('url').equals(payload.bookmark.url).first();
        let id: string;
        if (existing) {
          id = existing.id;
          await db.bookmarks.update(id, { categoryId: target, updatedAt: now });
        } else {
          id = (await db.bookmarks.get(payload.bookmark.id)) ? crypto.randomUUID() : payload.bookmark.id;
          await db.bookmarks.add({ ...payload.bookmark, id, categoryId: target, updatedAt: now });
          await db.texts.put({ id, text: payload.text });
          await db.tombstones.delete(id);
        }
        await db.lockedRecords.delete(recordId);
        return id;
      },
    );
    announce('bookmarks');
    announce('locked');
    await this.sync();
    await this.refreshLocked();
    return { bookmarkId };
  }

  async deleteLocked(recordId: string): Promise<{ item: LockedItem; text: string } | null> {
    const payload = this.locked?.items.get(recordId);
    await deleteLockedRecord(recordId);
    await this.refreshLocked();
    return payload ? { item: { recordId, bookmark: payload.bookmark }, text: payload.text } : null;
  }

  async restoreLocked(item: LockedItem, text: string): Promise<void> {
    if (!this.locked) throw new Error('Unlock the shelf first.');
    const salt = (await getLockMeta())?.fingerprintSalt;
    const record = await encryptRecord(this.locked.key, { bookmark: item.bookmark, text }, salt);
    await getDb().lockedRecords.add(record);
    await this.refreshLocked();
  }

  /** Import with a locked part when this library already has a locked shelf (5.6). */
  async importLocked(
    fileJson: string,
    filePassphrase: string,
    currentPassphrase?: string,
  ): Promise<{ added: number; updated: number; skipped: number }> {
    const file = parseExport(fileJson);
    let key = this.locked?.key;
    if (!key) {
      const meta = await getLockMeta();
      if (!meta) throw new Error('There is no locked shelf yet.');
      const current = currentPassphrase ? await unlock(meta, currentPassphrase) : null;
      if (!current) throw new WrongPassphrase();
      key = current.key;
    }
    const counts = await mergeLocked(file, filePassphrase, key);
    await this.refreshLocked();
    return counts;
  }
}
