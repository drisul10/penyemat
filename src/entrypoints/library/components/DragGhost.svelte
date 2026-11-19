<script lang="ts">
  import { drag } from '../drag.svelte';
  import { cut } from '../format';

  // The card under the pointer while dragging. No pointer events, so the shelf below can be found.
</script>

{#if drag.item}
  <div class="ghost" style:transform="translate({drag.x + 14}px, {drag.y + 14}px)" aria-hidden="true">
    <span class="t">{cut(drag.title, 60)}</span>
  </div>
  <p class="sr-only" role="status">
    {drag.over ? 'Release to move the link here.' : 'Drag onto a shelf to move the link.'}
  </p>
{/if}

<style>
  .ghost {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 60;
    width: 200px;
    padding: 12px 14px;
    background: var(--color-card);
    border: 2px solid var(--color-ink);
    border-radius: var(--radius-sm);
    pointer-events: none;
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
  }
  .t {
    font-weight: 600;
    font-size: 14px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
