<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../../../components/Icon.svelte';
  import type { Category } from '../../../lib/db/schema';
  import Menu from './Menu.svelte';

  // Shelf heading with count, "See all", and the shelf menu (Rename, Move up, Move down, Delete).
  let {
    category,
    count,
    seeAll = false,
    first = false,
    last = false,
    heading = 'h2',
    onrename,
    onmove,
    ondelete,
    extra,
  }: {
    category: Category;
    count: number;
    seeAll?: boolean;
    first?: boolean;
    last?: boolean;
    heading?: 'h1' | 'h2' | 'h3';
    onrename: (name: string) => Promise<string | null>;
    onmove: (direction: -1 | 1) => void;
    ondelete: () => void;
    extra?: Snippet;
  } = $props();

  let open = $state(false);
  let renaming = $state(false);
  let name = $state('');
  let error = $state('');
  let trigger: HTMLButtonElement | undefined = $state();
  let field: HTMLInputElement | undefined = $state();
  const editable = $derived(category.kind !== 'unsorted');

  function close() {
    open = false;
    trigger?.focus();
  }

  async function startRename() {
    open = false;
    name = category.name;
    error = '';
    renaming = true;
    await Promise.resolve();
    field?.select();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const problem = await onrename(name);
    if (problem) {
      error = problem;
      return;
    }
    renaming = false;
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      renaming = false;
    }
  }
</script>

<div class="shelf-h">
  {#if renaming}
    <form class="rename" onsubmit={submit}>
      <label class="sr-only" for="rename-{category.id}">Category name</label>
      <input
        id="rename-{category.id}"
        class="input"
        bind:this={field}
        bind:value={name}
        maxlength="40"
        onkeydown={keydown}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `rename-${category.id}-error` : undefined}
      />
      <button class="btn" type="submit">Save</button>
      <button class="btn btn-ghost" type="button" onclick={() => (renaming = false)}>Cancel</button>
      {#if error}<p class="errtext full" id="rename-{category.id}-error" role="alert">{error}</p>{/if}
    </form>
  {:else}
    <svelte:element this={heading} class="name">{category.name}</svelte:element>
    <span class="count num">{count}</span>
  {/if}
  <div class="end">
    {@render extra?.()}
    {#if seeAll && !renaming}
      <a class="link" href="#/shelf/{encodeURIComponent(category.id)}">See all<span class="wide">&nbsp;{count}</span></a>
    {/if}
    {#if editable && !renaming}
      <div class="menu-anchor">
        <button
          class="iconbtn"
          type="button"
          aria-label="{category.name} options"
          aria-haspopup="menu"
          aria-expanded={open}
          bind:this={trigger}
          onclick={() => (open = !open)}
        >
          <Icon name="more" />
        </button>
        {#if open}
          <Menu label="{category.name} options" onclose={close}>
            <button type="button" role="menuitem" onclick={startRename}>Rename</button>
            {#if !first}<button type="button" role="menuitem" onclick={() => { onmove(-1); close(); }}>Move up</button>{/if}
            {#if !last}<button type="button" role="menuitem" onclick={() => { onmove(1); close(); }}>Move down</button>{/if}
            <hr />
            <button type="button" role="menuitem" class="danger" onclick={() => { open = false; ondelete(); }}>Delete category</button>
          </Menu>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .shelf-h {
    display: flex;
    align-items: center;
    gap: var(--spacing-s3);
    margin-bottom: var(--spacing-s3);
    min-height: 32px;
    min-width: 0;
  }
  .name {
    font: 700 18px/1.2 var(--font-slab);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .count {
    font-size: 13px;
    color: var(--color-umber);
  }
  .end {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--spacing-s2);
    flex: none;
  }
  .menu-anchor {
    position: relative;
  }
  .rename {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-s2);
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  .rename .input {
    flex: 1;
    min-width: 140px;
    max-width: 320px;
    height: 40px;
  }
  .full {
    flex-basis: 100%;
  }
  @media (max-width: 700px) {
    .wide {
      display: none;
    }
  }
</style>
