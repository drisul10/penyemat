<script lang="ts">
  import Icon from '../../../components/Icon.svelte';
  import PassphraseField from '../../../components/PassphraseField.svelte';
  import { MIN_PASSPHRASE } from '../../../lib/crypto/kdf';
  import { library } from '../state.svelte';
  import Dialog from './Dialog.svelte';

  // Locked shelf setup (F4.8, F4.10): 8+ characters, both entries match, and the box is ticked.
  let { onclose }: { onclose: () => void } = $props();
  let shelfName = $state('Locked');
  let passphrase = $state('');
  let again = $state('');
  let understood = $state(false);
  let busy = $state(false);
  let error = $state('');

  const longEnough = $derived([...passphrase].length >= MIN_PASSPHRASE);
  const mismatch = $derived(again.length > 0 && again !== passphrase);
  const ready = $derived(longEnough && again === passphrase && understood && shelfName.trim().length > 0);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    busy = true;
    error = '';
    try {
      await library.client?.ask({ type: 'setup', passphrase, shelfName: shelfName.trim() });
      library.showToast(`“${shelfName.trim()}” is set up and unlocked for now.`, { ms: 6000 });
      onclose();
    } catch {
      error = "Couldn't create the locked shelf. Try again.";
    } finally {
      busy = false;
    }
  }
</script>

<Dialog id="setup-lock" title="Set up your locked shelf" {onclose} {busy}>
  <form class="form" onsubmit={submit}>
    <p>Links on this shelf are encrypted on this device. You'll need your passphrase to open them.</p>
    <div class="field">
      <label for="shelf-name">Shelf name</label>
      <input id="shelf-name" class="input" bind:value={shelfName} maxlength="40" autocomplete="off" />
    </div>
    <PassphraseField
      id="setup-pass"
      label="Passphrase"
      bind:value={passphrase}
      autocomplete="new-password"
      helper="At least 8 characters. A longer phrase is harder to guess."
    />
    <PassphraseField
      id="setup-again"
      label="Type it again"
      bind:value={again}
      autocomplete="new-password"
      error={mismatch ? "The passphrases don't match." : ''}
    />
    <p class="warn">If you forget this passphrase, these links are gone for good. Penyemat can't reset or recover it.</p>
    <label class="checkrow">
      <input type="checkbox" bind:checked={understood} />
      <span class="box" aria-hidden="true">{#if understood}<Icon name="check" size={12} />{/if}</span>
      <span>I understand I can't recover a forgotten passphrase.</span>
    </label>
    {#if error}<p class="errtext" role="alert">{error}</p>{/if}
    <div class="actions">
      <button class="btn btn-ghost" type="button" onclick={onclose} disabled={busy}>Cancel</button>
      <button class="btn" type="submit" disabled={!ready || busy}>{busy ? 'Creating…' : 'Create locked shelf'}</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s4);
  }
  .checkrow {
    display: flex;
    gap: var(--spacing-s2);
    align-items: flex-start;
    font-size: 14px;
    cursor: pointer;
    position: relative;
  }
  .checkrow input {
    position: absolute;
    opacity: 0;
    width: 18px;
    height: 18px;
    margin: 1px 0 0;
  }
  .box {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-ink);
    border-radius: 3px;
    flex: none;
    display: grid;
    place-items: center;
    margin-top: 1px;
    color: var(--color-field);
  }
  .checkrow input:checked + .box {
    background: var(--color-ink);
  }
  .checkrow input:focus-visible + .box {
    outline: 2px solid var(--color-ink);
    outline-offset: 2px;
  }
</style>
