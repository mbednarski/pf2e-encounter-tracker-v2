import type { AppliedEffect, CombatantState, Companion, CreatureSnapshot, PartyMember } from '../types';

export interface CreateCombatantFromPartyMemberInput {
  partyMember: PartyMember;
  combatantId: string;
  name?: string;
}

export function createCombatantFromPartyMember({
  partyMember,
  combatantId,
  name
}: CreateCombatantFromPartyMemberInput): CombatantState {
  const baseSnapshot: CreatureSnapshot = {
    level: partyMember.level,
    ac: partyMember.ac,
    fortitude: partyMember.fortitude,
    reflex: partyMember.reflex,
    will: partyMember.will,
    perception: partyMember.perception,
    hp: partyMember.hp,
    speed: primarySpeed(partyMember.speed),
    skills: structuredClone(partyMember.skills ?? {})
  };
  return {
    id: combatantId,
    sourceId: partyMember.id,
    name: name ?? partyMember.name,
    sourceType: 'partyMember',
    baseSnapshot,
    templateAdjustment: 'normal',
    currentHp: partyMember.hp,
    tempHp: 0,
    appliedEffects: expandPersistentEffects(partyMember.persistentEffects, combatantId),
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: []
  };
}

export interface CreateCombatantFromCompanionInput {
  companion: Companion;
  combatantId: string;
  /**
   * Combatant id of the master in this encounter. Setting it makes the
   * companion a minion (excluded from initiative, processed at the master's
   * turn boundaries). Omit for the spec §9.2 edge case — a companion fighting
   * without its master present acts independently and rolls its own initiative.
   */
  masterCombatantId?: string;
  name?: string;
}

export function createCombatantFromCompanion({
  companion,
  combatantId,
  masterCombatantId,
  name
}: CreateCombatantFromCompanionInput): CombatantState {
  const baseSnapshot: CreatureSnapshot = {
    level: companion.level,
    ac: companion.ac,
    fortitude: companion.fortitude,
    reflex: companion.reflex,
    will: companion.will,
    perception: companion.perception,
    hp: companion.hp,
    speed: primarySpeed(companion.speed),
    skills: structuredClone(companion.skills ?? {})
  };
  return {
    id: combatantId,
    sourceId: companion.id,
    name: name ?? companion.name,
    sourceType: 'companion',
    baseSnapshot,
    templateAdjustment: 'normal',
    currentHp: companion.hp,
    tempHp: 0,
    appliedEffects: expandPersistentEffects(companion.persistentEffects, combatantId),
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: structuredClone(companion.attacks),
    passiveAbilities: structuredClone(companion.passiveAbilities ?? []),
    reactiveAbilities: structuredClone(companion.reactiveAbilities ?? []),
    activeAbilities: structuredClone(companion.activeAbilities ?? []),
    ...(masterCombatantId !== undefined ? { masterId: masterCombatantId } : {})
  };
}

function primarySpeed(speed: Record<string, number> | undefined): number {
  if (!speed) return 0;
  return speed.land ?? Object.values(speed)[0] ?? 0;
}

function expandPersistentEffects(effects: AppliedEffect[], combatantId: string): AppliedEffect[] {
  return structuredClone(effects).map((effect) => ({
    ...effect,
    sourceId: combatantId,
    duration: { type: 'unlimited' as const }
  }));
}
