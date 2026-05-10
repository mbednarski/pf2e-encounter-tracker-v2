import type { CombatantId, CombatantState, EncounterState } from './types';

export type EncounterDifficulty = 'Trivial' | 'Low' | 'Moderate' | 'Severe' | 'Extreme';

export interface DifficultyThresholds {
  trivial: number;
  low: number;
  moderate: number;
  severe: number;
  extreme: number;
}

export interface CreatureXPContribution {
  combatantId: CombatantId;
  name: string;
  effectiveLevel: number;
  delta: number;
  xp: number;
  outOfRange: boolean;
}

export interface EncounterXPSummary {
  partyLevel: number | null;
  partySize: number;
  enemyCount: number;
  totalXP: number;
  difficulty: EncounterDifficulty | null;
  thresholds: DifficultyThresholds | null;
  /** Per-character XP award based on the encounter's difficulty band (PF2e GM Core). */
  xpPerPlayer: number;
  hasOutOfRange: boolean;
  contributions: CreatureXPContribution[];
}

export const XP_PER_PLAYER_BY_DIFFICULTY: Record<EncounterDifficulty, number> = {
  Trivial: 10,
  Low: 15,
  Moderate: 20,
  Severe: 30,
  Extreme: 40
};

const DELTA_XP: Record<number, number> = {
  [-4]: 10,
  [-3]: 15,
  [-2]: 20,
  [-1]: 30,
  0: 40,
  1: 60,
  2: 80,
  3: 120,
  4: 160
};

const MAX_XP = 160;

const BASE_THRESHOLDS: DifficultyThresholds = {
  trivial: 40,
  low: 60,
  moderate: 80,
  severe: 120,
  extreme: 160
};

const PER_PC_INCREMENTS: DifficultyThresholds = {
  trivial: 10,
  low: 15,
  moderate: 20,
  severe: 30,
  extreme: 40
};

export function creatureXPValue(
  creatureLevel: number,
  partyLevel: number
): { xp: number; outOfRange: boolean } {
  const delta = creatureLevel - partyLevel;
  if (delta <= -5) return { xp: 0, outOfRange: false };
  if (delta >= 5) return { xp: MAX_XP, outOfRange: true };
  return { xp: DELTA_XP[delta], outOfRange: false };
}

export function difficultyThresholds(partySize: number): DifficultyThresholds {
  const n = Math.max(1, partySize);
  const offset = n - 4;
  return {
    trivial: BASE_THRESHOLDS.trivial + PER_PC_INCREMENTS.trivial * offset,
    low: BASE_THRESHOLDS.low + PER_PC_INCREMENTS.low * offset,
    moderate: BASE_THRESHOLDS.moderate + PER_PC_INCREMENTS.moderate * offset,
    severe: BASE_THRESHOLDS.severe + PER_PC_INCREMENTS.severe * offset,
    extreme: BASE_THRESHOLDS.extreme + PER_PC_INCREMENTS.extreme * offset
  };
}

export function classifyDifficulty(
  totalXP: number,
  thresholds: DifficultyThresholds
): EncounterDifficulty {
  if (totalXP >= thresholds.extreme) return 'Extreme';
  if (totalXP >= thresholds.severe) return 'Severe';
  if (totalXP >= thresholds.moderate) return 'Moderate';
  if (totalXP >= thresholds.low) return 'Low';
  return 'Trivial';
}

function effectiveCreatureLevel(c: CombatantState): number | null {
  if (c.level == null) return null;
  if (c.templateAdjustment === 'elite') return c.level + 1;
  if (c.templateAdjustment === 'weak') return c.level - 1;
  return c.level;
}

export function computeEncounterXP(state: EncounterState): EncounterXPSummary {
  const combatants = Object.values(state.combatants);

  const partyMembers = combatants.filter((c) => c.sourceType === 'partyMember');
  const partySize = partyMembers.length;
  const partyLevels = partyMembers
    .map((c) => c.level)
    .filter((lvl): lvl is number => typeof lvl === 'number');
  const partyLevel = partyLevels.length > 0 ? Math.max(...partyLevels) : null;

  const enemies = combatants.filter(
    (c) => c.sourceType !== 'partyMember' && c.sourceType !== 'companion'
  );
  const enemyCount = enemies.length;

  const thresholds = partySize > 0 ? difficultyThresholds(partySize) : null;

  if (partyLevel == null) {
    return {
      partyLevel: null,
      partySize,
      enemyCount,
      totalXP: 0,
      difficulty: null,
      thresholds,
      xpPerPlayer: 0,
      hasOutOfRange: false,
      contributions: []
    };
  }

  const contributions: CreatureXPContribution[] = [];
  let totalXP = 0;
  let hasOutOfRange = false;

  for (const enemy of enemies) {
    const eff = effectiveCreatureLevel(enemy);
    if (eff == null) continue;
    const { xp, outOfRange } = creatureXPValue(eff, partyLevel);
    contributions.push({
      combatantId: enemy.id,
      name: enemy.name,
      effectiveLevel: eff,
      delta: eff - partyLevel,
      xp,
      outOfRange
    });
    totalXP += xp;
    if (outOfRange) hasOutOfRange = true;
  }

  const difficulty =
    enemyCount > 0 && thresholds ? classifyDifficulty(totalXP, thresholds) : null;
  const xpPerPlayer = difficulty ? XP_PER_PLAYER_BY_DIFFICULTY[difficulty] : 0;

  return {
    partyLevel,
    partySize,
    enemyCount,
    totalXP,
    difficulty,
    thresholds,
    xpPerPlayer,
    hasOutOfRange,
    contributions
  };
}
