<script lang="ts">
  import type { Snippet } from 'svelte';

  // Four cards per row on desktop; a sideways rail on narrow screens so the page never scrolls sideways.
  let { children, label }: { children: Snippet; label: string } = $props();
</script>

<div class="cards" role="list" aria-label={label}>
  {@render children()}
</div>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  .cards > :global(*) {
    min-width: 0;
  }
  @media (max-width: 980px) {
    .cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 700px) {
    .cards {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: 160px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 6px;
      margin-right: calc(var(--spacing-s4) * -1);
      padding-right: var(--spacing-s4);
    }
    .cards > :global(*) {
      scroll-snap-align: start;
    }
  }
</style>
