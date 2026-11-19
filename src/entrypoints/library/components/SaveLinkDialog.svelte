<script lang="ts">
  import { browser } from 'wxt/browser';
  import Chips from '../../../components/Chips.svelte';
  import PassphraseField from '../../../components/PassphraseField.svelte';
  import { findByUrl, savePage, UNSORTED_ID } from '../../../lib/db/bookmarks';
  import { isPdf } from '../../../lib/extract/limits';
  import { extractFromDocument } from '../../../lib/extract/readable';
  import type { SaveLockedResult } from '../../../lib/search/protocol';
  import { parseUserUrl, siteOf } from '../../../lib/url';
  import { newCategory } from '../actions';
  import { library } from '../state.svelte';
  import Dialog from './Dialog.svelte';

  // Save a pasted link (PRD F1.4, ARCHITECTURE 5.2). The page fetch is the product's only network request.
  let { onclose }: { onclose: () => void } = $props();

  const FETCH_TIMEOUT_MS = 15_000;

  let address = $state('');
  let categoryId = $state<string | null>(null);
  let error = $state('');
  let failure = $state('');
  let busy = $state(false);
  /** Save straight onto the locked shelf, encrypted before anything is written (F4.7). */
  let toLocked = $state(false);
  let passphrase = $state('');
  let passError = $state('');
  /** The last page read, so a wrong passphrase doesn't fetch it again. Memory only. */
  let fetched: { url: string; page: { title: string; text: string; favicon: string } } | null = null;
  const choices = $derived(library.categories.filter((c) => c.kind !== 'unsorted'));
  const hasLock = $derived(library.lock.state !== 'none');
  const needsPassphrase = $derived(toLocked && library.lock.state === 'locked');
  const shelfName = $derived(library.lock.state === 'none' ? 'Locked' : library.lock.shelfName);

  async function fetchPage(url: string): Promise<{ title: string; text: string; favicon: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: controller.signal });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const type = response.headers.get('content-type') ?? '';
      if (isPdf(url, type) || !type.includes('html')) return { title: '', text: '', favicon: '' };
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return extractFromDocument(doc, doc.body?.textContent ?? '');
    } finally {
      clearTimeout(timer);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    failure = '';
    const url = parseUserUrl(address);
    if (!url) {
      error = 'Enter the full address, like https://example.com/page';
      return;
    }
    error = '';
    if (needsPassphrase && !passphrase) {
      passError = 'Enter your passphrase to save onto the locked shelf.';
      return;
    }
    passError = '';
    busy = true;
    // Asked on the first paste only; the browser remembers the answer (risk K1).
    let allowed = false;
    try {
      allowed = await browser.permissions.request({ origins: ['<all_urls>'] });
    } catch {
      allowed = false;
    }
    try {
      const existing = await findByUrl(url);
      if (existing) {
        const where = library.categoryById.get(existing.categoryId)?.name ?? 'Unsorted';
        library.showToast(`Already saved in ${where}`, { ms: 5000 });
        onclose();
        return;
      }
      const page =
        fetched?.url === url ? fetched.page : allowed ? await fetchPage(url) : { title: '', text: '', favicon: '' };
      fetched = { url, page };
      if (toLocked) {
        await saveLocked(url, page);
        return;
      }
      const target = categoryId ?? UNSORTED_ID;
      await savePage({
        url,
        title: page.title || siteOf(url),
        text: page.text,
        favicon: page.favicon,
        categoryId: target,
      });
      const name = library.categoryById.get(target)?.name ?? 'Unsorted';
      library.showToast(`Saved to ${name}`, {
        detail: page.text ? undefined : 'Search will match only its title and address.',
        ms: 5000,
      });
      onclose();
    } catch {
      failure = "Couldn't save. Check your connection and try again.";
    } finally {
      busy = false;
      passphrase = '';
    }
  }

  async function saveLocked(url: string, page: { title: string; text: string; favicon: string }) {
    let result: SaveLockedResult | undefined;
    try {
      result = await library.client?.ask<SaveLockedResult>({
        type: 'save-locked',
        page: { url, title: page.title || siteOf(url), text: page.text, favicon: page.favicon },
        passphrase: needsPassphrase ? passphrase : undefined,
      });
    } catch (failed) {
      if (failed instanceof Error && failed.message === 'wrong-passphrase') {
        passError = "That passphrase doesn't match. Check it and try again.";
        return;
      }
      throw failed;
    }
    fetched = null;
    if (result?.status === 'already-plain') {
      library.showToast('This page is already saved without encryption. Use Move to Locked in its ⋯ menu.', {
        ms: 6000,
      });
    } else if (result?.status === 'already-locked') {
      library.showToast(`Already in ${shelfName}`, { ms: 5000 });
    } else {
      library.showToast(`Saved to ${shelfName}`, {
        detail: page.text ? 'Encrypted on this device.' : 'Encrypted. Search will match only its title and address.',
        ms: 5000,
      });
    }
    onclose();
  }

  function pickCategory(id: string) {
    toLocked = false;
    categoryId = categoryId === id ? null : id;
  }

  function pickLocked() {
    toLocked = !toLocked;
    if (toLocked) categoryId = null;
  }

  async function create(name: string): Promise<string | null> {
    const result = await newCategory(name);
    if (typeof result === 'string') return result;
    categoryId = result.id;
    toLocked = false;
    return null;
  }
</script>

<Dialog id="save-link" title="Save a link" {onclose} {busy}>
  <form class="form" onsubmit={submit} novalidate>
    <div class="field">
      <label for="save-url">Page address</label>
      <input
        id="save-url"
        class="input"
        type="url"
        inputmode="url"
        bind:value={address}
        placeholder="https://"
        autocomplete="off"
        spellcheck="false"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'save-url-error' : undefined}
      />
      {#if error}<span class="errtext" id="save-url-error" role="alert">{error}</span>{/if}
    </div>
    <div class="field">
      <span class="lbl" id="save-cat-label">Category <span class="opt">(optional)</span></span>
      <Chips
        categories={choices}
        selected={toLocked ? null : categoryId}
        onpick={pickCategory}
        oncreate={create}
        showLocked={hasLock}
        lockedOn={toLocked}
        onlocked={pickLocked}
      />
    </div>
    {#if needsPassphrase}
      <PassphraseField id="save-link-pass" label="Passphrase for {shelfName}" bind:value={passphrase} error={passError} />
    {/if}
    {#if failure}<p class="errtext" role="alert">{failure}</p>{/if}
    <div class="actions">
      <button class="btn btn-ghost" type="button" onclick={onclose} disabled={busy}>Cancel</button>
      <button class="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : toLocked ? 'Save encrypted' : 'Save link'}</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s4);
  }
  .lbl {
    font-weight: 600;
    font-size: 14px;
  }
  .opt {
    font-weight: 400;
    color: var(--color-umber);
  }
</style>
