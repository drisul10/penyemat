import type { Bookmark } from './db/schema';

// Messages between the popup and the background.

/** A page read for Save to Locked. Kept in memory only (storage.session), never on disk. */
export interface PendingLockedPage {
  url: string;
  title: string;
  site: string;
  favicon: string;
  text: string;
  /** Set when the page already has an unencrypted save. */
  plainId: string | null;
  at: number;
}

export type PopupStart =
  | { kind: 'saved'; bookmark: Bookmark }
  | { kind: 'already'; bookmark: Bookmark }
  /** The address is on the locked shelf; nothing was written. */
  | { kind: 'already-locked'; title: string; site: string }
  | { kind: 'unsavable' }
  | { kind: 'error' }
  | { kind: 'locked'; page: PendingLockedPage };

export type BackgroundRequest =
  | { type: 'popup-start'; tabId?: number }
  | { type: 'retry-save'; tabId?: number }
  | { type: 'clear-pending-locked' }
  | { type: 'open-library'; hash?: string }
  | { type: 'autosave-now' };
