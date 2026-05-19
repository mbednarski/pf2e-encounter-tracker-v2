// src/lib/spell-index/resolve.ts
import type { SpellIndexEntry, SpellLevelData } from './types';

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
    result.damage = `${entry.base.damage}${` ${deltaDamage}`.repeat(steps)}`;
  } else if (deltaDamage) {
    result.damage = Array(steps).fill(deltaDamage.replace(/^\+/, '')).join(' +');
  }
  return result;
}
