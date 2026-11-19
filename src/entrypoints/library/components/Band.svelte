<script lang="ts">
  import Icon from '../../../components/Icon.svelte';
  import { library } from '../state.svelte';

  // Brand band with the big search field (design.html section 1, SearchField).
  let {
    active = $bindable(0),
    onsave,
    disabled = false,
    input = $bindable(),
  }: { active?: number; onsave: () => void; disabled?: boolean; input?: HTMLInputElement } = $props();

  const compact = $derived(library.query.length > 0);
  const count = $derived(library.searchRows.length);

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      library.clearSearch();
      active = 0;
    } else if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      active = Math.min(count - 1, active + 1);
      document.getElementById(`result-${active}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      active = Math.max(0, active - 1);
      document.getElementById(`result-${active}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = library.searchRows[active];
      if (row?.kind === 'shelf') {
        library.clearSearch();
        location.hash = `#/shelf/${encodeURIComponent(row.id)}`;
      } else if (row) {
        window.open(row.bookmark.url, '_blank', 'noopener');
      }
    }
  }

  function oninput(event: Event) {
    active = 0;
    library.setQuery((event.target as HTMLInputElement).value);
  }
</script>

<header class="band" class:compact>
  <div class="band-top">
    <a class="logo" href="#/" aria-label="Penyemat library"><i aria-hidden="true"></i>Penyemat</a>
    <div class="end-actions">
      <a class="iconbtn" href="#/settings" aria-label="Settings" title="Settings"><Icon name="sliders" /></a>
      <button class="btn" type="button" onclick={onsave}>+ Save<span class="wide"> a link</span></button>
    </div>
  </div>
  <div class="hero">
    {#if !compact}<h1>What do you remember about it?</h1>{/if}
    <div class="search" role="search">
      <Icon name="search" size={20} />
      <label for="search" class="sr-only">Search inside your saved pages</label>
      <input
        id="search"
        bind:this={input}
        type="search"
        value={library.query}
        {oninput}
        onkeydown={keydown}
        {disabled}
        placeholder={disabled ? 'Save a page to start searching' : 'Search inside your saved pages'}
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-expanded={count > 0}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={count > 0 ? `result-${active}` : undefined}
      />
      {#if library.query}
        <button class="iconbtn" type="button" aria-label="Clear search" onclick={() => { library.clearSearch(); input?.focus(); }}>
          <Icon name="close" size={16} />
        </button>
      {:else}
        <span class="kbd" aria-hidden="true">/</span>
      {/if}
    </div>
    {#if !compact}<p class="help">Finds words in titles, addresses, and the full text of every page you save.</p>{/if}
  </div>
</header>

<style>
  .band {
    background: var(--color-field);
    padding: var(--spacing-s5) var(--spacing-s6) var(--spacing-s6);
  }
  .band-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-s4);
  }
  .logo {
    font: 700 20px/1 var(--font-slab);
    display: flex;
    align-items: center;
    gap: var(--spacing-s2);
    color: var(--color-ink);
    text-decoration: none;
  }
  .logo i {
    width: 18px;
    height: 22px;
    background: var(--color-ink);
    clip-path: polygon(0 0, 60% 0, 100% 35%, 100% 100%, 0 100%);
  }
  .end-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-s2);
  }
  .hero {
    max-width: 680px;
    margin: var(--spacing-s6) auto 0;
  }
  .compact .hero {
    margin-top: var(--spacing-s5);
  }
  h1 {
    font: 700 32px/1.15 var(--font-slab);
    text-align: center;
    text-wrap: balance;
    margin-bottom: 18px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--color-leaf);
    border: 2px solid var(--color-ink);
    border-radius: var(--radius-sm);
    padding: 0 var(--spacing-s3) 0 var(--spacing-s4);
    min-height: 56px;
  }
  .search:focus-within {
    outline: 2px solid var(--color-ink);
    outline-offset: 2px;
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    font-size: 17px;
    height: 52px;
    outline: none;
    color: var(--color-ink);
  }
  input::placeholder {
    color: var(--color-umber);
    opacity: 1;
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  input:disabled {
    cursor: not-allowed;
  }
  .kbd {
    font-size: 12px;
    color: var(--color-umber);
    border: 1px solid var(--color-control-line);
    border-radius: 3px;
    padding: 1px 6px;
  }
  .help {
    text-align: center;
    font-size: 14px;
    margin-top: 10px;
    color: var(--color-body);
  }
  @media (max-width: 700px) {
    .band {
      padding: var(--spacing-s4) var(--spacing-s4) var(--spacing-s5);
    }
    .hero {
      margin-top: var(--spacing-s5);
    }
    h1 {
      font-size: 24px;
    }
    .search {
      min-height: 52px;
    }
    input {
      font-size: 16px;
      height: 48px;
    }
    .kbd,
    .help,
    .wide {
      display: none;
    }
  }
  @media (max-width: 360px) {
    .logo {
      font-size: 18px;
    }
  }
</style>
