<script lang="ts">
  import Icon from '../../../components/Icon.svelte';
  import { askMoveToLocked, deleteLink, moveLink } from '../actions';
  import { library } from '../state.svelte';
  import CardMenu from './CardMenu.svelte';
  import LockedShelf from './LockedShelf.svelte';
  import ResultRow from './ResultRow.svelte';

  // "See all N" opens one category as a list, with the same rows as search results.
  let { id }: { id: string } = $props();
  const view = $derived(library.shelves.find((s) => s.category.id === id));
</script>

<div class="page">
  <a class="backlink" href="#/"><Icon name="back" size={16} /> All shelves</a>
  {#if id === 'locked'}
    <LockedShelf full />
  {:else if view}
    <h2 class="title">{view.category.name} <span class="count num">{view.items.length}</span></h2>
    {#if view.items.length}
      <ul class="list" aria-label="{view.category.name} links">
        {#each view.items as bookmark, i (bookmark.id)}
          <ResultRow id="row-{i}" {bookmark} option={false}>
            {#snippet menu()}
              <CardMenu
                {bookmark}
                categories={library.categories}
                onmove={(target) => moveLink(bookmark, target)}
                ondelete={() => deleteLink(bookmark)}
                onlock={() => askMoveToLocked(bookmark)}
              />
            {/snippet}
          </ResultRow>
        {/each}
      </ul>
    {:else}
      <p class="none">No links here yet. Move one here from its ⋯ menu.</p>
    {/if}
  {:else}
    <p class="none">This category doesn't exist anymore.</p>
  {/if}
</div>

<style>
  .page {
    margin: var(--spacing-s5) auto 0;
    max-width: 776px;
  }
  .backlink {
    color: var(--color-ink);
    font-weight: 600;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-decoration: none;
  }
  .backlink:hover {
    text-decoration: underline;
  }
  .title {
    font: 700 22px/1.2 var(--font-slab);
    margin: var(--spacing-s4) 0;
    overflow-wrap: anywhere;
  }
  .count {
    font: 400 14px/1 var(--font-sans);
    color: var(--color-umber);
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    border-top: 1px solid var(--color-line);
  }
  .none {
    color: var(--color-body);
    margin-top: var(--spacing-s4);
  }
</style>
