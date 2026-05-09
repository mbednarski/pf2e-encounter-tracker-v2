import { describe, expect, test } from 'vitest';
import type { PartyMember } from '../types';
import { expectSerializable } from '../test-support';
import { createCombatantFromPartyMember } from './factory';

function partyMember(overrides: Partial<PartyMember> = {}): PartyMember {
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

describe('createCombatantFromPartyMember', () => {
  test('produces a combatant with sourceType "partyMember" and the source id wired through', () => {
    const member = partyMember();
    const combatant = createCombatantFromPartyMember({
      partyMember: member,
      combatantId: 'lyra-1'
    });

    expect(combatant).toMatchObject({
      id: 'lyra-1',
      sourceId: 'lyra',
      name: 'Lyra Sunwhisper',
      sourceType: 'partyMember',
      level: 5,
      isAlive: true,
      currentHp: 56,
      tempHp: 0,
      reactionUsedThisRound: false
    });
  });

  test('builds defensive baseStats from the party member fields', () => {
    const member = partyMember({
      ac: 21,
      fortitude: 12,
      reflex: 14,
      will: 16,
      perception: 13,
      hp: 72,
      skills: { arcana: 14, occultism: 14 }
    });

    const combatant = createCombatantFromPartyMember({ partyMember: member, combatantId: 'lyra-1' });

    expect(combatant.baseStats).toEqual({
      hp: 72,
      ac: 21,
      fortitude: 12,
      reflex: 14,
      will: 16,
      perception: 13,
      speed: 0,
      skills: { arcana: 14, occultism: 14 }
    });
  });

  test('leaves attacks, abilities, and spellcasting empty (PCs are run by players)', () => {
    const combatant = createCombatantFromPartyMember({
      partyMember: partyMember(),
      combatantId: 'lyra-1'
    });

    expect(combatant.attacks).toEqual([]);
    expect(combatant.passiveAbilities).toEqual([]);
    expect(combatant.reactiveAbilities).toEqual([]);
    expect(combatant.activeAbilities).toEqual([]);
    expect(combatant.spellcasting).toBeUndefined();
    expect(combatant.traits).toBeUndefined();
    expect(combatant.size).toBeUndefined();
    expect(combatant.templateAdjustment).toBeUndefined();
  });

  test('uses the optional name override', () => {
    const combatant = createCombatantFromPartyMember({
      partyMember: partyMember(),
      combatantId: 'lyra-1',
      name: 'Lyra (haunted)'
    });
    expect(combatant.name).toBe('Lyra (haunted)');
  });

  test('uses speed.land when present', () => {
    const combatant = createCombatantFromPartyMember({
      partyMember: partyMember({ speed: { land: 30, swim: 15 } }),
      combatantId: 'lyra-1'
    });
    expect(combatant.baseStats.speed).toBe(30);
  });

  test('falls back to the first speed entry when land is missing', () => {
    const combatant = createCombatantFromPartyMember({
      partyMember: partyMember({ speed: { fly: 40 } }),
      combatantId: 'lyra-1'
    });
    expect(combatant.baseStats.speed).toBe(40);
  });

  test('defaults speed to 0 when undefined', () => {
    const combatant = createCombatantFromPartyMember({
      partyMember: partyMember(),
      combatantId: 'lyra-1'
    });
    expect(combatant.baseStats.speed).toBe(0);
  });

  test('expands persistentEffects into appliedEffects with sourceId set to the combatant id and duration unlimited', () => {
    const member = partyMember({
      persistentEffects: [
        {
          instanceId: 'wounded-instance',
          effectId: 'wounded',
          value: 1,
          duration: { type: 'rounds', count: 3 }
        }
      ]
    });

    const combatant = createCombatantFromPartyMember({ partyMember: member, combatantId: 'lyra-1' });

    expect(combatant.appliedEffects).toEqual([
      {
        instanceId: 'wounded-instance',
        effectId: 'wounded',
        value: 1,
        sourceId: 'lyra-1',
        duration: { type: 'unlimited' }
      }
    ]);
  });

  test('preserves parentInstanceId on persistent implied effects', () => {
    const member = partyMember({
      persistentEffects: [
        { instanceId: 'dying-1', effectId: 'dying', value: 2, duration: { type: 'unlimited' } },
        {
          instanceId: 'unconscious-1',
          effectId: 'unconscious',
          parentInstanceId: 'dying-1',
          duration: { type: 'unlimited' }
        }
      ]
    });

    const combatant = createCombatantFromPartyMember({ partyMember: member, combatantId: 'lyra-1' });

    expect(combatant.appliedEffects[1]).toMatchObject({
      instanceId: 'unconscious-1',
      parentInstanceId: 'dying-1'
    });
  });

  test('deep-clones skills so mutating combatant baseStats does not affect the source', () => {
    const member = partyMember({ skills: { arcana: 14 } });
    const combatant = createCombatantFromPartyMember({ partyMember: member, combatantId: 'lyra-1' });
    combatant.baseStats.skills.arcana = 99;
    expect(member.skills?.arcana).toBe(14);
  });

  test('deep-clones persistentEffects so the combatant does not alias the source', () => {
    const member = partyMember({
      persistentEffects: [
        { instanceId: 'w-1', effectId: 'wounded', value: 1, duration: { type: 'unlimited' } }
      ]
    });
    const combatant = createCombatantFromPartyMember({ partyMember: member, combatantId: 'lyra-1' });
    combatant.appliedEffects[0].value = 99;
    expect(member.persistentEffects[0].value).toBe(1);
  });

  test('the produced combatant is JSON-serializable', () => {
    const combatant = createCombatantFromPartyMember({
      partyMember: partyMember({
        persistentEffects: [
          { instanceId: 'd-1', effectId: 'doomed', value: 1, duration: { type: 'unlimited' } }
        ]
      }),
      combatantId: 'lyra-1'
    });
    expectSerializable(combatant);
  });
});
