import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { close, expect, launch, openLibrary, openPage, openPopup, savePage, test } from './extension';

const PASTA = 'https://recipes.example.com/lemon-pasta';
const FLAT = 'https://homes.example.com/river-flat';
const PASS = 'correct horse battery';

async function setUpLock(library: Page) {
  await library.goto(`${library.url().replace(/#.*$/, '')}#/settings`);
  await library.getByRole('button', { name: 'Set up a locked shelf' }).click();
  const dialog = library.getByRole('dialog', { name: 'Set up your locked shelf' });
  const create = dialog.getByRole('button', { name: 'Create locked shelf' });
  await dialog.locator('#setup-pass').fill('short');
  await dialog.locator('#setup-again').fill('short');
  await dialog.getByText("I understand I can't recover a forgotten passphrase.").click();
  await expect(create).toBeDisabled();
  await dialog.locator('#setup-pass').fill(PASS);
  await dialog.locator('#setup-again').fill(`${PASS}x`);
  await expect(dialog.getByText("The passphrases don't match.")).toBeVisible();
  await dialog.locator('#setup-again').fill(PASS);
  await expect(create).toBeEnabled();
  await create.click();
  await expect(dialog).toBeHidden();
}

test('locked shelf: setup, lock, wrong passphrase, unlock, search joins (F4)', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  await setUpLock(library);
  await library.getByRole('link', { name: 'Library' }).click();

  const shelf = library.getByTestId('locked-shelf');
  await expect(shelf.getByRole('button', { name: 'Lock now' })).toBeVisible();

  // Move a saved page onto the locked shelf from the popup's Locked chip (F4.7).
  const { tabId } = await openPage(ext, PASTA);
  const popup = await openPopup(ext, tabId);
  await popup.getByRole('radio', { name: 'Locked' }).click();
  await expect(popup.getByRole('heading', { name: 'Move to Locked?' })).toBeVisible();
  await popup.locator('#move-pass').fill(PASS);
  await popup.getByRole('button', { name: 'Move to Locked' }).click();
  await expect(popup.getByRole('heading', { name: 'Moved to Locked' })).toBeVisible();

  await expect(shelf.getByRole('link', { name: /Lemon ricotta/ })).toBeVisible();
  await library.locator('#search').fill('ricotta');
  await expect(library.locator('#search-results li[role=option]')).toHaveCount(1);
  await library.locator('#search').press('Escape');

  await shelf.getByRole('button', { name: 'Lock now' }).click();
  await expect(shelf.getByText('Unlock to see these links.')).toBeVisible();
  await expect(shelf.getByRole('link')).toHaveCount(0);
  await library.locator('#search').fill('ricotta');
  await expect(library.getByRole('heading', { name: /No saved pages match/ })).toBeVisible();
  await library.locator('#search').press('Escape');

  await shelf.getByRole('button', { name: 'Unlock' }).click();
  await shelf.locator('#unlock-pass').fill('wrong passphrase');
  await shelf.locator('#unlock-pass').press('Enter');
  await expect(shelf.getByText("That passphrase doesn't match. Check it and try again.")).toBeVisible();
  await expect(shelf.locator('#unlock-pass')).toHaveValue('');
  await shelf.locator('#unlock-pass').fill(PASS);
  await shelf.locator('#unlock-pass').press('Enter');
  await expect(shelf.getByRole('link', { name: /Lemon ricotta/ })).toBeVisible();

  // Nothing readable in storage (F4.2): the locked record is ciphertext only.
  const stored = await library.evaluate(async () => {
    const open = indexedDB.open('penyemat');
    const db: IDBDatabase = await new Promise((resolve) => {
      open.onsuccess = () => resolve(open.result);
    });
    const rows: unknown[] = await new Promise((resolve) => {
      const req = db.transaction('lockedRecords').objectStore('lockedRecords').getAll();
      req.onsuccess = () => resolve(req.result);
    });
    const plain = await new Promise<number>((resolve) => {
      const req = db.transaction('bookmarks').objectStore('bookmarks').count();
      req.onsuccess = () => resolve(req.result);
    });
    return {
      text: JSON.stringify(rows, (_k, v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : v)),
      plain,
    };
  });
  expect(stored.plain).toBe(0);
  expect(stored.text).not.toContain('ricotta');
  expect(stored.text).not.toContain('recipes.example.com');
});

test('a second library tab shares the unlock; locking one locks both (F4.6)', async ({ ext }) => {
  const first = await openLibrary(ext);
  await setUpLock(first);
  await first.getByRole('link', { name: 'Library' }).click();
  const second = await openLibrary(ext);
  await expect(second.getByTestId('locked-shelf').getByRole('button', { name: 'Lock now' })).toBeVisible();
  await first.getByTestId('locked-shelf').getByRole('button', { name: 'Lock now' }).click();
  await expect(second.getByTestId('locked-shelf').getByText('Unlock to see these links.')).toBeVisible();
});

test('relocks after the idle time (F4.6)', async ({ ext }) => {
  const library = await openLibrary(ext);
  await library.clock.install();
  await library.reload();
  await setUpLock(library);
  await library.getByRole('link', { name: 'Library' }).click();
  const shelf = library.getByTestId('locked-shelf');
  await expect(shelf.getByText('Locks after 5 idle minutes')).toBeVisible();
  await library.clock.runFor(5 * 60_000 + 1_000);
  await expect(shelf.getByText('Unlock to see these links.')).toBeVisible();
});

test('Save to Locked from the popup writes no plain copy (F4.7)', async ({ ext }) => {
  const library = await openLibrary(ext);
  await setUpLock(library);
  const { tabId } = await openPage(ext, FLAT);
  // The right-click command leaves the read page in session memory, then opens the popup.
  await ext.worker.evaluate(
    async ({ url }) => {
      await chrome.storage.session.set({
        pendingStart: {
          at: Date.now(),
          start: {
            kind: 'locked',
            page: {
              url,
              title: 'Apartment listings near the river',
              site: 'homes.example.com',
              favicon: '',
              text: 'Two bedrooms with a balcony facing the water',
              plainId: null,
              at: Date.now(),
            },
          },
        },
      });
    },
    { url: FLAT },
  );
  const popup = await openPopup(ext, tabId);
  await expect(popup.getByRole('heading', { name: 'Save to Locked' })).toBeVisible();
  await popup.locator('#lock-pass').fill('nope nope nope');
  await popup.getByRole('button', { name: 'Save encrypted' }).click();
  await expect(popup.getByText("That passphrase doesn't match. Check it and try again.")).toBeVisible();
  await popup.locator('#lock-pass').fill(PASS);
  await popup.getByRole('button', { name: 'Save encrypted' }).click();
  await expect(popup.getByRole('heading', { name: 'Saved to Locked' })).toBeVisible();

  await library.getByRole('link', { name: 'Library' }).click();
  await expect(library.getByTestId('locked-shelf').getByRole('link', { name: /Apartment listings/ })).toBeVisible();
  const plain = await library.evaluate(async () => {
    const open = indexedDB.open('penyemat');
    const db: IDBDatabase = await new Promise((resolve) => {
      open.onsuccess = () => resolve(open.result);
    });
    return new Promise<number>((resolve) => {
      const req = db.transaction('bookmarks').objectStore('bookmarks').count();
      req.onsuccess = () => resolve(req.result);
    });
  });
  expect(plain).toBe(0);
});

test('export then import into a fresh install restores everything (F5)', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  await setUpLock(library);
  await expect(library.getByText('Never exported.')).toBeVisible();
  const download = library.waitForEvent('download');
  await library.getByRole('button', { name: 'Export library' }).click();
  const file = await download;
  const filePath = await file.path();
  const json = await readFile(filePath, 'utf8');
  expect(json).toContain('lemon zest');
  await expect(library.getByText(/Last export:/)).toBeVisible();

  const fresh = await launch();
  try {
    const target = await openLibrary(fresh, '#/settings');
    await target.locator('#import-file').setInputFiles(filePath);
    await expect(target.getByText('Import finished: 1 added, 0 updated, 0 skipped.')).toBeVisible();
    await target.getByRole('link', { name: 'Library' }).click();
    await expect(target.getByRole('link', { name: /Lemon ricotta/ })).toBeVisible();
    // The file's locked shelf was adopted as is and opens with the same passphrase.
    const shelf = target.getByTestId('locked-shelf');
    await shelf.getByRole('button', { name: 'Unlock' }).click();
    await shelf.locator('#unlock-pass').fill(PASS);
    await shelf.locator('#unlock-pass').press('Enter');
    await expect(shelf.getByRole('button', { name: 'Lock now' })).toBeVisible();
  } finally {
    await close(fresh);
  }
});

test('moves a saved link to Locked from the card menu, unlocked and locked (F4.7)', async ({ ext }) => {
  await savePage(ext, PASTA);
  await savePage(ext, FLAT);
  const library = await openLibrary(ext);
  await setUpLock(library);
  await library.getByRole('link', { name: 'Library' }).click();
  const shelf = library.getByTestId('locked-shelf');
  const unsorted = library.getByRole('region', { name: 'Unsorted' });

  // Shelf open: confirm only.
  await unsorted.getByRole('button', { name: /Options for Lemon ricotta/ }).click();
  await library.getByRole('menuitem', { name: 'Move to Locked' }).click();
  const dialog = library.getByRole('dialog', { name: 'Move to Locked?' });
  await expect(dialog).toContainText('traces of the unencrypted copy may stay');
  await dialog.getByRole('button', { name: 'Move to Locked' }).click();
  await expect(shelf.getByRole('link', { name: /Lemon ricotta/ })).toBeVisible();
  await expect(unsorted.getByRole('link', { name: /Lemon ricotta/ })).toHaveCount(0);

  // Shelf locked: the dialog asks for the passphrase and the shelf stays locked.
  await shelf.getByRole('button', { name: 'Lock now' }).click();
  await unsorted.getByRole('button', { name: /Options for Apartment listings/ }).click();
  await library.getByRole('menuitem', { name: 'Move to Locked' }).click();
  await dialog.locator('#move-locked-pass').fill('wrong passphrase');
  await dialog.getByRole('button', { name: 'Move to Locked' }).click();
  await expect(dialog.getByText("That passphrase doesn't match. Check it and try again.")).toBeVisible();
  await dialog.locator('#move-locked-pass').fill(PASS);
  await dialog.getByRole('button', { name: 'Move to Locked' }).click();
  await expect(dialog).toBeHidden();
  await expect(shelf.getByText('Unlock to see these links.')).toBeVisible();
  await expect(library.getByRole('link', { name: /Apartment listings/ })).toHaveCount(0);
});

test('Save a link can go straight to Locked, open or locked (F4.7)', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  await setUpLock(library);
  await library.getByRole('link', { name: 'Library' }).click();
  const shelf = library.getByTestId('locked-shelf');

  await library.getByRole('button', { name: '+ Save a link' }).click();
  const dialog = library.getByRole('dialog', { name: 'Save a link' });
  await dialog.locator('#save-url').fill(FLAT);
  await dialog.getByRole('radio', { name: 'Locked' }).click();
  await dialog.getByRole('button', { name: 'Save encrypted' }).click();
  await expect(dialog).toBeHidden();
  await expect(shelf.getByRole('link', { name: /Apartment listings/ })).toBeVisible();

  await shelf.getByRole('button', { name: 'Lock now' }).click();
  await library.getByRole('button', { name: '+ Save a link' }).click();
  await dialog.locator('#save-url').fill('https://travel.example.com/lisbon-walk');
  await dialog.getByRole('radio', { name: 'Locked' }).click();
  await dialog.locator('#save-link-pass').fill('wrong passphrase');
  await dialog.getByRole('button', { name: 'Save encrypted' }).click();
  await expect(dialog.getByText("That passphrase doesn't match. Check it and try again.")).toBeVisible();
  await dialog.locator('#save-link-pass').fill(PASS);
  await dialog.getByRole('button', { name: 'Save encrypted' }).click();
  await expect(dialog).toBeHidden();
  await expect(shelf.getByText('Unlock to see these links.')).toBeVisible();
  await expect(library.getByRole('link', { name: /Lisbon/ })).toHaveCount(0);

  const plain = await library.evaluate(async () => {
    const open = indexedDB.open('penyemat');
    const db: IDBDatabase = await new Promise((resolve) => {
      open.onsuccess = () => resolve(open.result);
    });
    return new Promise<number>((resolve) => {
      const req = db.transaction('bookmarks').objectStore('bookmarks').count();
      req.onsuccess = () => resolve(req.result);
    });
  });
  expect(plain).toBe(1);
});

test('the toolbar button on a locked page writes nothing (F4.2)', async ({ ext }) => {
  await savePage(ext, FLAT);
  const library = await openLibrary(ext);
  await setUpLock(library);
  await library.getByRole('link', { name: 'Library' }).click();
  const unsorted = library.getByRole('region', { name: 'Unsorted' });
  await unsorted.getByRole('button', { name: /Options for Apartment listings/ }).click();
  await library.getByRole('menuitem', { name: 'Move to Locked' }).click();
  await library
    .getByRole('dialog', { name: 'Move to Locked?' })
    .getByRole('button', { name: 'Move to Locked' })
    .click();
  await library.getByTestId('locked-shelf').getByRole('button', { name: 'Lock now' }).click();

  const { tabId } = await openPage(ext, FLAT);
  const popup = await openPopup(ext, tabId);
  await expect(popup.getByRole('heading', { name: 'Already in Locked' })).toBeVisible();
  await expect(popup.getByRole('radio')).toHaveCount(0);
  const plain = await library.evaluate(async () => {
    const open = indexedDB.open('penyemat');
    const db: IDBDatabase = await new Promise((resolve) => {
      open.onsuccess = () => resolve(open.result);
    });
    return new Promise<number>((resolve) => {
      const req = db.transaction('bookmarks').objectStore('bookmarks').count();
      req.onsuccess = () => resolve(req.result);
    });
  });
  expect(plain).toBe(0);
});

test('a locked card moves back to a category from its menu', async ({ ext }) => {
  await savePage(ext, FLAT);
  const library = await openLibrary(ext);
  await setUpLock(library);
  await library.getByRole('link', { name: 'Library' }).click();
  const unsorted = library.getByRole('region', { name: 'Unsorted' });
  await unsorted.getByRole('button', { name: /Options for Apartment listings/ }).click();
  await library.getByRole('menuitem', { name: 'Move to Locked' }).click();
  await library
    .getByRole('dialog', { name: 'Move to Locked?' })
    .getByRole('button', { name: 'Move to Locked' })
    .click();

  const shelf = library.getByTestId('locked-shelf');
  await shelf.getByRole('button', { name: /Options for Apartment listings/ }).click();
  await expect(library.getByRole('menuitemradio', { checked: true })).toHaveCount(0);
  await library.getByRole('menuitemradio', { name: 'Read later' }).click();
  await expect(library.getByText('Moved “Apartment listings near the river” to Read later')).toBeVisible();
  await expect(
    library.getByRole('region', { name: 'Read later' }).getByRole('link', { name: /Apartment listings/ }),
  ).toBeVisible();
  await expect(shelf.getByRole('link', { name: /Apartment listings/ })).toHaveCount(0);
});

test('Lock after uses the menu-style picker, by mouse and keyboard', async ({ ext }) => {
  const library = await openLibrary(ext);
  await setUpLock(library);
  const picker = library.locator('#idle');
  await expect(picker).toHaveText(/5 minutes/);
  await picker.click();
  await library.getByRole('option', { name: '10 minutes' }).click();
  await expect(picker).toHaveText(/10 minutes/);
  await expect(library.getByRole('listbox')).toHaveCount(0);
  await picker.focus();
  await picker.press('Enter');
  await library.getByRole('listbox').press('ArrowDown');
  await library.getByRole('listbox').press('Enter');
  await expect(picker).toHaveText(/15 minutes/);
  await expect(picker).toBeFocused();
});
