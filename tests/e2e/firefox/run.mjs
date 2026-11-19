// Firefox e2e (ARCHITECTURE 8): Selenium WebDriver with BiDi loads the e2e build as a
// temporary add-on and drives the core flows: save, search, unlock.
// Run with `pnpm e2e:firefox` (builds .output-e2e/firefox-mv3 first).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Builder, By, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { startFixtureProxy } from './server.mjs';

const ADDON_ID = 'penyemat@example.com';
const UUID = '6f1c2a3e-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const BASE = `moz-extension://${UUID}`;
const BUILD_DIR = resolve('.output-e2e/firefox-mv3');
const LEMON = 'http://recipes.example.com/lemon-pasta';
const PASSPHRASE = 'correct horse battery';
const WAIT_MS = 10_000;

// Selenium Manager would otherwise send usage stats (no third-party requests).
process.env.SE_AVOID_STATS = 'true';

const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}\n      ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    throw error;
  }
}

function packAddon() {
  if (!existsSync(join(BUILD_DIR, 'manifest.json'))) {
    throw new Error(`No build at ${BUILD_DIR}. Run: PENYEMAT_E2E=1 pnpm exec wxt build -b firefox`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'penyemat-ff-'));
  const xpi = join(dir, 'penyemat.xpi');
  execFileSync('zip', ['-qr', xpi, '.'], { cwd: BUILD_DIR });
  return { dir, xpi };
}

async function textOf(driver, css) {
  const el = await driver.wait(until.elementLocated(By.css(css)), WAIT_MS);
  await driver.wait(until.elementIsVisible(el), WAIT_MS);
  return el.getText();
}

async function waitForText(driver, css, expected) {
  await driver.wait(
    async () => {
      const els = await driver.findElements(By.css(css));
      for (const el of els) {
        const text = await el.getText().catch(() => '');
        if (text.includes(expected)) return true;
      }
      return false;
    },
    WAIT_MS,
    `"${expected}" in ${css}`,
  );
}

async function clickButton(driver, label) {
  const xpath = `//button[normalize-space(.)=${JSON.stringify(label)}]`;
  const button = await driver.wait(until.elementLocated(By.xpath(xpath)), WAIT_MS);
  await driver.wait(until.elementIsEnabled(button), WAIT_MS);
  await button.click();
}

/**
 * WebDriver refuses to navigate content to moz-extension:// pages, so the selected tab is
 * pointed there from Firefox's chrome context (needs -remote-allow-system-access).
 */
async function openExtensionPage(driver, path) {
  const url = `${BASE}/${path}`;
  await driver.setContext(firefox.Context.CHROME);
  try {
    await driver.executeScript(
      `gBrowser.selectedBrowser.fixupAndLoadURIString(arguments[0], {
         triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
       });`,
      url,
    );
  } finally {
    await driver.setContext(firefox.Context.CONTENT);
  }
  await driver.wait(async () => (await driver.getCurrentUrl()) === url, WAIT_MS, `open ${url}`);
}

/** Numeric tab id of the tab showing `url`, read through the extension's own API. */
async function tabIdFor(driver, url) {
  const id = await driver.executeAsyncScript(
    `const done = arguments[arguments.length - 1];
     const api = (window.wrappedJSObject ?? window).browser ?? window.browser;
     api.tabs.query({}).then((tabs) => {
       const tab = tabs.find((t) => t.url === arguments[0]);
       done(tab ? tab.id : null);
     }, () => done(null));`,
    url,
  );
  if (typeof id !== 'number') throw new Error(`No tab found for ${url}`);
  return id;
}

/** Opens the fixture page, then the popup as a page aimed at that tab, and returns the header text. */
async function saveViaPopup(driver, url) {
  await driver.switchTo().newWindow('tab');
  await driver.get(url);
  await driver.wait(until.titleIs('Lemon ricotta pasta in 20 minutes'), WAIT_MS);
  await driver.switchTo().newWindow('tab');
  await openExtensionPage(driver, 'library.html');
  const tabId = await tabIdFor(driver, url);
  await openExtensionPage(driver, `popup.html?tab=${tabId}`);
  await driver.wait(until.elementLocated(By.css('.pop-h.brand h1')), WAIT_MS);
  return textOf(driver, '.pop-h.brand h1');
}

async function main() {
  const proxy = await startFixtureProxy();
  const { dir, xpi } = packAddon();
  // Firefox gets a throwaway home: it never touches the user's real profile folders, and on
  // recent macOS the real ~/Library/Application Support/Firefox may not be writable.
  const home = join(dir, 'home');
  mkdirSync(home, { recursive: true });
  const options = new firefox.Options()
    .addArguments('-headless')
    .enableBidi()
    .setPreference('extensions.webextensions.uuids', JSON.stringify({ [ADDON_ID]: UUID }))
    .setPreference('network.proxy.type', 1)
    .setPreference('network.proxy.http', '127.0.0.1')
    .setPreference('network.proxy.http_port', proxy.port)
    .setPreference('network.proxy.no_proxies_on', '')
    .setPreference('network.proxy.allow_hijacking_localhost', true)
    .setPreference('dom.security.https_first', false)
    .setPreference('dom.security.https_only_mode', false)
    .setPreference('browser.fixup.fallback-to-https', false);
  // geckodriver and Firefox inherit this environment. CFFIXED_USER_HOME moves macOS's
  // Application Support lookup; HOME stays so Selenium Manager finds its driver cache.
  process.env.CFFIXED_USER_HOME = home;
  process.env.MOZ_DISABLE_CONTENT_SANDBOX = '1';

  let driver;
  try {
    // Lets the runner use Firefox's chrome context (see openExtensionPage).
    const service = new firefox.ServiceBuilder().addArguments('--allow-system-access');
    if (process.env.PENYEMAT_E2E_DEBUG) service.enableVerboseLogging().setStdio('inherit');
    driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(service).build();
    await driver.installAddon(xpi, true);

    await step('save a page: popup shows "Saved"', async () => {
      const header = await saveViaPopup(driver, LEMON);
      if (header !== 'Saved') throw new Error(`header was "${header}"`);
    });

    await step('save it again: popup shows "Already saved"', async () => {
      const header = await saveViaPopup(driver, LEMON);
      if (header !== 'Already saved') throw new Error(`header was "${header}"`);
    });

    await step('search "lemmon zest" finds the page with a highlighted snippet', async () => {
      await openExtensionPage(driver, 'library.html');
      const search = await driver.wait(until.elementLocated(By.id('search')), WAIT_MS);
      await driver.wait(until.elementIsEnabled(search), WAIT_MS);
      await search.sendKeys('lemmon zest');
      await waitForText(driver, '#search-results li[role=option]', 'Lemon ricotta pasta in 20 minutes');
      await waitForText(driver, '.results-h p', '1 page matches “lemmon zest”');
      const marks = await driver.findElements(By.css('#search-results li[role=option] mark'));
      const words = await Promise.all(marks.map((m) => m.getText()));
      if (!words.some((w) => w.toLowerCase() === 'lemon') || !words.some((w) => w.toLowerCase() === 'zest')) {
        throw new Error(`highlighted words: ${JSON.stringify(words)}`);
      }
      await clickButton(driver, 'Clear search');
    });

    await step('set up a locked shelf in settings', async () => {
      await openExtensionPage(driver, 'library.html#/settings');
      await clickButton(driver, 'Set up a locked shelf');
      const name = await driver.wait(until.elementLocated(By.id('shelf-name')), WAIT_MS);
      await name.clear();
      await name.sendKeys('Locked');
      await driver.findElement(By.id('setup-pass')).sendKeys(PASSPHRASE);
      await driver.findElement(By.id('setup-again')).sendKeys(PASSPHRASE);
      await driver
        .findElement(By.xpath(`//label[contains(., "I understand I can't recover a forgotten passphrase.")]`))
        .click();
      await clickButton(driver, 'Create locked shelf');
      await driver.wait(until.stalenessOf(name), WAIT_MS * 3);
    });

    await step('Lock now closes the shelf', async () => {
      // In-app link: a full reload would drop the in-memory key on its own (F4.6).
      await driver.findElement(By.css('a.backlink')).click();
      await driver.wait(until.elementLocated(By.css('[data-testid=locked-shelf]')), WAIT_MS);
      await clickButton(driver, 'Lock now');
      await waitForText(driver, '[data-testid=locked-shelf]', 'Unlock to see these links.');
    });

    await step('wrong passphrase shows the error', async () => {
      await clickButton(driver, 'Unlock');
      const field = await driver.wait(until.elementLocated(By.id('unlock-pass')), WAIT_MS);
      await field.sendKeys('wrong passphrase');
      await clickButton(driver, 'Unlock');
      await waitForText(driver, '[data-testid=locked-shelf]', "That passphrase doesn't match. Check it and try again.");
    });

    await step('correct passphrase unlocks', async () => {
      const field = await driver.findElement(By.id('unlock-pass'));
      await field.sendKeys(PASSPHRASE);
      await clickButton(driver, 'Unlock');
      await waitForText(driver, '[data-testid=locked-shelf]', 'Lock now');
    });
  } finally {
    await driver?.quit().catch(() => {});
    await proxy.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // macOS may lock the throwaway home's Downloads folder. It stays in the OS temp folder.
    }
  }
}

main()
  .then(() => {
    console.log(`\nFirefox e2e: ${results.length} passed`);
  })
  .catch((error) => {
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nFirefox e2e: ${passed} passed, failed at "${results.find((r) => !r.ok)?.name ?? 'setup'}"`);
    if (!results.some((r) => !r.ok)) console.error(error);
    process.exit(1);
  });
