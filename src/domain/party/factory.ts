import type { AppliedEffect, CombatantState, CreatureSnapshot, PartyMember } from '../types';

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
    baseStats: {
      hp: partyMember.hp,
      ac: partyMember.ac,
      fortitude: partyMember.fortitude,
      reflex: partyMember.reflex,
      will: partyMember.will,
      perception: partyMember.perception,
      speed: primarySpeed(partyMember.speed),
      skills: structuredClone(partyMember.skills ?? {})
    },
    baseSnapshot,
    currentHp: partyMember.hp,
    tempHp: 0,
    appliedEffects: expandPersistentEffects(partyMember.persistentEffects, combatantId),
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    level: partyMember.level
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
