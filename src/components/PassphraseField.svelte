<script lang="ts">
  // Masked, Enter submits through the form, error under the field (design.html PassphraseField).
  let {
    id,
    label,
    value = $bindable(''),
    error = '',
    helper = '',
    autocomplete = 'current-password',
    autofocus = false,
  }: {
    id: string;
    label: string;
    value?: string;
    error?: string;
    helper?: string;
    autocomplete?: 'current-password' | 'new-password';
    autofocus?: boolean;
  } = $props();

  let input: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (autofocus) input?.focus();
  });
</script>

<div class="field">
  <label for={id}>{label}</label>
  <input
    {id}
    bind:this={input}
    class="input"
    type="password"
    bind:value
    {autocomplete}
    spellcheck="false"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
  />
  {#if error}
    <span class="errtext" id="{id}-error" role="alert">{error}</span>
  {:else if helper}
    <span class="helper" id="{id}-helper">{helper}</span>
  {/if}
</div>
