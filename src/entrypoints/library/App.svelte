<script lang="ts">
  import { onMount } from 'svelte';
  import { openLockChannel } from '../../lib/crypto/share';
  import type { Category } from '../../lib/db/schema';
  import Band from './components/Band.svelte';
  import Banner from './components/Banner.svelte';
  import DeleteCategoryDialog from './components/DeleteCategoryDialog.svelte';
  import DragGhost from './components/DragGhost.svelte';
  import EmptyLibrary from './components/EmptyLibrary.svelte';
  import MoveToLockedDialog from './components/MoveToLockedDialog.svelte';
  import Results from './components/Results.svelte';
  import SaveLinkDialog from './components/SaveLinkDialog.svelte';
  import SettingsPage from './components/SettingsPage.svelte';
  import ShelfPage from './components/ShelfPage.svelte';
  import Shelves from './components/Shelves.svelte';
  import Skeleton from './components/Skeleton.svelte';
  import Toast from './components/Toast.svelte';
  import { library } from './state.svelte';

  // Library page (design.html sections 1–4, 6, 7).

  const ACTIVITY_BROADCAST_MS = 15_000;

  let active = $state(0);
  let saving = $state(false);
  let deleting = $state<{ category: Category; count: number } | null>(null);
  let searchInput: HTMLInputElement | undefined = $state();

  // A library with a locked shelf is never empty: the shelf must stay reachable while locked.
  const isEmpty = $derived(library.load === 'ready' && library.bookmarks.length === 0 && library.lock.state === 'none');
  const searching = $derived(library.query.trim().length > 0);

  // ---- Idle relock (F4.6): any library tab's activity keeps the shelf open. ----
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastBroadcast = 0;
  const lockChannel = openLockChannel((message) => {
    if (message.type === 'activity') armIdle();
  });

  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    if (library.lock.state !== 'unlocked') return;
    idleTimer = setTimeout(() => library.client?.lock(), library.settings.idleMinutes * 60_000);
  }

  function activity() {
    if (library.lock.state !== 'unlocked') return;
    armIdle();
    const now = Date.now();
    if (now - lastBroadcast > ACTIVITY_BROADCAST_MS) {
      lastBroadcast = now;
      lockChannel.post({ type: 'activity', at: now });
    }
  }

  $effect(() => {
    // Re-arm when the shelf unlocks or the idle setting changes.
    void library.lock.state;
    void library.settings.idleMinutes;
    armIdle();
  });

  function keydown(event: KeyboardEvent) {
    activity();
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
    event.preventDefault();
    if (library.route.name !== 'library') location.hash = '#/';
    requestAnimationFrame(() => searchInput?.focus());
  }

  onMount(() => {
    library.start();
    return () => {
      lockChannel.close();
      if (idleTimer) clearTimeout(idleTimer);
    };
  });

  $effect(() => {
    // Keep the result highlight in range.
    const count = library.searchRows.length;
    if (active >= count) active = 0;
  });
</script>

<svelte:window onkeydown={keydown} onpointerdown={activity} onwheel={activity} />

{#if library.route.name === 'settings'}
  <SettingsPage />
{:else}
  <Band bind:active bind:input={searchInput} onsave={() => (saving = true)} disabled={isEmpty} />
  <main class="content">
    {#if searching && library.route.name === 'library'}
      <Results {active} />
    {:else if library.load === 'error'}
      <Banner
        title="Couldn't load your library"
        body="Penyemat couldn't read its storage in this browser. Try again. If it keeps happening, restart the browser."
        action="Try again"
        onaction={() => library.retryLoad()}
      />
    {:else if library.load === 'loading'}
      {#if library.slowLoad}<Skeleton />{/if}
    {:else if library.route.name === 'shelf'}
      <ShelfPage id={library.route.id} />
    {:else if isEmpty}
      <EmptyLibrary onsave={() => (saving = true)} />
    {:else}
      {#if library.searchFailed}
        <Banner
          title="Search isn't working right now"
          body="Your shelves are still here. Try the search again in a moment."
          action="Try again"
          onaction={() => library.retrySearch()}
        />
      {/if}
      <Shelves ondeletecategory={(category, count) => (deleting = { category, count })} />
    {/if}
  </main>
{/if}

{#if saving}<SaveLinkDialog onclose={() => (saving = false)} />{/if}
{#if deleting}<DeleteCategoryDialog category={deleting.category} count={deleting.count} onclose={() => (deleting = null)} />{/if}
{#if library.movingToLocked}
  <MoveToLockedDialog bookmark={library.movingToLocked} onclose={() => (library.movingToLocked = null)} />
{/if}
<DragGhost />
<Toast />

<style>
  .content {
    padding: var(--spacing-s2) var(--spacing-s6) 96px;
    max-width: 1240px;
    margin: 0 auto;
  }
  @media (max-width: 700px) {
    .content {
      padding: var(--spacing-s2) var(--spacing-s4) 96px;
    }
  }
</style>
