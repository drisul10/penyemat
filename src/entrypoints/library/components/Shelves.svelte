<script lang="ts">
  import type { Category } from '../../../lib/db/schema';
  import { askMoveToLocked, deleteLink, moveLink, newCategory, rename, reorder } from '../actions';
  import { drag } from '../drag.svelte';
  import { library } from '../state.svelte';
  import Card from './Card.svelte';
  import CardGrid from './CardGrid.svelte';
  import LockedShelf from './LockedShelf.svelte';
  import ShelfHeader from './ShelfHeader.svelte';

  // Shelves in the user's category order. Empty shelves are hidden and listed under "+ New category".
  let { ondeletecategory }: { ondeletecategory: (category: Category, count: number) => void } = $props();

  const filled = $derived(library.shelves.filter((s) => s.items.length > 0));
  const unsorted = $derived(filled.find((s) => s.category.kind === 'unsorted'));
  const others = $derived(filled.filter((s) => s.category.kind !== 'unsorted'));
  const empty = $derived(library.shelves.filter((s) => s.items.length === 0 && s.category.kind !== 'unsorted'));
  // Move up/down follows what is on screen: shelves among shelves, empty categories among themselves.
  const shelfIds = $derived(others.map((s) => s.category.id));
  const emptyIds = $derived(empty.map((s) => s.category.id));

  let adding = $state(false);
  let name = $state('');
  let error = $state('');

  async function createFromCard(bookmarkId: string, categoryName: string): Promise<string | null> {
    const result = await newCategory(categoryName);
    if (typeof result === 'string') return result;
    const bookmark = library.byId.get(bookmarkId);
    if (bookmark) await moveLink(bookmark, result.id);
    return null;
  }

  async function submitNew(event: SubmitEvent) {
    event.preventDefault();
    const result = await newCategory(name);
    if (typeof result === 'string') {
      error = result;
      return;
    }
    library.showToast(`Added “${name.trim()}”. Move a link there from its ⋯ menu.`, { ms: 5000 });
    name = '';
    error = '';
    adding = false;
  }
</script>

{#snippet shelf(view: (typeof filled)[number])}
  {@const index = shelfIds.indexOf(view.category.id)}
  <section
    class="shelf"
    aria-label={view.category.name}
    data-drop-target={view.category.id}
    class:drop-over={drag.over === view.category.id}
    class:drop-home={drag.home === view.category.id}
  >
    <ShelfHeader
      category={view.category}
      count={view.items.length}
      seeAll={view.items.length > 4}
      first={index <= 0}
      last={index === shelfIds.length - 1}
      onrename={(value) => rename(view.category.id, value)}
      onmove={(direction) => reorder(view.category.id, direction, shelfIds)}
      ondelete={() => ondeletecategory(view.category, view.items.length)}
    />
    <CardGrid label="{view.category.name} links">
      {#each view.items.slice(0, 4) as bookmark (bookmark.id)}
        <div role="listitem">
          <Card
            {bookmark}
            categories={library.categories}
            fresh={!library.seenAtStart.has(bookmark.id)}
            onmove={(id) => moveLink(bookmark, id)}
            ondelete={() => deleteLink(bookmark)}
            oncreate={(value) => createFromCard(bookmark.id, value)}
            onlock={() => askMoveToLocked(bookmark)}
            dragItem={{ kind: 'plain', bookmark }}
          />
        </div>
      {/each}
    </CardGrid>
  </section>
{/snippet}

{#each others as view (view.category.id)}
  {@render shelf(view)}
{/each}
<LockedShelf />
{#if unsorted}
  {@render shelf(unsorted)}
{:else if drag.item}
  <!-- Unsorted is hidden while empty; during a drag it shows as a drop zone. -->
  <section class="shelf" aria-label="Unsorted" data-drop-target="unsorted" class:drop-over={drag.over === 'unsorted'}
    class:drop-home={drag.home === 'unsorted'}>
    <h2 class="drop-name">Unsorted</h2>
    <p class="drop-hint">Drop here</p>
  </section>
{/if}

<div class="manage">
  {#if adding}
    <form class="new" onsubmit={submitNew}>
      <label for="new-shelf" class="lbl">New category</label>
      <div class="row">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="new-shelf"
          class="input"
          bind:value={name}
          maxlength="40"
          autofocus
          placeholder="For example, Recipes"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'new-shelf-error' : undefined}
          onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); adding = false; } }}
        />
        <button class="btn" type="submit">Add</button>
        <button class="btn btn-ghost" type="button" onclick={() => { adding = false; error = ''; }}>Cancel</button>
      </div>
      {#if error}<p class="errtext" id="new-shelf-error" role="alert">{error}</p>{/if}
    </form>
  {:else}
    <button class="link" type="button" onclick={() => (adding = true)}>+ New category</button>
  {/if}

  {#if empty.length}
    <section class="empties" aria-labelledby="empty-categories">
      <h2 class="label" id="empty-categories">Empty categories</h2>
      {#each empty as view (view.category.id)}
        {@const index = emptyIds.indexOf(view.category.id)}
        <div class="drop-row" data-drop-target={view.category.id} class:drop-over={drag.over === view.category.id}
    class:drop-home={drag.home === view.category.id}>
          <ShelfHeader
          category={view.category}
          count={0}
          heading="h3"
          first={index <= 0}
          last={index === emptyIds.length - 1}
          onrename={(value) => rename(view.category.id, value)}
          onmove={(direction) => reorder(view.category.id, direction, emptyIds)}
          ondelete={() => ondeletecategory(view.category, 0)}
        />
        </div>
      {/each}
    </section>
  {/if}
</div>

<style>
  .shelf {
    margin-top: var(--spacing-s5);
  }
  .manage {
    margin-top: var(--spacing-s6);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s4);
  }
  .manage > .link {
    align-self: flex-start;
  }
  .new {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 520px;
  }
  .lbl {
    font-weight: 600;
    font-size: 14px;
  }
  .row {
    display: flex;
    gap: var(--spacing-s2);
    flex-wrap: wrap;
  }
  .row .input {
    flex: 1;
    min-width: 180px;
  }
  .empties {
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s2);
  }
  .drop-row {
    border-radius: var(--radius-sm);
    padding: 2px 8px;
    margin: 0 -8px;
  }
  /* Rows sit close together, so their drop outlines hug the row instead of spilling into the next. */
  :global(.is-dragging) .drop-row {
    outline-offset: 0;
  }
  .drop-name {
    font: 700 18px/1.2 var(--font-slab);
    margin-bottom: var(--spacing-s3);
  }
  .drop-hint {
    min-height: 80px;
    display: grid;
    place-items: center;
    color: var(--color-umber);
    font-size: 14px;
  }
  .empties :global(.shelf-h) {
    margin-bottom: 0;
  }
  .empties :global(.shelf-h .name) {
    font: 600 15px/1.3 var(--font-sans);
  }
</style>
