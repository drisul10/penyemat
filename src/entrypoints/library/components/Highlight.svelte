<script lang="ts">
  import type { Snippet } from '../../../lib/search/snippet';

  // Renders a snippet with matched words in tomato (F2.7).
  let { snippet }: { snippet: Snippet } = $props();

  const parts = $derived.by(() => {
    const out: { text: string; mark: boolean }[] = [];
    let at = 0;
    for (const [start, end] of snippet.ranges) {
      if (start > at) out.push({ text: snippet.text.slice(at, start), mark: false });
      out.push({ text: snippet.text.slice(start, end), mark: true });
      at = end;
    }
    if (at < snippet.text.length) out.push({ text: snippet.text.slice(at), mark: false });
    return out;
  });
</script>

{#each parts as part, i (i)}{#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}

<style>
  mark {
    background: none;
    color: var(--color-tomato);
    font-weight: 600;
  }
</style>
