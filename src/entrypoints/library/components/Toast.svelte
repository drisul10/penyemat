<script lang="ts">
  import { library } from '../state.svelte';

  // One toast at a time, bottom centre. Undo stays for 10 seconds.
  async function act() {
    const action = library.toast?.action;
    library.dismissToast();
    await action?.run();
  }
</script>

<div class="region" role="status" aria-live="polite">
  {#if library.toast}
    {#key library.toast.id}
      <div class="toast">
        <div class="text">
          <span>{library.toast.message}</span>
          {#if library.toast.detail}<span class="detail">{library.toast.detail}</span>{/if}
        </div>
        {#if library.toast.action}
          <button type="button" onclick={act}>{library.toast.action.label}</button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .region {
    position: fixed;
    left: 50%;
    bottom: var(--spacing-s5);
    transform: translateX(-50%);
    z-index: 50;
    width: max-content;
    max-width: calc(100vw - 32px);
  }
  .toast {
    background: var(--color-ink);
    color: var(--color-leaf);
    border-radius: var(--radius-md);
    padding: 12px var(--spacing-s4);
    display: flex;
    gap: var(--spacing-s4);
    align-items: center;
    font-size: 14px;
    animation: rise var(--toast-ms) ease-out both;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .detail {
    color: var(--color-spinner);
  }
  button {
    background: none;
    border: 0;
    color: var(--color-field);
    font: 600 14px/1 var(--font-sans);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    padding: 6px 0;
    flex: none;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  /* Reduced motion: fade only. */
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation-name: fade;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
