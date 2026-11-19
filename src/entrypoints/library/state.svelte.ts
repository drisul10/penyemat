import { listBookmarks, listCategories } from '../../lib/db/bookmarks';
import { onDataChange } from '../../lib/db/events';
import type { Bookmark, Category, Settings } from '../../lib/db/schema';
import { getSettings } from '../../lib/db/settings';
import type { LockedItem, LockState, ResultHit } from '../../lib/search/protocol';
import { words } from '../../lib/search/tokenize';
import { SearchClient } from './search-client';

// Library page state. Shelves come straight from IndexedDB; search goes through the worker.

export interface ShelfView {
  category: Category;
  items: Bookmark[];
}

export interface Toast {
  id: number;
  message: string;
  detail?: string;
  action?: { label: string; run: () => void | Promise<void> };
}

/** A shelf whose name matches the query, shown above the page results. */
export interface ShelfMatch {
  id: string;
  name: string;
  /** Null for the locked shelf while it is locked: its count is not shown (F4.1). */
  count: number | null;
}

export interface PageRow {
  hit: ResultHit;
  bookmark: Bookmark;
  locked: boolean;
}

export type SearchRow = ({ kind: 'shelf' } & ShelfMatch) | ({ kind: 'page' } & PageRow);

/** Every typed word starts a word of the name, or sits inside one (3+ letters). */
function nameMatches(name: string, typed: string[]): boolean {
  const nameWords = words(name);
  return typed.every((w) => nameWords.some((n) => n.startsWith(w) || (w.length >= 3 && n.includes(w))));
}

export type Route = { name: 'library' } | { name: 'settings' } | { name: 'shelf'; id: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '/settings') return { name: 'settings' };
  const shelf = path.match(/^\/shelf\/(.+)$/);
  if (shelf?.[1]) return { name: 'shelf', id: decodeURIComponent(shelf[1]) };
  return { name: 'library' };
}

const SEARCH_DEBOUNCE_MS = 150;
const SLOW_SEARCH_MS = 1_000;
const TOAST_MS = 10_000;

class LibraryState {
  bookmarks = $state<Bookmark[]>([]);
  categories = $state<Category[]>([]);
  settings = $state<Settings>({ id: 'settings', idleMinutes: 5, lastExportAt: null });
  load = $state<'loading' | 'ready' | 'error'>('loading');
  slowLoad = $state(false);
  lock = $state<LockState>({ state: 'none' });
  route = $state<Route>(parseRoute(location.hash));

  searchReady = $state(false);
  searchBuilding = $state<{ done: number; total: number } | null>(null);
  searchFailed = $state(false);

  query = $state('');
  /** Category id (or "locked") the page results are narrowed to; null shows all. */
  filter = $state<string | null>(null);
  results = $state<ResultHit[] | null>(null);
  resultsQuery = $state('');
  searching = $state(false);
  slowSearch = $state(false);

  toast = $state<Toast | null>(null);
  /** The link waiting in the Move to Locked dialog. */
  movingToLocked = $state<Bookmark | null>(null);
  /** Ids present at first load. Cards not in it fold in when they appear. */
  seenAtStart = new Set<string>();
  private loadedOnce = false;

  client: SearchClient | null = null;
  private latestSearch = 0;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private nextToast = 1;

  byId = $derived(new Map(this.bookmarks.map((b) => [b.id, b])));
  lockedById = $derived(
    new Map(this.lock.state === 'unlocked' ? this.lock.items.map((i) => [i.recordId, i] as const) : []),
  );
  categoryById = $derived(new Map(this.categories.map((c) => [c.id, c])));

  shelves = $derived.by<ShelfView[]>(() => {
    const groups = new Map<string, Bookmark[]>();
    for (const b of this.bookmarks) {
      const list = groups.get(b.categoryId);
      if (list) list.push(b);
      else groups.set(b.categoryId, [b]);
    }
    const unsorted = this.categories.find((c) => c.kind === 'unsorted');
    return this.categories.map((category) => {
      // Links whose category is gone show on Unsorted.
      let items = groups.get(category.id) ?? [];
      if (category === unsorted) {
        const orphans = this.bookmarks.filter((b) => !this.categoryById.has(b.categoryId));
        if (orphans.length) items = [...items, ...orphans].sort((a, b) => b.savedAt - a.savedAt);
      }
      return { category, items };
    });
  });

  start() {
    window.addEventListener('hashchange', () => {
      this.route = parseRoute(location.hash);
    });
    onDataChange((event) => {
      if (event.scope !== 'locked') this.scheduleReload();
    });
    this.client = new SearchClient({
      onStatus: (ready, building, failed) => {
        this.searchReady = ready;
        this.searchBuilding = building;
        this.searchFailed = Boolean(failed);
      },
      onResults: (id, query, hits) => {
        if (id !== this.latestSearch) return;
        this.results = hits;
        this.resultsQuery = query;
        this.searching = false;
        this.slowSearch = false;
        if (this.slowTimer) clearTimeout(this.slowTimer);
      },
      onLockState: (lock) => {
        this.lock = lock;
      },
    });
    void navigator.storage?.persist?.().catch(() => {});
    void this.reload();
  }

  private scheduleReload() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => void this.reload(), 80);
  }

  async reload() {
    const slow = this.loadedOnce ? null : setTimeout(() => (this.slowLoad = true), 300);
    try {
      const [bookmarks, categories, settings] = await Promise.all([listBookmarks(), listCategories(), getSettings()]);
      this.bookmarks = bookmarks;
      this.categories = categories;
      this.settings = settings;
      if (!this.loadedOnce) for (const b of bookmarks) this.seenAtStart.add(b.id);
      this.loadedOnce = true;
      this.load = 'ready';
    } catch {
      if (!this.loadedOnce) this.load = 'error';
    } finally {
      if (slow) clearTimeout(slow);
      this.slowLoad = false;
    }
    // Results may point at links that just moved or went away.
    if (this.query.trim()) this.runSearch();
  }

  retryLoad() {
    this.load = 'loading';
    void this.reload();
  }

  // ---- Search ----

  setQuery(value: string) {
    this.query = value;
    this.filter = null;
    if (this.debounce) clearTimeout(this.debounce);
    if (!value.trim()) {
      this.clearSearch();
      return;
    }
    this.debounce = setTimeout(() => this.runSearch(), SEARCH_DEBOUNCE_MS);
  }

  runSearch() {
    if (!this.client || !this.query.trim()) return;
    this.searchFailed = false;
    this.searching = true;
    this.latestSearch = this.client.search(this.query.trim());
    if (this.slowTimer) clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => {
      if (this.searching) this.slowSearch = true;
    }, SLOW_SEARCH_MS);
  }

  clearSearch() {
    if (this.debounce) clearTimeout(this.debounce);
    if (this.slowTimer) clearTimeout(this.slowTimer);
    this.query = '';
    this.filter = null;
    this.results = null;
    this.resultsQuery = '';
    this.searching = false;
    this.slowSearch = false;
    this.latestSearch = 0;
  }

  retrySearch() {
    this.searchFailed = false;
    this.client?.restart();
    this.runSearch();
  }

  /** Joins worker hits with what the page knows, dropping links that no longer exist. */
  resolvedResults = $derived.by(() => {
    if (!this.results) return null;
    const rows: PageRow[] = [];
    for (const hit of this.results) {
      if (hit.locked) {
        const item = this.lockedById.get(hit.id);
        if (item) rows.push({ hit, bookmark: item.bookmark, locked: true });
      } else {
        const bookmark = this.byId.get(hit.id);
        if (bookmark) rows.push({ hit, bookmark, locked: false });
      }
    }
    return rows;
  });

  /** Shelves whose names match the query: typing "recip" offers the Recipes shelf. */
  shelfMatches = $derived.by<ShelfMatch[]>(() => {
    const typed = words(this.query);
    if (!typed.length) return [];
    const matches: ShelfMatch[] = this.shelves
      .filter((s) => nameMatches(s.category.name, typed))
      .map((s) => ({ id: s.category.id, name: s.category.name, count: s.items.length }));
    if (this.lock.state !== 'none' && nameMatches(this.lock.shelfName, typed)) {
      matches.push({
        id: 'locked',
        name: this.lock.shelfName,
        count: this.lock.state === 'unlocked' ? this.lock.items.length : null,
      });
    }
    return matches;
  });

  /** Categories present in the page results, with counts, for the filter chips. */
  facets = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const row of this.resolvedResults ?? []) {
      const key = row.locked
        ? 'locked'
        : this.categoryById.has(row.bookmark.categoryId)
          ? row.bookmark.categoryId
          : 'unsorted';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const name = (key: string) =>
      key === 'locked'
        ? this.lock.state === 'none'
          ? 'Locked'
          : this.lock.shelfName
        : (this.categoryById.get(key)?.name ?? 'Unsorted');
    const order = this.categories.map((c) => c.id);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: name(id), count }))
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  });

  pageRows = $derived.by<PageRow[] | null>(() => {
    const rows = this.resolvedResults;
    const filter = this.filter;
    if (!rows || !filter) return rows;
    return rows.filter((row) =>
      filter === 'locked'
        ? row.locked
        : !row.locked &&
          (this.categoryById.has(row.bookmark.categoryId) ? row.bookmark.categoryId : 'unsorted') === filter,
    );
  });

  /** Everything the arrow keys move through: matching shelves first, then pages. */
  searchRows = $derived<SearchRow[]>([
    ...this.shelfMatches.map((s) => ({ kind: 'shelf' as const, ...s })),
    ...(this.pageRows ?? []).map((r) => ({ kind: 'page' as const, ...r })),
  ]);

  setFilter(id: string | null) {
    this.filter = this.filter === id ? null : id;
  }

  // ---- Toasts (one at a time) ----

  showToast(message: string, options: { detail?: string; action?: Toast['action']; ms?: number } = {}) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    const toast: Toast = { id: this.nextToast++, message, detail: options.detail, action: options.action };
    this.toast = toast;
    this.toastTimer = setTimeout(() => {
      if (this.toast?.id === toast.id) this.toast = null;
    }, options.ms ?? TOAST_MS);
  }

  dismissToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = null;
  }

  lockedItems(): LockedItem[] {
    return this.lock.state === 'unlocked' ? this.lock.items : [];
  }
}

export const library = new LibraryState();
