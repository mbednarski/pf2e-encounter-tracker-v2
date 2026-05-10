import type { CombatantState, Hazard, HazardBaseStats } from '../types';

export interface CreateCombatantFromHazardInput {
  hazard: Hazard;
  combatantId: string;
  name?: string;
}

export function createCombatantFromHazard({
  hazard,
  combatantId,
  name
}: CreateCombatantFromHazardInput): CombatantState {
  const hp = hazard.hp ?? 0;
  const baseStats: HazardBaseStats = {
    hp,
    ac: hazard.ac ?? null,
    fortitude: hazard.fortitude ?? null,
    reflex: hazard.reflex ?? null,
    will: hazard.will ?? null,
    perception: hazard.perception ?? 0,
    stealth: hazard.stealth,
    speed: 0,
    skills: {}
  };
  if (hazard.stealthNote !== undefined) {
    baseStats.stealthNote = hazard.stealthNote;
  }
  if (hazard.hardness !== undefined) {
    baseStats.hardness = hazard.hardness;
  }
  if (hazard.immunities.length > 0) {
    baseStats.immunities = cloneValue(hazard.immunities);
  }
  if (hazard.resistances.length > 0) {
    baseStats.resistances = cloneValue(hazard.resistances);
  }
  if (hazard.weaknesses.length > 0) {
    baseStats.weaknesses = cloneValue(hazard.weaknesses);
  }

  return {
    id: combatantId,
    sourceId: hazard.id,
    name: name ?? hazard.name,
    sourceType: 'hazard',
    baseStats,
    currentHp: hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: cloneValue(hazard.attacks),
    passiveAbilities: cloneValue(hazard.passiveAbilities),
    reactiveAbilities: cloneValue(hazard.reactiveAbilities),
    activeAbilities: cloneValue(hazard.activeAbilities),
    traits: cloneValue(hazard.traits),
    level: hazard.level,
    hazardData: {
      routine: cloneValue(hazard.routine),
      disableChecks: cloneValue(hazard.disableChecks),
      disableProgress: hazard.disableChecks.map((check, i) => ({
        checkIndex: i,
        successesRemaining: check.requiredSuccesses
      }))
    }
  };
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
