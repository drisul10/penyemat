import {
  addCategory,
  CategoryError,
  deleteBookmark,
  renameCategory,
  restoreBookmark,
  setCategory,
  swapCategories,
} from '../../lib/db/bookmarks';
import type { Bookmark } from '../../lib/db/schema';
import type { LockedItem } from '../../lib/search/protocol';
import { cut } from './format';
import { library } from './state.svelte';

// User actions shared by shelves, the category list, and search results.

function problem(error: unknown, fallback: string): string {
  return error instanceof CategoryError ? error.message : fallback;
}

export async function moveLink(bookmark: Bookmark, categoryId: string): Promise<void> {
  const from = bookmark.categoryId;
  await setCategory(bookmark.id, categoryId);
  const name = library.categoryById.get(categoryId)?.name ?? 'Unsorted';
  library.showToast(`Moved to ${name}`, {
    action: { label: 'Undo', run: () => setCategory(bookmark.id, from) },
  });
}

export async function deleteLink(bookmark: Bookmark): Promise<void> {
  const copy = await deleteBookmark(bookmark.id);
  if (!copy) return;
  library.showToast(`Deleted “${cut(bookmark.title)}”`, {
    action: {
      label: 'Undo',
      run: async () => {
        if (!(await restoreBookmark(copy))) {
          library.showToast("Couldn't undo, because you saved this page again. The newer save stays.");
        }
      },
    },
  });
}

export async function deleteLockedLink(item: LockedItem): Promise<void> {
  const client = library.client;
  if (!client) return;
  const copy = await client.ask<{ item: LockedItem; text: string } | null>({
    type: 'locked-delete',
    recordId: item.recordId,
  });
  library.showToast(`Deleted “${cut(item.bookmark.title)}”`, {
    action: copy
      ? {
          label: 'Undo',
          run: async () => {
            try {
              await client.ask({ type: 'locked-restore', item: copy.item, text: copy.text });
            } catch {
              library.showToast("Couldn't undo because the shelf locked. Unlock it and save the page again.");
            }
          },
        }
      : undefined,
  });
}

/** Opens the Move to Locked dialog, or points to Settings when there is no locked shelf yet. */
export function askMoveToLocked(bookmark: Bookmark): void {
  if (library.lock.state === 'none') {
    library.showToast('Set up a locked shelf first.', {
      action: {
        label: 'Open settings',
        run: () => {
          location.hash = '#/settings';
        },
      },
    });
    return;
  }
  library.movingToLocked = bookmark;
}

/** Takes a link off the locked shelf into a category. Undo puts it back while the shelf is open. */
export async function moveFromLocked(item: LockedItem, categoryId: string): Promise<void> {
  const client = library.client;
  if (!client) return;
  try {
    const { bookmarkId } = await client.ask<{ bookmarkId: string }>({
      type: 'move-from-locked',
      recordId: item.recordId,
      categoryId,
    });
    const name = library.categoryById.get(categoryId)?.name ?? 'Unsorted';
    library.showToast(`Moved “${cut(item.bookmark.title)}” to ${name}`, {
      action: {
        label: 'Undo',
        run: async () => {
          try {
            await client.ask({ type: 'move-to-locked', bookmarkId });
          } catch {
            library.showToast("Couldn't undo because the shelf locked. Use Move to Locked in its ⋯ menu.");
          }
        },
      },
    });
  } catch {
    library.showToast("Couldn't move the link. Unlock the shelf and try again.");
  }
}

export async function newCategory(name: string): Promise<{ id: string } | string> {
  try {
    return await addCategory(name);
  } catch (error) {
    return problem(error, "Couldn't add the category. Try again.");
  }
}

export async function rename(id: string, name: string): Promise<string | null> {
  try {
    await renameCategory(id, name);
    return null;
  } catch (error) {
    return problem(error, "Couldn't rename the category. Try again.");
  }
}

/**
 * Moves a category up or down among the ones shown next to it: shelves among shelves,
 * empty categories among empty categories. Hidden neighbours don't count.
 */
export async function reorder(id: string, direction: -1 | 1, shown: string[]): Promise<void> {
  const neighbour = shown[shown.indexOf(id) + direction];
  if (neighbour) await swapCategories(id, neighbour);
}
