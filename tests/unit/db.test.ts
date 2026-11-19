import { beforeEach, describe, expect, it } from 'vitest';
import { createLock, decryptRecord } from '../../src/lib/crypto/lock';
import {
  addCategory,
  deleteBookmark,
  deleteCategory,
  listCategories,
  moveCategory,
  renameCategory,
  restoreBookmark,
  savePage,
  setCategory,
} from '../../src/lib/db/bookmarks';
import { moveToLocked } from '../../src/lib/db/locked';
import type { PenyematDB } from '../../src/lib/db/schema';
import { clampIdle, getSettings } from '../../src/lib/db/settings';
import { FAST_KDF, freshDb } from './helpers';

let db: PenyematDB;
beforeEach(async () => {
  db = await freshDb();
});

const page = (url: string, title = 'A page', text = 'some body text') => ({ url, title, text });

describe('saving (F1)', () => {
  it('saves once; a second save of the same address returns "already" (F1.3)', async () => {
    const first = await savePage(page('https://example.com/a?utm_source=x'));
    const second = await savePage(page('https://EXAMPLE.com/a#part'));
    expect(first.status).toBe('saved');
    expect(second.status).toBe('already');
    expect(second.bookmark.id).toBe(first.bookmark.id);
    expect(await db.bookmarks.count()).toBe(1);
  });
  it('marks empty text unreadable but still saves (F1.5)', async () => {
    const result = await savePage(page('https://example.com/login', 'Members only', ''));
    expect(result.bookmark.textStatus).toBe('unreadable');
  });
  it('defaults to Unsorted when no category is picked (F3.1a)', async () => {
    const result = await savePage(page('https://example.com/b'));
    expect(result.bookmark.categoryId).toBe('unsorted');
  });
});

describe('categories (F3)', () => {
  it('starts with Read later and Unsorted, Unsorted last (F3.1)', async () => {
    const names = (await listCategories()).map((c) => c.name);
    expect(names).toEqual(['Read later', 'Unsorted']);
    expect((await getSettings()).idleMinutes).toBe(5);
  });
  it('adds, renames, reorders; Unsorted stays last and fixed', async () => {
    const recipes = await addCategory('Recipes');
    await addCategory('Travel');
    await moveCategory(recipes.id, -1);
    await renameCategory(recipes.id, 'Food');
    expect((await listCategories()).map((c) => c.name)).toEqual(['Food', 'Read later', 'Travel', 'Unsorted']);
    await expect(renameCategory('unsorted', 'Misc')).rejects.toThrow();
    await expect(deleteCategory('unsorted')).rejects.toThrow();
    await expect(addCategory('food')).rejects.toThrow(/already/);
  });
  it('deleting a category moves its links to Unsorted and reports the count (F3.5)', async () => {
    const travel = await addCategory('Travel');
    const a = await savePage(page('https://example.com/1'));
    const b = await savePage(page('https://example.com/2'));
    await setCategory(a.bookmark.id, travel.id);
    await setCategory(b.bookmark.id, travel.id);
    expect(await deleteCategory(travel.id)).toBe(2);
    expect((await db.bookmarks.get(a.bookmark.id))?.categoryId).toBe('unsorted');
  });
});

describe('delete and undo (F3.5)', () => {
  it('deletes a link, leaves a tombstone, and Undo puts it back', async () => {
    const saved = await savePage(page('https://example.com/soup', 'Soup', 'tomato'));
    const copy = await deleteBookmark(saved.bookmark.id);
    expect(await db.bookmarks.count()).toBe(0);
    expect(await db.tombstones.get(saved.bookmark.id)).toBeTruthy();
    expect(copy).not.toBeNull();
    if (!copy) return;
    expect(await restoreBookmark(copy)).toBe(true);
    expect((await db.bookmarks.get(saved.bookmark.id))?.title).toBe('Soup');
    expect((await db.texts.get(saved.bookmark.id))?.text).toBe('tomato');
    expect(await db.tombstones.get(saved.bookmark.id)).toBeUndefined();
  });
});

describe('move to locked (F4.7)', () => {
  it('encrypts the page and deletes the plain row in one step', async () => {
    const { unlocked } = await createLock('correct horse', 'Locked', FAST_KDF);
    const saved = await savePage(page('https://homes.example.com/river', 'River flat', 'two bedrooms'));
    await moveToLocked(saved.bookmark.id, unlocked.key);
    expect(await db.bookmarks.count()).toBe(0);
    expect(await db.texts.count()).toBe(0);
    const [record] = await db.lockedRecords.toArray();
    expect(record).toBeTruthy();
    if (!record) return;
    expect((await decryptRecord(unlocked.key, record)).text).toBe('two bedrooms');
  });
});

describe('settings (F4.6)', () => {
  it('keeps idle time within 1 to 60 minutes', () => {
    expect(clampIdle(0)).toBe(1);
    expect(clampIdle(90)).toBe(60);
    expect(clampIdle(7.4)).toBe(7);
  });
});
