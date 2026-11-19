import { beforeEach, describe, expect, it } from 'vitest';
import type { LockMessage } from '../../src/lib/crypto/share';
import { deleteBookmark, savePage } from '../../src/lib/db/bookmarks';
import type { PenyematDB } from '../../src/lib/db/schema';
import type { LockState, WorkerEvent } from '../../src/lib/search/protocol';
import { SearchService } from '../../src/lib/search/service';
import { freshDb } from './helpers';

let db: PenyematDB;
let events: WorkerEvent[];
let sent: LockMessage[];

function makeService() {
  return new SearchService({ emit: (e) => events.push(e), broadcast: (m) => sent.push(m) });
}

async function query(service: SearchService, q: string, id = Math.random()) {
  await service.search(id, q);
  const result = [...events].reverse().find((e) => e.type === 'results' && e.id === id);
  return result?.type === 'results' ? result.hits : [];
}

beforeEach(async () => {
  db = await freshDb();
  events = [];
  sent = [];
});

describe('search service (ARCHITECTURE 5.3–5.5)', () => {
  it('builds, syncs new saves and deletes, and writes a snapshot', async () => {
    await savePage({ url: 'https://recipes.example.com/a', title: 'Pasta', text: 'finish with lemon zest' });
    const service = makeService();
    await service.init();
    expect((await query(service, 'zest')).map((h) => h.snippet?.text)).toEqual(['finish with lemon zest']);

    const b = await savePage({ url: 'https://bread.example.com/b', title: 'Sourdough', text: 'poppy seeds' });
    await service.sync();
    expect(await query(service, 'poppy')).toHaveLength(1);

    await deleteBookmark(b.bookmark.id);
    await service.sync();
    expect(await query(service, 'poppy')).toHaveLength(0);

    await service.writeSnapshot();
    const reloaded = makeService();
    await reloaded.init();
    expect(await query(reloaded, 'lemon')).toHaveLength(1);
    expect(await query(reloaded, 'poppy')).toHaveLength(0);
  });

  it('keeps locked items out of search until unlocked, and back out after lock (F4.5)', async () => {
    const service = makeService();
    await service.init();
    await service.setup('correct horse', 'Locked');
    // Save something into the locked shelf through the service's key.
    const state = (await service.lockState()) as Extract<LockState, { state: 'unlocked' }>;
    expect(state.state).toBe('unlocked');
    await service.restoreLocked(
      {
        recordId: 'x',
        bookmark: {
          id: 'l1',
          url: 'https://party.example.com/plan',
          title: 'Surprise party checklist',
          site: 'party.example.com',
          favicon: '',
          savedAt: 1,
          updatedAt: 1,
          categoryId: 'unsorted',
          textStatus: 'ok',
        },
      },
      'balloons and cake',
    );
    expect((await query(service, 'balloons')).map((h) => h.locked)).toEqual([true]);
    await service.lock();
    expect(sent.at(-1)).toEqual({ type: 'lock' });
    expect(await query(service, 'balloons')).toHaveLength(0);
    expect((await service.lockState()).state).toBe('locked');

    await expect(service.unlock('wrong passphrase')).rejects.toThrow(/doesn't match/);
    await service.unlock('correct horse');
    expect(await query(service, 'balloons')).toHaveLength(1);
  });

  it('shares an unlock with another tab over the lock channel', async () => {
    const first = makeService();
    await first.init();
    await first.setup('correct horse', 'Locked');
    const keyMessage = sent.find((m) => m.type === 'key');
    const second = makeService();
    await second.init();
    expect((await second.lockState()).state).toBe('locked');
    if (keyMessage) await second.onLockMessage(keyMessage);
    expect((await second.lockState()).state).toBe('unlocked');
    await second.onLockMessage({ type: 'lock' });
    expect((await second.lockState()).state).toBe('locked');
  });

  it('changes the passphrase and keeps every record readable (F4.9)', async () => {
    const service = makeService();
    await service.init();
    await service.setup('old passphrase', 'Locked');
    await service.restoreLocked(
      {
        recordId: 'x',
        bookmark: {
          id: 'l1',
          url: 'https://homes.example.com/river',
          title: 'River flat',
          site: 'homes.example.com',
          favicon: '',
          savedAt: 1,
          updatedAt: 1,
          categoryId: 'unsorted',
          textStatus: 'ok',
        },
      },
      'two bedrooms',
    );
    await service.changePassphrase('old passphrase', 'new passphrase');
    await service.lock();
    await expect(service.unlock('old passphrase')).rejects.toThrow();
    await service.unlock('new passphrase');
    const state = await service.lockState();
    expect(state.state === 'unlocked' && state.items.map((i) => i.bookmark.title)).toEqual(['River flat']);
    expect(await db.lockedRecords.count()).toBe(1);
  });

  it('moves a saved link onto the locked shelf, with the open key or a passphrase', async () => {
    const a = await savePage({ url: 'https://homes.example.com/a', title: 'River flat', text: 'two bedrooms' });
    const b = await savePage({ url: 'https://party.example.com/b', title: 'Party plan', text: 'balloons' });
    const service = makeService();
    await service.init();
    await service.setup('correct horse', 'Locked');

    await service.moveToLocked(a.bookmark.id);
    expect(await query(service, 'bedrooms')).toEqual([expect.objectContaining({ locked: true })]);

    await service.lock();
    await expect(service.moveToLocked(b.bookmark.id, 'wrong passphrase')).rejects.toThrow(/doesn't match/);
    await service.moveToLocked(b.bookmark.id, 'correct horse');
    expect((await service.lockState()).state).toBe('locked');
    expect(await db.bookmarks.count()).toBe(0);
    expect(await db.lockedRecords.count()).toBe(2);
    expect(await query(service, 'balloons')).toHaveLength(0);
  });

  it('saves a pasted page straight onto the locked shelf, never as a plain row (F4.7)', async () => {
    await savePage({ url: 'https://recipes.example.com/plain', title: 'Plain', text: 'x' });
    const service = makeService();
    await service.init();
    await service.setup('correct horse', 'Locked');
    const page = { url: 'https://homes.example.com/river', title: 'River flat', text: 'two bedrooms', favicon: '' };

    expect(await service.saveLocked(page)).toEqual({ status: 'saved' });
    expect(await service.saveLocked(page)).toEqual({ status: 'already-locked' });
    expect(await service.saveLocked({ ...page, url: 'https://recipes.example.com/plain' })).toEqual({
      status: 'already-plain',
    });

    await service.lock();
    const other = { ...page, url: 'https://homes.example.com/hill' };
    await expect(service.saveLocked(other, 'wrong passphrase')).rejects.toThrow(/doesn't match/);
    expect(await service.saveLocked(other, 'correct horse')).toEqual({ status: 'saved' });
    expect((await service.lockState()).state).toBe('locked');
    expect(await db.bookmarks.count()).toBe(1);
    expect(await db.lockedRecords.count()).toBe(2);
  });

  it('moves a locked link back to a category as a plain bookmark', async () => {
    const saved = await savePage({ url: 'https://homes.example.com/river', title: 'River flat', text: 'two bedrooms' });
    const service = makeService();
    await service.init();
    await service.setup('correct horse', 'Locked');
    await service.moveToLocked(saved.bookmark.id);
    const state = await service.lockState();
    const recordId = state.state === 'unlocked' ? state.items[0]?.recordId : undefined;
    if (!recordId) throw new Error('no locked item');

    await service.moveFromLocked(recordId, 'read-later');
    expect(await db.lockedRecords.count()).toBe(0);
    const [plain] = await db.bookmarks.toArray();
    expect(plain?.categoryId).toBe('read-later');
    expect((await db.texts.get(plain?.id ?? ''))?.text).toBe('two bedrooms');
    expect((await query(service, 'bedrooms')).map((h) => h.locked)).toEqual([false]);
  });
});
