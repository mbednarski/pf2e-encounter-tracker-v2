import { describe, expect, it } from 'vitest';
import { damageTypeGlyph, persistentEffectIdToDamageType } from './damage-type-glyph';

describe('damageTypeGlyph', () => {
  it('returns a glyph and color for known types', () => {
    expect(damageTypeGlyph('fire')).toEqual({ glyph: '🔥', color: 'red', aria: 'Fire' });
    expect(damageTypeGlyph('cold')).toEqual({ glyph: '❄', color: 'blue', aria: 'Cold' });
    expect(damageTypeGlyph('bleed')).toEqual({ glyph: '🩸', color: 'red', aria: 'Bleed' });
  });

  it('is case-insensitive', () => {
    expect(damageTypeGlyph('Fire').glyph).toBe('🔥');
    expect(damageTypeGlyph('ELECTRICITY').glyph).toBe('⚡');
  });

  it('falls back to a neutral glyph for unknown types', () => {
    const fallback = damageTypeGlyph('exotic');
    expect(fallback.glyph).toBe('◯');
    expect(fallback.color).toBe('ink');
    expect(fallback.aria).toBe('exotic');
  });

  it('covers every persistent damage type the effect library defines', () => {
    const expected = [
      'fire',
      'cold',
      'acid',
      'electricity',
      'sonic',
      'bleed',
      'poison',
      'mental',
      'bludgeoning',
      'piercing',
      'slashing'
    ];
    for (const type of expected) {
      const info = damageTypeGlyph(type);
      expect(info.glyph).not.toBe('◯');
      expect(info.aria.toLowerCase()).toBe(type);
    }
  });
});

describe('persistentEffectIdToDamageType', () => {
  it('strips the persistent- prefix', () => {
    expect(persistentEffectIdToDamageType('persistent-fire')).toBe('fire');
    expect(persistentEffectIdToDamageType('persistent-bleed')).toBe('bleed');
  });

  it('returns null when the prefix is absent', () => {
    expect(persistentEffectIdToDamageType('frightened')).toBeNull();
    expect(persistentEffectIdToDamageType('persistent-')).toBeNull();
  });
});
