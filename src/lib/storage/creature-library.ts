import type { Creature } from '../../domain';
import { dedupeNewCreatures } from '../yaml';
import { CREATURE_LIBRARY_STORE, getDb } from './db';

export type StorageFailureReason = 'unavailable' | 'failed';

export type LoadCreaturesResult =
  | { ok: true; creatures: Creature[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type AddCreaturesResult =
  | { ok: true; added: Creature[]; rejected: Creature[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type RemoveCreatureResult =
  | { ok: true; existed: boolean }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type ClearCreaturesResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export async function loadCreatures(): Promise<LoadCreaturesResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const stored = (await db.getAll(CREATURE_LIBRARY_STORE)) as Creature[];
    return { ok: true, creatures: stored };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function addCreatures(
  creatures: readonly Creature[]
): Promise<AddCreaturesResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    // Snapshot existing ids and write new records inside one readwrite tx so
    // two rapid imports cannot both decide to write the same id against a
    // stale snapshot — IDB serializes overlapping readwrite txns on the same
    // store, which is what makes the dedupe contract racy-safe.
    const tx = db.transaction(CREATURE_LIBRARY_STORE, 'readwrite');
    const existingIds = new Set(
      (await tx.store.getAllKeys()) as string[]
    );
    const { accepted, rejected } = dedupeNewCreatures(existingIds, creatures);
    for (const creature of accepted) {
      tx.store.put(creature, creature.id);
    }
    await tx.done;
    return { ok: true, added: accepted, rejected };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function removeCreature(id: string): Promise<RemoveCreatureResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(CREATURE_LIBRARY_STORE, 'readwrite');
    const existed = (await tx.store.getKey(id)) !== undefined;
    await tx.store.delete(id);
    await tx.done;
    return { ok: true, existed };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function clearCreatures(): Promise<ClearCreaturesResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.clear(CREATURE_LIBRARY_STORE);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
