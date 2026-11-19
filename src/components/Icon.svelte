<script lang="ts">
  type Name =
    | 'search'
    | 'close'
    | 'more'
    | 'lock'
    | 'unlock'
    | 'sliders'
    | 'check'
    | 'back'
    | 'download'
    | 'upload'
    | 'chevron';
  let { name, size = 18 }: { name: Name; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" class="icon">
  {#if name === 'search'}
    <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M13 13l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  {:else if name === 'close'}
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  {:else if name === 'more'}
    <circle cx="4" cy="10" r="1.6" fill="currentColor" />
    <circle cx="10" cy="10" r="1.6" fill="currentColor" />
    <circle cx="16" cy="10" r="1.6" fill="currentColor" />
  {:else if name === 'lock'}
    <rect x="4" y="9" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="2" />
  {:else if name === 'unlock'}
    <rect x="4" y="9" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M7 9V6a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  {:else if name === 'sliders'}
    <path d="M3 6h14M3 14h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="8" cy="6" r="2.2" class="knob" stroke="currentColor" stroke-width="2" />
    <circle cx="13" cy="14" r="2.2" class="knob" stroke="currentColor" stroke-width="2" />
  {:else if name === 'check'}
    <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === 'back'}
    <path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === 'download'}
    <path d="M10 3v9M6 8l4 4 4-4M4 16h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === 'chevron'}
    <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === 'upload'}
    <path d="M10 13V4M6 8l4-4 4 4M4 16h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {/if}
</svg>

<style>
  .icon {
    flex: none;
    display: block;
  }
  .knob {
    fill: var(--color-field);
  }
</style>
