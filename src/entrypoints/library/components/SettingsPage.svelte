<script lang="ts">
  import { browser } from 'wxt/browser';
  import Icon from '../../../components/Icon.svelte';
  import Select from '../../../components/Select.svelte';
  import {
    autosavePath,
    cleanFolder,
    DEFAULT_FOLDER,
    FolderError,
    KEEP_IN_BROWSER,
    listStoredBackups,
    readStoredBackup,
  } from '../../../lib/backup/autosave';
  import {
    adoptLocked,
    exportLibrary,
    type ImportCounts,
    importPlain,
    lockedImportPlan,
  } from '../../../lib/backup/backup';
  import { type ExportFile, ImportError, parseExport } from '../../../lib/backup/format';
  import { IDLE_MAX, IDLE_MIN, updateSettings } from '../../../lib/db/settings';
  import { shortDate } from '../format';
  import { library } from '../state.svelte';
  import ChangePassphraseDialog from './ChangePassphraseDialog.svelte';
  import ImportLockedDialog from './ImportLockedDialog.svelte';
  import SetupLockDialog from './SetupLockDialog.svelte';

  // Settings (design.html section 7): idle relock, passphrase, export, import.
  const IDLE_CHOICES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60].filter((m) => m >= IDLE_MIN && m <= IDLE_MAX);

  let dialog = $state<'setup' | 'change' | null>(null);
  let exporting = $state(false);
  let exportError = $state('');
  let importing = $state(false);
  let importError = $state('');
  let pendingLocked = $state<{ json: string; file: ExportFile; counts: ImportCounts } | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  const choices = $derived(
    IDLE_CHOICES.includes(library.settings.idleMinutes)
      ? IDLE_CHOICES
      : [...IDLE_CHOICES, library.settings.idleMinutes].sort((a, b) => a - b),
  );

  async function setIdle(minutes: number) {
    await updateSettings({ idleMinutes: minutes });
  }

  async function runExport() {
    exporting = true;
    exportError = '';
    try {
      const { json, fileName } = await exportLibrary();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      library.showToast('Exported your library. Keep the file somewhere safe.', { ms: 5000 });
    } catch {
      exportError = "Couldn't export. Try again.";
    } finally {
      exporting = false;
    }
  }

  function summary(counts: ImportCounts) {
    library.showToast(`Import finished: ${counts.added} added, ${counts.updated} updated, ${counts.skipped} skipped.`, {
      detail: counts.lockedSkipped ? 'Skipped the locked links in the file.' : undefined,
    });
  }

  // ---- Autosave (owner's choice, 2026-11-19) ----

  let autosaveBusy = $state(false);
  let autosaveNote = $state('');
  let editingFolder = $state(false);
  let folderDraft = $state('');
  let folderError = $state('');
  let stored = $state<{ id: number; at: number; size: number }[]>([]);
  let restoring = $state<number | null>(null);
  const autosaveOn = $derived(Boolean(library.settings.autosave));
  const downloadsPath = $derived(`Downloads/${autosavePath(library.settings.autosaveFolder)}`);
  // Chromium can save into any folder the user picks; Firefox only inside Downloads.
  const canPick = typeof window.showDirectoryPicker === 'function';
  const pickedDir = $derived(library.settings.autosaveDir ?? null);
  const path = $derived(pickedDir ? `${pickedDir.name}/penyemat-backup.json` : downloadsPath);

  async function chooseFolder() {
    autosaveNote = '';
    try {
      const picker = window.showDirectoryPicker;
      if (!picker) return;
      const dir = await picker({ id: 'penyemat-autosave', mode: 'readwrite', startIn: 'documents' });
      await updateSettings({ autosaveDir: dir, autosaveDirBlocked: false });
      await saveNow();
    } catch (error) {
      // Closing the picker is not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      autosaveNote = "Couldn't use that folder. Pick another one, or keep saving to Downloads.";
    }
  }

  async function useDownloads() {
    await updateSettings({ autosaveDir: null, autosaveDirBlocked: false });
    await saveNow();
  }

  async function allowFolder() {
    const dir = library.settings.autosaveDir;
    if (!dir) return;
    if ((await dir.requestPermission({ mode: 'readwrite' })) === 'granted') {
      await updateSettings({ autosaveDirBlocked: false });
      await saveNow();
    }
  }

  $effect(() => {
    // Refresh the list whenever an autosave lands (settings reload on every change).
    void library.settings.lastAutosaveAt;
    void listStoredBackups().then((rows) => (stored = rows));
  });

  const when = (at: number) =>
    `${shortDate(at)}, ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const megabytes = (size: number) =>
    size < 1_000_000 ? `${Math.max(1, Math.round(size / 1000))} KB` : `${(size / 1_000_000).toFixed(1)} MB`;

  async function saveNow() {
    autosaveBusy = true;
    autosaveNote = '';
    try {
      // A failure is stored in settings and shown in the status line.
      await browser.runtime.sendMessage({ type: 'autosave-now' });
    } catch {
      autosaveNote = "Couldn't reach Penyemat's background. Reload this page and try again.";
    } finally {
      autosaveBusy = false;
    }
  }

  async function toggleAutosave() {
    const next = !autosaveOn;
    await updateSettings({ autosave: next });
    if (next) await saveNow();
  }

  function startFolder() {
    folderDraft = library.settings.autosaveFolder ?? DEFAULT_FOLDER;
    folderError = '';
    editingFolder = true;
  }

  async function saveFolder(event: SubmitEvent) {
    event.preventDefault();
    try {
      const folder = cleanFolder(folderDraft);
      await updateSettings({ autosaveFolder: folder });
      editingFolder = false;
      await saveNow();
    } catch (error) {
      folderError = error instanceof FolderError ? error.message : "Couldn't change the folder. Try again.";
    }
  }

  async function restore(id: number) {
    restoring = id;
    try {
      await importJson(await readStoredBackup(id));
    } catch {
      importError = "Couldn't read that backup. Try another one.";
    } finally {
      restoring = null;
    }
  }

  async function onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0];
    input.value = '';
    if (!chosen) return;
    await importJson(await chosen.text());
  }

  async function importJson(json: string) {
    importing = true;
    importError = '';
    try {
      const file = parseExport(json);
      const counts = await importPlain(file);
      const plan = await lockedImportPlan(file);
      if (plan === 'adopt') {
        counts.added += await adoptLocked(file);
      } else if (plan === 'needs-passphrase') {
        pendingLocked = { json, file, counts };
        return;
      }
      summary(counts);
    } catch (error) {
      importError = error instanceof ImportError ? error.message : "Couldn't import that file. Try again.";
    } finally {
      importing = false;
    }
  }

  function lockedDone(result: { added: number; updated: number; skipped: number } | null) {
    if (!pendingLocked) return;
    const counts = { ...pendingLocked.counts };
    if (result) {
      counts.added += result.added;
      counts.updated += result.updated;
      counts.skipped += result.skipped;
    } else {
      counts.lockedSkipped = true;
    }
    pendingLocked = null;
    summary(counts);
  }
</script>

<header class="band">
  <div class="band-top">
    <a class="logo" href="#/"><i aria-hidden="true"></i>Penyemat</a>
    <a class="backlink" href="#/"><Icon name="back" size={16} /> Library</a>
  </div>
</header>

<main class="settings">
  <h1>Settings</h1>

  <section class="set-sec" aria-labelledby="sec-locked">
    <h2 id="sec-locked"><Icon name="lock" size={16} /> Locked shelf</h2>
    {#if library.lock.state === 'none'}
      <p>Keep private links on one shelf that only opens with your passphrase. They're encrypted on this device.</p>
      <div class="solo"><button class="btn" type="button" onclick={() => (dialog = 'setup')}>Set up a locked shelf</button></div>
    {:else}
      <div class="set-row">
        <span class="lbl" id="idle-label">Lock after</span>
        <div class="ctl">
          <Select
            id="idle"
            labelledby="idle-label"
            describedby="idle-help"
            options={choices.map((minutes) => ({ value: minutes, label: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` }))}
            value={library.settings.idleMinutes}
            onchange={setIdle}
          />
          <span class="helper" id="idle-help">Locks when no library tab has been used for this long. 1 to 60 minutes.</span>
        </div>
      </div>
      <div class="set-row">
        <span class="lbl">Passphrase</span>
        <div class="ctl"><button class="btn btn-ghost" type="button" onclick={() => (dialog = 'change')}>Change passphrase</button></div>
      </div>
    {/if}
  </section>

  <section class="set-sec" aria-labelledby="sec-backup">
    <h2 id="sec-backup">Backup</h2>
    <p>Penyemat keeps everything in this browser only. Export a file to keep a copy.</p>
    <div class="set-row">
      <span class="lbl">Export</span>
      <div class="ctl">
        <button class="btn" type="button" onclick={runExport} disabled={exporting}>
          <Icon name="download" size={16} /> {exporting ? 'Exporting…' : 'Export library'}
        </button>
        <span class="helper">
          {#if library.settings.lastExportAt}
            Last export: <span class="num">{shortDate(library.settings.lastExportAt)}</span>.
          {:else}
            Never exported.
          {/if}
          Locked links stay encrypted in the file.
        </span>
        {#if exportError}<span class="errtext" role="alert">{exportError}</span>{/if}
      </div>
    </div>
    <div class="set-row">
      <span class="lbl">Import</span>
      <div class="ctl">
        <input bind:this={fileInput} class="sr-only" id="import-file" type="file" accept="application/json,.json" onchange={onFile} tabindex="-1" />
        <button class="btn btn-ghost" type="button" onclick={() => fileInput?.click()} disabled={importing}>
          <Icon name="upload" size={16} /> {importing ? 'Importing…' : 'Import from file'}
        </button>
        <span class="helper">If a page is in both, Penyemat keeps the newer copy.</span>
        {#if importError}<span class="errtext" role="alert">{importError}</span>{/if}
      </div>
    </div>
    <div class="set-row">
      <span class="lbl" id="autosave-label">Autosave</span>
      <div class="ctl">
        <button
          type="button"
          class="switch"
          role="switch"
          aria-checked={autosaveOn}
          aria-labelledby="autosave-label"
          aria-describedby="autosave-help"
          onclick={toggleAutosave}
        >
          <span class="track" aria-hidden="true"><span class="knob"></span></span>
          <span>{autosaveOn ? 'On' : 'Off'}</span>
        </button>
        <span class="helper" id="autosave-help">
          Saves a backup file when something changed, at most once an hour. Penyemat also keeps the last
          {KEEP_IN_BROWSER} copies in this browser.
        </span>
        {#if autosaveOn}
          {#if editingFolder}
            <form class="folder" onsubmit={saveFolder}>
              <label for="autosave-folder" class="small-lbl">Folder inside Downloads</label>
              <div class="folder-row">
                <input
                  id="autosave-folder"
                  class="input"
                  bind:value={folderDraft}
                  maxlength="80"
                  autocomplete="off"
                  aria-invalid={folderError ? 'true' : undefined}
                  aria-describedby={folderError ? 'autosave-folder-error' : undefined}
                />
                <button class="btn" type="submit">Save</button>
                <button class="btn btn-ghost" type="button" onclick={() => (editingFolder = false)}>Cancel</button>
              </div>
              {#if folderError}<span class="errtext" id="autosave-folder-error" role="alert">{folderError}</span>{/if}
            </form>
          {:else}
            <p class="path">
              <span class="helper">Saves to</span> <code>{path}</code>
              {#if canPick}
                <button class="link" type="button" onclick={chooseFolder}>Choose folder…</button>
                {#if pickedDir}
                  <button class="link link-quiet" type="button" onclick={useDownloads}>Use Downloads instead</button>
                {/if}
              {:else}
                <button class="link" type="button" onclick={startFolder}>Change folder</button>
              {/if}
            </p>
            {#if pickedDir}
              <span class="helper">Your browser shows only the folder's name, not where it is.</span>
            {:else if !canPick}
              <span class="helper">This browser can save backups only inside its Downloads folder.</span>
            {/if}
            {#if pickedDir && library.settings.autosaveDirBlocked}
              <div class="warn blocked" role="alert">
                <p>
                  Your browser needs your OK again to save in “{pickedDir.name}”. Until then, backups go to
                  <code>{downloadsPath}</code>.
                </p>
                <button class="btn" type="button" onclick={allowFolder}>Allow access</button>
              </div>
            {/if}
          {/if}
          <p class="helper" role="status">
            {#if autosaveBusy}
              Saving a backup…
            {:else if library.settings.lastAutosaveError}
              <span class="errtext">
                The last autosave failed: {library.settings.lastAutosaveError}. Penyemat tries again within the hour.
              </span>
            {:else if library.settings.lastAutosaveAt}
              Last autosave: <span class="num">{when(library.settings.lastAutosaveAt)}</span>.
            {:else}
              No autosave yet.
            {/if}
          </p>
          {#if autosaveNote}<span class="errtext" role="alert">{autosaveNote}</span>{/if}
          <button class="btn btn-ghost" type="button" onclick={saveNow} disabled={autosaveBusy}>Save a backup now</button>
        {/if}
      </div>
    </div>
    {#if stored.length}
      <div class="set-row">
        <span class="lbl">In this browser</span>
        <div class="ctl">
          <ul class="stored">
            {#each stored as backup (backup.id)}
              <li>
                <span class="num">{when(backup.at)}</span>
                <span class="helper num">{megabytes(backup.size)}</span>
                <button class="link" type="button" disabled={restoring !== null} onclick={() => restore(backup.id)}>
                  {restoring === backup.id ? 'Restoring…' : 'Restore'}
                </button>
              </li>
            {/each}
          </ul>
          <span class="helper">Restore brings back links from that copy. Links you saved or changed since then stay.</span>
        </div>
      </div>
    {/if}
  </section>
</main>

{#if dialog === 'setup'}<SetupLockDialog onclose={() => (dialog = null)} />{/if}
{#if dialog === 'change'}<ChangePassphraseDialog onclose={() => (dialog = null)} />{/if}
{#if pendingLocked}<ImportLockedDialog fileJson={pendingLocked.json} ondone={lockedDone} />{/if}

<style>
  .band {
    background: var(--color-field);
    padding: var(--spacing-s5) var(--spacing-s6);
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
  .backlink {
    color: var(--color-ink);
    font-weight: 600;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-decoration: none;
    min-height: 32px;
  }
  .backlink:hover {
    text-decoration: underline;
  }
  .settings {
    max-width: 760px;
    margin: 0 auto;
    padding: var(--spacing-s5) var(--spacing-s6) var(--spacing-s7);
  }
  h1 {
    font: 700 26px/1.2 var(--font-slab);
  }
  .set-sec {
    margin-top: var(--spacing-s6);
    padding-top: var(--spacing-s5);
    border-top: 1px solid var(--color-line);
  }
  h2 {
    font: 700 18px/1.2 var(--font-slab);
    display: flex;
    align-items: center;
    gap: var(--spacing-s2);
  }
  .set-sec > p {
    font-size: 14px;
    color: var(--color-body);
    margin-top: 6px;
    max-width: 60ch;
  }
  .solo {
    margin-top: var(--spacing-s4);
  }
  .set-row {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: var(--spacing-s4);
    padding: var(--spacing-s4) 0;
    border-bottom: 1px solid var(--color-line);
    align-items: start;
  }
  .set-row:last-child {
    border-bottom: 0;
  }
  .lbl {
    font-weight: 600;
    font-size: 15px;
    padding-top: 10px;
  }
  .ctl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-s2);
    background: none;
    border: 0;
    padding: 4px 0;
    font: 600 14px/1 var(--font-sans);
    color: var(--color-ink);
    cursor: pointer;
  }
  .track {
    width: 40px;
    height: 24px;
    border-radius: 999px;
    background: var(--color-white);
    box-shadow: inset 0 0 0 1.5px var(--color-umber);
    position: relative;
    transition: background var(--quick-ms) ease-out;
  }
  .knob {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-umber);
    transition: transform var(--quick-ms) ease-out;
  }
  .switch[aria-checked='true'] .track {
    background: var(--color-ink);
    box-shadow: none;
  }
  .switch[aria-checked='true'] .knob {
    background: var(--color-field);
    transform: translateX(16px);
  }
  .path {
    font-size: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: baseline;
  }
  code {
    font-size: 13px;
    background: var(--color-chip);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    overflow-wrap: anywhere;
  }
  .blocked {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-s2);
    max-width: 520px;
  }
  .folder {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 440px;
  }
  .small-lbl {
    font-weight: 600;
    font-size: 14px;
  }
  .folder-row {
    display: flex;
    gap: var(--spacing-s2);
    flex-wrap: wrap;
  }
  .folder-row .input {
    flex: 1;
    min-width: 160px;
  }
  .stored {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stored li {
    display: flex;
    gap: var(--spacing-s3);
    align-items: baseline;
    font-size: 14px;
  }
  @media (max-width: 700px) {
    .band {
      padding: var(--spacing-s4);
    }
    .settings {
      padding: var(--spacing-s4);
    }
    .set-row {
      grid-template-columns: 1fr;
      gap: var(--spacing-s2);
    }
    .lbl {
      padding-top: 0;
    }
  }
</style>
