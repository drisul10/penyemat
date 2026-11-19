<script lang="ts">
  import Icon from '../../../components/Icon.svelte';
  import { plural } from '../format';
  import { library } from '../state.svelte';
  import Banner from './Banner.svelte';
  import ResultRow from './ResultRow.svelte';

  // Search results replace the shelves while the user types (design.html section 2).
  // Shelves whose names match come first; chips narrow the pages to one category.
  let { active = 0 }: { active?: number } = $props();
  const pages = $derived(library.pageRows);
  const shelves = $derived(library.shelfMatches);
  const allCount = $derived(library.resolvedResults?.length ?? 0);

  function openShelf(id: string) {
    library.clearSearch();
    location.hash = `#/shelf/${encodeURIComponent(id)}`;
  }
</script>

<div class="results">
  {#if library.searchFailed}
    <Banner
      title="Search isn't working right now"
      body="Your shelves are still here. Try the search again in a moment."
      action="Try again"
      onaction={() => library.retrySearch()}
    />
  {/if}
  {#if !library.searchReady && !library.searchFailed}
    <p class="note" role="status">
      {#if library.searchBuilding && library.searchBuilding.total > 0}
        Getting search ready: <span class="num">{library.searchBuilding.done}</span> of
        <span class="num">{library.searchBuilding.total}</span> pages read…
      {:else}
        Getting search ready…
      {/if}
    </p>
  {:else if library.slowSearch}
    <p class="note" role="status">Searching…</p>
  {/if}

  {#if allCount > 0}
    <div class="results-h">
      <p role="status">
        <b class="num">{allCount}</b> {allCount === 1 ? 'page matches' : 'pages match'} “{library.resultsQuery}”
      </p>
      <button class="link" type="button" onclick={() => library.clearSearch()}>Clear search</button>
    </div>
    {#if library.facets.length > 1}
      <div class="facets" role="group" aria-label="Show results from">
        <button type="button" class="facet" aria-pressed={library.filter === null} onclick={() => library.setFilter(null)}>
          All <span class="num">{allCount}</span>
        </button>
        {#each library.facets as facet (facet.id)}
          <button
            type="button"
            class="facet"
            aria-pressed={library.filter === facet.id}
            onclick={() => library.setFilter(facet.id)}
          >
            {#if facet.id === 'locked'}<Icon name="lock" size={14} />{/if}
            {facet.name} <span class="num">{facet.count}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  {#if shelves.length > 0 || (pages && pages.length > 0)}
    <ul class="list" id="search-results" role="listbox" aria-label="Search results">
      {#each shelves as shelf, i (shelf.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li class="shelf-row" class:active={i === active} id="result-{i}" role="option" aria-selected={i === active} onclick={() => openShelf(shelf.id)}>
          <span class="shelf-icon" aria-hidden="true">
            {#if shelf.id === 'locked'}<Icon name="lock" size={16} />{:else}<span class="fold"></span>{/if}
          </span>
          <span class="shelf-text">
            <span class="kind">Shelf</span>
            <a class="shelf-name" href="#/shelf/{encodeURIComponent(shelf.id)}" tabindex="-1" onclick={(e) => { e.preventDefault(); openShelf(shelf.id); }}>{shelf.name}</a>
          </span>
          <span class="shelf-count">{shelf.count === null ? 'Locked' : plural(shelf.count, 'link', 'links')}</span>
        </li>
      {/each}
      {#each pages ?? [] as row, i (row.hit.id)}
        {@const index = shelves.length + i}
        <ResultRow
          id="result-{index}"
          bookmark={row.bookmark}
          snippet={row.hit.snippet}
          locked={row.locked}
          categoryName={row.locked
            ? library.lock.state === 'unlocked'
              ? library.lock.shelfName
              : ''
            : (library.categoryById.get(row.bookmark.categoryId)?.name ?? 'Unsorted')}
          active={index === active}
        />
      {/each}
    </ul>
  {/if}

  {#if pages && pages.length === 0 && library.query.trim()}
    <div class="empty" class:compact={shelves.length > 0}>
      <h2>No saved pages match “{library.resultsQuery}”</h2>
      <p>Search looks in titles, addresses, and page text. Check the spelling or try fewer words.</p>
      {#if shelves.length === 0}
        <button class="btn btn-ghost" type="button" onclick={() => library.clearSearch()}>Clear search</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .results {
    max-width: 776px;
    margin: 0 auto;
  }
  .note {
    font-size: 14px;
    color: var(--color-umber);
    margin-top: var(--spacing-s5);
  }
  .results-h {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--spacing-s3);
    margin: var(--spacing-s5) 0 var(--spacing-s2);
    flex-wrap: wrap;
  }
  .results-h p {
    font-size: 14px;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    border-top: 1px solid var(--color-line);
  }
  .empty {
    max-width: 560px;
    margin: var(--spacing-s6) auto var(--spacing-s7);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-s3);
  }
  .empty.compact {
    margin: var(--spacing-s5) auto;
  }
  .facets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-s2);
    margin-bottom: var(--spacing-s3);
  }
  .facet {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    padding: 6px 12px;
    min-height: 34px;
    border-radius: 999px;
    background: var(--color-chip);
    border: 1.5px solid transparent;
    color: var(--color-ink);
    cursor: pointer;
  }
  .facet:hover {
    border-color: var(--color-umber);
  }
  .facet .num {
    color: var(--color-umber);
  }
  .facet[aria-pressed='true'] {
    background: var(--color-ink);
    color: var(--color-field);
    font-weight: 600;
  }
  .facet[aria-pressed='true'] .num {
    color: var(--color-field);
  }
  .shelf-row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: var(--spacing-s3);
    align-items: center;
    padding: 14px var(--spacing-s4) 14px var(--spacing-s2);
    border-bottom: 1px solid var(--color-line);
    cursor: pointer;
  }
  .shelf-row:hover,
  .shelf-row.active {
    background: var(--color-card);
  }
  .shelf-row.active {
    box-shadow: inset 3px 0 0 var(--color-ink);
  }
  .shelf-icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--color-tile);
    color: var(--color-umber);
  }
  .fold {
    width: 12px;
    height: 15px;
    background: var(--color-umber);
    clip-path: polygon(0 0, 60% 0, 100% 35%, 100% 100%, 0 100%);
  }
  .shelf-text {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-s2);
    min-width: 0;
  }
  .kind {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-umber);
  }
  .shelf-name {
    font: 700 17px/1.2 var(--font-slab);
    color: var(--color-ink);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .shelf-count {
    font-size: 13px;
    color: var(--color-umber);
    white-space: nowrap;
  }
  .empty h2 {
    font: 700 22px/1.2 var(--font-slab);
    overflow-wrap: anywhere;
  }
  .empty p {
    color: var(--color-body);
  }
</style>
