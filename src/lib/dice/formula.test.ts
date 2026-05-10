import { describe, expect, it } from 'vitest';
import { parseDiceFormula, rollDiceFormula } from './formula';

describe('parseDiceFormula', () => {
  it('parses bare NdM', () => {
    expect(parseDiceFormula('1d6')).toEqual({ dice: 1, dieSize: 6, bonus: 0 });
    expect(parseDiceFormula('2d4')).toEqual({ dice: 2, dieSize: 4, bonus: 0 });
    expect(parseDiceFormula('3d10')).toEqual({ dice: 3, dieSize: 10, bonus: 0 });
  });

  it('parses positive bonus', () => {
    expect(parseDiceFormula('1d6+2')).toEqual({ dice: 1, dieSize: 6, bonus: 2 });
    expect(parseDiceFormula('2d6 + 3')).toEqual({ dice: 2, dieSize: 6, bonus: 3 });
  });

  it('parses negative bonus', () => {
    expect(parseDiceFormula('2d8-1')).toEqual({ dice: 2, dieSize: 8, bonus: -1 });
    expect(parseDiceFormula('1d10 - 2')).toEqual({ dice: 1, dieSize: 10, bonus: -2 });
  });

  it('is case-insensitive on D', () => {
    expect(parseDiceFormula('1D6')).toEqual({ dice: 1, dieSize: 6, bonus: 0 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDiceFormula('  1d6  ')).toEqual({ dice: 1, dieSize: 6, bonus: 0 });
  });

  it('returns null for unparseable input', () => {
    expect(parseDiceFormula('')).toBeNull();
    expect(parseDiceFormula('   ')).toBeNull();
    expect(parseDiceFormula('d6')).toBeNull();
    expect(parseDiceFormula('1d')).toBeNull();
    expect(parseDiceFormula('abc')).toBeNull();
    expect(parseDiceFormula('1d6+')).toBeNull();
    expect(parseDiceFormula('0d6')).toBeNull();
    expect(parseDiceFormula('1d1')).toBeNull();
  });
});

describe('rollDiceFormula', () => {
  it('returns null for unparseable input', () => {
    expect(rollDiceFormula('garbage')).toBeNull();
  });

  it('rolls each die using the injected RNG', () => {
    const values = [0, 0.5, 0.999];
    let i = 0;
    const rng = () => values[i++];
    expect(rollDiceFormula('3d6', rng)).toBe(1 + 4 + 6);
  });

  it('adds the bonus', () => {
    const rng = () => 0;
    expect(rollDiceFormula('2d6+5', rng)).toBe(1 + 1 + 5);
  });

  it('subtracts the bonus', () => {
    const rng = () => 0.999;
    expect(rollDiceFormula('1d6-2', rng)).toBe(6 - 2);
  });

  it('clamps a negative total to zero', () => {
    const rng = () => 0;
    expect(rollDiceFormula('1d4-10', rng)).toBe(0);
  });
});
