<script lang="ts" generics="T extends string | number">
  import { onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';

  // Single-choice picker styled like the card ⋯ menu (WAI-ARIA listbox pattern).
  // Arrow keys move, Enter or Space picks, Esc or Tab closes; focus returns to the button.
  let {
    id,
    options,
    value,
    onchange,
    describedby,
    labelledby,
  }: {
    id: string;
    options: { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
    describedby?: string;
    labelledby?: string;
  } = $props();

  let open = $state(false);
  let active = $state(0);
  let root: HTMLDivElement | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  const selectedIndex = $derived(
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const current = $derived(options[selectedIndex]);

  async function show() {
    active = selectedIndex;
    open = true;
    await tick();
    list?.focus();
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }

  function hide(focusButton = true) {
    open = false;
    if (focusButton) button?.focus();
  }

  function pick(index: number) {
    const option = options[index];
    if (option && option.value !== value) onchange(option.value);
    hide();
  }

  function move(to: number) {
    active = Math.min(options.length - 1, Math.max(0, to));
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }

  function buttonKey(event: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      void show();
    }
  }

  function listKey(event: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(active + 1),
      ArrowUp: () => move(active - 1),
      Home: () => move(0),
      End: () => move(options.length - 1),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => hide(),
    };
    if (event.key === 'Tab') {
      hide(false);
      return;
    }
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  onMount(() => {
    const outside = (event: PointerEvent) => {
      if (open && root && !root.contains(event.target as Node)) hide(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  });
</script>

<div class="select" bind:this={root}>
  <button
    {id}
    bind:this={button}
    type="button"
    class="trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-labelledby={labelledby ? `${labelledby} ${id}` : undefined}
    aria-describedby={describedby}
    onclick={() => (open ? hide() : show())}
    onkeydown={buttonKey}
  >
    <span>{current?.label}</span>
    <span class="chevron" class:up={open}><Icon name="chevron" size={14} /></span>
  </button>
  {#if open}
    <ul
      id="{id}-list"
      class="list"
      role="listbox"
      tabindex="-1"
      aria-labelledby={labelledby}
      aria-activedescendant="{id}-opt-{active}"
      bind:this={list}
      onkeydown={listKey}
    >
      {#each options as option, i (option.value)}
        {@const selected = option.value === value}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id="{id}-opt-{i}"
          role="option"
          aria-selected={selected}
          class:active={i === active}
          onpointermove={() => (active = i)}
          onclick={() => pick(i)}
        >
          <span>{option.label}</span>
          {#if selected}<span class="check"><Icon name="check" size={14} /></span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .select {
    position: relative;
    display: inline-block;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-s3);
    height: 44px;
    min-width: 168px;
    border: 1.5px solid var(--color-umber);
    border-radius: var(--radius-sm);
    background: var(--color-white);
    padding: 0 var(--spacing-s3);
    font-size: 15px;
    color: var(--color-ink);
    cursor: pointer;
  }
  .trigger:hover {
    border-color: var(--color-ink);
  }
  .trigger[aria-expanded='true'] {
    border-color: var(--color-ink);
    box-shadow: inset 0 0 0 1px var(--color-ink);
  }
  .chevron {
    display: inline-flex;
    transition: transform var(--quick-ms) ease-out;
  }
  .chevron.up {
    transform: rotate(180deg);
  }
  .list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    min-width: 100%;
    max-height: min(320px, 50vh);
    overflow-y: auto;
    margin: 0;
    padding: 6px;
    list-style: none;
    background: var(--color-white);
    border-radius: var(--radius-md);
    box-shadow:
      0 0 0 1px var(--color-menu-line),
      0 8px 24px var(--color-menu-shadow);
    outline: none;
    animation: drop var(--quick-ms) ease-out both;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--spacing-s2);
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    font: 500 14px/1.3 var(--font-sans);
    color: var(--color-ink);
    cursor: pointer;
    white-space: nowrap;
  }
  li.active {
    background: var(--color-chip);
  }
  li[aria-selected='true'] {
    font-weight: 600;
  }
  .check {
    margin-left: auto;
    display: inline-flex;
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
</style>
