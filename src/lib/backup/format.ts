import { fromBase64, toBase64 } from '../bytes';
import type { Bookmark, Category, KdfParams, LockedRecord, LockMeta } from '../db/schema';

// Export file (ARCHITECTURE 5.6). Locked records stay ciphertext (F5.2). Indexes are not exported.

export const EXPORT_FORMAT = 'penyemat-export';
export const EXPORT_VERSION = 1;

export interface ExportBookmark extends Bookmark {
  text: string;
}

export interface ExportLocked {
  lockMeta: {
    shelfName: string;
    salt: string;
    kdf: KdfParams;
    verifierIv: string;
    verifier: string;
    fingerprintSalt?: string;
  };
  records: { id: string; iv: string; ciphertext: string; fingerprint?: string }[];
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: number;
  categories: Category[];
  bookmarks: ExportBookmark[];
  locked: ExportLocked | null;
}

export class ImportError extends Error {}

export function encodeLocked(meta: LockMeta, records: LockedRecord[]): ExportLocked {
  return {
    lockMeta: {
      shelfName: meta.shelfName,
      salt: toBase64(meta.salt),
      kdf: meta.kdf,
      verifierIv: toBase64(meta.verifierIv),
      verifier: toBase64(meta.verifier),
      fingerprintSalt: meta.fingerprintSalt ? toBase64(meta.fingerprintSalt) : undefined,
    },
    records: records.map((r) => ({
      id: r.id,
      iv: toBase64(r.iv),
      ciphertext: toBase64(r.ciphertext),
      fingerprint: r.fingerprint,
    })),
  };
}

export function decodeLocked(locked: ExportLocked): { meta: LockMeta; records: LockedRecord[] } {
  const m = locked.lockMeta;
  return {
    meta: {
      id: 'lock',
      shelfName: m.shelfName,
      salt: fromBase64(m.salt),
      kdf: m.kdf,
      verifierIv: fromBase64(m.verifierIv),
      verifier: fromBase64(m.verifier),
      // Files from before fingerprints get a fresh salt; their records gain fingerprints on unlock.
      fingerprintSalt: m.fingerprintSalt ? fromBase64(m.fingerprintSalt) : crypto.getRandomValues(new Uint8Array(16)),
    },
    records: locked.records.map((r) => ({
      id: r.id,
      iv: fromBase64(r.iv),
      ciphertext: fromBase64(r.ciphertext),
      ...(r.fingerprint ? { fingerprint: r.fingerprint } : {}),
    })),
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Checks the shape before anything is written. */
export function parseExport(json: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ImportError("This file isn't a Penyemat export. Choose a file made with Export library.");
  }
  if (!isObject(data) || data.format !== EXPORT_FORMAT) {
    throw new ImportError("This file isn't a Penyemat export. Choose a file made with Export library.");
  }
  if (data.version !== EXPORT_VERSION) {
    throw new ImportError('This file comes from a newer version of Penyemat. Update Penyemat, then import again.');
  }
  if (!Array.isArray(data.categories) || !Array.isArray(data.bookmarks)) {
    throw new ImportError('This export file is damaged. Export it again, then import the new file.');
  }
  for (const b of data.bookmarks) {
    if (!isObject(b) || typeof b.url !== 'string' || typeof b.id !== 'string' || typeof b.savedAt !== 'number') {
      throw new ImportError('This export file is damaged. Export it again, then import the new file.');
    }
  }
  return data as unknown as ExportFile;
}
