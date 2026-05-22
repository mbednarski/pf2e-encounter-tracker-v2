import { describe, expect, test } from 'vitest';
import type { Hazard } from '../../domain';
import { validateHazard } from './hazard-validator';

describe('validateHazard', () => {
  test('accepts a well-formed hazard document', () => {
    const result = validateHazard(validHazardData(), 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('poisoned-dart-gallery');
    expect(result.value.hardness).toBe(10);
    expect(result.value.routine).toContain('darts');
    expect(result.issues).toHaveLength(0);
  });

  test('omits absent optional fields from the result', () => {
    const data = validHazardData();
    delete data.hardness;
    delete data.routine;
    delete data.stealthNote;
    const result = validateHazard(data, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty('hardness');
    expect(result.value).not.toHaveProperty('routine');
    expect(result.value).not.toHaveProperty('stealthNote');
  });

  test('reports missing required fields with paths', () => {
    const data = validHazardData();
    delete data.stealth;
    delete data.level;
    const result = validateHazard(data, 0);
    expect(result.ok).toBe(false);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('stealth');
    expect(paths).toContain('level');
  });

  test('rejects an invalid rarity', () => {
    const data = { ...validHazardData(), rarity: 'legendary' };
    const result = validateHazard(data, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'rarity')).toBe(true);
  });

  test('rejects a non-string routine', () => {
    const data = { ...validHazardData(), routine: 42 };
    const result = validateHazard(data, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'routine')).toBe(true);
  });
});

function validHazardData(): Record<string, unknown> & Partial<Hazard> {
  return {
    id: 'poisoned-dart-gallery',
    name: 'Poisoned Dart Gallery',
    level: 8,
    traits: ['mechanical', 'trap'],
    rarity: 'common',
    stealth: 28,
    stealthNote: 'expert',
    ac: 27,
    fortitude: 13,
    reflex: 17,
    will: 8,
    hp: 100,
    hardness: 10,
    immunities: [],
    resistances: [],
    weaknesses: [],
    routine: 'The trap fires a volley of poisoned darts.',
    disable: 'Thievery DC 26.',
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    tags: []
  };
}
