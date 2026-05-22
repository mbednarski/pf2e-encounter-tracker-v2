import type { CombatantState, CreatureSnapshot, Hazard, HazardData } from '../types';

export interface CreateCombatantFromHazardInput {
  hazard: Hazard;
  combatantId: string;
  name?: string;
}

/**
 * Builds a hazard combatant from a library `Hazard`. The result is a plain
 * `CombatantState` — the domain reducer, effects engine, initiative, and HP
 * tracking treat it identically to a creature combatant.
 *
 * A complex hazard rolls Stealth for initiative, so the hazard's `stealth`
 * value occupies the snapshot `perception` slot (the slot the initiative
 * logic reads). The UI labels that stat "Stealth" for hazards. Hazards never
 * receive weak/elite templates, so `templateAdjustment` stays `'normal'`.
 */
export function createCombatantFromHazard({
  hazard,
  combatantId,
  name
}: CreateCombatantFromHazardInput): CombatantState {
  const baseSnapshot: CreatureSnapshot = {
    level: hazard.level,
    ac: hazard.ac,
    fortitude: hazard.fortitude,
    reflex: hazard.reflex,
    will: hazard.will,
    perception: hazard.stealth,
    hp: hazard.hp,
    speed: 0,
    skills: {}
  };

  return {
    id: combatantId,
    sourceId: hazard.id,
    name: name ?? hazard.name,
    sourceType: 'hazard',
    baseSnapshot,
    templateAdjustment: 'normal',
    currentHp: hazard.hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: cloneValue(hazard.attacks),
    passiveAbilities: cloneValue(hazard.passiveAbilities),
    reactiveAbilities: cloneValue(hazard.reactiveAbilities),
    activeAbilities: cloneValue(hazard.activeAbilities),
    spellcasting: undefined,
    traits: cloneValue(hazard.traits),
    hazardData: buildHazardData(hazard)
  };
}

function buildHazardData(hazard: Hazard): HazardData {
  const data: HazardData = { stealth: hazard.stealth };
  if (hazard.stealthNote !== undefined) data.stealthNote = hazard.stealthNote;
  if (hazard.hardness !== undefined) data.hardness = hazard.hardness;
  if (hazard.routine !== undefined) data.routine = hazard.routine;
  if (hazard.disable !== undefined) data.disable = hazard.disable;
  if (hazard.reset !== undefined) data.reset = hazard.reset;
  if (hazard.description !== undefined) data.description = hazard.description;
  return data;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
