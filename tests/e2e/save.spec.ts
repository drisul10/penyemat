import { expect, openLibrary, openPage, openPopup, savePage, test } from './extension';

const PASTA = 'https://recipes.example.com/lemon-pasta';
const BREAD = 'https://bread.example.com/sourdough-starter';

test('saves a page, then says Already saved with no duplicate (F1.1, F1.3)', async ({ ext }) => {
  const { tabId } = await openPage(ext, PASTA);
  const popup = await openPopup(ext, tabId);
  await expect(popup.getByRole('heading', { name: 'Saved' })).toBeVisible();
  await expect(popup.getByText('Lemon ricotta pasta in 20 minutes')).toBeVisible();
  await expect(popup.getByRole('radio', { name: 'Unsorted' })).toHaveAttribute('aria-checked', 'true');

  const again = await openPopup(ext, tabId);
  await expect(again.getByRole('heading', { name: 'Already saved' })).toBeVisible();

  const library = await openLibrary(ext);
  await expect(library.getByRole('link', { name: /Lemon ricotta pasta/ })).toHaveCount(1);
});

test('picks a category in the popup, including a new one (F1.2, F3.2)', async ({ ext }) => {
  const popup = await savePage(ext, PASTA);
  await popup.getByRole('radio', { name: 'Read later' }).click();
  await expect(popup.getByRole('radio', { name: /Read later/ })).toHaveAttribute('aria-checked', 'true');
  await popup.getByRole('button', { name: '+ New' }).click();
  await popup.getByLabel('New category name').fill('Recipes');
  await popup.getByLabel('New category name').press('Enter');
  await expect(popup.getByRole('radio', { name: /Recipes/ })).toHaveAttribute('aria-checked', 'true');

  const library = await openLibrary(ext);
  const shelf = library.getByRole('region', { name: 'Recipes' });
  await expect(shelf.getByRole('link', { name: /Lemon ricotta pasta/ })).toBeVisible();
});

test('refuses browser pages (F1.6)', async ({ ext }) => {
  const library = await openLibrary(ext);
  const tabId = await ext.worker.evaluate(
    async () => (await chrome.tabs.query({})).find((t) => t.url?.includes('library.html'))?.id ?? -1,
  );
  await library.bringToFront();
  const popup = await openPopup(ext, tabId);
  await expect(popup.getByRole('heading', { name: "Penyemat can't save this kind of page" })).toBeVisible();
});

test('Remove in the popup deletes the save', async ({ ext }) => {
  const popup = await savePage(ext, BREAD);
  const closed = popup.waitForEvent('close');
  await popup.getByRole('button', { name: 'Remove' }).click();
  await closed;
  const library = await openLibrary(ext);
  await expect(library.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
});
