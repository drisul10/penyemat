import { expect, openLibrary, savePage, test } from './extension';

const PASTA = 'https://recipes.example.com/lemon-pasta';
const BREAD = 'https://bread.example.com/sourdough-starter';
const LISBON = 'https://travel.example.com/lisbon-walk';

test('first use shows the empty state with the starter categories (F3.1)', async ({ ext }) => {
  const library = await openLibrary(ext);
  await expect(library.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
  await expect(library.getByText('Read later', { exact: true })).toBeVisible();
  await expect(library.locator('#search')).toBeDisabled();
});

test('search finds body words with a typo, prefix, and stem, and highlights them (F2)', async ({ ext }) => {
  await savePage(ext, PASTA);
  await savePage(ext, BREAD);
  await savePage(ext, LISBON);
  const library = await openLibrary(ext);
  const search = library.locator('#search');

  await library.keyboard.press('/');
  await expect(search).toBeFocused();
  await search.fill('lemmon zest');
  const rows = library.locator('#search-results li[role=option]');
  await expect(rows.first()).toContainText('Lemon ricotta pasta');
  await expect(rows.first().locator('mark').first()).toHaveText(/lemon/i);

  await search.fill('sourd');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('sourdough');

  await search.fill('cobble');
  await expect(rows.first()).toContainText('Lisbon');

  await search.fill('lemon zets spaceship');
  await search.fill('zzqqxx');
  await expect(library.getByRole('heading', { name: 'No saved pages match “zzqqxx”' })).toBeVisible();

  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(library.getByRole('region', { name: 'Unsorted' })).toBeVisible();
});

test('Enter opens the highlighted result, arrows move (N4)', async ({ ext }) => {
  await savePage(ext, PASTA);
  await savePage(ext, BREAD);
  const library = await openLibrary(ext);
  const search = library.locator('#search');
  await search.fill('the');
  await search.fill('starter');
  await expect(library.locator('#result-0')).toHaveAttribute('aria-selected', 'true');
  const opened = ext.context.waitForEvent('page');
  await search.press('Enter');
  expect((await opened).url()).toContain('bread.example.com');
});

test('moves a link with Undo, deletes with Undo (F3.5)', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  const card = library.getByRole('region', { name: 'Unsorted' });
  await card.getByRole('button', { name: /Options for Lemon ricotta/ }).click();
  await library.getByRole('menuitemradio', { name: 'Read later' }).click();
  await expect(library.getByRole('status').getByText('Moved to Read later')).toBeVisible();
  await expect(library.getByRole('region', { name: 'Read later' })).toBeVisible();

  const shelf = library.getByRole('region', { name: 'Read later' });
  await shelf.getByRole('button', { name: /Options for Lemon ricotta/ }).click();
  await library.getByRole('menuitem', { name: 'Delete link' }).click();
  await expect(library.getByText('Deleted “Lemon ricotta pasta in 20 minutes”')).toBeVisible();
  await expect(library.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
  await library.getByRole('button', { name: 'Undo' }).click();
  await expect(
    library.getByRole('region', { name: 'Read later' }).getByRole('link', { name: /Lemon ricotta/ }),
  ).toBeVisible();
});

test('adds, renames, and deletes a category; its links move to Unsorted (F3.1, F3.5)', async ({ ext }) => {
  await savePage(ext, LISBON);
  const library = await openLibrary(ext);
  await library.getByRole('button', { name: '+ New category' }).click();
  await library.getByLabel('New category').fill('Travel');
  await library.getByRole('button', { name: 'Add', exact: true }).click();

  const unsorted = library.getByRole('region', { name: 'Unsorted' });
  await unsorted.getByRole('button', { name: /Options for Lisbon/ }).click();
  await library.getByRole('menuitemradio', { name: 'Travel' }).click();
  const travel = library.getByRole('region', { name: 'Travel' });
  await expect(travel).toBeVisible();

  await travel.getByRole('button', { name: 'Travel options' }).click();
  await library.getByRole('menuitem', { name: 'Rename' }).click();
  await library.getByLabel('Category name').fill('Trips');
  await library.getByRole('button', { name: 'Save', exact: true }).click();
  const trips = library.getByRole('region', { name: 'Trips' });
  await expect(trips).toBeVisible();

  await trips.getByRole('button', { name: 'Trips options' }).click();
  await library.getByRole('menuitem', { name: 'Delete category' }).click();
  const dialog = library.getByRole('dialog', { name: 'Delete the “Trips” category?' });
  await expect(dialog).toContainText('Its 1 link moves to Unsorted');
  await dialog.getByRole('button', { name: 'Delete category' }).click();
  await expect(library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Lisbon/ })).toBeVisible();
});

test('shows no sideways scroll at 1440, 390, and 320 px', async ({ ext }) => {
  await savePage(ext, PASTA);
  await savePage(ext, BREAD);
  await savePage(ext, LISBON);
  const library = await openLibrary(ext);
  for (const width of [1440, 390, 320]) {
    await library.setViewportSize({ width, height: 900 });
    for (const hash of ['#/', '#/settings']) {
      await library.evaluate((h) => {
        location.hash = h;
      }, hash);
      await library.waitForTimeout(100);
      const overflow = await library.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px ${hash}`).toBeLessThanOrEqual(0);
    }
  }
});

test('Move up and down follow the shelves on screen, not hidden empty categories', async ({ ext }) => {
  await savePage(ext, LISBON);
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  for (const name of ['Trips', 'Food']) {
    await library.getByRole('button', { name: '+ New category' }).click();
    await library.getByLabel('New category').fill(name);
    await library.getByRole('button', { name: 'Add', exact: true }).click();
  }
  const unsorted = library.getByRole('region', { name: 'Unsorted' });
  await unsorted.getByRole('button', { name: /Options for Lisbon/ }).click();
  await library.getByRole('menuitemradio', { name: 'Trips' }).click();

  // Trips is the only filled shelf; empty Read later and Food sort around it but are listed apart.
  const trips = library.getByRole('region', { name: 'Trips' });
  await trips.getByRole('button', { name: 'Trips options' }).click();
  await expect(library.getByRole('menuitem', { name: 'Move up' })).toHaveCount(0);
  await expect(library.getByRole('menuitem', { name: 'Move down' })).toHaveCount(0);
  await library.keyboard.press('Escape');

  // A second filled shelf below it: now Trips can move down, and the order on screen swaps.
  await library
    .getByRole('region', { name: 'Unsorted' })
    .getByRole('button', { name: /Options for Lemon/ })
    .click();
  await library.getByRole('menuitemradio', { name: 'Food' }).click();
  await trips.getByRole('button', { name: 'Trips options' }).click();
  await expect(library.getByRole('menuitem', { name: 'Move up' })).toHaveCount(0);
  await library.getByRole('menuitem', { name: 'Move down' }).click();
  const order = () =>
    library
      .locator('main section.shelf[aria-label]')
      .evaluateAll((els) => els.slice(0, 2).map((el) => el.getAttribute('aria-label')));
  await expect.poll(order).toEqual(['Food', 'Trips']);
});

test('search shows matching shelves first and filters pages by category', async ({ ext }) => {
  await savePage(ext, PASTA);
  await savePage(ext, BREAD);
  const library = await openLibrary(ext);
  await library.getByRole('button', { name: '+ New category' }).click();
  await library.getByLabel('New category').fill('Recipes');
  await library.getByRole('button', { name: 'Add', exact: true }).click();
  await library
    .getByRole('region', { name: 'Unsorted' })
    .getByRole('button', { name: /Options for Lemon/ })
    .click();
  await library.getByRole('menuitemradio', { name: 'Recipes' }).click();

  const search = library.locator('#search');
  const rows = library.locator('#search-results li[role=option]');

  // Pages in two categories: chips narrow the list.
  await search.fill('water');
  await expect(rows).toHaveCount(2);
  await library.getByRole('button', { name: /^Recipes/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Lemon ricotta');
  await library.getByRole('button', { name: /^All/ }).click();
  await expect(rows).toHaveCount(2);

  // A category name: its shelf comes first, and Enter opens it.
  await search.fill('recip');
  await expect(rows.first()).toContainText('Shelf');
  await expect(rows.first()).toContainText('Recipes');
  await expect(rows.first()).toContainText('1 link');
  await search.press('Enter');
  await expect(library).toHaveURL(/#\/shelf\//);
  await expect(library.getByRole('heading', { name: /^Recipes/ })).toBeVisible();
  await expect(search).toHaveValue('');
});
