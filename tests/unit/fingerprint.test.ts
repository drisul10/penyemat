import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLock, encryptRecord, rekey } from '../../src/lib/crypto/lock';
import type { LockMessage } from '../../src/lib/crypto/share';
import { savePage } from '../../src/lib/db/bookmarks';
import { createLockedShelf, isLockedUrl, moveToLocked } from '../../src/lib/db/locked';
import { type PenyematDB as DB, PenyematDB, setDb } from '../../src/lib/db/schema';
import { SearchService } from '../../src/lib/search/service';
import { FAST_KDF, freshDb } from './helpers';

let db: DB;
beforeEach(async () => {
  db = await freshDb();
});

const quiet = () => new SearchService({ emit: () => {}, broadcast: (_m: LockMessage) => {} });

describe('locked address fingerprints (toolbar duplicate check)', () => {
  it('recognises a moved page by address without the key, and nothing else', async () => {
    const { meta, unlocked } = await createLock('correct horse', 'Locked', FAST_KDF);
    await createLockedShelf(meta);
    const saved = await savePage({ url: 'https://homes.example.com/river?utm_source=x', title: 'River', text: 'x' });
    await moveToLocked(saved.bookmark.id, unlocked.key);
    expect(await isLockedUrl('https://HOMES.example.com/river#top')).toBe(true);
    expect(await isLockedUrl('https://homes.example.com/hill')).toBe(false);
    const [record] = await db.lockedRecords.toArray();
    expect(record?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fills in missing fingerprints when the shelf unlocks', async () => {
    const service = quiet();
    await service.init();
    await service.setup('correct horse', 'Locked');
    const meta = await db.lockMeta.get('lock');
    const key = (await import('../../src/lib/crypto/lock')).unlock;
    const open = meta ? await key(meta, 'correct horse') : null;
    if (!open) throw new Error('unlock failed');
    const bookmark = {
      id: 'old',
      url: 'https://party.example.com/plan',
      title: 'Party',
      site: 'party.example.com',
      favicon: '',
      savedAt: 1,
      updatedAt: 1,
      categoryId: 'unsorted',
      textStatus: 'ok' as const,
    };
    await db.lockedRecords.add(await encryptRecord(open.key, { bookmark, text: '' })); // no salt: an old record
    expect(await isLockedUrl(bookmark.url)).toBe(false);
    await service.lock();
    await service.unlock('correct horse');
    expect(await isLockedUrl(bookmark.url)).toBe(true);
  });

  it('keeps fingerprints valid across a passphrase change', async () => {
    const first = await createLock('old passphrase', 'Locked', FAST_KDF);
    const bookmark = {
      id: 'b',
      url: 'https://homes.example.com/river',
      title: 'River',
      site: 'homes.example.com',
      favicon: '',
      savedAt: 1,
      updatedAt: 1,
      categoryId: 'unsorted',
      textStatus: 'ok' as const,
    };
    const record = await encryptRecord(first.unlocked.key, { bookmark, text: '' }, first.meta.fingerprintSalt);
    const next = await rekey(first.meta, first.unlocked.key, [record], 'new passphrase');
    expect(next.meta.fingerprintSalt).toEqual(first.meta.fingerprintSalt);
    expect(next.records[0]?.fingerprint).toBe(record.fingerprint);
  });

  it('migrates a v1 library: the lock gains a fingerprint salt', async () => {
    const name = `migrate-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      bookmarks: 'id, &url, categoryId, updatedAt, savedAt',
      texts: 'id',
      tombstones: 'id, removedAt',
      categories: 'id, order',
      lockedRecords: 'id',
      lockMeta: 'id',
      indexSnapshots: 'kind',
      settings: 'id',
    });
    const { meta } = await createLock('correct horse', 'Locked', FAST_KDF);
    const { fingerprintSalt: _drop, ...oldMeta } = meta;
    await v1.table('lockMeta').put(oldMeta);
    v1.close();
    const upgraded = new PenyematDB(name);
    await upgraded.open();
    setDb(upgraded);
    expect((await upgraded.lockMeta.get('lock'))?.fingerprintSalt?.length).toBe(16);
    expect(await isLockedUrl('https://homes.example.com/river')).toBe(false);
  });
});
