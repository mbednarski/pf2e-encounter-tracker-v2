import type { EffectDefinition } from '../../domain';
import { getDb, SPELL_EFFECT_LIBRARY_STORE } from './db';
import type { StorageFailureReason } from './creature-library';

export type LoadSpellEffectsResult =
  | { ok: true; effects: EffectDefinition[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type AddSpellEffectsResult =
  | { ok: true; added: EffectDefinition[]; rejected: EffectDefinition[] }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type RemoveSpellEffectResult =
  | { ok: true; existed: boolean }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type ClearSpellEffectsResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export interface DedupeSpellEffectsResult {
  accepted: EffectDefinition[];
  rejected: EffectDefinition[];
}

export function dedupeNewSpellEffects(
  existingIds: ReadonlySet<string>,
  incoming: readonly EffectDefinition[]
): DedupeSpellEffectsResult {
  const accepted: EffectDefinition[] = [];
  const rejected: EffectDefinition[] = [];
  const seen = new Set(existingIds);
  for (const effect of incoming) {
    if (seen.has(effect.id)) {
      rejected.push(effect);
    } else {
      seen.add(effect.id);
      accepted.push(effect);
    }
  }
  return { accepted, rejected };
}

export async function loadSpellEffects(): Promise<LoadSpellEffectsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const effects = (await db.getAll(SPELL_EFFECT_LIBRARY_STORE)) as EffectDefinition[];
    return { ok: true, effects };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function addSpellEffects(
  effects: readonly EffectDefinition[]
): Promise<AddSpellEffectsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    // Same racy-safe dedupe contract as the creature library: snapshot ids and
    // write inside one readwrite tx so overlapping imports serialize.
    const tx = db.transaction(SPELL_EFFECT_LIBRARY_STORE, 'readwrite');
    const existingIds = new Set((await tx.store.getAllKeys()) as string[]);
    const { accepted, rejected } = dedupeNewSpellEffects(existingIds, effects);
    for (const effect of accepted) {
      tx.store.put(effect, effect.id);
    }
    await tx.done;
    return { ok: true, added: accepted, rejected };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function removeSpellEffect(id: string): Promise<RemoveSpellEffectResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    const tx = db.transaction(SPELL_EFFECT_LIBRARY_STORE, 'readwrite');
    const existed = (await tx.store.getKey(id)) !== undefined;
    await tx.store.delete(id);
    await tx.done;
    return { ok: true, existed };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}

export async function clearSpellEffects(): Promise<ClearSpellEffectsResult> {
  const promise = getDb();
  if (!promise) return { ok: false, reason: 'unavailable' };
  try {
    const db = await promise;
    await db.clear(SPELL_EFFECT_LIBRARY_STORE);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
