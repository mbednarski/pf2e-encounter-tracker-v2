import type { Party } from '../../domain';
import { getDb, PARTY_STORE } from './db';
import type { StorageFailureReason } from './party-members';

export type LoadPartiesResult =
  | { ok: true; parties: Party[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type AddPartiesResult =
  | { ok: true; added: Party[]; rejected: Party[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type SavePartyResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type RemovePartyResult =
  | { ok: true; existed: boolean }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export interface PartyDedupeResult {
  accepted: Party[];
  rejected: Party[];
}

export function dedupeNewParties(
  existingIds: ReadonlySet<string>,
  incoming: readonly Party[]
): PartyDedupeResult {
  const accepted: Party[] = [];
  const rejected: Party[] = [];
  const seen = new Set(existingIds);
  for (const party of incoming) {
    if (seen.has(party.id)) {
      rejected.push(party);
    } else {
      seen.add(party.id);
      accepted.push(party);
    }
  }
  return { accepted, rejected };
}

export async function loadParties(): Promise<LoadPartiesResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const stored = (await db.getAll(PARTY_STORE)) as Party[];
    return { ok: true, parties: stored };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function addParties(parties: readonly Party[]): Promise<AddPartiesResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    // Same racy-safe dedupe contract as the other library stores.
    const tx = db.transaction(PARTY_STORE, 'readwrite');
    const existingIds = new Set((await tx.store.getAllKeys()) as string[]);
    const { accepted, rejected } = dedupeNewParties(existingIds, parties);
    for (const party of accepted) {
      tx.store.put(party, party.id);
    }
    await tx.done;
    return { ok: true, added: accepted, rejected };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function saveParty(party: Party): Promise<SavePartyResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.put(PARTY_STORE, party, party.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function removeParty(id: string): Promise<RemovePartyResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(PARTY_STORE, 'readwrite');
    const existed = (await tx.store.getKey(id)) !== undefined;
    await tx.store.delete(id);
    await tx.done;
    return { ok: true, existed };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
