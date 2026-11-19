import { decryptRecord, encryptRecord, type LockedPayload, unlock, verifyKey } from '../crypto/lock';
import { announce } from '../db/events';
import { type Bookmark, type Category, getDb, type LockedRecord, UNSORTED_ID } from '../db/schema';
import { updateSettings } from '../db/settings';
import { normalizeUrl } from '../url';
import { decodeLocked, EXPORT_FORMAT, EXPORT_VERSION, type ExportFile, encodeLocked } from './format';

export async function buildExport(now = Date.now()): Promise<ExportFile> {
  const db = getDb();
  return db.transaction('r', [db.categories, db.bookmarks, db.texts, db.lockMeta, db.lockedRecords], async () => {
    const [categories, bookmarks, texts, meta, records] = await Promise.all([
      db.categories.toArray(),
      db.bookmarks.toArray(),
      db.texts.toArray(),
      db.lockMeta.get('lock'),
      db.lockedRecords.toArray(),
    ]);
    const textById = new Map(texts.map((t) => [t.id, t.text]));
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: now,
      categories,
      bookmarks: bookmarks.map((b) => ({ ...b, text: textById.get(b.id) ?? '' })),
      locked: meta ? encodeLocked(meta, records) : null,
    } satisfies ExportFile;
  });
}

/** Writes the export and records its date (F5.1, F5.5). */
export async function exportLibrary(): Promise<{ json: string; fileName: string }> {
  const file = await buildExport();
  await updateSettings({ lastExportAt: file.exportedAt });
  const day = new Date(file.exportedAt).toISOString().slice(0, 10);
  return { json: JSON.stringify(file), fileName: `penyemat-${day}.json` };
}

export interface ImportCounts {
  added: number;
  updated: number;
  skipped: number;
  lockedSkipped: boolean;
}

/** Maps file categories onto this library's: same id, else same name, else a new category. */
async function mergeCategories(fileCategories: Category[]): Promise<Map<string, string>> {
  const db = getDb();
  const existing = await db.categories.toArray();
  const byId = new Map(existing.map((c) => [c.id, c]));
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  let nextOrder = existing.filter((c) => c.kind !== 'unsorted').reduce((m, c) => Math.max(m, c.order), -1) + 1;
  const map = new Map<string, string>();
  for (const c of fileCategories) {
    if (c.kind === 'unsorted' || c.id === UNSORTED_ID) {
      map.set(c.id, UNSORTED_ID);
      continue;
    }
    const match = byId.get(c.id) ?? byName.get(c.name.toLowerCase());
    if (match) {
      map.set(c.id, match.id);
      continue;
    }
    const added: Category = {
      id: c.id,
      name: c.name,
      order: nextOrder++,
      kind: c.kind === 'starter' ? 'starter' : 'custom',
    };
    await db.categories.add(added);
    byName.set(added.name.toLowerCase(), added);
    map.set(c.id, added.id);
  }
  return map;
}

/** Imports bookmarks and categories. On a shared address the newer save wins (F5.4). */
export async function importPlain(file: ExportFile): Promise<ImportCounts> {
  const db = getDb();
  const counts: ImportCounts = { added: 0, updated: 0, skipped: 0, lockedSkipped: false };
  await db.transaction('rw', [db.categories, db.bookmarks, db.texts, db.tombstones], async () => {
    const categoryMap = await mergeCategories(file.categories);
    const now = Date.now();
    for (const item of file.bookmarks) {
      const { text, ...rest } = item;
      let url: string;
      try {
        url = normalizeUrl(rest.url);
      } catch {
        counts.skipped++;
        continue;
      }
      const incoming: Bookmark = {
        ...rest,
        url,
        categoryId: categoryMap.get(rest.categoryId) ?? UNSORTED_ID,
        updatedAt: now,
        textStatus: text ? 'ok' : 'unreadable',
      };
      const existing = await db.bookmarks.where('url').equals(url).first();
      if (existing) {
        if (incoming.savedAt > existing.savedAt) {
          await db.bookmarks.put({ ...incoming, id: existing.id });
          await db.texts.put({ id: existing.id, text });
          counts.updated++;
        } else {
          counts.skipped++;
        }
        continue;
      }
      if (await db.bookmarks.get(incoming.id)) incoming.id = crypto.randomUUID();
      await db.bookmarks.add(incoming);
      await db.texts.put({ id: incoming.id, text });
      await db.tombstones.delete(incoming.id);
      counts.added++;
    }
  });
  announce('categories');
  announce('bookmarks');
  return counts;
}

export type LockedImportPlan = 'none' | 'adopt' | 'needs-passphrase';

export async function lockedImportPlan(file: ExportFile): Promise<LockedImportPlan> {
  if (!file.locked) return 'none';
  return (await getDb().lockMeta.get('lock')) ? 'needs-passphrase' : 'adopt';
}

/** This library has no locked shelf: take over the file's as it is (ARCHITECTURE 5.6). */
export async function adoptLocked(file: ExportFile): Promise<number> {
  if (!file.locked) return 0;
  const { meta, records } = decodeLocked(file.locked);
  const db = getDb();
  await db.transaction('rw', db.lockMeta, db.lockedRecords, async () => {
    if (await db.lockMeta.get('lock')) throw new Error('A locked shelf already exists.');
    await db.lockMeta.put(meta);
    await db.lockedRecords.bulkPut(records);
  });
  announce('locked');
  return records.length;
}

export class WrongFilePassphrase extends Error {}

/**
 * Both have a locked shelf: decrypt the file's records with its passphrase, keep the newer
 * copy per address, and re-encrypt with this library's key.
 */
export async function mergeLocked(
  file: ExportFile,
  filePassphrase: string,
  currentKey: CryptoKey,
): Promise<Omit<ImportCounts, 'lockedSkipped'>> {
  const counts = { added: 0, updated: 0, skipped: 0 };
  if (!file.locked) return counts;
  const { meta: fileMeta, records: fileRecords } = decodeLocked(file.locked);
  const fileKey = await unlock(fileMeta, filePassphrase);
  if (!fileKey) throw new WrongFilePassphrase("That passphrase doesn't match this file. Check it and try again.");
  const db = getDb();
  const currentMeta = await db.lockMeta.get('lock');
  if (!currentMeta || !(await verifyKey(currentMeta, currentKey))) throw new Error('Locked shelf is not unlocked.');

  const current = await db.lockedRecords.toArray();
  const byUrl = new Map<string, { record: LockedRecord; payload: LockedPayload }>();
  for (const record of current) {
    const payload = await decryptRecord(currentKey, record);
    byUrl.set(payload.bookmark.url, { record, payload });
  }
  const toPut: LockedRecord[] = [];
  const toDelete: string[] = [];
  for (const record of fileRecords) {
    const payload = await decryptRecord(fileKey.key, record);
    const mine = byUrl.get(payload.bookmark.url);
    if (mine && mine.payload.bookmark.savedAt >= payload.bookmark.savedAt) {
      counts.skipped++;
      continue;
    }
    if (mine) {
      toDelete.push(mine.record.id);
      counts.updated++;
    } else {
      counts.added++;
    }
    toPut.push(
      await encryptRecord(
        currentKey,
        { ...payload, bookmark: { ...payload.bookmark, updatedAt: Date.now() } },
        currentMeta.fingerprintSalt,
      ),
    );
  }
  await db.transaction('rw', db.lockedRecords, async () => {
    await db.lockedRecords.bulkDelete(toDelete);
    await db.lockedRecords.bulkAdd(toPut);
  });
  announce('locked');
  return counts;
}
