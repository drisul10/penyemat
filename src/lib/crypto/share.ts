// One unlock serves every library tab (ARCHITECTURE 5.5, risk T6). Same origin only.
// Raw key bytes pass between this extension's own tabs and are dropped on relock.

export const LOCK_CHANNEL = 'penyemat-lock';

export type LockMessage =
  | { type: 'request-key' }
  | { type: 'key'; raw: Uint8Array }
  | { type: 'lock' }
  | { type: 'activity'; at: number };

export function openLockChannel(handler: (message: LockMessage) => void): {
  post: (message: LockMessage) => void;
  close: () => void;
} {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} };
  const channel = new BroadcastChannel(LOCK_CHANNEL);
  channel.onmessage = (event: MessageEvent<LockMessage>) => handler(event.data);
  return { post: (message) => channel.postMessage(message), close: () => channel.close() };
}
