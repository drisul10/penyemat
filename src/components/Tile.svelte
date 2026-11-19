<script lang="ts">
  // Site tile: an inline (data:) favicon, or the site's first letter. Remote icons are never loaded.
  let { site, favicon = '' }: { site: string; favicon?: string } = $props();
  const letter = $derived((site.replace(/^www\./, '')[0] ?? '?').toUpperCase());
</script>

<span class="tile" aria-hidden="true">
  {#if favicon.startsWith('data:image/')}
    <img src={favicon} alt="" />
  {:else}
    {letter}
  {/if}
</span>
