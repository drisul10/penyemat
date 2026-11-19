import { expect, openLibrary, savePage, test } from './extension';

const PASTA = 'https://recipes.example.com/lemon-pasta';

test('autosave: off by default; turning it on saves a backup that can be restored', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext, '#/settings');
  const toggle = library.getByRole('switch', { name: 'Autosave' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(library.getByText('Downloads/Penyemat/penyemat-backup.json')).toBeVisible();
  await expect(library.getByText(/Last autosave:/)).toBeVisible({ timeout: 15_000 });
  await expect(library.getByRole('button', { name: 'Restore' })).toHaveCount(1);

  // A mistake: the link is deleted. Restoring the copy kept in the browser brings it back.
  await library.getByRole('link', { name: 'Library' }).click();
  const unsorted = library.getByRole('region', { name: 'Unsorted' });
  await unsorted.getByRole('button', { name: /Options for Lemon ricotta/ }).click();
  await library.getByRole('menuitem', { name: 'Delete link' }).click();
  await expect(library.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
  await library.getByRole('link', { name: 'Settings' }).click();
  await library.getByRole('button', { name: 'Restore' }).first().click();
  await expect(library.getByText('Import finished: 1 added, 0 updated, 0 skipped.')).toBeVisible();
  await library.getByRole('link', { name: 'Library' }).click();
  await expect(library.getByRole('link', { name: /Lemon ricotta/ })).toBeVisible();
});

test('autosave writes into a picked folder from the background', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext, '#/settings');
  // The native folder picker can't be automated; the browser's private storage gives a real,
  // always-allowed folder handle to store in its place.
  await library.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('Backups', { create: true });
    const open = indexedDB.open('penyemat');
    const db: IDBDatabase = await new Promise((resolve) => {
      open.onsuccess = () => resolve(open.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const get = store.get('settings');
      get.onsuccess = () => store.put({ ...get.result, autosave: true, autosaveDir: dir });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
  await library.reload();
  await expect(library.getByText('Backups/penyemat-backup.json')).toBeVisible();
  await expect(library.getByRole('button', { name: 'Use Downloads instead' })).toBeVisible();
  await library.getByRole('button', { name: 'Save a backup now' }).click();
  await expect(library.getByText(/Last autosave:/)).toBeVisible();
  const saved = await library.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('Backups');
    const file = await (await dir.getFileHandle('penyemat-backup.json')).getFile();
    return file.text();
  });
  expect(saved).toContain('lemon zest');

  await library.getByRole('button', { name: 'Use Downloads instead' }).click();
  await expect(library.getByText('Downloads/Penyemat/penyemat-backup.json')).toBeVisible();
});
