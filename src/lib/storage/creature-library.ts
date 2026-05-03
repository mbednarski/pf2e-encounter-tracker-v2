import type { Creature } from '../../domain';
import { dedupeNewCreatures } from '../yaml';
import { CREATURE_LIBRARY_STORE, getDb } from './db';

export interface AddCreaturesResult {
  added: Creature[];
  rejected: Creature[];
  persisted: boolean;
}

export async function loadCreatures(): Promise<Creature[]> {
  const promise = getDb();
  if (!promise) return [];
  const db = await promise;
  const stored = (await db.getAll(CREATURE_LIBRARY_STORE)) as Creature[];
  return stored;
}

export async function addCreatures(
  creatures: readonly Creature[]
): Promise<AddCreaturesResult> {
  const promise = getDb();
  if (!promise) {
    return { added: [], rejected: [], persisted: false };
  }
  const db = await promise;
  const existingIds = new Set(
    (await db.getAllKeys(CREATURE_LIBRARY_STORE)) as string[]
  );
  const { accepted, rejected } = dedupeNewCreatures(existingIds, creatures);
  if (accepted.length === 0) {
    return { added: [], rejected, persisted: true };
  }
  const tx = db.transaction(CREATURE_LIBRARY_STORE, 'readwrite');
  for (const creature of accepted) {
    tx.store.put(creature, creature.id);
  }
  await tx.done;
  return { added: accepted, rejected, persisted: true };
}

export async function removeCreature(id: string): Promise<boolean> {
  const promise = getDb();
  if (!promise) return false;
  const db = await promise;
  await db.delete(CREATURE_LIBRARY_STORE, id);
  return true;
}

export async function clearCreatures(): Promise<boolean> {
  const promise = getDb();
  if (!promise) return false;
  const db = await promise;
  await db.clear(CREATURE_LIBRARY_STORE);
  return true;
}
