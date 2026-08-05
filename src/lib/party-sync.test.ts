import { describe, expect, test } from 'vitest';
import type { AppliedEffect, CombatantState, Companion, PartyMember } from '../domain';
import { effectLibrary } from '../domain/effects/library';
import { combatant } from '../domain/test-support';
import { syncCompanionsAfterEncounter, syncPartyMembersAfterEncounter } from './party-sync';

function member(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    id: 'lyra',
    name: 'Lyra Sunwhisper',
    level: 5,
    ac: 19,
    fortitude: 9,
    reflex: 11,
    will: 13,
    perception: 11,
    hp: 56,
    persistentEffects: [],
    companionIds: [],
    tags: [],
    ...overrides
  };
}

function pcCombatant(id: string, sourceId: string, effects: AppliedEffect[]): CombatantState {
  return combatant(id, { sourceType: 'partyMember', sourceId, appliedEffects: effects });
}

const wounded: AppliedEffect = {
  instanceId: 'w',
  effectId: 'wounded',
  value: 1,
  duration: { type: 'unlimited' }
};

describe('syncPartyMembersAfterEncounter', () => {
  test('writes surviving effects back to the matching stored member', () => {
    const updated = syncPartyMembersAfterEncounter(
      { 'pc-1': pcCombatant('pc-1', 'lyra', [wounded]) },
      [member(), member({ id: 'brog', name: 'Brog' })],
      effectLibrary
    );

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('lyra');
    expect(updated[0].persistentEffects.map((e) => e.effectId)).toEqual(['wounded']);
  });

  test('clears stale persisted effects when nothing survives the encounter', () => {
    const updated = syncPartyMembersAfterEncounter(
      { 'pc-1': pcCombatant('pc-1', 'lyra', []) },
      [member({ persistentEffects: [wounded] })],
      effectLibrary
    );

    expect(updated).toHaveLength(1);
    expect(updated[0].persistentEffects).toEqual([]);
  });

  test('ignores creature combatants and unknown source ids', () => {
    const updated = syncPartyMembersAfterEncounter(
      {
        'goblin-1': combatant('goblin-1', { appliedEffects: [wounded] }),
        'pc-9': pcCombatant('pc-9', 'deleted-member', [wounded])
      },
      [member()],
      effectLibrary
    );

    expect(updated).toEqual([]);
  });

  test('does not mutate the stored member records', () => {
    const stored = member();
    syncPartyMembersAfterEncounter(
      { 'pc-1': pcCombatant('pc-1', 'lyra', [wounded]) },
      [stored],
      effectLibrary
    );
    expect(stored.persistentEffects).toEqual([]);
  });
});

function companionRecord(overrides: Partial<Companion> = {}): Companion {
  return {
    id: 'fang',
    name: 'Fang',
    type: 'animal-companion',
    masterId: 'lyra',
    level: 5,
    ac: 21,
    fortitude: 11,
    reflex: 12,
    will: 9,
    perception: 10,
    hp: 60,
    speed: { land: 35 },
    attacks: [],
    persistentEffects: [],
    tags: [],
    ...overrides
  };
}

describe('syncCompanionsAfterEncounter', () => {
  test('writes surviving effects back to the matching companion record', () => {
    const updated = syncCompanionsAfterEncounter(
      {
        'fang-1': combatant('fang-1', {
          sourceType: 'companion',
          sourceId: 'fang',
          appliedEffects: [wounded]
        })
      },
      [companionRecord()],
      effectLibrary
    );

    expect(updated).toHaveLength(1);
    expect(updated[0].persistentEffects.map((e) => e.effectId)).toEqual(['wounded']);
  });

  test('ignores party-member combatants and unknown companion ids', () => {
    const updated = syncCompanionsAfterEncounter(
      {
        'pc-1': combatant('pc-1', { sourceType: 'partyMember', sourceId: 'lyra', appliedEffects: [wounded] }),
        'ghost-1': combatant('ghost-1', { sourceType: 'companion', sourceId: 'deleted', appliedEffects: [wounded] })
      },
      [companionRecord()],
      effectLibrary
    );

    expect(updated).toEqual([]);
  });
});
