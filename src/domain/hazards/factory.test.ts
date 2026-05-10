import { describe, expect, test } from 'vitest';
import { createCombatantFromHazard } from './factory';
import type { Hazard, HazardBaseStats } from '../types';

function baseHazard(overrides: Partial<Hazard> = {}): Hazard {
  return {
    id: 'dart-gallery',
    name: 'Poisoned Dart Gallery',
    level: 8,
    traits: ['mechanical', 'trap'],
    rarity: 'common',
    ac: 27,
    fortitude: 13,
    reflex: 17,
    hp: 100,
    hardness: 10,
    stealth: 28,
    stealthNote: 'expert',
    immunities: ['critical-hits'],
    resistances: [],
    weaknesses: [],
    disableChecks: [
      { skill: 'thievery', dc: 26, requiredSuccesses: 3 },
      { skill: 'athletics', dc: 22, requiredSuccesses: 1 }
    ],
    routine: { actions: 2, description: 'Fires darts.' },
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    attacks: [],
    tags: [],
    ...overrides
  };
}

describe('createCombatantFromHazard', () => {
  test('builds a hazard combatant with HazardBaseStats and hazardData', () => {
    const c = createCombatantFromHazard({ hazard: baseHazard(), combatantId: 'trap-1' });

    expect(c.id).toBe('trap-1');
    expect(c.sourceType).toBe('hazard');
    expect(c.sourceId).toBe('dart-gallery');
    expect(c.name).toBe('Poisoned Dart Gallery');
    expect(c.isAlive).toBe(true);
    expect(c.currentHp).toBe(100);

    const stats = c.baseStats as HazardBaseStats;
    expect(stats.ac).toBe(27);
    expect(stats.fortitude).toBe(13);
    expect(stats.reflex).toBe(17);
    expect(stats.will).toBeNull();
    expect(stats.hardness).toBe(10);
    expect(stats.stealth).toBe(28);
    expect(stats.stealthNote).toBe('expert');
    expect(stats.immunities).toEqual(['critical-hits']);

    expect(c.hazardData?.routine.actions).toBe(2);
    expect(c.hazardData?.disableChecks).toHaveLength(2);
    expect(c.hazardData?.disableProgress).toEqual([
      { checkIndex: 0, successesRemaining: 3 },
      { checkIndex: 1, successesRemaining: 1 }
    ]);
  });

  test('null AC and saves when hazard fields are absent', () => {
    const c = createCombatantFromHazard({
      hazard: baseHazard({ ac: undefined, fortitude: undefined, reflex: undefined, will: undefined }),
      combatantId: 'trap-2'
    });
    const stats = c.baseStats as HazardBaseStats;
    expect(stats.ac).toBeNull();
    expect(stats.fortitude).toBeNull();
    expect(stats.reflex).toBeNull();
    expect(stats.will).toBeNull();
  });

  test('indestructible hazard: hp undefined → 0, isAlive: true', () => {
    const c = createCombatantFromHazard({
      hazard: baseHazard({ hp: undefined }),
      combatantId: 'trap-3'
    });
    expect(c.currentHp).toBe(0);
    expect((c.baseStats as HazardBaseStats).hp).toBe(0);
    expect(c.isAlive).toBe(true);
  });

  test('omits hardness when absent', () => {
    const c = createCombatantFromHazard({
      hazard: baseHazard({ hardness: undefined }),
      combatantId: 'trap-4'
    });
    expect((c.baseStats as HazardBaseStats).hardness).toBeUndefined();
  });

  test('result is JSON-serializable', () => {
    const c = createCombatantFromHazard({ hazard: baseHazard(), combatantId: 'trap-5' });
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });

  test('name override wins', () => {
    const c = createCombatantFromHazard({
      hazard: baseHazard(),
      combatantId: 'trap-6',
      name: 'Custom Name'
    });
    expect(c.name).toBe('Custom Name');
  });
});
