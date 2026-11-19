<script lang="ts">
  import Icon from '../../../components/Icon.svelte';
  import type { Bookmark, Category } from '../../../lib/db/schema';
  import Menu from './Menu.svelte';

  // Card menu (design.html section 4): open, copy, move to a category, delete.
  let {
    bookmark,
    categories,
    onmove,
    ondelete,
    oncreate,
    onlock,
    current,
    open = $bindable(false),
  }: {
    bookmark: Bookmark;
    categories: Category[] | null;
    onmove?: (categoryId: string) => void;
    ondelete: () => void;
    oncreate?: (name: string) => Promise<string | null>;
    onlock?: () => void;
    /** The checked category. Locked cards pass null: they sit on no category. */
    current?: string | null;
    open?: boolean;
  } = $props();

  let adding = $state(false);
  let newName = $state('');
  let addError = $state('');
  let trigger: HTMLButtonElement | undefined = $state();

  function close() {
    open = false;
    adding = false;
    newName = '';
    addError = '';
    trigger?.focus();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookmark.url);
    } finally {
      close();
    }
  }

  async function submitNew(event: SubmitEvent) {
    event.preventDefault();
    const problem = await oncreate?.(newName);
    if (problem) addError = problem;
    else close();
  }
</script>

<div class="anchor">
  <button
    class="iconbtn more"
    type="button"
    aria-label="Options for {bookmark.title}"
    aria-haspopup="menu"
    aria-expanded={open}
    bind:this={trigger}
    onclick={() => (open = !open)}
  >
    <Icon name="more" />
  </button>
  {#if open}
    <Menu label="Options for {bookmark.title}" onclose={close}>
      <button type="button" role="menuitem" onclick={() => { window.open(bookmark.url, '_blank', 'noopener'); close(); }}>Open page</button>
      <button type="button" role="menuitem" onclick={copy}>Copy link</button>
      {#if categories && onmove}
        <hr />
        <div class="ttl">Move to</div>
        {#each categories as category (category.id)}
          {@const isCurrent = category.id === (current === undefined ? bookmark.categoryId : current)}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isCurrent}
            onclick={() => { if (!isCurrent) onmove(category.id); close(); }}
          >
            <span class="name">{category.name}</span>
            {#if isCurrent}<span class="check"><Icon name="check" size={14} /></span>{/if}
          </button>
        {/each}
        {#if oncreate}
          {#if adding}
            <form class="new" onsubmit={submitNew}>
              <label class="sr-only" for="new-cat-{bookmark.id}">New category name</label>
              <!-- svelte-ignore a11y_autofocus -->
              <input id="new-cat-{bookmark.id}" class="input small" bind:value={newName} maxlength="40" placeholder="Category name" autofocus aria-invalid={addError ? 'true' : undefined} />
              {#if addError}<p class="errtext">{addError}</p>{/if}
            </form>
          {:else}
            <button type="button" role="menuitem" onclick={() => (adding = true)}>+ New category</button>
          {/if}
        {/if}
      {/if}
      <hr />
      {#if onlock}
        <button type="button" role="menuitem" onclick={() => { close(); onlock(); }}>
          <Icon name="lock" size={16} /> Move to Locked
        </button>
      {/if}
      <button type="button" role="menuitem" class="danger" onclick={() => { close(); ondelete(); }}>Delete link</button>
    </Menu>
  {/if}
</div>

<style>
  .anchor {
    position: relative;
  }
  .new {
    padding: 4px 6px;
  }
  .small {
    height: 36px;
    font-size: 14px;
  }
</style>
