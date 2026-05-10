import type { Hazard } from '../../domain';
import { dedupeNewHazards } from '../yaml';
import { getDb, HAZARD_LIBRARY_STORE } from './db';

export type StorageFailureReason = 'unavailable' | 'failed';

export type LoadHazardsResult =
  | { ok: true; hazards: Hazard[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type AddHazardsResult =
  | { ok: true; added: Hazard[]; rejected: Hazard[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type RemoveHazardResult =
  | { ok: true; existed: boolean }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type ClearHazardsResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export async function loadHazards(): Promise<LoadHazardsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const stored = (await db.getAll(HAZARD_LIBRARY_STORE)) as Hazard[];
    return { ok: true, hazards: stored };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function addHazards(hazards: readonly Hazard[]): Promise<AddHazardsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(HAZARD_LIBRARY_STORE, 'readwrite');
    const existingIds = new Set((await tx.store.getAllKeys()) as string[]);
    const { accepted, rejected } = dedupeNewHazards(existingIds, hazards);
    for (const hazard of accepted) {
      tx.store.put(hazard, hazard.id);
    }
    await tx.done;
    return { ok: true, added: accepted, rejected };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function removeHazard(id: string): Promise<RemoveHazardResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(HAZARD_LIBRARY_STORE, 'readwrite');
    const existed = (await tx.store.getKey(id)) !== undefined;
    await tx.store.delete(id);
    await tx.done;
    return { ok: true, existed };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function clearHazards(): Promise<ClearHazardsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.clear(HAZARD_LIBRARY_STORE);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
