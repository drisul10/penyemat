import type { Locator, Page } from '@playwright/test';
import { expect, openLibrary, savePage, test } from './extension';

const PASTA = 'https://recipes.example.com/lemon-pasta';
const FLAT = 'https://homes.example.com/river-flat';
const PASS = 'correct horse battery';

/** A real mouse drag: press on the card, move in steps, release over the target. */
async function dragTo(page: Page, source: Locator, target: Locator) {
  const from = await source.boundingBox();
  if (!from) throw new Error('source not visible');
  await page.mouse.move(from.x + 30, from.y + 30);
  await page.mouse.down();
  await page.mouse.move(from.x + 50, from.y + 50, { steps: 4 });
  await target.scrollIntoViewIfNeeded();
  const to = await target.boundingBox();
  if (!to) throw new Error('target not visible');
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function setUpLock(library: Page) {
  await library.goto(`${library.url().replace(/#.*$/, '')}#/settings`);
  await library.getByRole('button', { name: 'Set up a locked shelf' }).click();
  const dialog = library.getByRole('dialog', { name: 'Set up your locked shelf' });
  await dialog.locator('#setup-pass').fill(PASS);
  await dialog.locator('#setup-again').fill(PASS);
  await dialog.getByText("I understand I can't recover a forgotten passphrase.").click();
  await dialog.getByRole('button', { name: 'Create locked shelf' }).click();
  await expect(dialog).toBeHidden();
  await library.getByRole('link', { name: 'Library' }).click();
}

test('drags a card onto an empty category; the drag opens no page', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  const card = library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Lemon ricotta/ });
  const readLater = library.locator('[data-drop-target="read-later"]');
  let opened = false;
  ext.context.on('page', () => {
    opened = true;
  });
  await dragTo(library, card, readLater);
  await expect(library.getByText('Moved to Read later')).toBeVisible();
  await expect(
    library.getByRole('region', { name: 'Read later' }).getByRole('link', { name: /Lemon ricotta/ }),
  ).toBeVisible();
  expect(opened).toBe(false);
});

test('dropping outside a shelf changes nothing', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  const card = library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Lemon ricotta/ });
  await dragTo(library, card, library.locator('header.band h1'));
  await expect(
    library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Lemon ricotta/ }),
  ).toBeVisible();
  await expect(library.locator('.is-dragging')).toHaveCount(0);
});

test('drags onto the locked shelf, and from it back to a category', async ({ ext }) => {
  await savePage(ext, FLAT);
  const library = await openLibrary(ext);
  await setUpLock(library);
  const shelf = library.getByTestId('locked-shelf');

  const card = library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Apartment listings/ });
  await dragTo(library, card, shelf);
  const dialog = library.getByRole('dialog', { name: 'Move to Locked?' });
  await dialog.getByRole('button', { name: 'Move to Locked' }).click();
  await expect(shelf.getByRole('link', { name: /Apartment listings/ })).toBeVisible();

  // Unsorted is empty now, so it shows only as a drop zone during the drag.
  await expect(library.getByRole('region', { name: 'Unsorted' })).toHaveCount(0);
  await dragTo(
    library,
    shelf.getByRole('link', { name: /Apartment listings/ }),
    library.locator('[data-drop-target="unsorted"]'),
  );
  await expect(library.getByText('Moved “Apartment listings near the river” to Unsorted')).toBeVisible();
  await expect(
    library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Apartment listings/ }),
  ).toBeVisible();
});

test('touch: a long press drags; a quick swipe does not (rail scroll stays)', async ({ ext }) => {
  await savePage(ext, PASTA);
  const library = await openLibrary(ext);
  await library.setViewportSize({ width: 390, height: 844 });
  const cdp = await ext.context.newCDPSession(library);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

  const card = library.getByRole('region', { name: 'Unsorted' }).getByRole('link', { name: /Lemon ricotta/ });
  const from = await card.boundingBox();
  const target = library.locator('[data-drop-target="read-later"]');
  await target.scrollIntoViewIfNeeded();
  const to = await target.boundingBox();
  const fromNow = await card.boundingBox();
  if (!from || !to || !fromNow) throw new Error('not visible');
  const sx = fromNow.x + 20;
  const sy = fromNow.y + 20;

  // Quick swipe: moves before the long press, so it is not a drag.
  await touch('touchStart', sx, sy);
  await touch('touchMove', sx + 40, sy + 2);
  await touch('touchEnd', sx + 40, sy + 2);
  await expect(library.locator('.is-dragging')).toHaveCount(0);

  // Long press, then move onto the empty Read later category.
  await touch('touchStart', sx, sy);
  await library.waitForTimeout(500);
  await expect(library.locator('html.is-dragging')).toHaveCount(1);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', sx + ((to.x + 20 - sx) * i) / 8, sy + ((to.y + to.height / 2 - sy) * i) / 8);
  }
  await touch('touchEnd', to.x + 20, to.y + to.height / 2);
  await expect(library.getByText('Moved to Read later')).toBeVisible();
});
