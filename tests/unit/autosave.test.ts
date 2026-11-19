import { beforeEach, describe, expect, it } from 'vitest';
import {
  autosavePath,
  cleanFolder,
  KEEP_IN_BROWSER,
  listStoredBackups,
  readStoredBackup,
  runAutosave,
  writeToPickedFolder,
} from '../../src/lib/backup/autosave';
import { parseExport } from '../../src/lib/backup/format';
import { savePage, setCategory } from '../../src/lib/db/bookmarks';
import type { PenyematDB } from '../../src/lib/db/schema';
import { getSettings, updateSettings } from '../../src/lib/db/settings';
import { freshDb } from './helpers';

let db: PenyematDB;
let writes: { json: string; path: string }[];
const write = async (json: string, path: string) => {
  writes.push({ json, path });
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));

beforeEach(async () => {
  db = await freshDb();
  writes = [];
});

describe('autosave (owner choice 2026-11-19)', () => {
  it('does nothing while off, which is the default', async () => {
    expect((await getSettings()).autosave).toBeFalsy();
    expect(await runAutosave(write)).toBe('off');
    expect(writes).toHaveLength(0);
  });

  it('writes one file to Downloads/Penyemat and keeps a copy in the browser', async () => {
    const saved = await savePage({ url: 'https://recipes.example.com/a', title: 'Pasta', text: 'lemon zest' });
    await updateSettings({ autosave: true });
    await settle();
    expect(await runAutosave(write)).toBe('saved');
    expect(writes[0]?.path).toBe('Penyemat/penyemat-backup.json');
    expect(parseExport(writes[0]?.json ?? '').bookmarks.map((b) => b.title)).toEqual(['Pasta']);
    const [stored] = await listStoredBackups();
    expect(parseExport(await readStoredBackup(stored?.id ?? 0)).bookmarks).toHaveLength(1);
    expect((await getSettings()).lastAutosaveAt).toBeTruthy();

    // Nothing changed: no new file. A change: a new file.
    expect(await runAutosave(write)).toBe('unchanged');
    await settle();
    await setCategory(saved.bookmark.id, 'read-later');
    await settle();
    expect(await runAutosave(write)).toBe('saved');
    expect(writes).toHaveLength(2);
  });

  it(`keeps only the last ${KEEP_IN_BROWSER} copies in the browser`, async () => {
    await updateSettings({ autosave: true });
    for (let i = 0; i < KEEP_IN_BROWSER + 3; i++) await runAutosave(write, true, 1000 + i);
    const stored = await listStoredBackups();
    expect(stored).toHaveLength(KEEP_IN_BROWSER);
    expect(stored[0]?.at).toBe(1000 + KEEP_IN_BROWSER + 2);
    expect(await db.backups.count()).toBe(KEEP_IN_BROWSER);
  });

  it('records a failed write and keeps the browser copy', async () => {
    await updateSettings({ autosave: true });
    const failing = async () => {
      throw new Error('disk full');
    };
    expect(await runAutosave(failing, true)).toBe('failed');
    expect((await getSettings()).lastAutosaveError).toBe('disk full');
    expect(await db.backups.count()).toBe(1);
    expect(await runAutosave(write, true)).toBe('saved');
    expect((await getSettings()).lastAutosaveError).toBeNull();
  });

  it('keeps the folder inside Downloads', () => {
    expect(cleanFolder(' /Backups/Penyemat/ ')).toBe('Backups/Penyemat');
    expect(cleanFolder('')).toBe('Penyemat');
    expect(() => cleanFolder('../Desktop')).toThrow();
    expect(() => cleanFolder('a:b')).toThrow();
    expect(autosavePath('../evil')).toBe('Penyemat/penyemat-backup.json');
  });

  it('writes into a picked folder only while the browser allows it', async () => {
    const written: string[] = [];
    const folder = (permission: PermissionState) =>
      ({
        name: 'Backups',
        queryPermission: async () => permission,
        getFileHandle: async () => ({
          createWritable: async () => ({
            write: async (data: string) => {
              written.push(data);
            },
            close: async () => {},
          }),
        }),
      }) as unknown as FileSystemDirectoryHandle;
    expect(await writeToPickedFolder(folder('granted'), '{"a":1}')).toBe(true);
    expect(written).toEqual(['{"a":1}']);
    expect(await writeToPickedFolder(folder('prompt'), '{"b":2}')).toBe(false);
    expect(written).toHaveLength(1);
  });
});
