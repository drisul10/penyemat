<script lang="ts">
  import type { Category } from '../lib/db/schema';
  import Icon from './Icon.svelte';

  // Category chips (design.html CategoryChips): single select, a tap sets the category at once.
  let {
    categories,
    selected = null,
    onpick,
    oncreate,
    showLocked = false,
    lockedOn = false,
    onlocked,
    label = 'Category',
  }: {
    categories: Category[];
    selected?: string | null;
    onpick: (id: string) => void;
    oncreate?: (name: string) => Promise<string | null>;
    showLocked?: boolean;
    lockedOn?: boolean;
    onlocked?: () => void;
    label?: string;
  } = $props();

  let adding = $state(false);
  let name = $state('');
  let error = $state('');
  let input: HTMLInputElement | undefined = $state();

  async function startAdd() {
    adding = true;
    error = '';
    await Promise.resolve();
    input?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!oncreate) return;
    const problem = await oncreate(name);
    if (problem) {
      error = problem;
      return;
    }
    name = '';
    adding = false;
  }

  function cancel(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      adding = false;
      name = '';
      error = '';
    }
  }
</script>

<div class="chips" role="radiogroup" aria-label={label}>
  {#each categories as category (category.id)}
    {@const on = selected === category.id}
    <button type="button" class="chip" class:on role="radio" aria-checked={on} onclick={() => onpick(category.id)}>
      {category.name}
      {#if on}<span class="tick"><Icon name="check" size={14} /></span>{/if}
    </button>
  {/each}
  {#if showLocked}
    <button type="button" class="chip" class:on={lockedOn} role="radio" aria-checked={lockedOn} onclick={() => onlocked?.()}>
      <Icon name="lock" size={16} /> Locked
      {#if lockedOn}<span class="tick"><Icon name="check" size={14} /></span>{/if}
    </button>
  {/if}
  {#if oncreate}
    {#if adding}
      <form class="add-form" onsubmit={submit}>
        <label class="sr-only" for="new-category">New category name</label>
        <input
          id="new-category"
          class="add-input"
          bind:this={input}
          bind:value={name}
          maxlength="40"
          placeholder="Category name"
          autocomplete="off"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'new-category-error' : undefined}
          onkeydown={cancel}
        />
        <button class="chip on" type="submit">Add</button>
      </form>
    {:else}
      <button type="button" class="chip add" onclick={startAdd}>+ New</button>
    {/if}
  {/if}
</div>
{#if error}<p class="errtext" id="new-category-error" role="alert">{error}</p>{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-s2);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    line-height: 1.3;
    padding: 7px 12px;
    min-height: 34px;
    border-radius: 999px;
    background: var(--color-chip);
    border: 1.5px solid transparent;
    color: var(--color-ink);
    cursor: pointer;
    max-width: 100%;
  }
  .chip:hover {
    border-color: var(--color-umber);
  }
  .chip.on {
    background: var(--color-ink);
    color: var(--color-field);
    font-weight: 600;
  }
  .tick {
    display: inline-flex;
    animation: tick var(--quick-ms) ease-out both;
  }
  @keyframes tick {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
  .chip.add {
    background: transparent;
    border: 1.5px dashed var(--color-umber);
  }
  .add-form {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .add-input {
    height: 34px;
    border-radius: 999px;
    border: 1.5px solid var(--color-umber);
    background: var(--color-white);
    padding: 0 12px;
    font-size: 14px;
    width: 160px;
  }
  .errtext {
    margin-top: 6px;
  }
</style>
