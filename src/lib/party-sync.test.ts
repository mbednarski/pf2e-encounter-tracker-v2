import { describe, expect, test } from 'vitest';
import type { AppliedEffect, CombatantState, PartyMember } from '../domain';
import { effectLibrary } from '../domain/effects/library';
import { combatant } from '../domain/test-support';
import { syncPartyMembersAfterEncounter } from './party-sync';

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
