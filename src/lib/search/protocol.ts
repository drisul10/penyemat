import type { Bookmark } from '../db/schema';
import type { Snippet } from './snippet';

// Messages between the library page and its search worker.

export interface ResultHit {
  id: string;
  locked: boolean;
  score: number;
  snippet: Snippet | null;
}

/** A pasted page read in memory, headed straight for the locked shelf. */
export interface LockedPage {
  url: string;
  title: string;
  text: string;
  favicon: string;
}

export type SaveLockedResult = { status: 'saved' } | { status: 'already-locked' } | { status: 'already-plain' };

export interface LockedItem {
  recordId: string;
  bookmark: Bookmark;
}

export type LockState =
  | { state: 'none' }
  | { state: 'locked'; shelfName: string }
  | { state: 'unlocked'; shelfName: string; items: LockedItem[] };

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'search'; id: number; query: string }
  | { type: 'unlock'; id: number; passphrase: string }
  | { type: 'lock' }
  | { type: 'setup'; id: number; passphrase: string; shelfName: string }
  | { type: 'change-passphrase'; id: number; current: string; next: string }
  | { type: 'locked-delete'; id: number; recordId: string }
  | { type: 'move-to-locked'; id: number; bookmarkId: string; passphrase?: string }
  | { type: 'save-locked'; id: number; page: LockedPage; passphrase?: string }
  | { type: 'move-from-locked'; id: number; recordId: string; categoryId: string }
  | { type: 'locked-restore'; id: number; item: LockedItem; text: string }
  | { type: 'locked-import'; id: number; fileJson: string; filePassphrase: string; currentPassphrase?: string };

export type WorkerEvent =
  | { type: 'status'; ready: boolean; building: { done: number; total: number } | null; failed?: string }
  | { type: 'results'; id: number; query: string; hits: ResultHit[]; tookMs: number }
  | { type: 'lock-state'; lock: LockState }
  | { type: 'reply'; id: number; ok: boolean; error?: string; data?: unknown };
