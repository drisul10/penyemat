<script lang="ts">
  import PassphraseField from '../../../components/PassphraseField.svelte';
  import type { Bookmark } from '../../../lib/db/schema';
  import { cut } from '../format';
  import { library } from '../state.svelte';
  import Dialog from './Dialog.svelte';

  // Move a saved link onto the locked shelf from the library (F4.7, same warning as the popup chip).
  let { bookmark, onclose }: { bookmark: Bookmark; onclose: () => void } = $props();

  let passphrase = $state('');
  let error = $state('');
  let busy = $state(false);
  const needsPassphrase = $derived(library.lock.state !== 'unlocked');
  const shelfName = $derived(library.lock.state === 'none' ? 'Locked' : library.lock.shelfName);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || (needsPassphrase && !passphrase)) return;
    busy = true;
    error = '';
    try {
      await library.client?.ask({
        type: 'move-to-locked',
        bookmarkId: bookmark.id,
        passphrase: needsPassphrase ? passphrase : undefined,
      });
      library.showToast(`Moved “${cut(bookmark.title)}” to ${shelfName}.`, { ms: 5000 });
      onclose();
    } catch (failure) {
      error =
        failure instanceof Error && failure.message === 'wrong-passphrase'
          ? "That passphrase doesn't match. Check it and try again."
          : "Couldn't move the link. Try again.";
    } finally {
      passphrase = '';
      busy = false;
    }
  }
</script>

<Dialog id="move-locked" title="Move to {shelfName}?" {onclose} {busy}>
  <form class="form" onsubmit={submit}>
    <p class="link">{bookmark.title}</p>
    <p>
      This link is saved without encryption. Moving it encrypts it, but traces of the unencrypted copy may stay on this
      device.
    </p>
    {#if needsPassphrase}
      <PassphraseField id="move-locked-pass" label="Passphrase" bind:value={passphrase} {error} autofocus />
    {:else if error}
      <p class="errtext" role="alert">{error}</p>
    {/if}
    <div class="actions">
      <button class="btn btn-ghost" type="button" onclick={onclose} disabled={busy}>Cancel</button>
      <button class="btn" type="submit" disabled={busy || (needsPassphrase && !passphrase)}>
        {busy ? 'Moving…' : 'Move to Locked'}
      </button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s4);
  }
  .link {
    font-weight: 600;
    color: var(--color-ink);
    overflow-wrap: anywhere;
  }
</style>
