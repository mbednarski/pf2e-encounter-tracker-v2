import { describe, expect, test } from 'vitest';
import { formatDamage, formatModifier } from './format-damage';

describe('formatDamage', () => {
  test('renders single dice + bonus + type', () => {
    expect(formatDamage([{ dice: 1, dieSize: 8, bonus: 3, type: 'slashing' }])).toBe('1d8+3 slashing');
  });

  test('renders persistent suffix', () => {
    expect(formatDamage([{ dice: 1, dieSize: 6, type: 'fire', persistent: true }])).toBe(
      '1d6 fire persistent'
    );
  });

  test('joins multiple components with " + "', () => {
    expect(
      formatDamage([
        { dice: 2, dieSize: 8, bonus: 4, type: 'piercing' },
        { dice: 1, dieSize: 6, type: 'fire', persistent: true },
        { bonus: 2, type: 'precision' }
      ])
    ).toBe('2d8+4 piercing + 1d6 fire persistent + +2 precision');
  });

  test('renders flat bonus-only damage', () => {
    expect(formatDamage([{ bonus: 5, type: 'fire' }])).toBe('+5 fire');
  });

  test('renders dice-only damage with no bonus', () => {
    expect(formatDamage([{ dice: 1, dieSize: 6, type: 'bleed' }])).toBe('1d6 bleed');
  });
});

describe('formatModifier', () => {
  test('prefixes positive with +', () => {
    expect(formatModifier(7)).toBe('+7');
  });
  test('keeps negative with -', () => {
    expect(formatModifier(-3)).toBe('-3');
  });
  test('renders zero as +0', () => {
    expect(formatModifier(0)).toBe('+0');
  });
});
