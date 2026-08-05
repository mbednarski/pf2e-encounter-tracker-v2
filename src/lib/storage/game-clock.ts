import { getDb, SETTINGS_STORE } from './db';

const KEY = 'gameClockMinutes';

export async function saveGameClock(minutes: number): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.put(SETTINGS_STORE, minutes, KEY);
}

export async function loadGameClock(): Promise<number | null> {
  const promise = getDb();
  if (!promise) return null;
  const db = await promise;
  const stored = (await db.get(SETTINGS_STORE, KEY)) as unknown;
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : null;
}
