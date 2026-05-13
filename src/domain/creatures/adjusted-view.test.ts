import { describe, expect, test } from 'vitest';
import {
  adjustedAbility,
  adjustedAttack,
  adjustedDC,
  adjustedDamage,
  adjustedHp,
  adjustedSpellBlock,
  adjustedSpellEntry,
  getAdjustedView,
  getEffectiveLevel
} from './adjusted-view';
import type {
  Ability,
  Attack,
  CombatantState,
  CreatureSnapshot,
  DamageComponent,
  SpellcastingBlock,
  TemplateAdjustment
} from '../types';

describe('getEffectiveLevel', () => {
  test('elite adds +1, or +2 when starting at level <= 0', () => {
    expect(getEffectiveLevel(5, 'elite')).toBe(6);
    expect(getEffectiveLevel(1, 'elite')).toBe(2);
    expect(getEffectiveLevel(0, 'elite')).toBe(2);
    expect(getEffectiveLevel(-1, 'elite')).toBe(1);
  });

  test('weak subtracts 1, or 2 when starting at level 1', () => {
    expect(getEffectiveLevel(5, 'weak')).toBe(4);
    expect(getEffectiveLevel(2, 'weak')).toBe(1);
    expect(getEffectiveLevel(1, 'weak')).toBe(-1);
  });

  test('normal returns the input', () => {
    expect(getEffectiveLevel(5, 'normal')).toBe(5);
    expect(getEffectiveLevel(-1, 'normal')).toBe(-1);
  });
});

describe('adjustedHp', () => {
  test('uses Monster Core HP bands from the starting level for elite', () => {
    expect(adjustedHp(8, -1, 'elite')).toBe(18);
    expect(adjustedHp(18, 1, 'elite')).toBe(28);
    expect(adjustedHp(30, 2, 'elite')).toBe(45);
    expect(adjustedHp(70, 5, 'elite')).toBe(90);
    expect(adjustedHp(360, 20, 'elite')).toBe(390);
  });

  test('uses Monster Core HP bands from the starting level for weak', () => {
    expect(adjustedHp(12, 0, 'weak')).toBe(2);
    expect(adjustedHp(30, 2, 'weak')).toBe(20);
    expect(adjustedHp(45, 3, 'weak')).toBe(30);
    expect(adjustedHp(90, 6, 'weak')).toBe(70);
    expect(adjustedHp(400, 21, 'weak')).toBe(370);
  });

  test('floors weak HP at 1', () => {
    expect(adjustedHp(6, 2, 'weak')).toBe(1);
  });

  test('normal passes through', () => {
    expect(adjustedHp(42, 5, 'normal')).toBe(42);
  });
});

describe('adjustedDC', () => {
  test('elite +2, weak -2, normal unchanged', () => {
    expect(adjustedDC(20, 'elite')).toBe(22);
    expect(adjustedDC(20, 'weak')).toBe(18);
    expect(adjustedDC(20, 'normal')).toBe(20);
  });
});

describe('adjustedDamage', () => {
  const physical: DamageComponent = { dice: 2, dieSize: 8, bonus: 5, type: 'piercing' };
  const fireRider: DamageComponent = { dice: 1, dieSize: 6, type: 'fire' };

  test('adds ±2 to bonus of the primary component for non-limited damage', () => {
    const out = adjustedDamage([physical, fireRider], 'elite', { limitedUse: false, primaryIndex: 0 });
    expect(out[0]).toEqual({ dice: 2, dieSize: 8, bonus: 7, type: 'piercing' });
    expect(out[1]).toEqual(fireRider);
  });

  test('respects primaryIndex when the physical line is not first', () => {
    const out = adjustedDamage([fireRider, physical], 'elite', { limitedUse: false, primaryIndex: 1 });
    expect(out[0]).toEqual(fireRider);
    expect(out[1]).toEqual({ dice: 2, dieSize: 8, bonus: 7, type: 'piercing' });
  });

  test('uses ±4 for limited-use damage', () => {
    const out = adjustedDamage([physical], 'elite', { limitedUse: true, primaryIndex: 0 });
    expect(out[0].bonus).toBe(9);
    const weak = adjustedDamage([physical], 'weak', { limitedUse: true, primaryIndex: 0 });
    expect(weak[0].bonus).toBe(1);
  });

  test('treats a missing bonus as 0', () => {
    const out = adjustedDamage([fireRider], 'elite', { limitedUse: false, primaryIndex: 0 });
    expect(out[0]).toEqual({ ...fireRider, bonus: 2 });
  });

  test('falls back to index 0 when primaryIndex is out of range', () => {
    const out = adjustedDamage([physical], 'elite', { limitedUse: false, primaryIndex: 5 });
    expect(out[0].bonus).toBe(7);
  });

  test('returns a defensive copy for normal', () => {
    const input = [physical];
    const out = adjustedDamage(input, 'normal', { limitedUse: false, primaryIndex: 0 });
    expect(out[0]).toEqual(physical);
    expect(out[0]).not.toBe(input[0]);
  });
});

describe('adjustedAttack', () => {
  const attack: Attack = {
    name: 'claw',
    type: 'melee',
    modifier: 15,
    traits: ['agile'],
    damage: [
      { dice: 2, dieSize: 8, bonus: 5, type: 'slashing' },
      { dice: 1, dieSize: 6, type: 'fire' }
    ]
  };

  test('elite shifts modifier and primary damage', () => {
    const out = adjustedAttack(attack, 'elite');
    expect(out.modifier).toBe(17);
    expect(out.damage).toEqual([
      { dice: 2, dieSize: 8, bonus: 7, type: 'slashing' },
      { dice: 1, dieSize: 6, type: 'fire' }
    ]);
  });

  test('weak shifts modifier and primary damage', () => {
    const out = adjustedAttack(attack, 'weak');
    expect(out.modifier).toBe(13);
    expect(out.damage[0].bonus).toBe(3);
  });

  test('respects an explicit primaryDamageIndex', () => {
    const withRiderFirst: Attack = {
      ...attack,
      damage: [
        { dice: 1, dieSize: 6, type: 'fire' },
        { dice: 2, dieSize: 8, bonus: 5, type: 'slashing' }
      ],
      primaryDamageIndex: 1
    };
    const out = adjustedAttack(withRiderFirst, 'elite');
    expect(out.damage[0]).toEqual({ dice: 1, dieSize: 6, type: 'fire' });
    expect(out.damage[1]).toEqual({ dice: 2, dieSize: 8, bonus: 7, type: 'slashing' });
  });

  test('normal returns a structural clone', () => {
    const out = adjustedAttack(attack, 'normal');
    expect(out).toEqual(attack);
    expect(out.damage).not.toBe(attack.damage);
  });
});

describe('adjustedAbility', () => {
  const baseAbility: Ability = {
    name: 'Petrifying Gaze',
    actions: 2,
    description: 'DC 22 Fortitude or slowed 1.',
    save: { defense: 'fortitude', dc: 22 }
  };

  test('shifts structured save DC for elite/weak', () => {
    expect(adjustedAbility(baseAbility, 'elite').save?.dc).toBe(24);
    expect(adjustedAbility(baseAbility, 'weak').save?.dc).toBe(20);
    expect(adjustedAbility(baseAbility, 'normal').save?.dc).toBe(22);
  });

  test('passes through abilities with no structured save or damage', () => {
    const plain: Ability = { name: 'Scuttle', description: 'Hard to pin down.' };
    expect(adjustedAbility(plain, 'elite')).toEqual(plain);
  });

  test('applies ±4 to limited-use ability damage', () => {
    const breath: Ability = {
      name: 'Breath Weapon',
      description: '4d6 fire.',
      damage: [{ dice: 4, dieSize: 6, type: 'fire' }],
      isLimitedUse: true,
      save: { defense: 'reflex', dc: 20, basic: true }
    };
    const elite = adjustedAbility(breath, 'elite');
    expect(elite.damage?.[0]).toEqual({ dice: 4, dieSize: 6, type: 'fire', bonus: 4 });
    expect(elite.save?.dc).toBe(22);
  });

  test('applies ±2 to at-will damaging ability', () => {
    const ability: Ability = {
      name: 'Searing Glare',
      description: '1d6 fire.',
      damage: [{ dice: 1, dieSize: 6, type: 'fire' }]
    };
    expect(adjustedAbility(ability, 'elite').damage?.[0].bonus).toBe(2);
    expect(adjustedAbility(ability, 'weak').damage?.[0].bonus).toBe(-2);
  });
});

describe('adjustedSpellBlock and adjustedSpellEntry', () => {
  const block: SpellcastingBlock = {
    blockId: 'arcane',
    name: 'Arcane',
    tradition: 'arcane',
    type: 'prepared',
    dc: 20,
    attackModifier: 12,
    slots: { 1: 2 },
    entries: [
      { spellSlug: 'heal', name: 'Heal', level: 1 },
      {
        spellSlug: 'fireball',
        name: 'Fireball',
        level: 3,
        damage: [{ dice: 6, dieSize: 6, type: 'fire' }]
      }
    ]
  };

  test('shifts block dc and attackModifier', () => {
    const out = adjustedSpellBlock(block, 'elite');
    expect(out.dc).toBe(22);
    expect(out.attackModifier).toBe(14);
  });

  test('applies ±4 to slotted spell damage', () => {
    const out = adjustedSpellBlock(block, 'elite');
    expect(out.entries[1].damage?.[0]).toEqual({ dice: 6, dieSize: 6, type: 'fire', bonus: 4 });
  });

  test('cantrip damage is not limited-use', () => {
    const cantripBlock: SpellcastingBlock = {
      ...block,
      type: 'innate',
      entries: [
        {
          spellSlug: 'ignition',
          name: 'Ignition',
          level: 1,
          isCantrip: true,
          frequency: { type: 'atWill' },
          damage: [{ dice: 1, dieSize: 4, type: 'fire' }]
        }
      ]
    };
    const out = adjustedSpellBlock(cantripBlock, 'elite');
    expect(out.entries[0].damage?.[0].bonus).toBe(2);
  });

  test('innate perDay spell damage is limited-use', () => {
    const innateBlock: SpellcastingBlock = {
      ...block,
      type: 'innate',
      slots: undefined,
      entries: [
        {
          spellSlug: 'fear',
          name: 'Fear',
          level: 1,
          frequency: { type: 'perDay', uses: 1 },
          damage: [{ dice: 1, dieSize: 6, type: 'mental' }]
        }
      ]
    };
    const out = adjustedSpellBlock(innateBlock, 'elite');
    expect(out.entries[0].damage?.[0].bonus).toBe(4);
  });

  test('adjustedSpellEntry with normal adjustment passes through', () => {
    const entry = block.entries[1];
    const out = adjustedSpellEntry(entry, 'prepared', 'normal');
    expect(out).toEqual(entry);
  });
});

describe('getAdjustedView', () => {
  test('returns snapshot values for normal adjustment', () => {
    const view = getAdjustedView(combatantFixture('normal'));
    expect(view).toMatchObject({
      adjustment: 'normal',
      level: 5,
      ac: 20,
      hp: 42,
      fortitude: 14,
      reflex: 12,
      will: 10,
      perception: 13,
      speed: 30,
      skills: { athletics: 15, stealth: 11 }
    });
  });

  test('shifts numeric stats and recomputes HP for elite', () => {
    const view = getAdjustedView(combatantFixture('elite'));
    expect(view).toMatchObject({
      adjustment: 'elite',
      level: 6,
      ac: 22,
      hp: 62,
      fortitude: 16,
      reflex: 14,
      will: 12,
      perception: 15,
      skills: { athletics: 17, stealth: 13 }
    });
  });

  test('shifts numeric stats and recomputes HP for weak with floor', () => {
    const view = getAdjustedView(combatantFixture('weak', { hp: 6, level: 2 }));
    expect(view.hp).toBe(1);
    expect(view.ac).toBe(18);
  });
});

function combatantFixture(
  adjustment: TemplateAdjustment,
  overrides: Partial<CreatureSnapshot> = {}
): CombatantState {
  const snap: CreatureSnapshot = {
    level: 5,
    ac: 20,
    fortitude: 14,
    reflex: 12,
    will: 10,
    perception: 13,
    hp: 42,
    speed: 30,
    skills: { athletics: 15, stealth: 11 },
    ...overrides
  };
  return {
    id: 'c1',
    sourceId: 's',
    name: 'Test',
    sourceType: 'creature',
    baseSnapshot: snap,
    currentHp: snap.hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    templateAdjustment: adjustment
  };
}
