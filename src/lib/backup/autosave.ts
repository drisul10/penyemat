import { gunzip, gzip } from '../bytes';
import { getDb } from '../db/schema';
import { getSettings, updateSettings } from '../db/settings';
import { buildExport } from './backup';

// Autosave (owner's choice, 2026-11-19): when something changed, at most hourly, one file in
// Downloads/<folder>/ that is overwritten, plus the last 7 copies kept inside the browser.

export const AUTOSAVE_FILE = 'penyemat-backup.json';
export const DEFAULT_FOLDER = 'Penyemat';
export const KEEP_IN_BROWSER = 7;

export class FolderError extends Error {}

/** A folder name inside Downloads. Subfolders are allowed; nothing may climb out of Downloads. */
export function cleanFolder(input: string): string {
  const parts = input
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return DEFAULT_FOLDER;
  for (const part of parts) {
    if (part === '.' || part === '..') throw new FolderError('Use a folder name without "." or "..".');
    if (/[<>:"|?*]/.test(part) || /^[.\s]|[.\s]$/.test(part)) {
      throw new FolderError('Use letters, numbers, spaces, dashes, or underscores in the folder name.');
    }
  }
  return parts.join('/');
}

export function autosavePath(folder: string | undefined): string {
  let clean = DEFAULT_FOLDER;
  try {
    clean = cleanFolder(folder ?? DEFAULT_FOLDER);
  } catch {
    // A bad stored name falls back to the default folder.
  }
  return `${clean}/${AUTOSAVE_FILE}`;
}

export type WriteFile = (json: string, path: string) => Promise<void>;

/**
 * Writes into a folder the user picked, if the browser still allows it. Returns false when
 * permission lapsed (Chromium asks again after a restart); the caller then uses Downloads.
 */
export async function writeToPickedFolder(dir: FileSystemDirectoryHandle, json: string): Promise<boolean> {
  if (typeof dir.queryPermission !== 'function') return false;
  if ((await dir.queryPermission({ mode: 'readwrite' })) !== 'granted') return false;
  const file = await dir.getFileHandle(AUTOSAVE_FILE, { create: true });
  const writable = await file.createWritable();
  await writable.write(json);
  await writable.close();
  return true;
}

export type AutosaveResult = 'saved' | 'off' | 'unchanged' | 'failed';

/** Runs one autosave. `force` skips the "anything changed?" check (turning autosave on, Save now). */
export async function runAutosave(write: WriteFile, force = false, now = Date.now()): Promise<AutosaveResult> {
  const settings = await getSettings();
  if (!settings.autosave && !force) return 'off';
  if (!force && settings.lastAutosaveAt && (settings.changedAt ?? 0) <= settings.lastAutosaveAt) return 'unchanged';
  try {
    const file = await buildExport(now);
    const json = JSON.stringify(file);
    const data = await gzip(json);
    const db = getDb();
    await db.backups.add({ at: now, data, size: json.length });
    const keep = await db.backups.orderBy('at').reverse().limit(KEEP_IN_BROWSER).primaryKeys();
    const kept = keep.filter((key): key is number => typeof key === 'number');
    await db.backups.where('id').noneOf(kept).delete();
    const dir = settings.autosaveDir;
    if (dir && (await writeToPickedFolder(dir, json))) {
      await updateSettings({
        lastAutosaveAt: now,
        lastAutosaveError: null,
        autosaveDirBlocked: false,
        lastAutosavePath: `${dir.name}/${AUTOSAVE_FILE}`,
      });
      return 'saved';
    }
    const path = autosavePath(settings.autosaveFolder);
    await write(json, path);
    await updateSettings({
      lastAutosaveAt: now,
      lastAutosaveError: null,
      autosaveDirBlocked: Boolean(dir),
      lastAutosavePath: `Downloads/${path}`,
    });
    return 'saved';
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await updateSettings({ lastAutosaveError: reason || 'unknown error' });
    return 'failed';
  }
}

export async function listStoredBackups(): Promise<{ id: number; at: number; size: number }[]> {
  const rows = await getDb().backups.orderBy('at').reverse().toArray();
  return rows.map((r) => ({ id: r.id ?? 0, at: r.at, size: r.size }));
}

export async function readStoredBackup(id: number): Promise<string> {
  const row = await getDb().backups.get(id);
  if (!row) throw new Error('That backup is gone.');
  return gunzip(row.data);
}
