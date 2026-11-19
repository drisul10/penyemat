<script lang="ts">
  import PassphraseField from '../../../components/PassphraseField.svelte';
  import { library } from '../state.svelte';
  import Dialog from './Dialog.svelte';

  // Asked only when this library already has its own locked shelf (ARCHITECTURE 5.6).
  let {
    fileJson,
    ondone,
  }: { fileJson: string; ondone: (result: { added: number; updated: number; skipped: number } | null) => void } =
    $props();

  let filePass = $state('');
  let currentPass = $state('');
  let fileError = $state('');
  let currentError = $state('');
  let busy = $state(false);
  const needsCurrent = $derived(library.lock.state === 'locked');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !filePass || (needsCurrent && !currentPass)) return;
    busy = true;
    fileError = '';
    currentError = '';
    try {
      const result = await library.client?.ask<{ added: number; updated: number; skipped: number }>({
        type: 'locked-import',
        fileJson,
        filePassphrase: filePass,
        currentPassphrase: needsCurrent ? currentPass : undefined,
      });
      ondone(result ?? { added: 0, updated: 0, skipped: 0 });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : '';
      if (message === 'wrong-passphrase') {
        currentError = "That passphrase doesn't match. Check it and try again.";
        currentPass = '';
      } else if (message.includes("doesn't match this file")) {
        fileError = "That passphrase doesn't match this file. Check it and try again.";
        filePass = '';
      } else {
        fileError = "Couldn't add the locked links. Try again.";
      }
    } finally {
      busy = false;
    }
  }
</script>

<Dialog id="import-locked" title="This file has a locked shelf" onclose={() => ondone(null)} {busy}>
  <form class="form" onsubmit={submit}>
    <p>Enter the passphrase this file was exported with to add its locked links.</p>
    <PassphraseField id="file-pass" label="Passphrase for the file" bind:value={filePass} error={fileError} />
    {#if needsCurrent}
      <PassphraseField
        id="current-pass"
        label="Your current passphrase"
        bind:value={currentPass}
        error={currentError}
        helper="Your shelf is locked. Penyemat needs this passphrase to add the links."
      />
    {/if}
    <div class="actions">
      <button class="btn btn-ghost" type="button" onclick={() => ondone(null)} disabled={busy}>Skip locked links</button>
      <button class="btn" type="submit" disabled={busy || !filePass || (needsCurrent && !currentPass)}>
        {busy ? 'Adding…' : 'Add locked links'}
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
</style>
