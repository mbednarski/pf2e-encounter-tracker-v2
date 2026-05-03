import type { EncounterState } from '../../domain/types';
import { ACTIVE_ENCOUNTER_STORE, getDb } from './db';

const KEY = 'current';

export async function saveActiveEncounter(state: EncounterState): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.put(ACTIVE_ENCOUNTER_STORE, state, KEY);
}

export async function loadActiveEncounter(): Promise<EncounterState | null> {
  const promise = getDb();
  if (!promise) return null;
  const db = await promise;
  const stored = (await db.get(ACTIVE_ENCOUNTER_STORE, KEY)) as EncounterState | undefined;
  if (!stored) return null;
  if (stored.phase === 'COMPLETED') return null;
  return stored;
}

export async function clearActiveEncounter(): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.delete(ACTIVE_ENCOUNTER_STORE, KEY);
}
