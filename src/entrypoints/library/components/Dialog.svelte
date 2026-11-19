<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  // Modal dialog on a scrim. Esc closes unless busy; focus returns to where it was.
  let {
    title,
    onclose,
    busy = false,
    children,
    id,
  }: { title: string; onclose: () => void; busy?: boolean; children: Snippet; id: string } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const first = dialog?.querySelector<HTMLElement>('input, select, button:not(:disabled)');
    first?.focus();
    return () => previous?.focus?.();
  });

  function cancel(event: Event) {
    event.preventDefault();
    if (!busy) onclose();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="{id}-title" oncancel={cancel}>
  <div class="box">
    <h2 id="{id}-title">{title}</h2>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    /* Preflight zeroes margins; auto margins centre the modal. */
    margin: auto;
    border: 0;
    padding: 0;
    background: transparent;
    width: calc(100% - 32px);
    max-width: 440px;
    max-height: calc(100dvh - 32px);
    overflow: visible;
  }
  dialog::backdrop {
    background: var(--color-scrim);
  }
  .box {
    background: var(--color-leaf);
    border-radius: var(--radius-md);
    padding: var(--spacing-s5);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s4);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
  }
  h2 {
    font: 700 22px/1.2 var(--font-slab);
    overflow-wrap: anywhere;
  }
  .box :global(.actions) {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-s3);
    margin-top: var(--spacing-s2);
    flex-wrap: wrap;
  }
  .box :global(p) {
    color: var(--color-body);
  }
</style>
