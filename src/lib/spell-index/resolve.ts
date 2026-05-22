// src/lib/spell-index/resolve.ts
import type { SpellIndexEntry, SpellLevelData } from './types';

// "NdM", "NdM+K", "NdM-K", optional damage type tail.
const BASE_TERM = /^(\d+)d(\d+)(?:([+-]\d+))?(?:\s+(.+))?$/;
// Heightening delta: leading "+" allowed; no modifier component (heightening
// adds dice, not flat damage).
const DELTA_TERM = /^\+?(\d+)d(\d+)(?:\s+(.+))?$/;

function combineSameTypeDice(
  base: string,
  delta: string,
  steps: number
): string | null {
  const b = base.trim().match(BASE_TERM);
  const d = delta.trim().match(DELTA_TERM);
  if (!b || !d) return null;
  const [, bDice, bDie, bMod, bType] = b;
  const [, dDice, dDie, dType] = d;
  if (bDie !== dDie) return null;
  if ((bType ?? '') !== (dType ?? '')) return null;
  const total = Number(bDice) + Number(dDice) * steps;
  const modSuffix = bMod ?? '';
  const typeSuffix = bType ? ` ${bType}` : '';
  return `${total}d${bDie}${modSuffix}${typeSuffix}`;
}

export function resolveAtLevel(
  entry: SpellIndexEntry,
  castLevel: number
): SpellLevelData {
  if (!entry.heightening) return { ...entry.base };

  if (entry.heightening.mode === 'fixed') {
    const defined = Object.keys(entry.heightening.levels)
      .map((k) => Number(k))
      .filter((lvl) => lvl <= castLevel)
      .sort((a, b) => b - a);
    if (defined.length === 0) return { ...entry.base };
    return { ...entry.base, ...entry.heightening.levels[defined[0]] };
  }

  // interval mode
  const steps = Math.max(0, Math.floor((castLevel - entry.baseLevel) / entry.heightening.per));
  if (steps === 0) return { ...entry.base };
  const result: SpellLevelData = { ...entry.base };
  const deltaDamage = entry.heightening.delta.damage;
  if (deltaDamage && entry.base.damage) {
    result.damage =
      combineSameTypeDice(entry.base.damage, deltaDamage, steps) ??
      `${entry.base.damage}${` ${deltaDamage}`.repeat(steps)}`;
  } else if (deltaDamage) {
    const stripped = deltaDamage.replace(/^\+/, '');
    const m = stripped.match(DELTA_TERM);
    if (m) {
      const [, dice, die, type] = m;
      result.damage = `${Number(dice) * steps}d${die}${type ? ` ${type}` : ''}`;
    } else {
      result.damage = Array(steps).fill(stripped).join(' +');
    }
  }
  return result;
}
