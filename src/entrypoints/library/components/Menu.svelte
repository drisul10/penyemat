<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  // Popover menu: first item focused on open, arrow keys move, Esc or outside click closes.
  let {
    label,
    onclose,
    children,
    align = 'right',
  }: { label: string; onclose: () => void; children: Snippet; align?: 'left' | 'right' } = $props();
  let menu: HTMLDivElement | undefined = $state();

  const items = () => [
    ...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"], input') ?? []),
  ];

  onMount(() => {
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      if (menu && !menu.contains(event.target as Node)) onclose();
    };
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
    return () => document.removeEventListener('pointerdown', outside);
  });

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onclose();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    event.preventDefault();
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    list[(next + list.length) % list.length]?.focus();
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="menu {align}" role="menu" aria-label={label} bind:this={menu} onkeydown={keydown}>
  {@render children()}
</div>

<style>
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    z-index: 20;
    background: var(--color-white);
    border-radius: var(--radius-md);
    box-shadow:
      0 0 0 1px var(--color-menu-line),
      0 8px 24px var(--color-menu-shadow);
    padding: 6px;
    min-width: 210px;
    max-width: min(280px, calc(100vw - 32px));
    max-height: min(420px, 70vh);
    overflow-y: auto;
  }
  .right {
    right: 0;
  }
  .left {
    left: 0;
  }
  .menu :global(button) {
    display: flex;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    font: 500 14px/1.3 var(--font-sans);
    color: var(--color-ink);
    gap: var(--spacing-s2);
    align-items: center;
    cursor: pointer;
  }
  .menu :global(button:hover),
  .menu :global(button:focus-visible) {
    background: var(--color-chip);
    outline: none;
  }
  .menu :global(button.danger) {
    color: var(--color-tomato);
  }
  .menu :global(hr) {
    border: 0;
    border-top: 1px solid var(--color-line);
    margin: 4px 0;
  }
  .menu :global(.ttl) {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-umber);
    padding: 6px 10px 4px;
  }
  .menu :global(.check) {
    margin-left: auto;
    display: inline-flex;
  }
  .menu :global(.name) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
</style>
