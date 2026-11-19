import { beforeEach, describe, expect, it } from 'vitest';
import {
  adoptLocked,
  buildExport,
  exportLibrary,
  importPlain,
  lockedImportPlan,
  mergeLocked,
} from '../../src/lib/backup/backup';
import { parseExport } from '../../src/lib/backup/format';
import { createLock, decryptRecord, encryptRecord } from '../../src/lib/crypto/lock';
import { addCategory, savePage, setCategory } from '../../src/lib/db/bookmarks';
import { createLockedShelf } from '../../src/lib/db/locked';
import type { Bookmark } from '../../src/lib/db/schema';
import { getSettings } from '../../src/lib/db/settings';
import { FAST_KDF, freshDb } from './helpers';

const lockedBookmark = (url: string, savedAt: number): Bookmark => ({
  id: crypto.randomUUID(),
  url,
  title: 'Surprise party checklist',
  site: 'party.example.com',
  favicon: '',
  savedAt,
  updatedAt: savedAt,
  categoryId: 'unsorted',
  textStatus: 'ok',
});

beforeEach(async () => {
  await freshDb();
});

describe('export (F5.1, F5.2, F5.5)', () => {
  it('writes bookmarks with text and categories, keeps locked data encrypted, records the date', async () => {
    const recipes = await addCategory('Recipes');
    const saved = await savePage({ url: 'https://recipes.example.com/a', title: 'Pasta', text: 'lemon zest' });
    await setCategory(saved.bookmark.id, recipes.id);
    const { meta, unlocked } = await createLock('correct horse', 'Locked', FAST_KDF);
    await createLockedShelf(meta);
    const db = (await import('../../src/lib/db/schema')).getDb();
    await db.lockedRecords.add(
      await encryptRecord(unlocked.key, {
        bookmark: lockedBookmark('https://party.example.com/x', 1),
        text: 'balloons',
      }),
    );
    const { json } = await exportLibrary();
    expect(json).toContain('lemon zest');
    expect(json).not.toContain('party.example.com');
    expect(json).not.toContain('balloons');
    expect((await getSettings()).lastExportAt).not.toBeNull();
    const parsed = parseExport(json);
    expect(parsed.categories.map((c) => c.name)).toContain('Recipes');
  });

  it('rejects files that are not Penyemat exports', () => {
    expect(() => parseExport('{"hello":1}')).toThrow(/isn't a Penyemat export/);
    expect(() => parseExport('not json')).toThrow();
  });
});

describe('import (F5.3, F5.4)', () => {
  it('restores everything into a fresh library', async () => {
    const travel = await addCategory('Travel');
    const saved = await savePage({ url: 'https://travel.example.com/lisbon', title: 'Lisbon', text: 'walking plan' });
    await setCategory(saved.bookmark.id, travel.id);
    const file = await buildExport();

    const db = await freshDb();
    const counts = await importPlain(file);
    expect(counts).toEqual({ added: 1, updated: 0, skipped: 0, lockedSkipped: false });
    const [restored] = await db.bookmarks.toArray();
    expect(restored?.title).toBe('Lisbon');
    expect((await db.categories.get(restored?.categoryId ?? ''))?.name).toBe('Travel');
    expect((await db.texts.get(restored?.id ?? ''))?.text).toBe('walking plan');
  });

  it('keeps the newer copy of a shared address and counts added, updated, skipped', async () => {
    const file = await buildExport();
    const base = { favicon: '', categoryId: 'unsorted', textStatus: 'ok' as const, updatedAt: 0 };
    await savePage({ url: 'https://example.com/older-here', title: 'Mine old', text: 'x' });
    await savePage({ url: 'https://example.com/newer-here', title: 'Mine new', text: 'x' });
    const now = Date.now();
    file.bookmarks = [
      {
        ...base,
        id: 'f1',
        url: 'https://example.com/older-here',
        title: 'File newer',
        site: 'example.com',
        savedAt: now + 10_000,
        text: 'new',
      },
      {
        ...base,
        id: 'f2',
        url: 'https://example.com/newer-here',
        title: 'File older',
        site: 'example.com',
        savedAt: 1,
        text: 'old',
      },
      {
        ...base,
        id: 'f3',
        url: 'https://example.com/fresh',
        title: 'Fresh',
        site: 'example.com',
        savedAt: 5,
        text: 'f',
      },
    ];
    expect(await importPlain(file)).toEqual({ added: 1, updated: 1, skipped: 1, lockedSkipped: false });
  });

  it('adopts the file locked shelf when this library has none', async () => {
    const { meta, unlocked } = await createLock('file passphrase', 'Private', FAST_KDF);
    await createLockedShelf(meta);
    const db = (await import('../../src/lib/db/schema')).getDb();
    await db.lockedRecords.add(
      await encryptRecord(unlocked.key, { bookmark: lockedBookmark('https://party.example.com/x', 1), text: '' }),
    );
    const file = await buildExport();
    const fresh = await freshDb();
    expect(await lockedImportPlan(file)).toBe('adopt');
    expect(await adoptLocked(file)).toBe(1);
    expect((await fresh.lockMeta.get('lock'))?.shelfName).toBe('Private');
  });

  it('merges a file locked shelf into an existing one under the current key', async () => {
    const fileLock = await createLock('file passphrase', 'Locked', FAST_KDF);
    await createLockedShelf(fileLock.meta);
    const db1 = (await import('../../src/lib/db/schema')).getDb();
    await db1.lockedRecords.bulkAdd([
      await encryptRecord(fileLock.unlocked.key, {
        bookmark: lockedBookmark('https://party.example.com/a', 10),
        text: '',
      }),
      await encryptRecord(fileLock.unlocked.key, {
        bookmark: lockedBookmark('https://party.example.com/b', 10),
        text: '',
      }),
    ]);
    const file = await buildExport();

    const db = await freshDb();
    const mine = await createLock('my passphrase', 'Locked', FAST_KDF);
    await createLockedShelf(mine.meta);
    await db.lockedRecords.add(
      await encryptRecord(mine.unlocked.key, { bookmark: lockedBookmark('https://party.example.com/a', 99), text: '' }),
    );
    expect(await lockedImportPlan(file)).toBe('needs-passphrase');
    await expect(mergeLocked(file, 'wrong passphrase', mine.unlocked.key)).rejects.toThrow(/doesn't match/);
    expect(await mergeLocked(file, 'file passphrase', mine.unlocked.key)).toEqual({ added: 1, updated: 0, skipped: 1 });
    const records = await db.lockedRecords.toArray();
    expect(records).toHaveLength(2);
    for (const r of records) await expect(decryptRecord(mine.unlocked.key, r)).resolves.toBeTruthy();
  });
});
