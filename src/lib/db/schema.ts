import Dexie, { type EntityTable } from 'dexie';

// Data model: ARCHITECTURE.md section 4. Changing a store definition needs a new
// version() with a migration and the owner's approval (AGENTS.md "Ask before").

export const UNSORTED_ID = 'unsorted';
export const READ_LATER_ID = 'read-later';

export type TextStatus = 'ok' | 'unreadable';
export type CategoryKind = 'starter' | 'custom' | 'unsorted';

export interface Bookmark {
  id: string;
  /** Normalized URL (src/lib/url.ts), unique. */
  url: string;
  title: string;
  site: string;
  /** data: URL or empty. Remote favicons are never loaded (no third-party requests). */
  favicon: string;
  savedAt: number;
  updatedAt: number;
  categoryId: string;
  textStatus: TextStatus;
}

/** Page text lives in its own table so shelves load without reading 100 KB per row. */
export interface PageText {
  id: string;
  text: string;
}

/** Left behind by a delete so every search index drops the page (ARCHITECTURE 5.4). */
export interface Tombstone {
  id: string;
  removedAt: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  kind: CategoryKind;
}

/** One encrypted bookmark. Nothing readable is stored outside the ciphertext (F4.2). */
export interface LockedRecord {
  id: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  /** Salted SHA-256 of the address (crypto/fingerprint.ts). Missing on records saved before v2 until the next unlock. */
  fingerprint?: string;
}

export interface KdfParams {
  name: 'argon2id';
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

export interface LockMeta {
  id: 'lock';
  shelfName: string;
  salt: Uint8Array;
  kdf: KdfParams;
  verifierIv: Uint8Array;
  verifier: Uint8Array;
  /** Salt for address fingerprints. Kept across passphrase changes. */
  fingerprintSalt?: Uint8Array;
}

export interface IndexSnapshot {
  kind: 'open';
  data: Uint8Array;
  docCount: number;
  builtAt: number;
  /** Highest bookmark updatedAt / tombstone removedAt already in this snapshot. */
  watermark: number;
  schemaVersion: number;
}

export interface Settings {
  id: 'settings';
  idleMinutes: number;
  lastExportAt: number | null;
  /** Autosave a backup file (off by default). */
  autosave?: boolean;
  /** Folder inside the browser's Downloads folder. */
  autosaveFolder?: string;
  /** A folder the user picked anywhere (Chromium). Used while the browser still allows it. */
  autosaveDir?: FileSystemDirectoryHandle | null;
  /** True when the picked folder needs the user's OK again; backups go to Downloads meanwhile. */
  autosaveDirBlocked?: boolean;
  /** Where the last autosave went, shown in Settings. */
  lastAutosavePath?: string | null;
  lastAutosaveAt?: number | null;
  lastAutosaveError?: string | null;
  /** Last change to links, categories, or the locked shelf; autosave runs only after one. */
  changedAt?: number;
}

/** An autosave kept inside the browser, so a bad change can be undone from Settings. */
export interface StoredBackup {
  id?: number;
  at: number;
  /** Gzipped export JSON (src/lib/backup/format.ts). */
  data: Uint8Array;
  size: number;
}

export class PenyematDB extends Dexie {
  bookmarks!: EntityTable<Bookmark, 'id'>;
  texts!: EntityTable<PageText, 'id'>;
  tombstones!: EntityTable<Tombstone, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  lockedRecords!: EntityTable<LockedRecord, 'id'>;
  lockMeta!: EntityTable<LockMeta, 'id'>;
  indexSnapshots!: EntityTable<IndexSnapshot, 'kind'>;
  settings!: EntityTable<Settings, 'id'>;
  backups!: EntityTable<StoredBackup, 'id'>;

  constructor(name = 'penyemat') {
    super(name);
    this.version(1).stores({
      bookmarks: 'id, &url, categoryId, updatedAt, savedAt',
      texts: 'id',
      tombstones: 'id, removedAt',
      categories: 'id, order',
      lockedRecords: 'id',
      lockMeta: 'id',
      indexSnapshots: 'kind',
      settings: 'id',
    });
    // v2: locked records get an address fingerprint so the toolbar button can see a page is
    // already locked (owner's choice, 2026-11-19). Old records gain theirs on the next unlock.
    this.version(2)
      .stores({ lockedRecords: 'id, fingerprint' })
      .upgrade(async (tx) => {
        await tx
          .table('lockMeta')
          .toCollection()
          .modify((meta: LockMeta) => {
            meta.fingerprintSalt ??= crypto.getRandomValues(new Uint8Array(16));
          });
      });
    // v3: the last autosaves are kept in the browser (owner's choice, 2026-11-19).
    this.version(3).stores({ backups: '++id, at' });
    this.on('populate', (tx) => {
      // Starter set (PRD F3.1, F3.1a): Read later and Unsorted only.
      tx.table('categories').bulkAdd([
        { id: READ_LATER_ID, name: 'Read later', order: 0, kind: 'starter' },
        { id: UNSORTED_ID, name: 'Unsorted', order: Number.MAX_SAFE_INTEGER, kind: 'unsorted' },
      ]);
      tx.table('settings').add({ id: 'settings', idleMinutes: 5, lastExportAt: null });
    });
  }
}

let instance: PenyematDB | null = null;

export function getDb(): PenyematDB {
  instance ??= new PenyematDB();
  return instance;
}

/** Tests use a fresh database per case. */
export function setDb(db: PenyematDB | null): void {
  instance = db;
}
