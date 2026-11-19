<script lang="ts">
  import Foldmark from '../../../components/Foldmark.svelte';
  import { newCategory } from '../actions';
  import { library } from '../state.svelte';

  // First use (design.html section 3). Shown only after loading finishes with zero links.
  let { onsave }: { onsave: () => void } = $props();

  let adding = $state(false);
  let name = $state('');
  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = await newCategory(name);
    if (typeof result === 'string') {
      error = result;
      return;
    }
    name = '';
    error = '';
    adding = false;
  }
</script>

<div class="empty">
  <Foldmark width={48} />
  <h2>Nothing saved yet</h2>
  <p>Save a page and it lands on a shelf here. Later, search finds it by any word on the page.</p>
  <ol>
    <li>Open a page you want to keep.</li>
    <li>Click the Penyemat button in your browser bar, or paste the address here.</li>
  </ol>
  <button class="btn" type="button" onclick={onsave}>+ Save your first link</button>
  <p class="label cats">Your categories</p>
  <div class="chips">
    {#each library.categories as category (category.id)}
      <span class="chip">{category.name}</span>
    {/each}
    {#if !adding}
      <button class="chip add" type="button" onclick={() => (adding = true)}>+ New category</button>
    {/if}
  </div>
  {#if adding}
    <form class="new" onsubmit={submit}>
      <label class="sr-only" for="first-category">New category name</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="first-category"
        class="input"
        bind:value={name}
        maxlength="40"
        autofocus
        placeholder="For example, Recipes"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'first-category-error' : undefined}
        onkeydown={(e) => {
          if (e.key === 'Escape') adding = false;
        }}
      />
      <button class="btn" type="submit">Add</button>
      <button class="btn btn-ghost" type="button" onclick={() => (adding = false)}>Cancel</button>
    </form>
    {#if error}<p class="errtext" id="first-category-error" role="alert">{error}</p>{/if}
  {/if}
  <p class="small">Pages you don't sort go to Unsorted. Add your own categories any time.</p>
</div>

<style>
  .empty {
    max-width: 560px;
    margin: var(--spacing-s6) auto var(--spacing-s7);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-s3);
  }
  h2 {
    font: 700 22px/1.2 var(--font-slab);
  }
  p,
  ol {
    color: var(--color-body);
  }
  ol {
    text-align: left;
    padding-left: 20px;
    list-style: decimal;
  }
  .new {
    display: flex;
    gap: var(--spacing-s2);
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    max-width: 440px;
  }
  .new .input {
    flex: 1;
    min-width: 180px;
  }
  .cats {
    margin-top: var(--spacing-s4);
    color: var(--color-umber);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-s2);
    justify-content: center;
  }
  .chip {
    font-size: 14px;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--color-chip);
    border: 1.5px solid transparent;
  }
  .chip.add {
    background: transparent;
    border: 1.5px dashed var(--color-umber);
    cursor: pointer;
  }
  .small {
    font-size: 14px;
  }
</style>
