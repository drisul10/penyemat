<script lang="ts">
  import type { Bookmark, Category } from '../../../lib/db/schema';
  import { type DragItem, drag, dragSource } from '../drag.svelte';
  import { shortDate } from '../format';
  import CardMenu from './CardMenu.svelte';

  // Folded card (design.html BookmarkCard). Click opens the page; ⋯ opens the card menu.
  let {
    bookmark,
    categories,
    fresh = false,
    showDate = true,
    onmove,
    ondelete,
    oncreate,
    onlock,
    current,
    dragItem,
  }: {
    bookmark: Bookmark;
    categories: Category[] | null;
    fresh?: boolean;
    showDate?: boolean;
    onmove?: (categoryId: string) => void;
    ondelete: () => void;
    oncreate?: (name: string) => Promise<string | null>;
    onlock?: () => void;
    current?: string | null;
    /** Set where the card can be dragged onto another shelf. */
    dragItem?: DragItem;
  } = $props();

  const lifted = $derived(
    drag.item !== null &&
      dragItem !== undefined &&
      (drag.item.kind === 'plain' ? drag.item.bookmark.id : drag.item.item.bookmark.id) === bookmark.id,
  );

  let open = $state(false);
</script>

<div class="card" class:fresh class:menu-open={open} class:lifted use:dragSource={dragItem}>
  <a class="hit" href={bookmark.url} target="_blank" rel="noopener noreferrer" draggable="false">
    <span class="t">{bookmark.title}</span>
    <span class="m">
      <span class="site">{bookmark.site}</span>
      {#if showDate}<span class="num date">{shortDate(bookmark.savedAt)}</span>{/if}
    </span>
  </a>
  <div class="more-wrap">
    <CardMenu {bookmark} {categories} {onmove} {ondelete} {oncreate} {onlock} {current} bind:open />
  </div>
</div>

<style>
  .card {
    position: relative;
    min-height: 112px;
    border-radius: var(--radius-sm) 0 var(--radius-sm) var(--radius-sm);
    min-width: 0;
  }
  .card::before {
    /* The card body with its cut corner. */
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-card);
    clip-path: polygon(0 0, calc(100% - var(--fold-size)) 0, 100% var(--fold-size), 100% 100%, 0 100%);
    border-radius: inherit;
  }
  .card::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: var(--fold-size);
    height: var(--fold-size);
    background: linear-gradient(225deg, transparent 50%, var(--color-fold) 50%);
    pointer-events: none;
  }
  .fresh::before {
    animation: fold-body var(--fold-ms) var(--ease-out-fold) both;
  }
  .fresh::after {
    animation: fold-corner var(--fold-ms) var(--ease-out-fold) both;
  }
  @keyframes fold-body {
    from {
      clip-path: polygon(0 0, 100% 0, 100% 0, 100% 100%, 0 100%);
    }
  }
  @keyframes fold-corner {
    from {
      transform: scale(0);
      transform-origin: top right;
    }
  }
  .hit {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 112px;
    height: 100%;
    padding: 14px 14px 12px;
    color: var(--color-ink);
    text-decoration: none;
    border-radius: inherit;
    clip-path: polygon(0 0, calc(100% - var(--fold-size)) 0, 100% var(--fold-size), 100% 100%, 0 100%);
  }
  .lifted {
    opacity: 0.4;
  }
  .hit {
    -webkit-touch-callout: none;
  }
  .hit:hover,
  .hit:focus-visible {
    box-shadow: inset 0 0 0 2px var(--color-ink);
    outline: none;
  }
  .t {
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    padding-right: var(--spacing-s4);
    overflow-wrap: anywhere;
  }
  .m {
    font-size: 13px;
    color: var(--color-umber);
    margin-top: auto;
    padding-top: var(--spacing-s2);
    padding-right: 30px;
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-s2);
  }
  .site {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .date {
    white-space: nowrap;
    flex: none;
  }
  /* Mobile rail: dates drop off cards; search results still show them (design.html). */
  @media (max-width: 700px) {
    .date {
      display: none;
    }
  }
  .more-wrap {
    position: absolute;
    right: 4px;
    bottom: 4px;
  }
  .more-wrap :global(.more) {
    opacity: 0;
  }
  .card:hover .more-wrap :global(.more),
  .card:focus-within .more-wrap :global(.more),
  .menu-open .more-wrap :global(.more) {
    opacity: 1;
  }
  @media (hover: none) {
    .more-wrap :global(.more) {
      opacity: 1;
    }
  }
</style>
