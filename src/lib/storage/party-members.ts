import type { PartyMember } from '../../domain';
import { getDb, PARTY_MEMBER_STORE } from './db';

export type StorageFailureReason = 'unavailable' | 'failed';

export type LoadPartyMembersResult =
  | { ok: true; partyMembers: PartyMember[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type AddPartyMembersResult =
  | { ok: true; added: PartyMember[]; rejected: PartyMember[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type RemovePartyMemberResult =
  | { ok: true; existed: boolean }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type SavePartyMemberResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type ClearPartyMembersResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export interface DedupeResult {
  accepted: PartyMember[];
  rejected: PartyMember[];
}

export function dedupeNewPartyMembers(
  existingIds: ReadonlySet<string>,
  incoming: readonly PartyMember[]
): DedupeResult {
  const accepted: PartyMember[] = [];
  const rejected: PartyMember[] = [];
  const seen = new Set(existingIds);
  for (const member of incoming) {
    if (seen.has(member.id)) {
      rejected.push(member);
    } else {
      seen.add(member.id);
      accepted.push(member);
    }
  }
  return { accepted, rejected };
}

export async function loadPartyMembers(): Promise<LoadPartyMembersResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const stored = (await db.getAll(PARTY_MEMBER_STORE)) as PartyMember[];
    return { ok: true, partyMembers: stored };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function addPartyMembers(
  members: readonly PartyMember[]
): Promise<AddPartyMembersResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    // Snapshot existing ids and write new records inside one readwrite tx so
    // two rapid imports cannot both decide to write the same id against a
    // stale snapshot — IDB serializes overlapping readwrite txns on the same
    // store, which is what makes the dedupe contract racy-safe.
    const tx = db.transaction(PARTY_MEMBER_STORE, 'readwrite');
    const existingIds = new Set((await tx.store.getAllKeys()) as string[]);
    const { accepted, rejected } = dedupeNewPartyMembers(existingIds, members);
    for (const member of accepted) {
      tx.store.put(member, member.id);
    }
    await tx.done;
    return { ok: true, added: accepted, rejected };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function savePartyMember(member: PartyMember): Promise<SavePartyMemberResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.put(PARTY_MEMBER_STORE, member, member.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function removePartyMember(id: string): Promise<RemovePartyMemberResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(PARTY_MEMBER_STORE, 'readwrite');
    const existed = (await tx.store.getKey(id)) !== undefined;
    await tx.store.delete(id);
    await tx.done;
    return { ok: true, existed };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function clearPartyMembers(): Promise<ClearPartyMembersResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.clear(PARTY_MEMBER_STORE);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
