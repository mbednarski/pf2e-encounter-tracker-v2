import type { CombatantId, CreatureSnapshot, EncounterState } from '../../domain/types';
import { ACTIVE_ENCOUNTER_STORE, getDb } from './db';

const KEY = 'current';

export interface ActiveEncounterMigration {
  type: 'legacy-delayed-combatants';
  restoredCombatantIds: CombatantId[];
}

export interface ActiveEncounterLoadResult {
  state: EncounterState;
  migrations: ActiveEncounterMigration[];
}

export async function saveActiveEncounter(state: EncounterState): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.put(ACTIVE_ENCOUNTER_STORE, state, KEY);
}

export async function loadActiveEncounter(): Promise<ActiveEncounterLoadResult | null> {
  const promise = getDb();
  if (!promise) return null;
  const db = await promise;
  const stored = (await db.get(ACTIVE_ENCOUNTER_STORE, KEY)) as EncounterState | undefined;
  if (!stored) return null;
  const migrations: ActiveEncounterMigration[] = [];
  const legacyInitiative = stored.initiative as EncounterState['initiative'] & {
    delaying?: unknown;
  };
  if (Array.isArray(legacyInitiative.delaying)) {
    const legacyDelayed = legacyInitiative.delaying;
    const restoredCombatantIds: CombatantId[] = [];
    const orderIds = new Set(stored.initiative.order);
    for (const combatantId of legacyDelayed) {
      if (
        typeof combatantId === 'string' &&
        stored.combatants[combatantId] &&
        !orderIds.has(combatantId)
      ) {
        restoredCombatantIds.push(combatantId);
        orderIds.add(combatantId);
      }
    }
    if (legacyDelayed.length > 0) {
      stored.initiative.order = [...stored.initiative.order, ...restoredCombatantIds];
      migrations.push({ type: 'legacy-delayed-combatants', restoredCombatantIds });
    }
    delete legacyInitiative.delaying;
  }
  // Back-compat: rename creatureId -> sourceId on combatants saved under DB
  // versions <= 3. Keeps existing active encounters loadable after the rename.
  // Also: migrate pre-#117 combatants that stored baseStats + top-level level
  // into the new baseSnapshot shape. Old baseStats values were already
  // post-adjusted by applyEliteWeak before persistence, so reset
  // templateAdjustment to 'normal' to avoid double-applying elite/weak.
  if (stored.combatants) {
    for (const c of Object.values(stored.combatants)) {
      const legacy = c as unknown as {
        sourceId?: string;
        creatureId?: string;
        baseSnapshot?: CreatureSnapshot;
        baseStats?: {
          hp: number;
          ac: number;
          fortitude: number;
          reflex: number;
          will: number;
          perception: number;
          speed: number;
          skills?: Record<string, number>;
        };
        level?: number;
        templateAdjustment?: 'normal' | 'elite' | 'weak';
      };
      if (legacy.sourceId === undefined && legacy.creatureId !== undefined) {
        legacy.sourceId = legacy.creatureId;
      }
      if (
        legacy.baseSnapshot === undefined &&
        legacy.baseStats !== undefined &&
        typeof legacy.level === 'number'
      ) {
        legacy.baseSnapshot = {
          level: legacy.level,
          hp: legacy.baseStats.hp,
          ac: legacy.baseStats.ac,
          fortitude: legacy.baseStats.fortitude,
          reflex: legacy.baseStats.reflex,
          will: legacy.baseStats.will,
          perception: legacy.baseStats.perception,
          speed: legacy.baseStats.speed,
          skills: legacy.baseStats.skills ?? {}
        };
        legacy.templateAdjustment = 'normal';
      }
    }
  }
  if (!Array.isArray((stored as { recentEffectIds?: unknown }).recentEffectIds)) {
    stored.recentEffectIds = [];
  }
  return { state: stored, migrations };
}

export async function clearActiveEncounter(): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.delete(ACTIVE_ENCOUNTER_STORE, KEY);
}
