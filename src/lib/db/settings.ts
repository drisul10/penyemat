import { announce } from './events';
import { getDb, type Settings } from './schema';

export const IDLE_MIN = 1;
export const IDLE_MAX = 60;
const DEFAULTS: Settings = { id: 'settings', idleMinutes: 5, lastExportAt: null };

export async function getSettings(): Promise<Settings> {
  return (await getDb().settings.get('settings')) ?? DEFAULTS;
}

export function clampIdle(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULTS.idleMinutes;
  return Math.min(IDLE_MAX, Math.max(IDLE_MIN, Math.round(minutes)));
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'settings' as const };
  next.idleMinutes = clampIdle(next.idleMinutes);
  await getDb().settings.put(next);
  announce('settings');
  return next;
}
