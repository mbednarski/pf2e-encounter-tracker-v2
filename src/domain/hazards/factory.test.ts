import { describe, expect, test } from 'vitest';
import { expectSerializable } from '../test-support';
import type { Hazard } from '../types';
import { createCombatantFromHazard } from './factory';

describe('createCombatantFromHazard', () => {
  test('creates a hazard combatant from a hazard template', () => {
    const hazard = hazardTemplate();

    const combatant = createCombatantFromHazard({
      hazard,
      combatantId: 'dart-gallery-1',
      name: 'Poisoned Dart Gallery 1'
    });

    expect(combatant).toMatchObject({
      id: 'dart-gallery-1',
      sourceId: 'poisoned-dart-gallery',
      name: 'Poisoned Dart Gallery 1',
      sourceType: 'hazard',
      baseSnapshot: {
        level: 8,
        ac: 27,
        fortitude: 13,
        reflex: 17,
        will: 8,
        hp: 100,
        speed: 0,
        skills: {}
      },
      templateAdjustment: 'normal',
      currentHp: 100,
      tempHp: 0,
      appliedEffects: [],
      isAlive: true,
      traits: ['mechanical', 'trap']
    });
    expect(combatant.spellcasting).toBeUndefined();
    expectSerializable(combatant);
  });

  test('stores the stealth value in the snapshot perception slot for initiative', () => {
    const combatant = createCombatantFromHazard({
      hazard: hazardTemplate(),
      combatantId: 'dart-gallery-1'
    });

    expect(combatant.baseSnapshot.perception).toBe(28);
    expect(combatant.hazardData?.stealth).toBe(28);
  });

  test('populates hazardData with the free-form text blocks', () => {
    const combatant = createCombatantFromHazard({
      hazard: hazardTemplate(),
      combatantId: 'dart-gallery-1'
    });

    expect(combatant.hazardData).toEqual({
      stealth: 28,
      stealthNote: 'expert',
      hardness: 10,
      routine: 'The trap fires a volley of poisoned darts.',
      disable: 'Thievery DC 26 to disarm a launcher.',
      reset: 'The trap resets after one hour.',
      description: 'A gallery lined with hidden dart launchers.'
    });
  });

  test('omits absent optional hazardData fields', () => {
    const combatant = createCombatantFromHazard({
      hazard: hazardTemplate({
        stealthNote: undefined,
        hardness: undefined,
        routine: undefined,
        disable: undefined,
        reset: undefined,
        description: undefined
      }),
      combatantId: 'dart-gallery-1'
    });

    expect(combatant.hazardData).toEqual({ stealth: 28 });
  });

  test('defaults the combatant name to the hazard name', () => {
    const combatant = createCombatantFromHazard({
      hazard: hazardTemplate(),
      combatantId: 'dart-gallery-1'
    });

    expect(combatant.name).toBe('Poisoned Dart Gallery');
  });

  test('deep-clones hazard attacks and abilities', () => {
    const hazard = hazardTemplate();

    const combatant = createCombatantFromHazard({
      hazard,
      combatantId: 'dart-gallery-1'
    });

    combatant.traits?.push('elite');
    combatant.attacks[0].traits.push('range-60');
    combatant.reactiveAbilities[0].description = 'Changed on combatant only';

    expect(hazard.traits).toEqual(['mechanical', 'trap']);
    expect(hazard.attacks[0].traits).toEqual([]);
    expect(hazard.reactiveAbilities[0].description).toBe('Strike the triggering creature.');
  });
});

function hazardTemplate(overrides: Partial<Hazard> = {}): Hazard {
  return {
    id: 'poisoned-dart-gallery',
    name: 'Poisoned Dart Gallery',
    level: 8,
    traits: ['mechanical', 'trap'],
    rarity: 'common',
    stealth: 28,
    stealthNote: 'expert',
    ac: 27,
    fortitude: 13,
    reflex: 17,
    will: 8,
    hp: 100,
    hardness: 10,
    immunities: [],
    resistances: [],
    weaknesses: [],
    routine: 'The trap fires a volley of poisoned darts.',
    disable: 'Thievery DC 26 to disarm a launcher.',
    reset: 'The trap resets after one hour.',
    description: 'A gallery lined with hidden dart launchers.',
    attacks: [
      {
        name: 'poisoned dart',
        type: 'ranged',
        modifier: 21,
        traits: [],
        damage: [{ dice: 3, dieSize: 4, bonus: 2, type: 'piercing' }]
      }
    ],
    passiveAbilities: [],
    reactiveAbilities: [
      {
        name: 'Dart Volley',
        actions: 'reaction',
        trigger: 'A creature enters the gallery.',
        description: 'Strike the triggering creature.'
      }
    ],
    activeAbilities: [],
    source: 'Test Source',
    tags: [],
    ...overrides
  };
}
