<script lang="ts">
  import Icon from '../../../components/Icon.svelte';
  import PassphraseField from '../../../components/PassphraseField.svelte';
  import { deleteLockedLink, moveFromLocked, newCategory } from '../actions';
  import { drag, LOCKED_TARGET } from '../drag.svelte';
  import { plural } from '../format';
  import { library } from '../state.svelte';
  import Card from './Card.svelte';
  import CardGrid from './CardGrid.svelte';

  // Locked shelf (design.html section 6). Closed: name and lock only, no count, no cards.
  let { full = false }: { full?: boolean } = $props();

  let unlocking = $state(false);
  let busy = $state(false);
  let passphrase = $state('');
  let error = $state('');

  const lock = $derived(library.lock);
  const items = $derived(lock.state === 'unlocked' ? lock.items : []);
  const shown = $derived(full ? items : items.slice(0, 4));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !passphrase) return;
    busy = true;
    error = '';
    try {
      await library.client?.ask({ type: 'unlock', passphrase });
      unlocking = false;
    } catch (failure) {
      error =
        failure instanceof Error && failure.message === 'wrong-passphrase'
          ? "That passphrase doesn't match. Check it and try again."
          : "Couldn't unlock the shelf. Try again.";
    } finally {
      passphrase = '';
      busy = false;
    }
  }
</script>

{#if lock.state !== 'none'}
  <section
    class="shelf"
    aria-labelledby="locked-shelf-name"
    data-testid="locked-shelf"
    data-drop-target={LOCKED_TARGET}
    class:drop-over={drag.over === LOCKED_TARGET}
    class:drop-home={drag.home === LOCKED_TARGET}
  >
    <div class="shelf-h">
      <h2 class="name" id="locked-shelf-name">
        <Icon name={lock.state === 'unlocked' ? 'unlock' : 'lock'} size={16} />
        <span class="text">{lock.shelfName}</span>
      </h2>
      {#if lock.state === 'unlocked'}
        <span class="count num">{items.length}</span>
        <div class="end">
          <span class="helper idle">Locks after {plural(library.settings.idleMinutes, 'idle minute', 'idle minutes')}</span>
          {#if !full && items.length > 4}<a class="link" href="#/shelf/locked">See all</a>{/if}
          <button class="btn btn-ghost" type="button" onclick={() => library.client?.lock()}>
            <Icon name="lock" size={16} /> Lock now
          </button>
        </div>
      {/if}
    </div>

    {#if lock.state === 'locked'}
      {#if unlocking}
        <form class="unlock-row" onsubmit={submit}>
          <PassphraseField id="unlock-pass" label="Passphrase" bind:value={passphrase} {error} autofocus />
          <div class="buttons">
            <button class="btn" type="submit" disabled={busy || !passphrase}>{busy ? 'Unlocking…' : 'Unlock'}</button>
            <button class="btn btn-ghost" type="button" disabled={busy} onclick={() => { unlocking = false; error = ''; passphrase = ''; }}>Cancel</button>
          </div>
        </form>
      {:else}
        <div class="sealed">
          <p>Unlock to see these links.</p>
          <button class="btn btn-ghost" type="button" onclick={() => (unlocking = true)}>Unlock</button>
        </div>
      {/if}
    {:else if items.length === 0}
      <p class="empty">Nothing here yet. Right-click a page or the Penyemat button and choose Save to Locked.</p>
    {:else}
      <CardGrid label="{lock.shelfName} links">
        {#each shown as item (item.recordId)}
          <div role="listitem">
            <Card
              bookmark={item.bookmark}
              categories={library.categories}
              current={null}
              onmove={(categoryId) => moveFromLocked(item, categoryId)}
              oncreate={async (name) => {
                const result = await newCategory(name);
                if (typeof result === 'string') return result;
                await moveFromLocked(item, result.id);
                return null;
              }}
              ondelete={() => deleteLockedLink(item)}
              dragItem={{ kind: 'locked', item }}
            />
          </div>
        {/each}
      </CardGrid>
    {/if}
  </section>
{/if}

<style>
  .shelf {
    margin-top: var(--spacing-s5);
  }
  .shelf-h {
    display: flex;
    align-items: center;
    gap: var(--spacing-s3);
    margin-bottom: var(--spacing-s3);
    flex-wrap: wrap;
    min-height: 32px;
  }
  .name {
    font: 700 18px/1.2 var(--font-slab);
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    font-size: 13px;
    color: var(--color-umber);
  }
  .end {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--spacing-s3);
    flex-wrap: wrap;
  }
  .sealed {
    display: flex;
    align-items: center;
    gap: var(--spacing-s3);
    flex-wrap: wrap;
    background: var(--color-chip);
    border-radius: var(--radius-sm);
    padding: var(--spacing-s4);
  }
  .sealed p {
    flex: 1;
    min-width: 180px;
    font-size: 14px;
    color: var(--color-body);
  }
  .unlock-row {
    display: flex;
    gap: var(--spacing-s2);
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .unlock-row :global(.field) {
    flex: 1;
    min-width: 200px;
    max-width: 420px;
  }
  .buttons {
    display: flex;
    gap: var(--spacing-s2);
    margin-top: 27px;
  }
  .empty {
    font-size: 14px;
    color: var(--color-body);
  }
  @media (max-width: 520px) {
    .buttons {
      margin-top: 0;
    }
    .idle {
      flex-basis: 100%;
      order: 2;
    }
  }
</style>
