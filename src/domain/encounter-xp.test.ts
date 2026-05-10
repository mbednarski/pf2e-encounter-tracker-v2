import { describe, it, expect } from 'vitest';
import {
  classifyDifficulty,
  computeEncounterXP,
  creatureXPValue,
  difficultyThresholds
} from './encounter-xp';
import { combatant } from './test-support';
import type { CombatantState, EncounterState } from './types';

function makeEncounter(combatants: CombatantState[]): EncounterState {
  return {
    id: 'enc-1',
    name: 'Test Encounter',
    phase: 'PREPARING',
    round: 0,
    initiative: { order: [], currentIndex: 0, delaying: [], scores: {} },
    combatants: Object.fromEntries(combatants.map((c) => [c.id, c])),
    pendingPrompts: [],
    combatLog: [],
    recentEffectIds: []
  };
}

const pc = (id: string, level: number, overrides: Partial<CombatantState> = {}) =>
  combatant(id, { sourceType: 'partyMember', level, ...overrides });

const enemy = (id: string, level: number, overrides: Partial<CombatantState> = {}) =>
  combatant(id, { sourceType: 'creature', level, ...overrides });

describe('creatureXPValue', () => {
  it.each([
    [-6, { xp: 0, outOfRange: false }],
    [-5, { xp: 0, outOfRange: false }],
    [-4, { xp: 10, outOfRange: false }],
    [-3, { xp: 15, outOfRange: false }],
    [-2, { xp: 20, outOfRange: false }],
    [-1, { xp: 30, outOfRange: false }],
    [0, { xp: 40, outOfRange: false }],
    [1, { xp: 60, outOfRange: false }],
    [2, { xp: 80, outOfRange: false }],
    [3, { xp: 120, outOfRange: false }],
    [4, { xp: 160, outOfRange: false }],
    [5, { xp: 160, outOfRange: true }],
    [8, { xp: 160, outOfRange: true }]
  ])('delta %i → %o', (delta, expected) => {
    expect(creatureXPValue(5 + delta, 5)).toEqual(expected);
  });
});

describe('difficultyThresholds', () => {
  it('party of 4 (canonical)', () => {
    expect(difficultyThresholds(4)).toEqual({
      trivial: 40,
      low: 60,
      moderate: 80,
      severe: 120,
      extreme: 160
    });
  });

  it('party of 5 (one PC above standard)', () => {
    expect(difficultyThresholds(5)).toEqual({
      trivial: 50,
      low: 80,
      moderate: 100,
      severe: 150,
      extreme: 200
    });
  });

  it('party of 3 (one PC below standard)', () => {
    expect(difficultyThresholds(3)).toEqual({
      trivial: 30,
      low: 40,
      moderate: 60,
      severe: 90,
      extreme: 120
    });
  });

  it('party of 6', () => {
    expect(difficultyThresholds(6)).toEqual({
      trivial: 60,
      low: 100,
      moderate: 120,
      severe: 180,
      extreme: 240
    });
  });

  it('party of 1 — Low collapses to 0 because GM Core deducts 20 XP per missing PC', () => {
    // Base Low = 60, deducted by 20*3 = 60 for the three "missing" PCs → 0.
    // This matches the literal spec formula; party-of-1 is a degenerate edge
    // case the rules don't really cover, so any non-zero XP qualifies as Low.
    expect(difficultyThresholds(1)).toEqual({
      trivial: 10,
      low: 0,
      moderate: 20,
      severe: 30,
      extreme: 40
    });
  });

  it('clamps party of 0 to party of 1', () => {
    expect(difficultyThresholds(0)).toEqual(difficultyThresholds(1));
  });
});

describe('classifyDifficulty', () => {
  const t = difficultyThresholds(4); // 40, 60, 80, 120, 160

  it.each([
    [0, 'Trivial'],
    [39, 'Trivial'],
    [40, 'Trivial'], // below Low band
    [59, 'Trivial'],
    [60, 'Low'],
    [79, 'Low'],
    [80, 'Moderate'],
    [119, 'Moderate'],
    [120, 'Severe'],
    [159, 'Severe'],
    [160, 'Extreme'],
    [400, 'Extreme']
  ])('total %i XP → %s', (totalXP, expected) => {
    expect(classifyDifficulty(totalXP, t)).toBe(expected);
  });
});

describe('computeEncounterXP', () => {
  it('4 PCs L3 vs three L3 creatures → 120 XP raw, Severe, 120 XP awarded', () => {
    const state = makeEncounter([
      pc('p1', 3),
      pc('p2', 3),
      pc('p3', 3),
      pc('p4', 3),
      enemy('e1', 3),
      enemy('e2', 3),
      enemy('e3', 3)
    ]);
    const result = computeEncounterXP(state);
    expect(result.partyLevel).toBe(3);
    expect(result.partySize).toBe(4);
    expect(result.enemyCount).toBe(3);
    expect(result.totalXP).toBe(120);
    expect(result.difficulty).toBe('Severe');
    expect(result.xpAward).toBe(120);
    expect(result.hasOutOfRange).toBe(false);
  });

  it('xpAward maps each difficulty band to the canonical 4-PC budget value', () => {
    // Trivial → 40
    const trivial = computeEncounterXP(
      makeEncounter([pc('p1', 5), pc('p2', 5), pc('p3', 5), pc('p4', 5), enemy('e1', 1)])
    );
    expect(trivial.difficulty).toBe('Trivial');
    expect(trivial.xpAward).toBe(40);

    // Low → 60
    const low = computeEncounterXP(
      makeEncounter([pc('p1', 5), pc('p2', 5), pc('p3', 5), pc('p4', 5), enemy('e1', 6)])
    );
    expect(low.difficulty).toBe('Low');
    expect(low.xpAward).toBe(60);

    // Moderate → 80
    const moderate = computeEncounterXP(
      makeEncounter([pc('p1', 5), pc('p2', 5), pc('p3', 5), pc('p4', 5), enemy('e1', 7)])
    );
    expect(moderate.difficulty).toBe('Moderate');
    expect(moderate.xpAward).toBe(80);

    // Severe → 120
    const severe = computeEncounterXP(
      makeEncounter([pc('p1', 5), pc('p2', 5), pc('p3', 5), pc('p4', 5), enemy('e1', 8)])
    );
    expect(severe.difficulty).toBe('Severe');
    expect(severe.xpAward).toBe(120);

    // Extreme → 160
    const extreme = computeEncounterXP(
      makeEncounter([pc('p1', 5), pc('p2', 5), pc('p3', 5), pc('p4', 5), enemy('e1', 9)])
    );
    expect(extreme.difficulty).toBe('Extreme');
    expect(extreme.xpAward).toBe(160);
  });

  it('xpAward is independent of party size — 3 PCs at 60 XP raw → Moderate, awarded 80 XP', () => {
    // 3 PCs at L3 vs three L3 creatures = 120 XP raw at canonical 4-PC rates.
    // For party-3 thresholds (Trivial 30, Low 45, Moderate 60, Severe 90, Extreme 120),
    // 120 XP qualifies as Extreme, awarding the canonical Extreme = 160.
    const extremeFor3 = computeEncounterXP(
      makeEncounter([pc('p1', 3), pc('p2', 3), pc('p3', 3), enemy('e1', 3), enemy('e2', 3), enemy('e3', 3)])
    );
    expect(extremeFor3.partySize).toBe(3);
    expect(extremeFor3.totalXP).toBe(120);
    expect(extremeFor3.difficulty).toBe('Extreme');
    expect(extremeFor3.xpAward).toBe(160);

    // 3 PCs at L3 vs one L+1 creature (L4) = 60 XP raw.
    // Party-3 Moderate threshold is 60 → qualifies as Moderate.
    // Award is the canonical Moderate value = 80, NOT the raw total.
    const moderateFor3 = computeEncounterXP(
      makeEncounter([pc('p1', 3), pc('p2', 3), pc('p3', 3), enemy('e1', 4)])
    );
    expect(moderateFor3.partySize).toBe(3);
    expect(moderateFor3.totalXP).toBe(60);
    expect(moderateFor3.difficulty).toBe('Moderate');
    expect(moderateFor3.xpAward).toBe(80);

    // Same raw 60 XP, but for 4 PCs → Low threshold is 60 → Low → award 60.
    const lowFor4 = computeEncounterXP(
      makeEncounter([pc('p1', 3), pc('p2', 3), pc('p3', 3), pc('p4', 3), enemy('e1', 4)])
    );
    expect(lowFor4.partySize).toBe(4);
    expect(lowFor4.totalXP).toBe(60);
    expect(lowFor4.difficulty).toBe('Low');
    expect(lowFor4.xpAward).toBe(60);
  });

  it('xpAward is 0 when difficulty is null (no party or no enemies)', () => {
    const noParty = computeEncounterXP(makeEncounter([enemy('e1', 3)]));
    expect(noParty.difficulty).toBe(null);
    expect(noParty.xpAward).toBe(0);

    const noEnemies = computeEncounterXP(
      makeEncounter([pc('p1', 3), pc('p2', 3), pc('p3', 3), pc('p4', 3)])
    );
    expect(noEnemies.difficulty).toBe(null);
    expect(noEnemies.xpAward).toBe(0);
  });

  it('4 PCs L5 vs one L5 elite → 60 XP, Low (elite shifts effective level +1)', () => {
    const state = makeEncounter([
      pc('p1', 5),
      pc('p2', 5),
      pc('p3', 5),
      pc('p4', 5),
      enemy('e1', 5, { templateAdjustment: 'elite' })
    ]);
    const result = computeEncounterXP(state);
    expect(result.totalXP).toBe(60);
    expect(result.difficulty).toBe('Low');
    expect(result.contributions[0].effectiveLevel).toBe(6);
    expect(result.contributions[0].delta).toBe(1);
  });

  it('4 PCs L5 vs one L4 weak → 20 XP (weak shifts effective level -1)', () => {
    const state = makeEncounter([
      pc('p1', 5),
      pc('p2', 5),
      pc('p3', 5),
      pc('p4', 5),
      enemy('e1', 4, { templateAdjustment: 'weak' })
    ]);
    const result = computeEncounterXP(state);
    expect(result.contributions[0].effectiveLevel).toBe(3);
    expect(result.contributions[0].delta).toBe(-2);
    expect(result.totalXP).toBe(20);
    expect(result.difficulty).toBe('Trivial');
  });

  it('5 PCs L4 vs L5+L5+L7 → uses party-5 thresholds', () => {
    const state = makeEncounter([
      pc('p1', 4),
      pc('p2', 4),
      pc('p3', 4),
      pc('p4', 4),
      pc('p5', 4),
      enemy('e1', 5),
      enemy('e2', 5),
      enemy('e3', 7)
    ]);
    const result = computeEncounterXP(state);
    // L5 vs L4 = +1 = 60 XP each; L7 vs L4 = +3 = 120 XP. Total 240.
    expect(result.totalXP).toBe(240);
    expect(result.thresholds).toEqual({
      trivial: 50,
      low: 80,
      moderate: 100,
      severe: 150,
      extreme: 200
    });
    expect(result.difficulty).toBe('Extreme'); // 240 >= 200
  });

  it('4 PCs L1 vs one L10 creature → 160 XP, outOfRange, Extreme', () => {
    const state = makeEncounter([
      pc('p1', 1),
      pc('p2', 1),
      pc('p3', 1),
      pc('p4', 1),
      enemy('e1', 10)
    ]);
    const result = computeEncounterXP(state);
    expect(result.totalXP).toBe(160);
    expect(result.hasOutOfRange).toBe(true);
    expect(result.contributions[0].outOfRange).toBe(true);
    expect(result.difficulty).toBe('Extreme');
  });

  it('no party members, two L3 creatures → partyLevel null, difficulty null', () => {
    const state = makeEncounter([enemy('e1', 3), enemy('e2', 3)]);
    const result = computeEncounterXP(state);
    expect(result.partyLevel).toBe(null);
    expect(result.partySize).toBe(0);
    expect(result.enemyCount).toBe(2);
    expect(result.totalXP).toBe(0);
    expect(result.difficulty).toBe(null);
    expect(result.thresholds).toBe(null);
  });

  it('PCs only, no enemies → enemyCount 0, difficulty null', () => {
    const state = makeEncounter([pc('p1', 3), pc('p2', 3), pc('p3', 3), pc('p4', 3)]);
    const result = computeEncounterXP(state);
    expect(result.enemyCount).toBe(0);
    expect(result.totalXP).toBe(0);
    expect(result.difficulty).toBe(null);
    expect(result.thresholds).not.toBe(null); // thresholds computed once we have a party
  });

  it('mixed party levels (3,3,3,4) → partyLevel 4 (max)', () => {
    const state = makeEncounter([
      pc('p1', 3),
      pc('p2', 3),
      pc('p3', 3),
      pc('p4', 4),
      enemy('e1', 3)
    ]);
    const result = computeEncounterXP(state);
    expect(result.partyLevel).toBe(4);
    // L3 enemy vs party L4 = -1 = 30 XP
    expect(result.totalXP).toBe(30);
  });

  it('companion is excluded from party and enemies', () => {
    const state = makeEncounter([
      pc('p1', 5),
      pc('p2', 5),
      pc('p3', 5),
      pc('p4', 5),
      combatant('comp', { sourceType: 'companion', level: 5, masterId: 'p1' }),
      enemy('e1', 5)
    ]);
    const result = computeEncounterXP(state);
    expect(result.partySize).toBe(4); // companion not counted
    expect(result.enemyCount).toBe(1); // companion not counted
    expect(result.totalXP).toBe(40); // only the L5 creature
  });

  it('hazard counts as enemy', () => {
    const state = makeEncounter([
      pc('p1', 3),
      pc('p2', 3),
      pc('p3', 3),
      pc('p4', 3),
      combatant('haz', { sourceType: 'hazard', level: 4 })
    ]);
    const result = computeEncounterXP(state);
    expect(result.enemyCount).toBe(1);
    expect(result.totalXP).toBe(60); // L4 vs L3 = +1 = 60
    expect(result.difficulty).toBe('Low');
  });

  it('enemy with no level is omitted from contributions', () => {
    const state = makeEncounter([
      pc('p1', 3),
      pc('p2', 3),
      pc('p3', 3),
      pc('p4', 3),
      enemy('e1', 3),
      combatant('e2', { sourceType: 'creature', level: undefined })
    ]);
    const result = computeEncounterXP(state);
    expect(result.contributions).toHaveLength(1);
    expect(result.totalXP).toBe(40);
  });
});
