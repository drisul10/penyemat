<script lang="ts">
  import type { Snippet as Render } from 'svelte';
  import Icon from '../../../components/Icon.svelte';
  import Tile from '../../../components/Tile.svelte';
  import type { Bookmark } from '../../../lib/db/schema';
  import type { Snippet } from '../../../lib/search/snippet';
  import { shortDate } from '../format';
  import Highlight from './Highlight.svelte';

  // Search result and category-list row (design.html ResultRow).
  let {
    bookmark,
    snippet = null,
    categoryName = '',
    locked = false,
    active = false,
    id,
    option = true,
    menu,
  }: {
    bookmark: Bookmark;
    snippet?: Snippet | null;
    categoryName?: string;
    locked?: boolean;
    active?: boolean;
    id: string;
    option?: boolean;
    menu?: Render;
  } = $props();
</script>

<li class="row" class:active class:with-menu={Boolean(menu)} {id} role={option ? 'option' : undefined} aria-selected={option ? active : undefined}>
  <Tile site={bookmark.site} favicon={bookmark.favicon} />
  <div class="main">
    <a class="t" href={bookmark.url} target="_blank" rel="noopener noreferrer" tabindex="-1">
      {bookmark.title}
    </a>
    {#if categoryName || locked}
      <span class="cat">{#if locked}<Icon name="lock" size={12} />{/if}{categoryName}</span>
    {/if}
    <p class="u"><span class="site">{bookmark.site}</span><span class="d-inline num"> · {shortDate(bookmark.savedAt)}</span></p>
    {#if snippet}<p class="s"><Highlight {snippet} /></p>{/if}
  </div>
  <span class="end">
    <span class="d num">{shortDate(bookmark.savedAt)}</span>
    {#if menu}<span class="menu-slot">{@render menu()}</span>{/if}
  </span>
</li>

<style>
  .row {
    position: relative;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: var(--spacing-s3);
    padding: 14px var(--spacing-s4) 14px var(--spacing-s2);
    border-bottom: 1px solid var(--color-line);
    align-items: start;
    cursor: pointer;
  }
  .row::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 12px;
    height: 12px;
    background: linear-gradient(225deg, var(--color-leaf) 50%, var(--color-fold) 50%);
  }
  .row:hover,
  .row.active {
    background: var(--color-card);
  }
  .row.active {
    box-shadow: inset 3px 0 0 var(--color-ink);
  }
  .main {
    min-width: 0;
  }
  .t {
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-ink);
    text-decoration: none;
    display: -webkit-inline-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .t::before {
    /* Whole row is the click target. */
    content: '';
    position: absolute;
    inset: 0;
  }
  .t:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .cat {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    background: var(--color-chip);
    padding: 1px 8px;
    border-radius: 999px;
    margin-left: 6px;
    vertical-align: 2px;
    color: var(--color-ink);
    white-space: nowrap;
  }
  .u {
    font-size: 13px;
    color: var(--color-umber);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .s {
    font-size: 14px;
    color: var(--color-body);
    margin-top: 6px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .end {
    display: flex;
    align-items: center;
    gap: var(--spacing-s2);
  }
  .menu-slot {
    position: relative;
    z-index: 1;
    margin-top: -6px;
  }
  .d {
    font-size: 13px;
    color: var(--color-umber);
    white-space: nowrap;
  }
  .d-inline {
    display: none;
  }
  @media (max-width: 700px) {
    .row {
      grid-template-columns: 28px minmax(0, 1fr);
      padding-right: var(--spacing-s3);
    }
    .with-menu {
      grid-template-columns: 28px minmax(0, 1fr) auto;
    }
    .d {
      display: none;
    }
    .d-inline {
      display: inline;
    }
  }
</style>
