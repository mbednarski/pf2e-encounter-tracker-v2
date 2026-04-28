import { describe, expect, test } from 'vitest';
import { expectSerializable } from '../test-support';
import type { Creature } from '../types';
import { createCombatantFromCreature } from './clone';

describe('createCombatantFromCreature', () => {
  test('creates mutable encounter state from a creature template', () => {
    const creature = creatureTemplate();

    const combatant = createCombatantFromCreature({
      creature,
      combatantId: 'goblin-1',
      name: 'Goblin Warrior 1'
    });

    expect(combatant).toMatchObject({
      id: 'goblin-1',
      creatureId: 'goblin-warrior',
      name: 'Goblin Warrior 1',
      sourceType: 'creature',
      baseStats: {
        hp: 18,
        ac: 16,
        fortitude: 6,
        reflex: 8,
        will: 5,
        perception: 7,
        speed: 25,
        skills: { acrobatics: 8, stealth: 10 }
      },
      currentHp: 18,
      tempHp: 0,
      appliedEffects: [],
      reactionUsedThisRound: false,
      isAlive: true,
      traits: ['goblin', 'humanoid'],
      size: 'small',
      level: 1
    });
    expect(combatant.attacks).toHaveLength(1);
    expect(combatant.passiveAbilities).toHaveLength(1);
    expect(combatant.reactiveAbilities).toHaveLength(1);
    expect(combatant.activeAbilities).toHaveLength(1);
    expectSerializable(combatant);
  });

  test('defaults the combatant name to the creature name', () => {
    const combatant = createCombatantFromCreature({
      creature: creatureTemplate(),
      combatantId: 'goblin-1'
    });

    expect(combatant.name).toBe('Goblin Warrior');
  });

  test('deep-clones creature display data and skills', () => {
    const creature = creatureTemplate();

    const combatant = createCombatantFromCreature({
      creature,
      combatantId: 'goblin-1'
    });

    combatant.baseStats.skills.stealth = 99;
    combatant.traits?.push('elite');
    combatant.attacks[0].traits.push('backswing');
    combatant.attacks[0].damage[0].bonus = 99;
    combatant.passiveAbilities[0].description = 'Changed on combatant only';

    expect(creature.skills.stealth).toBe(10);
    expect(creature.traits).toEqual(['goblin', 'humanoid']);
    expect(creature.attacks[0].traits).toEqual(['agile', 'finesse']);
    expect(creature.attacks[0].damage[0].bonus).toBe(2);
    expect(creature.passiveAbilities[0].description).toBe('Goblins are hard to pin down.');
  });

  test('hydrates spellcasting usage fields without mutating spellcasting templates', () => {
    const creature = creatureTemplate({
      spellcasting: [
        {
          blockId: 'arcane-prepared',
          name: 'Arcane Prepared Spells',
          tradition: 'arcane',
          type: 'prepared',
          dc: 18,
          attackModifier: 10,
          slots: { 1: 3 },
          entries: [{ spellSlug: 'force-barrage', name: 'Force Barrage', level: 1, count: 2 }]
        },
        {
          blockId: 'focus',
          name: 'Focus Spells',
          tradition: 'occult',
          type: 'focus',
          dc: 17,
          focusPoints: 1,
          entries: [{ spellSlug: 'phase-bolt', name: 'Phase Bolt', level: 1 }]
        },
        {
          blockId: 'innate',
          name: 'Primal Innate Spells',
          tradition: 'primal',
          type: 'innate',
          dc: 16,
          entries: [
            { spellSlug: 'detect-magic', name: 'Detect Magic', level: 1, frequency: { type: 'atWill' } },
            { spellSlug: 'fear', name: 'Fear', level: 1, frequency: { type: 'perDay', uses: 1 } }
          ]
        }
      ]
    });

    const combatant = createCombatantFromCreature({
      creature,
      combatantId: 'caster-1'
    });

    expect(combatant.spellcasting).toEqual([
      expect.objectContaining({ blockId: 'arcane-prepared', usedSlots: {}, usedFocusPoints: undefined, usedEntries: undefined }),
      expect.objectContaining({ blockId: 'focus', usedSlots: undefined, usedFocusPoints: 0, usedEntries: undefined }),
      expect.objectContaining({ blockId: 'innate', usedSlots: undefined, usedFocusPoints: undefined, usedEntries: {} })
    ]);

    expect(combatant.spellcasting).toBeDefined();
    combatant.spellcasting![0].entries[0].name = 'Changed';
    expect(creature.spellcasting?.[0].entries[0].name).toBe('Force Barrage');
  });

  test('creates an elite combatant from adjusted creature data without mutating the creature template', () => {
    const creature = creatureTemplate({
      spellcasting: [
        {
          blockId: 'arcane-prepared',
          name: 'Arcane Prepared Spells',
          tradition: 'arcane',
          type: 'prepared',
          dc: 18,
          attackModifier: 10,
          slots: { 1: 3 },
          entries: [{ spellSlug: 'force-barrage', name: 'Force Barrage', level: 1, count: 2 }]
        }
      ]
    });

    const combatant = createCombatantFromCreature({
      creature,
      combatantId: 'elite-goblin-1',
      adjustment: 'elite'
    });

    expect(combatant).toMatchObject({
      id: 'elite-goblin-1',
      creatureId: 'goblin-warrior',
      name: 'Goblin Warrior',
      baseStats: {
        hp: 28,
        ac: 18,
        fortitude: 8,
        reflex: 10,
        will: 7,
        perception: 9,
        speed: 25,
        skills: { acrobatics: 10, stealth: 12 }
      },
      currentHp: 28,
      level: 2,
      templateAdjustment: 'elite'
    });
    expect(combatant.attacks[0]).toMatchObject({
      modifier: 10,
      damage: [{ dice: 1, dieSize: 6, bonus: 4, type: 'slashing' }]
    });
    expect(combatant.spellcasting?.[0]).toMatchObject({ dc: 20, attackModifier: 12, usedSlots: {} });
    expect(creature.hp).toBe(18);
    expect(creature.attacks[0].damage[0].bonus).toBe(2);
    expect(creature.spellcasting?.[0].dc).toBe(18);
    expectSerializable(combatant);
  });

  test('creates a weak combatant with adjusted current HP, display data, and template marker', () => {
    const combatant = createCombatantFromCreature({
      creature: creatureTemplate({ level: 3, hp: 30 }),
      combatantId: 'weak-goblin-1',
      adjustment: 'weak'
    });

    expect(combatant).toMatchObject({
      baseStats: {
        hp: 15,
        ac: 14,
        fortitude: 4,
        reflex: 6,
        will: 3,
        perception: 5,
        speed: 25,
        skills: { acrobatics: 6, stealth: 8 }
      },
      currentHp: 15,
      level: 2,
      templateAdjustment: 'weak'
    });
    expect(combatant.attacks[0]).toMatchObject({
      modifier: 6,
      damage: [{ dice: 1, dieSize: 6, bonus: 0, type: 'slashing' }]
    });
  });

  test('falls back to the first available speed when land speed is absent', () => {
    const combatant = createCombatantFromCreature({
      creature: creatureTemplate({ speed: { fly: 40, swim: 20 } }),
      combatantId: 'sprite-1'
    });

    expect(combatant.baseStats.speed).toBe(40);
  });
});

function creatureTemplate(overrides: Partial<Creature> = {}): Creature {
  return {
    id: 'goblin-warrior',
    name: 'Goblin Warrior',
    level: 1,
    traits: ['goblin', 'humanoid'],
    size: 'small',
    rarity: 'common',
    ac: 16,
    fortitude: 6,
    reflex: 8,
    will: 5,
    perception: 7,
    hp: 18,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 25 },
    attacks: [
      {
        name: 'dogslicer',
        type: 'melee',
        modifier: 8,
        traits: ['agile', 'finesse'],
        damage: [{ dice: 1, dieSize: 6, bonus: 2, type: 'slashing' }]
      }
    ],
    passiveAbilities: [
      {
        name: 'Goblin Scuttle',
        description: 'Goblins are hard to pin down.'
      }
    ],
    reactiveAbilities: [
      {
        name: 'Reactive Strike',
        actions: 'reaction',
        trigger: 'A creature within reach uses a manipulate action.',
        description: 'Strike the triggering creature.'
      }
    ],
    activeAbilities: [
      {
        name: 'Slash',
        actions: 1,
        description: 'Make a dogslicer Strike.'
      }
    ],
    skills: { acrobatics: 8, stealth: 10 },
    tags: [],
    ...overrides
  };
}
