<script lang="ts">
  import PassphraseField from '../../../components/PassphraseField.svelte';
  import { MIN_PASSPHRASE } from '../../../lib/crypto/kdf';
  import { library } from '../state.svelte';
  import Dialog from './Dialog.svelte';

  // Change passphrase (F4.9): every locked link is re-encrypted in one step.
  let { onclose }: { onclose: () => void } = $props();
  let current = $state('');
  let next = $state('');
  let again = $state('');
  let busy = $state(false);
  let currentError = $state('');
  let error = $state('');

  const mismatch = $derived(again.length > 0 && again !== next);
  const ready = $derived(current.length > 0 && [...next].length >= MIN_PASSPHRASE && again === next);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    busy = true;
    currentError = '';
    error = '';
    try {
      await library.client?.ask({ type: 'change-passphrase', current, next });
      library.showToast('Passphrase changed. Use the new one from now on.', { ms: 6000 });
      onclose();
    } catch (failure) {
      if (failure instanceof Error && failure.message === 'wrong-passphrase') {
        currentError = "That passphrase doesn't match. Check it and try again.";
        current = '';
      } else {
        error = "Couldn't change the passphrase. Your old one still works.";
      }
    } finally {
      busy = false;
    }
  }
</script>

<Dialog id="change-pass" title="Change passphrase" {onclose} {busy}>
  <form class="form" onsubmit={submit}>
    <PassphraseField id="pass-current" label="Current passphrase" bind:value={current} error={currentError} />
    <PassphraseField id="pass-new" label="New passphrase" bind:value={next} autocomplete="new-password" helper="At least 8 characters." />
    <PassphraseField
      id="pass-again"
      label="Type it again"
      bind:value={again}
      autocomplete="new-password"
      error={mismatch ? "The passphrases don't match." : ''}
    />
    {#if error}<p class="errtext" role="alert">{error}</p>{/if}
    <div class="actions">
      <button class="btn btn-ghost" type="button" onclick={onclose} disabled={busy}>Cancel</button>
      <button class="btn" type="submit" disabled={!ready || busy}>
        {#if busy}<span class="spin small" aria-hidden="true"></span> Re-encrypting…{:else}Change passphrase{/if}
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
  .small {
    width: 14px;
    height: 14px;
    border-color: var(--color-umber);
    border-top-color: var(--color-field);
  }
</style>
