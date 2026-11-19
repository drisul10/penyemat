// Every context (background, popup, library tabs, search workers) shares one IndexedDB.
// Writers announce changes here so readers refresh without polling.

import { getDb } from './schema';

export const DATA_CHANNEL = 'penyemat-data';

export type DataEvent = { type: 'changed'; scope: 'bookmarks' | 'categories' | 'locked' | 'settings' };

/** Stamps the time of the last data change, which autosave compares with its last run. */
function markChanged(): void {
  void getDb()
    .settings.update('settings', { changedAt: Date.now() })
    .catch(() => {});
}

export function announce(scope: DataEvent['scope']): void {
  if (scope !== 'settings') markChanged();
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(DATA_CHANNEL);
  channel.postMessage({ type: 'changed', scope } satisfies DataEvent);
  channel.close();
}

export function onDataChange(handler: (event: DataEvent) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(DATA_CHANNEL);
  channel.onmessage = (event: MessageEvent<DataEvent>) => handler(event.data);
  return () => channel.close();
}
