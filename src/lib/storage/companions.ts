import type { Companion } from '../../domain';
import { getDb, COMPANION_STORE } from './db';
import type { StorageFailureReason } from './party-members';

export type LoadCompanionsResult =
  | { ok: true; companions: Companion[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type AddCompanionsResult =
  | { ok: true; added: Companion[]; rejected: Companion[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type RemoveCompanionResult =
  | { ok: true; existed: boolean }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type SaveCompanionResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export interface CompanionDedupeResult {
  accepted: Companion[];
  rejected: Companion[];
}

export function dedupeNewCompanions(
  existingIds: ReadonlySet<string>,
  incoming: readonly Companion[]
): CompanionDedupeResult {
  const accepted: Companion[] = [];
  const rejected: Companion[] = [];
  const seen = new Set(existingIds);
  for (const companion of incoming) {
    if (seen.has(companion.id)) {
      rejected.push(companion);
    } else {
      seen.add(companion.id);
      accepted.push(companion);
    }
  }
  return { accepted, rejected };
}

export async function loadCompanions(): Promise<LoadCompanionsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const stored = (await db.getAll(COMPANION_STORE)) as Companion[];
    return { ok: true, companions: stored };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function addCompanions(companions: readonly Companion[]): Promise<AddCompanionsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    // Same racy-safe dedupe contract as addPartyMembers: snapshot + writes in
    // one readwrite tx so overlapping imports serialize on the store.
    const tx = db.transaction(COMPANION_STORE, 'readwrite');
    const existingIds = new Set((await tx.store.getAllKeys()) as string[]);
    const { accepted, rejected } = dedupeNewCompanions(existingIds, companions);
    for (const companion of accepted) {
      tx.store.put(companion, companion.id);
    }
    await tx.done;
    return { ok: true, added: accepted, rejected };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function saveCompanion(companion: Companion): Promise<SaveCompanionResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.put(COMPANION_STORE, companion, companion.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function removeCompanion(id: string): Promise<RemoveCompanionResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(COMPANION_STORE, 'readwrite');
    const existed = (await tx.store.getKey(id)) !== undefined;
    await tx.store.delete(id);
    await tx.done;
    return { ok: true, existed };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
