import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, test as base, chromium, type Page, type Worker } from '@playwright/test';
import { fixtureFor } from './fixtures.mjs';

const EXTENSION = path.resolve('.output-e2e/chrome-mv3');

export interface Ext {
  context: BrowserContext;
  id: string;
  worker: Worker;
  userDataDir: string;
}

export async function launch(userDataDir?: string): Promise<Ext> {
  const dir = userDataDir ?? (await mkdtemp(path.join(tmpdir(), 'penyemat-e2e-')));
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    acceptDownloads: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route(/^https:\/\/[a-z]+\.example\.com\//, async (route) => {
    const fixture = fixtureFor(route.request().url());
    if (!fixture) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture.html });
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  return { context, id, worker, userDataDir: dir };
}

export async function close(ext: Ext, keepProfile = false): Promise<void> {
  await ext.context.close();
  if (!keepProfile) await rm(ext.userDataDir, { recursive: true, force: true });
}

/** Opens a fixture page and returns its tab id. */
export async function openPage(ext: Ext, url: string): Promise<{ page: Page; tabId: number }> {
  const page = await ext.context.newPage();
  await page.goto(url);
  const tabId = await ext.worker.evaluate(async (target: string) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url === target)?.id ?? -1;
  }, url);
  return { page, tabId };
}

/** The toolbar click, as a page: popup.html?tab=<id> saves that tab. */
export async function openPopup(ext: Ext, tabId: number): Promise<Page> {
  const popup = await ext.context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.goto(`chrome-extension://${ext.id}/popup.html?tab=${tabId}`);
  return popup;
}

export async function openLibrary(ext: Ext, hash = ''): Promise<Page> {
  const page = await ext.context.newPage();
  await page.goto(`chrome-extension://${ext.id}/library.html${hash}`);
  return page;
}

export async function savePage(ext: Ext, url: string): Promise<Page> {
  const { tabId } = await openPage(ext, url);
  const popup = await openPopup(ext, tabId);
  await popup.getByRole('heading', { name: /^(Saved|Already saved)$/ }).waitFor();
  return popup;
}

export const test = base.extend<{ ext: Ext }>({
  // Playwright needs an object pattern here; browserName is unused.
  ext: async ({ browserName: _browserName }, use) => {
    const ext = await launch();
    await use(ext);
    await close(ext);
  },
});

export { expect } from '@playwright/test';
