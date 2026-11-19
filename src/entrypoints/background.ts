import { type Browser, browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { runAutosave } from '../lib/backup/autosave';
import { toBase64 } from '../lib/bytes';
import { findByUrl, savePage } from '../lib/db/bookmarks';
import { isLockedUrl } from '../lib/db/locked';
import { isPdf, isUnsavable } from '../lib/extract/limits';
import type { BackgroundRequest, PendingLockedPage, PopupStart } from '../lib/messages';
import { siteOf } from '../lib/url';

// Background (ARCHITECTURE 2, 5.1, 5.5). Holds no state between events: MV3 stops it when idle.
// Anything the popup must pick up later goes to storage.session, which lives in memory only.

const MENU_SAVE = 'penyemat-save';
const MENU_SAVE_LOCKED = 'penyemat-save-locked';
const PENDING_TTL_MS = 2 * 60 * 1000;
const EXTRACT_TIMEOUT_MS = 4_000;

type Tab = Browser.tabs.Tab;

interface Extracted {
  title: string;
  text: string;
  favicon: string;
  contentType?: string;
}

async function extract(tab: Tab): Promise<Extracted | null> {
  if (tab.id === undefined) return null;
  const tabId = tab.id;
  const run = async () => {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/extractor.js'] });
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => (globalThis as unknown as { __penyematExtract: () => unknown }).__penyematExtract(),
    });
    return (result?.result ?? null) as Extracted | null;
  };
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), EXTRACT_TIMEOUT_MS));
  try {
    return await Promise.race([run(), timeout]);
  } catch {
    // Some pages refuse scripts. The save still goes ahead with title and address (F1.5).
    return null;
  }
}

async function readPage(tab: Tab): Promise<{ url: string; title: string; text: string; favicon: string }> {
  const url = tab.url ?? '';
  const pdf = isPdf(url);
  const page = pdf ? null : await extract(tab);
  const unreadable = pdf || !page || isPdf(url, page.contentType);
  const tabFavicon = tab.favIconUrl?.startsWith('data:image/') ? tab.favIconUrl : '';
  return {
    url,
    title: page?.title || tab.title || siteOf(url),
    text: unreadable ? '' : (page?.text ?? ''),
    favicon: page?.favicon || tabFavicon,
  };
}

async function activeTab(): Promise<Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** The popup names a tab only when opened as a page (e2e tests); otherwise the active tab. */
async function targetTab(tabId?: number): Promise<Tab | undefined> {
  if (tabId === undefined) return activeTab();
  try {
    return await browser.tabs.get(tabId);
  } catch {
    return undefined;
  }
}

/** Toolbar save (5.1). */
async function saveTab(tab: Tab | undefined): Promise<PopupStart> {
  if (!tab || isUnsavable(tab.url)) return { kind: 'unsavable' };
  try {
    const url = tab.url ?? '';
    // A page on the locked shelf must never gain a plain copy (F4.2): write nothing.
    if (await isLockedUrl(url)) return { kind: 'already-locked', title: tab.title || siteOf(url), site: siteOf(url) };
    const existing = await findByUrl(url);
    if (existing) return { kind: 'already', bookmark: existing };
    const page = await readPage(tab);
    const result = await savePage(page);
    return result.status === 'saved'
      ? { kind: 'saved', bookmark: result.bookmark }
      : { kind: 'already', bookmark: result.bookmark };
  } catch {
    return { kind: 'error' };
  }
}

/** Save to Locked (5.5): read the page, keep it in memory, and let the popup encrypt it. */
async function prepareLocked(tab: Tab | undefined): Promise<PopupStart> {
  if (!tab || isUnsavable(tab.url)) return { kind: 'unsavable' };
  try {
    const page = await readPage(tab);
    const plain = await findByUrl(page.url);
    const pending: PendingLockedPage = {
      ...page,
      site: siteOf(page.url),
      plainId: plain?.id ?? null,
      at: Date.now(),
    };
    return { kind: 'locked', page: pending };
  } catch {
    return { kind: 'error' };
  }
}

async function setPending(start: PopupStart): Promise<void> {
  await browser.storage.session.set({ pendingStart: { start, at: Date.now() } });
}

async function takePending(): Promise<PopupStart | null> {
  const { pendingStart } = (await browser.storage.session.get('pendingStart')) as {
    pendingStart?: { start: PopupStart; at: number };
  };
  await browser.storage.session.remove('pendingStart');
  if (!pendingStart || Date.now() - pendingStart.at > PENDING_TTL_MS) return null;
  return pendingStart.start;
}

/** Opens the popup to show a result from the right-click menu or the shortcut. */
async function showInPopup(start: PopupStart): Promise<void> {
  await setPending(start);
  try {
    await browser.action.openPopup();
  } catch {
    // The browser won't open it here: a badge tells the user to click the button.
    await browser.action.setBadgeBackgroundColor({ color: '#1E1605' });
    await browser.action.setBadgeText({ text: '1' });
  }
}

// ---- Autosave (owner's choice, 2026-11-19) ----

const AUTOSAVE_ALARM = 'penyemat-autosave';
const DOWNLOAD_TIMEOUT_MS = 120_000;

function waitForDownload(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('the download took too long')), DOWNLOAD_TIMEOUT_MS);
    const listener = (delta: Browser.downloads.DownloadDelta) => {
      if (delta.id !== id || !delta.state) return;
      if (delta.state.current === 'complete') finish();
      else if (delta.state.current === 'interrupted') finish(new Error(delta.error?.current ?? 'the download stopped'));
    };
    const finish = (error?: Error) => {
      clearTimeout(timer);
      browser.downloads.onChanged.removeListener(listener);
      if (error) reject(error);
      else resolve();
    };
    browser.downloads.onChanged.addListener(listener);
  });
}

/** Writes the backup into Downloads/<folder>/, replacing the last one, without asking where. */
async function writeDownload(json: string, path: string): Promise<void> {
  const bytes = new TextEncoder().encode(json);
  let url: string;
  let release = () => {};
  if (typeof URL.createObjectURL === 'function') {
    // Firefox's background page has object URLs; Chrome's service worker does not.
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
    url = objectUrl;
    release = () => URL.revokeObjectURL(objectUrl);
  } else {
    url = `data:application/json;base64,${toBase64(bytes)}`;
  }
  try {
    const id = await browser.downloads.download({ url, filename: path, conflictAction: 'overwrite', saveAs: false });
    await waitForDownload(id);
    // Keep the browser's download list tidy. The file itself stays.
    await browser.downloads.erase({ id }).catch(() => {});
  } finally {
    release();
  }
}

export default defineBackground(() => {
  // Hourly check; it writes only when something changed since the last autosave.
  void browser.alarms.get(AUTOSAVE_ALARM).then((alarm) => {
    if (!alarm) void browser.alarms.create(AUTOSAVE_ALARM, { periodInMinutes: 60 });
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTOSAVE_ALARM) void runAutosave(writeDownload);
  });

  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({ id: MENU_SAVE, title: 'Save to Penyemat', contexts: ['page', 'action'] });
      browser.contextMenus.create({ id: MENU_SAVE_LOCKED, title: 'Save to Locked', contexts: ['page', 'action'] });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const target = tab?.url ? Promise.resolve(tab) : activeTab();
    if (info.menuItemId === MENU_SAVE) {
      void target.then(saveTab).then(showInPopup);
    } else if (info.menuItemId === MENU_SAVE_LOCKED) {
      void target.then(prepareLocked).then(showInPopup);
    }
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'save-to-locked') return;
    const target = tab?.url ? Promise.resolve(tab) : activeTab();
    void target.then(prepareLocked).then(showInPopup);
  });

  browser.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
    const respond = (work: Promise<unknown>) => {
      work.then(sendResponse, () => sendResponse({ kind: 'error' }));
      return true;
    };
    switch (message.type) {
      case 'popup-start':
        return respond(
          (async () => {
            await browser.action.setBadgeText({ text: '' });
            return (await takePending()) ?? saveTab(await targetTab(message.tabId));
          })(),
        );
      case 'retry-save':
        return respond(targetTab(message.tabId).then(saveTab));
      case 'clear-pending-locked':
        return respond(browser.storage.session.remove('pendingStart'));
      case 'autosave-now':
        return respond(runAutosave(writeDownload, true));
      case 'open-library':
        return respond(
          browser.tabs.create({ url: browser.runtime.getURL(`/library.html${message.hash ?? ''}` as '/library.html') }),
        );
      default:
        return false;
    }
  });
});
