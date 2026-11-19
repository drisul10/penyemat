import { normalizeUrl, siteOf } from '../url';
import { announce } from './events';
import { type Bookmark, type Category, getDb, READ_LATER_ID, UNSORTED_ID } from './schema';

export interface NewPage {
  url: string;
  title: string;
  text: string;
  favicon?: string;
  categoryId?: string;
}

export type SaveResult = { status: 'saved'; bookmark: Bookmark } | { status: 'already'; bookmark: Bookmark };

export function newId(): string {
  return crypto.randomUUID();
}

export async function findByUrl(rawUrl: string): Promise<Bookmark | undefined> {
  return getDb().bookmarks.where('url').equals(normalizeUrl(rawUrl)).first();
}

/** Builds the bookmark record for a page. Shared by the plain save and Save to Locked. */
export function buildBookmark(page: NewPage, now = Date.now()): { bookmark: Bookmark; text: string } {
  const url = normalizeUrl(page.url);
  const text = page.text.trim();
  return {
    bookmark: {
      id: newId(),
      url,
      title: page.title.trim() || siteOf(url),
      site: siteOf(url),
      favicon: page.favicon ?? '',
      savedAt: now,
      updatedAt: now,
      categoryId: page.categoryId ?? UNSORTED_ID,
      textStatus: text ? 'ok' : 'unreadable',
    },
    text,
  };
}

/** Saves a page once. Saving the same address again returns the existing record (F1.3). */
export async function savePage(page: NewPage): Promise<SaveResult> {
  const db = getDb();
  const { bookmark, text } = buildBookmark(page);
  const result = await db.transaction('rw', db.bookmarks, db.texts, async () => {
    const existing = await db.bookmarks.where('url').equals(bookmark.url).first();
    if (existing) return { status: 'already', bookmark: existing } as const;
    await db.bookmarks.add(bookmark);
    await db.texts.put({ id: bookmark.id, text });
    return { status: 'saved', bookmark } as const;
  });
  if (result.status === 'saved') announce('bookmarks');
  return result;
}

export async function setCategory(id: string, categoryId: string): Promise<void> {
  const db = getDb();
  await db.bookmarks.update(id, { categoryId, updatedAt: Date.now() });
  announce('bookmarks');
}

export interface DeletedCopy {
  bookmark: Bookmark;
  text: string;
}

/** Deletes a link and keeps a copy in memory for Undo (F3.5). */
export async function deleteBookmark(id: string): Promise<DeletedCopy | null> {
  const db = getDb();
  const copy = await db.transaction('rw', db.bookmarks, db.texts, db.tombstones, async () => {
    const bookmark = await db.bookmarks.get(id);
    if (!bookmark) return null;
    const text = (await db.texts.get(id))?.text ?? '';
    await db.bookmarks.delete(id);
    await db.texts.delete(id);
    await db.tombstones.put({ id, removedAt: Date.now() });
    return { bookmark, text };
  });
  announce('bookmarks');
  return copy;
}

/** Puts a deleted link back where it was. A newer save of the same address wins. */
export async function restoreBookmark(copy: DeletedCopy): Promise<boolean> {
  const db = getDb();
  const restored = await db.transaction('rw', [db.bookmarks, db.texts, db.tombstones, db.categories], async () => {
    const clash = await db.bookmarks.where('url').equals(copy.bookmark.url).first();
    if (clash) return false;
    const category = await db.categories.get(copy.bookmark.categoryId);
    await db.bookmarks.put({
      ...copy.bookmark,
      categoryId: category ? copy.bookmark.categoryId : UNSORTED_ID,
      updatedAt: Date.now(),
    });
    await db.texts.put({ id: copy.bookmark.id, text: copy.text });
    await db.tombstones.delete(copy.bookmark.id);
    return true;
  });
  announce('bookmarks');
  return restored;
}

export async function listBookmarks(): Promise<Bookmark[]> {
  return getDb().bookmarks.orderBy('savedAt').reverse().toArray();
}

export async function getText(id: string): Promise<string> {
  return (await getDb().texts.get(id))?.text ?? '';
}

// ---- Categories (F3) ----

export async function listCategories(): Promise<Category[]> {
  const all = await getDb().categories.orderBy('order').toArray();
  return sortCategories(all);
}

/** User order, with Unsorted always last (F3.1a). */
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    if (a.kind === 'unsorted') return 1;
    if (b.kind === 'unsorted') return -1;
    return a.order - b.order;
  });
}

export class CategoryError extends Error {}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new CategoryError('Give the category a name.');
  if (trimmed.length > 40) throw new CategoryError('Keep the name to 40 characters or fewer.');
  return trimmed;
}

async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const all = await getDb().categories.toArray();
  const lower = name.toLowerCase();
  if (all.some((c) => c.id !== exceptId && c.name.toLowerCase() === lower)) {
    throw new CategoryError(`There is already a category called "${name}".`);
  }
}

export async function addCategory(name: string): Promise<Category> {
  const db = getDb();
  const clean = cleanName(name);
  await assertUniqueName(clean);
  const others = (await db.categories.toArray()).filter((c) => c.kind !== 'unsorted');
  const order = others.reduce((max, c) => Math.max(max, c.order), -1) + 1;
  const category: Category = { id: newId(), name: clean, order, kind: 'custom' };
  await db.categories.add(category);
  announce('categories');
  return category;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const db = getDb();
  const category = await db.categories.get(id);
  if (!category || category.kind === 'unsorted') throw new CategoryError("Unsorted can't be renamed.");
  const clean = cleanName(name);
  await assertUniqueName(clean, id);
  await db.categories.update(id, { name: clean });
  announce('categories');
}

/** Swaps a category with its neighbour. Unsorted never moves. */
export async function moveCategory(id: string, direction: -1 | 1): Promise<void> {
  const db = getDb();
  const ordered = (await listCategories()).filter((c) => c.kind !== 'unsorted');
  const index = ordered.findIndex((c) => c.id === id);
  const target = ordered[index + direction];
  const current = ordered[index];
  if (!current || !target) return;
  await db.transaction('rw', db.categories, async () => {
    await db.categories.update(current.id, { order: target.order });
    await db.categories.update(target.id, { order: current.order });
  });
  announce('categories');
}

/** Swaps the order of two categories. Unsorted never moves. */
export async function swapCategories(aId: string, bId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.categories, async () => {
    const [a, b] = await Promise.all([db.categories.get(aId), db.categories.get(bId)]);
    if (!a || !b || a.kind === 'unsorted' || b.kind === 'unsorted') return;
    await db.categories.update(a.id, { order: b.order });
    await db.categories.update(b.id, { order: a.order });
  });
  announce('categories');
}

export async function countInCategory(id: string): Promise<number> {
  return getDb().bookmarks.where('categoryId').equals(id).count();
}

/** Deletes a category and moves its links to Unsorted (F3.5). Returns how many moved. */
export async function deleteCategory(id: string): Promise<number> {
  const db = getDb();
  const category = await db.categories.get(id);
  if (!category || category.kind === 'unsorted') throw new CategoryError("Unsorted can't be deleted.");
  const moved = await db.transaction('rw', db.categories, db.bookmarks, async () => {
    const now = Date.now();
    const count = await db.bookmarks.where('categoryId').equals(id).modify({ categoryId: UNSORTED_ID, updatedAt: now });
    await db.categories.delete(id);
    return count;
  });
  announce('categories');
  announce('bookmarks');
  return moved;
}

export { READ_LATER_ID, UNSORTED_ID };
