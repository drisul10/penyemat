<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import Chips from '../../components/Chips.svelte';
  import Foldmark from '../../components/Foldmark.svelte';
  import Icon from '../../components/Icon.svelte';
  import PassphraseField from '../../components/PassphraseField.svelte';
  import Tile from '../../components/Tile.svelte';
  import { decryptRecord, encryptRecord, unlock } from '../../lib/crypto/lock';
  import {
    addCategory,
    buildBookmark,
    CategoryError,
    deleteBookmark,
    listCategories,
    setCategory,
  } from '../../lib/db/bookmarks';
  import { addLockedRecord, getLockMeta, listLockedRecords, moveToLocked } from '../../lib/db/locked';
  import type { Bookmark, Category } from '../../lib/db/schema';
  import type { BackgroundRequest, PendingLockedPage, PopupStart } from '../../lib/messages';
  import { siteOf } from '../../lib/url';

  // Extension popup (design.html sections 5 and 6).

  type View =
    | { name: 'saving' }
    | { name: 'saved'; bookmark: Bookmark; already: boolean }
    | { name: 'unsavable' }
    | { name: 'error' }
    | { name: 'locked-entry'; page: PendingLockedPage }
    | { name: 'move'; bookmarkId: string; title: string; site: string; favicon: string; fromCommand: boolean }
    | { name: 'needs-setup' }
    | { name: 'already-locked'; title: string; site: string }
    | { name: 'locked-saved'; title: string; site: string; favicon: string; moved: boolean; already: boolean };

  const WRONG = "That passphrase doesn't match. Check it and try again.";

  let view = $state<View>({ name: 'saving' });
  let showSaving = $state(false);
  let tabTitle = $state('');
  let tabSite = $state('');
  let categories = $state<Category[]>([]);
  let hasLock = $state(false);
  let passphrase = $state('');
  let passError = $state('');
  let busy = $state(false);
  let retrying = $state(false);

  function send<T>(message: BackgroundRequest): Promise<T> {
    return browser.runtime.sendMessage(message) as Promise<T>;
  }

  async function refreshCategories() {
    categories = await listCategories();
  }

  function show(start: PopupStart) {
    if (start.kind === 'saved' || start.kind === 'already') {
      view = { name: 'saved', bookmark: start.bookmark, already: start.kind === 'already' };
    } else if (start.kind === 'already-locked') {
      view = { name: 'already-locked', title: start.title, site: start.site };
    } else if (start.kind === 'locked') {
      const page = start.page;
      view = page.plainId
        ? {
            name: 'move',
            bookmarkId: page.plainId,
            title: page.title,
            site: page.site,
            favicon: page.favicon,
            fromCommand: true,
          }
        : { name: 'locked-entry', page };
      if (!hasLock) view = { name: 'needs-setup' };
    } else {
      view = { name: start.kind };
    }
  }

  // Set only when the popup is opened as a page for e2e tests (popup.html?tab=<id>).
  const tabParam = Number(new URLSearchParams(location.search).get('tab'));
  const tabId = Number.isInteger(tabParam) && tabParam > 0 ? tabParam : undefined;

  onMount(() => {
    const slow = setTimeout(() => (showSaving = true), 400);
    void (async () => {
      const [tab] = tabId
        ? [await browser.tabs.get(tabId)]
        : await browser.tabs.query({ active: true, currentWindow: true });
      tabTitle = tab?.title ?? '';
      tabSite = tab?.url ? siteOf(tab.url) : '';
      const [start] = await Promise.all([
        send<PopupStart>({ type: 'popup-start', tabId }),
        refreshCategories(),
        getLockMeta().then((meta) => (hasLock = Boolean(meta))),
      ]);
      clearTimeout(slow);
      show(start ?? { kind: 'error' });
    })().catch(() => {
      clearTimeout(slow);
      view = { name: 'error' };
    });
    return () => clearTimeout(slow);
  });

  async function retry() {
    retrying = true;
    show(await send<PopupStart>({ type: 'retry-save', tabId }));
    retrying = false;
  }

  async function pick(id: string) {
    if (view.name !== 'saved') return;
    const bookmark = view.bookmark;
    if (bookmark.categoryId === id) return;
    await setCategory(bookmark.id, id);
    view = { ...view, bookmark: { ...bookmark, categoryId: id } };
  }

  async function create(name: string): Promise<string | null> {
    try {
      const category = await addCategory(name);
      await refreshCategories();
      await pick(category.id);
      return null;
    } catch (error) {
      return error instanceof CategoryError ? error.message : "Couldn't add the category. Try again.";
    }
  }

  function askMove() {
    if (view.name !== 'saved') return;
    if (!hasLock) {
      view = { name: 'needs-setup' };
      return;
    }
    const b = view.bookmark;
    passphrase = '';
    passError = '';
    view = { name: 'move', bookmarkId: b.id, title: b.title, site: b.site, favicon: b.favicon, fromCommand: false };
  }

  async function remove() {
    if (view.name !== 'saved') return;
    await deleteBookmark(view.bookmark.id);
    window.close();
  }

  async function openLibrary(hash = '') {
    await send({ type: 'open-library', hash });
    window.close();
  }

  /** Derives the key; Argon2id takes a moment, so the button shows progress first. */
  async function keyFromPassphrase(): Promise<CryptoKey | null> {
    const meta = await getLockMeta();
    if (!meta) {
      view = { name: 'needs-setup' };
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    const key = await unlock(meta, passphrase);
    if (!key) {
      passError = WRONG;
      passphrase = '';
      return null;
    }
    return key.key;
  }

  async function saveEncrypted(event: SubmitEvent) {
    event.preventDefault();
    if (view.name !== 'locked-entry' || busy) return;
    const page = view.page;
    busy = true;
    passError = '';
    try {
      const key = await keyFromPassphrase();
      if (!key) return;
      const { bookmark, text } = buildBookmark(page);
      let already = false;
      for (const record of await listLockedRecords()) {
        const payload = await decryptRecord(key, record).catch(() => null);
        if (payload?.bookmark.url === bookmark.url) already = true;
      }
      const salt = (await getLockMeta())?.fingerprintSalt;
      if (!already) await addLockedRecord(await encryptRecord(key, { bookmark, text }, salt));
      await send({ type: 'clear-pending-locked' });
      view = {
        name: 'locked-saved',
        title: bookmark.title,
        site: bookmark.site,
        favicon: bookmark.favicon,
        moved: false,
        already,
      };
    } catch {
      passError = "Couldn't save the page. Try again.";
    } finally {
      busy = false;
      passphrase = '';
    }
  }

  async function move(event: SubmitEvent) {
    event.preventDefault();
    if (view.name !== 'move' || busy) return;
    const current = view;
    busy = true;
    passError = '';
    try {
      const key = await keyFromPassphrase();
      if (!key) return;
      await moveToLocked(current.bookmarkId, key);
      await send({ type: 'clear-pending-locked' });
      view = {
        name: 'locked-saved',
        title: current.title,
        site: current.site,
        favicon: current.favicon,
        moved: true,
        already: false,
      };
    } catch {
      passError = "Couldn't move the page. Try again.";
    } finally {
      busy = false;
      passphrase = '';
    }
  }
</script>

<main class="pop">
  {#if view.name === 'saving'}
    {#if showSaving}
      <header class="pop-h plain">
        <span class="spin" role="status" aria-label="Saving"></span>
        <h1>Saving…</h1>
      </header>
      <div class="pop-b">
        <div class="pagecard">
          <Tile site={tabSite} />
          <div><p class="t">{tabTitle}</p><p class="u">{tabSite}</p></div>
        </div>
      </div>
    {/if}
  {:else if view.name === 'saved'}
    {@const b = view.bookmark}
    <header class="pop-h brand">
      <Foldmark animate />
      <h1>{view.already ? 'Already saved' : 'Saved'}</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <div class="pop-b">
      <div class="pagecard">
        <Tile site={b.site} favicon={b.favicon} />
        <div>
          <p class="t">{b.title}</p>
          <p class="u">
            {b.site}{#if view.already}{' '}· saved <span class="num">{new Date(b.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>{/if}
          </p>
        </div>
      </div>
      {#if b.textStatus === 'unreadable'}
        <p class="info">Penyemat couldn't read this page's text, so search will match only its title and address.</p>
      {/if}
      <div class="field">
        <span class="label" id="chips-label">{view.already ? 'Category' : 'Category (optional)'}</span>
        <Chips
          {categories}
          selected={b.categoryId}
          onpick={pick}
          oncreate={create}
          showLocked
          onlocked={askMove}
          label={view.already ? 'Category' : 'Category (optional)'}
        />
      </div>
    </div>
    <footer class="pop-f">
      <button class="link" type="button" onclick={() => openLibrary()}>Open Penyemat</button>
      <button class="link link-quiet" type="button" onclick={remove}>Remove</button>
    </footer>
  {:else if view.name === 'unsavable'}
    <header class="pop-h plain">
      <h1>Penyemat can't save this kind of page</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <div class="pop-b">
      <p class="body">Browser pages like settings, a new tab, or an extension store can't be saved. Open a web page and try again.</p>
    </div>
    <footer class="pop-f">
      <button class="link" type="button" onclick={() => openLibrary()}>Open Penyemat</button>
    </footer>
  {:else if view.name === 'error'}
    <header class="pop-h plain">
      <h1>Couldn't save this page</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <div class="pop-b">
      <p class="body">Penyemat couldn't store this page. Try again.</p>
      <button class="btn start" type="button" onclick={retry} disabled={retrying}>{retrying ? 'Trying…' : 'Try again'}</button>
    </div>
  {:else if view.name === 'locked-entry'}
    {@const page = view.page}
    <header class="pop-h plain">
      <Icon name="lock" size={16} />
      <h1>Save to Locked</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <form class="pop-b" onsubmit={saveEncrypted}>
      <div class="pagecard">
        <Tile site={page.site} favicon={page.favicon} />
        <div><p class="t">{page.title}</p><p class="u">{page.site}</p></div>
      </div>
      <PassphraseField id="lock-pass" label="Passphrase" bind:value={passphrase} error={passError} autofocus />
      <button class="btn start" type="submit" disabled={busy || !passphrase}>
        {busy ? 'Encrypting…' : 'Save encrypted'}
      </button>
    </form>
  {:else if view.name === 'move'}
    <header class="pop-h plain">
      <Icon name="lock" size={16} />
      <h1>Move to Locked?</h1>
    </header>
    <form onsubmit={move}>
      <div class="pop-b">
        <div class="pagecard">
          <Tile site={view.site} favicon={view.favicon} />
          <div><p class="t">{view.title}</p><p class="u">{view.site}</p></div>
        </div>
        <p class="body">
          This page is already saved without encryption. Moving it encrypts it, but traces of the unencrypted copy may
          stay on this device.{#if !view.fromCommand}{' '}Next time, right-click the Penyemat button and choose Save to Locked.{/if}
        </p>
        <PassphraseField id="move-pass" label="Passphrase" bind:value={passphrase} error={passError} autofocus />
      </div>
      <footer class="pop-f">
        <button class="link link-quiet" type="button" onclick={() => window.close()}>Cancel</button>
        <button class="btn" type="submit" disabled={busy || !passphrase}>{busy ? 'Moving…' : 'Move to Locked'}</button>
      </footer>
    </form>
  {:else if view.name === 'needs-setup'}
    <header class="pop-h plain">
      <Icon name="lock" size={16} />
      <h1>Set up a locked shelf first.</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <div class="pop-b">
      <p class="body">Choose a passphrase in Settings. Then pages you save to Locked are encrypted on this device.</p>
      <button class="btn start" type="button" onclick={() => openLibrary('#/settings')}>Open settings</button>
    </div>
  {:else if view.name === 'already-locked'}
    <header class="pop-h plain">
      <Icon name="lock" size={16} />
      <h1>Already in Locked</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <div class="pop-b">
      <div class="pagecard">
        <Tile site={view.site} />
        <div><p class="t">{view.title}</p><p class="u">{view.site}</p></div>
      </div>
      <p class="info">This page is on your locked shelf, so nothing was saved. Unlock the shelf in Penyemat to see it.</p>
    </div>
    <footer class="pop-f">
      <button class="link" type="button" onclick={() => openLibrary()}>Open Penyemat</button>
    </footer>
  {:else if view.name === 'locked-saved'}
    <header class="pop-h brand">
      <Foldmark animate />
      <h1>{view.already ? 'Already in Locked' : view.moved ? 'Moved to Locked' : 'Saved to Locked'}</h1>
      <button class="iconbtn x" type="button" aria-label="Close" onclick={() => window.close()}><Icon name="close" size={16} /></button>
    </header>
    <div class="pop-b">
      <div class="pagecard">
        <Tile site={view.site} favicon={view.favicon} />
        <div><p class="t">{view.title}</p><p class="u">{view.site}</p></div>
      </div>
      <p class="info">
        {view.already
          ? 'This page is already on your locked shelf, so nothing new was saved.'
          : 'Encrypted on this device. It shows in search once the shelf is unlocked.'}
      </p>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    width: 360px;
    min-height: 120px;
  }
  .pop {
    width: 100%;
  }
  .pop-h {
    display: flex;
    align-items: center;
    gap: var(--spacing-s3);
    padding: var(--spacing-s4);
  }
  .pop-h.brand {
    background: var(--color-field);
  }
  .pop-h.plain {
    background: var(--color-leaf);
    border-bottom: 1px solid var(--color-line);
  }
  h1 {
    font: 700 20px/1.15 var(--font-slab);
  }
  .x {
    margin-left: auto;
  }
  .pop-b {
    padding: var(--spacing-s4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s4);
  }
  .pagecard {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: var(--spacing-s3);
  }
  .t {
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .u {
    font-size: 13px;
    color: var(--color-umber);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .body {
    font-size: 14px;
    color: var(--color-body);
  }
  .start {
    align-self: flex-start;
  }
  .pop-f {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-s3);
    padding: var(--spacing-s3) var(--spacing-s4);
    border-top: 1px solid var(--color-line);
  }
</style>
