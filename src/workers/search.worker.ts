/// <reference lib="webworker" />
import { openLockChannel } from '../lib/crypto/share';
import { onDataChange } from '../lib/db/events';
import type { WorkerEvent, WorkerRequest } from '../lib/search/protocol';
import { SearchService, WrongPassphrase } from '../lib/search/service';

// Search worker (ARCHITECTURE 2, 5.3–5.5): search, index upkeep, Argon2id, and the
// locked shelf run here so the library page never freezes.

// Loaded as an extension file (src/entrypoints/search-worker.ts), never from the dev server:
// a worker served from http://localhost inside a chrome-extension:// page makes Chrome kill the tab.

export function startSearchWorker(): void {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  const emit = (event: WorkerEvent) => scope.postMessage(event);
  const lockChannel = openLockChannel((message) => void service.onLockMessage(message));
  const service = new SearchService({ emit, broadcast: lockChannel.post });

  onDataChange((event) => {
    if (event.scope === 'bookmarks' || event.scope === 'categories') void service.sync();
    if (event.scope === 'locked') void service.refreshLocked();
  });

  async function reply(id: number, work: () => Promise<unknown>): Promise<void> {
    try {
      const data = await work();
      emit({ type: 'reply', id, ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ type: 'reply', id, ok: false, error: error instanceof WrongPassphrase ? 'wrong-passphrase' : message });
    }
  }

  scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;
    switch (request.type) {
      case 'init':
        void service.init().catch(() => {});
        break;
      case 'search':
        void service.search(request.id, request.query);
        break;
      case 'lock':
        void service.lock();
        break;
      case 'unlock':
        void reply(request.id, () => service.unlock(request.passphrase));
        break;
      case 'setup':
        void reply(request.id, () => service.setup(request.passphrase, request.shelfName));
        break;
      case 'change-passphrase':
        void reply(request.id, () => service.changePassphrase(request.current, request.next));
        break;
      case 'move-from-locked':
        void reply(request.id, () => service.moveFromLocked(request.recordId, request.categoryId));
        break;
      case 'save-locked':
        void reply(request.id, () => service.saveLocked(request.page, request.passphrase));
        break;
      case 'move-to-locked':
        void reply(request.id, () => service.moveToLocked(request.bookmarkId, request.passphrase));
        break;
      case 'locked-delete':
        void reply(request.id, () => service.deleteLocked(request.recordId));
        break;
      case 'locked-restore':
        void reply(request.id, () => service.restoreLocked(request.item, request.text));
        break;
      case 'locked-import':
        void reply(request.id, () =>
          service.importLocked(request.fileJson, request.filePassphrase, request.currentPassphrase),
        );
        break;
    }
  };
}
