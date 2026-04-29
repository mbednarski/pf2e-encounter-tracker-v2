import { describe, expect, test } from 'vitest';
import { deriveStats } from './derivation';
import { effectLibrary } from './library';
import type { AppliedEffect, CreatureBaseStats, EffectLibrary } from '../types';

const baseStats: CreatureBaseStats = {
  hp: 20,
  ac: 18,
  fortitude: 9,
  reflex: 8,
  will: 7,
  perception: 6,
  speed: 25,
  skills: {
    acrobatics: 8,
    arcana: 5,
    athletics: 10,
    crafting: 4,
    deception: 3,
    diplomacy: 2,
    intimidation: 6,
    medicine: 7,
    nature: 5,
    occultism: 9,
    performance: 1,
    religion: 6,
    society: 4,
    stealth: 11,
    survival: 8,
    thievery: 7,
    warfareLore: 12
  }
};

const defaultDuration = { type: 'unlimited' } as const;

function applied(effectId: string, value?: number, instanceId = `${effectId}-${value ?? 'base'}`): AppliedEffect {
  return { instanceId, effectId, value, duration: defaultDuration };
}

const customLibrary: EffectLibrary = {
  lowerStatusBoost: {
    id: 'lowerStatusBoost',
    name: 'Lower Status Boost',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'status', value: 1 }]
  },
  higherStatusBoost: {
    id: 'higherStatusBoost',
    name: 'Higher Status Boost',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'status', value: 3 }]
  },
  untypedPenaltyA: {
    id: 'untypedPenaltyA',
    name: 'Untyped Penalty A',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'untyped', value: -1 }]
  },
  untypedPenaltyB: {
    id: 'untypedPenaltyB',
    name: 'Untyped Penalty B',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'untyped', value: -2 }]
  },
  lowerUntypedBoost: {
    id: 'lowerUntypedBoost',
    name: 'Lower Untyped Boost',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'untyped', value: 1 }]
  },
  higherUntypedBoost: {
    id: 'higherUntypedBoost',
    name: 'Higher Untyped Boost',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'untyped', value: 2 }]
  },
  allMetaPenalty: {
    id: 'allMetaPenalty',
    name: 'All Meta Penalty',
    category: 'custom',
    hasValue: false,
    modifiers: [
      { stat: 'allSaves', bonusType: 'circumstance', value: -1 },
      { stat: 'allSkills', bonusType: 'circumstance', value: -1 }
    ]
  },
  abilityMetaPenalty: {
    id: 'abilityMetaPenalty',
    name: 'Ability Meta Penalty',
    category: 'custom',
    hasValue: false,
    modifiers: [
      { stat: 'strSkills', bonusType: 'status', value: -1 },
      { stat: 'dexSkills', bonusType: 'status', value: -2 },
      { stat: 'intSkills', bonusType: 'item', value: -3 },
      { stat: 'wisSkills', bonusType: 'untyped', value: -4 },
      { stat: 'chaSkills', bonusType: 'circumstance', value: -5 }
    ]
  },
  mentalPenalty: {
    id: 'mentalPenalty',
    name: 'Mental Penalty',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'mentalSkills', bonusType: 'status', value: -1 }]
  },
  valuePenalty: {
    id: 'valuePenalty',
    name: 'Value Penalty',
    category: 'custom',
    hasValue: true,
    modifiers: [
      { stat: 'attackRolls', bonusType: 'status', value: { kind: 'effectValue', sign: 1 } },
      { stat: 'allDCs', bonusType: 'status', value: { kind: 'effectValue', sign: -1 } }
    ]
  },
  stealthStatusPenalty: {
    id: 'stealthStatusPenalty',
    name: 'Stealth Status Penalty',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'stealth', bonusType: 'status', value: -1 }]
  },
  savePenalty: {
    id: 'savePenalty',
    name: 'Save Penalty',
    category: 'custom',
    hasValue: false,
    modifiers: [{ stat: 'allSaves', bonusType: 'circumstance', value: -2 }]
  }
};

describe('deriveStats', () => {
  test('returns base values unchanged when no effects apply and ignores unknown effects', () => {
    const computed = deriveStats(baseStats, [applied('missing-effect')], effectLibrary);

    expect(computed.ac).toEqual({ base: 18, final: 18, modifiers: [] });
    expect(computed.fortitude).toEqual({ base: 9, final: 9, modifiers: [] });
    expect(computed.reflex).toEqual({ base: 8, final: 8, modifiers: [] });
    expect(computed.will).toEqual({ base: 7, final: 7, modifiers: [] });
    expect(computed.perception).toEqual({ base: 6, final: 6, modifiers: [] });
    expect(computed.skills.stealth).toEqual({ base: 11, final: 11, modifiers: [] });
    expect(computed.attackRolls).toEqual({ total: 0, modifiers: [] });
    expect(computed.allDCs).toEqual({ total: 0, modifiers: [] });
  });

  test('keeps only the worse same-type status penalty from Frightened and Sickened', () => {
    const computed = deriveStats(baseStats, [applied('frightened', 1), applied('sickened', 2)], effectLibrary);

    expect(computed.ac.final).toBe(16);
    expect(computed.ac.modifiers).toEqual([
      expect.objectContaining({ effectId: 'frightened', value: -1, suppressed: true }),
      expect.objectContaining({ effectId: 'sickened', value: -2, suppressed: false })
    ]);
  });

  test('stacks Frightened status penalty and Off-Guard circumstance penalty on AC', () => {
    const computed = deriveStats(baseStats, [applied('frightened', 1), applied('off-guard')], effectLibrary);

    expect(computed.ac.final).toBe(15);
    expect(computed.ac.modifiers).toEqual([
      expect.objectContaining({ effectId: 'frightened', bonusType: 'status', value: -1, suppressed: false }),
      expect.objectContaining({ effectId: 'off-guard', bonusType: 'circumstance', value: -2, suppressed: false })
    ]);
  });

  test('suppresses the lower duplicate Frightened value', () => {
    const computed = deriveStats(baseStats, [applied('frightened', 1, 'frightened-low'), applied('frightened', 3, 'frightened-high')], effectLibrary);

    expect(computed.will.final).toBe(4);
    expect(computed.will.modifiers).toEqual([
      expect.objectContaining({ instanceId: 'frightened-low', value: -1, suppressed: true }),
      expect.objectContaining({ instanceId: 'frightened-high', value: -3, suppressed: false })
    ]);
  });

  test('stacks all untyped penalties and suppresses lower untyped bonuses', () => {
    const computed = deriveStats(
      baseStats,
      [
        applied('untypedPenaltyA'),
        applied('untypedPenaltyB'),
        applied('lowerUntypedBoost'),
        applied('higherUntypedBoost')
      ],
      customLibrary
    );

    expect(computed.ac.final).toBe(17);
    expect(computed.ac.modifiers).toEqual([
      expect.objectContaining({ effectId: 'untypedPenaltyA', value: -1, suppressed: false }),
      expect.objectContaining({ effectId: 'untypedPenaltyB', value: -2, suppressed: false }),
      expect.objectContaining({ effectId: 'lowerUntypedBoost', value: 1, suppressed: true }),
      expect.objectContaining({ effectId: 'higherUntypedBoost', value: 2, suppressed: false })
    ]);
  });

  test('suppresses lower same-type bonuses while keeping same-type penalties', () => {
    const computed = deriveStats(
      baseStats,
      [applied('lowerStatusBoost'), applied('higherStatusBoost'), applied('frightened', 1)],
      { ...customLibrary, frightened: effectLibrary.frightened }
    );

    expect(computed.ac.final).toBe(20);
    expect(computed.ac.modifiers).toEqual([
      expect.objectContaining({ effectId: 'lowerStatusBoost', value: 1, suppressed: true }),
      expect.objectContaining({ effectId: 'higherStatusBoost', value: 3, suppressed: false }),
      expect.objectContaining({ effectId: 'frightened', value: -1, suppressed: false })
    ]);
  });

  test('expands save, skill, ability, and mental skill meta-targets against existing skills only', () => {
    const allComputed = deriveStats(baseStats, [applied('allMetaPenalty')], customLibrary);
    const abilityComputed = deriveStats(baseStats, [applied('abilityMetaPenalty')], customLibrary);
    const mentalComputed = deriveStats(baseStats, [applied('mentalPenalty')], customLibrary);

    expect(allComputed.fortitude.final).toBe(8);
    expect(allComputed.reflex.final).toBe(7);
    expect(allComputed.will.final).toBe(6);
    expect(allComputed.skills.stealth.final).toBe(10);
    expect(allComputed.skills.warfareLore.final).toBe(11);

    expect(abilityComputed.skills.athletics.final).toBe(9);
    expect(abilityComputed.skills.acrobatics.final).toBe(6);
    expect(abilityComputed.skills.stealth.final).toBe(9);
    expect(abilityComputed.skills.thievery.final).toBe(5);
    expect(abilityComputed.skills.arcana.final).toBe(2);
    expect(abilityComputed.skills.crafting.final).toBe(1);
    expect(abilityComputed.skills.occultism.final).toBe(6);
    expect(abilityComputed.skills.society.final).toBe(1);
    expect(abilityComputed.skills.medicine.final).toBe(3);
    expect(abilityComputed.skills.nature.final).toBe(1);
    expect(abilityComputed.skills.religion.final).toBe(2);
    expect(abilityComputed.skills.survival.final).toBe(4);
    expect(abilityComputed.skills.deception.final).toBe(-2);
    expect(abilityComputed.skills.diplomacy.final).toBe(-3);
    expect(abilityComputed.skills.intimidation.final).toBe(1);
    expect(abilityComputed.skills.performance.final).toBe(-4);
    expect(abilityComputed.skills.warfareLore.final).toBe(12);

    expect(mentalComputed.skills.arcana.final).toBe(4);
    expect(mentalComputed.skills.occultism.final).toBe(8);
    expect(mentalComputed.skills.survival.final).toBe(7);
    expect(mentalComputed.skills.intimidation.final).toBe(5);
    expect(mentalComputed.skills.athletics.final).toBe(10);
    expect(mentalComputed.skills.warfareLore.final).toBe(12);
  });

  test('resolves effectValue and negative effectValue from AppliedEffect value for bucket stats', () => {
    const computed = deriveStats(baseStats, [applied('valuePenalty', 3)], customLibrary);

    expect(computed.attackRolls).toEqual({
      total: 3,
      modifiers: [expect.objectContaining({ effectId: 'valuePenalty', value: 3, suppressed: false })]
    });
    expect(computed.allDCs).toEqual({
      total: -3,
      modifiers: [expect.objectContaining({ effectId: 'valuePenalty', value: -3, suppressed: false })]
    });
  });

  test('defaults missing value effects to 1 in resolved values and source names', () => {
    const computed = deriveStats(baseStats, [applied('valuePenalty')], customLibrary);

    expect(computed.attackRolls).toEqual({
      total: 1,
      modifiers: [
        expect.objectContaining({
          effectId: 'valuePenalty',
          sourceName: 'Value Penalty 1',
          value: 1,
          suppressed: false
        })
      ]
    });
    expect(computed.allDCs).toEqual({
      total: -1,
      modifiers: [
        expect.objectContaining({
          effectId: 'valuePenalty',
          sourceName: 'Value Penalty 1',
          value: -1,
          suppressed: false
        })
      ]
    });
  });

  test('suppresses exactly one lower same-type stealth modifier from explicit and ability meta-targets', () => {
    const computed = deriveStats(baseStats, [applied('stealthStatusPenalty'), applied('abilityMetaPenalty')], customLibrary);

    expect(computed.skills.stealth.final).toBe(9);
    expect(computed.skills.stealth.modifiers).toEqual([
      expect.objectContaining({ effectId: 'stealthStatusPenalty', value: -1, suppressed: true }),
      expect.objectContaining({ effectId: 'abilityMetaPenalty', value: -2, suppressed: false })
    ]);
    expect(computed.skills.stealth.modifiers.filter((modifier) => modifier.suppressed)).toHaveLength(1);
  });

  test('applies standalone Fascinated to all actual creature skills', () => {
    const computed = deriveStats(baseStats, [applied('fascinated')], effectLibrary);

    expect(computed.perception.final).toBe(4);
    expect(computed.skills.stealth.final).toBe(9);
    expect(computed.skills.warfareLore.final).toBe(10);
    expect(Object.keys(computed.skills)).toHaveLength(Object.keys(baseStats.skills).length);
  });

  test('applies standalone custom allSaves modifier to all saves', () => {
    const computed = deriveStats(baseStats, [applied('savePenalty')], customLibrary);

    expect(computed.fortitude.final).toBe(7);
    expect(computed.reflex.final).toBe(6);
    expect(computed.will.final).toBe(5);
    expect(computed.ac.final).toBe(18);
  });
});
