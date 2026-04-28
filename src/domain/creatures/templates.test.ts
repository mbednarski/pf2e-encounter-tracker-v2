import { describe, expect, test } from 'vitest';
import { expectSerializable } from '../test-support';
import type { Creature } from '../types';
import { applyEliteWeak } from './templates';

describe('applyEliteWeak', () => {
  test('applies elite numeric, strike, and spellcasting adjustments without mutating the source creature', () => {
    const creature = creatureTemplate();

    const adjusted = applyEliteWeak(creature, 'elite');

    expect(adjusted).toMatchObject({
      id: 'test-creature',
      level: 6,
      hp: 62,
      ac: 22,
      fortitude: 16,
      reflex: 14,
      will: 12,
      perception: 15,
      skills: { athletics: 17, stealth: 13 }
    });
    expect(adjusted.attacks).toEqual([
      expect.objectContaining({
        name: 'claw',
        modifier: 17,
        damage: [
          { dice: 2, dieSize: 8, bonus: 7, type: 'slashing' },
          { dice: 1, dieSize: 6, type: 'fire' }
        ]
      }),
      expect.objectContaining({
        name: 'spike',
        modifier: 15,
        damage: [{ dice: 1, dieSize: 10, bonus: 2, type: 'piercing' }]
      })
    ]);
    expect(adjusted.spellcasting).toEqual([
      expect.objectContaining({ dc: 22, attackModifier: 14 }),
      expect.objectContaining({ dc: 21, attackModifier: undefined })
    ]);
    expect(creature).toEqual(creatureTemplate());
    expectSerializable(adjusted);
  });

  test('applies weak numeric, strike, and spellcasting adjustments with an HP floor', () => {
    const adjusted = applyEliteWeak(creatureTemplate({ level: 2, hp: 6 }), 'weak');

    expect(adjusted).toMatchObject({
      level: 1,
      hp: 1,
      ac: 18,
      fortitude: 12,
      reflex: 10,
      will: 8,
      perception: 11,
      skills: { athletics: 13, stealth: 9 }
    });
    expect(adjusted.attacks[0]).toMatchObject({
      modifier: 13,
      damage: [
        { dice: 2, dieSize: 8, bonus: 3, type: 'slashing' },
        { dice: 1, dieSize: 6, type: 'fire' }
      ]
    });
    expect(adjusted.attacks[1]).toMatchObject({
      modifier: 11,
      damage: [{ dice: 1, dieSize: 10, bonus: -2, type: 'piercing' }]
    });
    expect(adjusted.spellcasting?.[0]).toMatchObject({ dc: 18, attackModifier: 10 });
  });

  test('uses Monster Core HP bands from the starting level', () => {
    expect(applyEliteWeak(creatureTemplate({ level: -1, hp: 8 }), 'elite').hp).toBe(18);
    expect(applyEliteWeak(creatureTemplate({ level: 1, hp: 18 }), 'elite').hp).toBe(28);
    expect(applyEliteWeak(creatureTemplate({ level: 2, hp: 30 }), 'elite').hp).toBe(45);
    expect(applyEliteWeak(creatureTemplate({ level: 5, hp: 70 }), 'elite').hp).toBe(90);
    expect(applyEliteWeak(creatureTemplate({ level: 20, hp: 360 }), 'elite').hp).toBe(390);

    expect(applyEliteWeak(creatureTemplate({ level: 0, hp: 12 }), 'weak').hp).toBe(2);
    expect(applyEliteWeak(creatureTemplate({ level: 2, hp: 30 }), 'weak').hp).toBe(20);
    expect(applyEliteWeak(creatureTemplate({ level: 3, hp: 45 }), 'weak').hp).toBe(30);
    expect(applyEliteWeak(creatureTemplate({ level: 6, hp: 90 }), 'weak').hp).toBe(70);
    expect(applyEliteWeak(creatureTemplate({ level: 21, hp: 400 }), 'weak').hp).toBe(370);
  });

  test('handles level edge cases', () => {
    expect(applyEliteWeak(creatureTemplate({ level: -1 }), 'elite').level).toBe(1);
    expect(applyEliteWeak(creatureTemplate({ level: 0 }), 'elite').level).toBe(2);
    expect(applyEliteWeak(creatureTemplate({ level: 1 }), 'elite').level).toBe(2);

    expect(applyEliteWeak(creatureTemplate({ level: 1 }), 'weak').level).toBe(-1);
    expect(applyEliteWeak(creatureTemplate({ level: 2 }), 'weak').level).toBe(1);
  });
});

function creatureTemplate(overrides: Partial<Creature> = {}): Creature {
  return {
    id: 'test-creature',
    name: 'Test Creature',
    level: 5,
    traits: ['beast'],
    size: 'medium',
    rarity: 'common',
    ac: 20,
    fortitude: 14,
    reflex: 12,
    will: 10,
    perception: 13,
    hp: 42,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 30 },
    attacks: [
      {
        name: 'claw',
        type: 'melee',
        modifier: 15,
        traits: ['agile'],
        damage: [
          { dice: 2, dieSize: 8, bonus: 5, type: 'slashing' },
          { dice: 1, dieSize: 6, type: 'fire' }
        ]
      },
      {
        name: 'spike',
        type: 'ranged',
        modifier: 13,
        traits: ['range-30'],
        damage: [{ dice: 1, dieSize: 10, type: 'piercing' }]
      }
    ],
    spellcasting: [
      {
        blockId: 'arcane',
        name: 'Arcane Innate Spells',
        tradition: 'arcane',
        type: 'innate',
        dc: 20,
        attackModifier: 12,
        entries: [{ spellSlug: 'ignition', name: 'Ignition', level: 1, frequency: { type: 'atWill' } }]
      },
      {
        blockId: 'primal',
        name: 'Primal Prepared Spells',
        tradition: 'primal',
        type: 'prepared',
        dc: 19,
        slots: { 1: 2 },
        entries: [{ spellSlug: 'heal', name: 'Heal', level: 1 }]
      }
    ],
    passiveAbilities: [{ name: 'Aura', description: 'DC 20 text remains unmodified.' }],
    reactiveAbilities: [],
    activeAbilities: [{ name: 'Limited Blast', frequency: 'once per day', actions: 2, description: '4d6 fire, basic Reflex DC 20.' }],
    skills: { athletics: 15, stealth: 11 },
    tags: [],
    ...overrides
  };
}
