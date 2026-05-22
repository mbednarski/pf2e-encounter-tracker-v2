// src/lib/spell-index/resolve.test.ts
import { describe, expect, test } from 'vitest';
import { resolveAtLevel } from './resolve';
import type { SpellIndexEntry } from './types';

function spell(over: Partial<SpellIndexEntry> = {}): SpellIndexEntry {
  return {
    slug: 'magic-missile',
    name: 'Magic Missile',
    baseLevel: 1,
    isCantrip: false,
    isFocus: false,
    actionCost: 1,
    traits: ['force'],
    traditions: ['arcane', 'occult'],
    effectSummary: '',
    base: { damage: '1d4+1 force' },
    aonUrl: '',
    ...over
  };
}

describe('resolveAtLevel', () => {
  test('returns base when no heightening defined', () => {
    const entry = spell();
    expect(resolveAtLevel(entry, 1)).toEqual({ damage: '1d4+1 force' });
    expect(resolveAtLevel(entry, 5)).toEqual({ damage: '1d4+1 force' });
  });

  test('fixed mode picks highest defined level ≤ castLevel', () => {
    const entry = spell({
      baseLevel: 1,
      base: { damage: '2d6 force' },
      heightening: {
        mode: 'fixed',
        levels: {
          3: { damage: '4d6 force' },
          5: { damage: '6d6 force' }
        }
      }
    });
    expect(resolveAtLevel(entry, 1)).toEqual({ damage: '2d6 force' });
    expect(resolveAtLevel(entry, 2)).toEqual({ damage: '2d6 force' });
    expect(resolveAtLevel(entry, 3)).toEqual({ damage: '4d6 force' });
    expect(resolveAtLevel(entry, 4)).toEqual({ damage: '4d6 force' });
    expect(resolveAtLevel(entry, 5)).toEqual({ damage: '6d6 force' });
    expect(resolveAtLevel(entry, 9)).toEqual({ damage: '6d6 force' });
  });

  test('interval mode sums dice of the same type', () => {
    const fireball = spell({
      slug: 'fireball',
      name: 'Fireball',
      baseLevel: 3,
      base: { damage: '6d6 fire' },
      heightening: {
        mode: 'interval',
        per: 1,
        delta: { damage: '+2d6 fire' }
      }
    });
    expect(resolveAtLevel(fireball, 3)).toEqual({ damage: '6d6 fire' });
    expect(resolveAtLevel(fireball, 4)).toEqual({ damage: '8d6 fire' });
    expect(resolveAtLevel(fireball, 5)).toEqual({ damage: '10d6 fire' });
    expect(resolveAtLevel(fireball, 2)).toEqual({ damage: '6d6 fire' });
  });

  test('cantrips apply interval heightening based on entry.level', () => {
    const electricArc = spell({
      slug: 'electric-arc',
      name: 'Electric Arc',
      isCantrip: true,
      baseLevel: 1,
      base: { damage: '1d4 electricity' },
      heightening: {
        mode: 'interval',
        per: 2,
        delta: { damage: '+1d4 electricity' }
      }
    });
    expect(resolveAtLevel(electricArc, 1)).toEqual({ damage: '1d4 electricity' });
    expect(resolveAtLevel(electricArc, 3)).toEqual({ damage: '2d4 electricity' });
    expect(resolveAtLevel(electricArc, 5)).toEqual({ damage: '3d4 electricity' });
  });

  test('interval preserves the base modifier when summing dice', () => {
    const entry = spell({
      base: { damage: '1d4+1 force' },
      heightening: {
        mode: 'interval',
        per: 2,
        delta: { damage: '+1d4 force' }
      }
    });
    expect(resolveAtLevel(entry, 5)).toEqual({ damage: '3d4+1 force' });
  });

  test('interval falls back to verbose stacking when base is compound', () => {
    const entry = spell({
      baseLevel: 1,
      base: { damage: '6d6 fire + 1d4 evil' },
      heightening: {
        mode: 'interval',
        per: 1,
        delta: { damage: '+2d6 fire' }
      }
    });
    // One step at castLevel = baseLevel + 1; can't safely sum into a compound
    // expression so the additive form is kept.
    expect(resolveAtLevel(entry, 2).damage).toBe('6d6 fire + 1d4 evil +2d6 fire');
  });

  test('interval scales a typeless delta with no base damage', () => {
    const entry = spell({
      base: {},
      heightening: {
        mode: 'interval',
        per: 1,
        delta: { damage: '+1d6' }
      },
      baseLevel: 1
    });
    expect(resolveAtLevel(entry, 4)).toEqual({ damage: '3d6' });
  });
});
