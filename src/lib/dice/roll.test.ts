import { describe, expect, test } from 'vitest';
import { rollAttack, rollD20, rollDamage } from './roll';

describe('rollD20', () => {
  test('returns 11 with deterministic 0.5 rng', () => {
    expect(rollD20(() => 0.5)).toBe(11);
  });

  test('returns 1 at the lower bound', () => {
    expect(rollD20(() => 0)).toBe(1);
  });

  test('returns 20 at the upper bound', () => {
    // 0.9999... * 20 → 19, +1 = 20
    expect(rollD20(() => 0.9999)).toBe(20);
  });
});

describe('rollAttack', () => {
  test('total = d20 + modifier', () => {
    const result = rollAttack(7, () => 0.5);
    expect(result).toEqual({ d20: 11, modifier: 7, total: 18 });
  });

  test('handles negative modifiers', () => {
    const result = rollAttack(-2, () => 0);
    expect(result).toEqual({ d20: 1, modifier: -2, total: -1 });
  });
});

describe('rollDamage', () => {
  test('rolls a single dice + bonus component', () => {
    const result = rollDamage([{ dice: 1, dieSize: 8, bonus: 3, type: 'slashing' }], () => 0.5);
    // 0.5 * 8 = 4, +1 → 5; +3 = 8
    expect(result.total).toBe(8);
    expect(result.breakdown).toBe('1d8+3 slashing (8)');
  });

  test('sums multiple components and joins breakdown with " + "', () => {
    const result = rollDamage(
      [
        { dice: 2, dieSize: 8, bonus: 4, type: 'piercing' },
        { dice: 1, dieSize: 6, type: 'fire', persistent: true }
      ],
      () => 0.5
    );
    // 2d8: 5+5 = 10, +4 = 14; 1d6: 4
    expect(result.total).toBe(18);
    expect(result.breakdown).toBe('2d8+4 piercing (14) + 1d6 fire persistent (4)');
  });

  test('flat bonus-only component renders bonus prefix', () => {
    const result = rollDamage([{ bonus: 5, type: 'fire' }], () => 0.5);
    expect(result.total).toBe(5);
    expect(result.breakdown).toBe('+5 fire (5)');
  });

  test('dice-only component (e.g. persistent bleed)', () => {
    const result = rollDamage([{ dice: 1, dieSize: 4, type: 'bleed', persistent: true }], () => 0);
    // 0 * 4 → 0, +1 = 1
    expect(result.total).toBe(1);
    expect(result.breakdown).toBe('1d4 bleed persistent (1)');
  });
});
