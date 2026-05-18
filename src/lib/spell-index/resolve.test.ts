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

  test('interval mode adds delta per step', () => {
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
    expect(resolveAtLevel(fireball, 4)).toEqual({ damage: '6d6 fire +2d6 fire' });
    expect(resolveAtLevel(fireball, 5)).toEqual({ damage: '6d6 fire +2d6 fire +2d6 fire' });
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
    expect(resolveAtLevel(electricArc, 3)).toEqual({ damage: '1d4 electricity +1d4 electricity' });
    expect(resolveAtLevel(electricArc, 5)).toEqual({ damage: '1d4 electricity +1d4 electricity +1d4 electricity' });
  });
});
