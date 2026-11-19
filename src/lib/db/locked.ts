import { fingerprint } from '../crypto/fingerprint';
import { encryptRecord, type LockedPayload } from '../crypto/lock';
import { normalizeUrl } from '../url';
import { announce } from './events';
import { getDb, type LockedRecord, type LockMeta } from './schema';

export async function getLockMeta(): Promise<LockMeta | undefined> {
  return getDb().lockMeta.get('lock');
}

export async function createLockedShelf(meta: LockMeta): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.lockMeta, async () => {
    if (await db.lockMeta.get('lock')) throw new Error('A locked shelf already exists.');
    await db.lockMeta.put(meta);
  });
  announce('locked');
}

/** True when the address is on the locked shelf, checked by fingerprint without the key. */
export async function isLockedUrl(url: string): Promise<boolean> {
  const db = getDb();
  const meta = await db.lockMeta.get('lock');
  if (!meta?.fingerprintSalt) return false;
  const print = await fingerprint(meta.fingerprintSalt, url);
  return (await db.lockedRecords.where('fingerprint').equals(print).count()) > 0;
}

export async function listLockedRecords(): Promise<LockedRecord[]> {
  return getDb().lockedRecords.toArray();
}

export async function addLockedRecord(record: LockedRecord): Promise<void> {
  await getDb().lockedRecords.add(record);
  announce('locked');
}

export async function deleteLockedRecord(id: string): Promise<void> {
  await getDb().lockedRecords.delete(id);
  announce('locked');
}

/**
 * Moves an already-saved page onto the locked shelf (F4.7, popup Locked chip).
 * Encryption runs first; the plain row is deleted in the same transaction that adds the record.
 */
export async function moveToLocked(bookmarkId: string, key: CryptoKey): Promise<LockedPayload | null> {
  const db = getDb();
  const bookmark = await db.bookmarks.get(bookmarkId);
  if (!bookmark) return null;
  const text = (await db.texts.get(bookmarkId))?.text ?? '';
  const payload: LockedPayload = { bookmark: { ...bookmark, updatedAt: Date.now() }, text };
  const meta = await db.lockMeta.get('lock');
  const record = await encryptRecord(key, payload, meta?.fingerprintSalt);
  await db.transaction('rw', [db.bookmarks, db.texts, db.tombstones, db.lockedRecords], async () => {
    await db.lockedRecords.add(record);
    await db.bookmarks.delete(bookmarkId);
    await db.texts.delete(bookmarkId);
    await db.tombstones.put({ id: bookmarkId, removedAt: Date.now() });
  });
  announce('bookmarks');
  announce('locked');
  return payload;
}

/** Replaces the lock and every record at once, so a failure keeps the old passphrase working (F4.9). */
export async function replaceLock(meta: LockMeta, records: LockedRecord[]): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.lockMeta, db.lockedRecords, async () => {
    await db.lockedRecords.clear();
    await db.lockedRecords.bulkAdd(records);
    await db.lockMeta.put(meta);
  });
  announce('locked');
}

export function sameUrl(a: string, b: string): boolean {
  try {
    return normalizeUrl(a) === normalizeUrl(b);
  } catch {
    return a === b;
  }
}
