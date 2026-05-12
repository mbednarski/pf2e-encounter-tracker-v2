import type { DamageComponent } from '../../domain';

export type Rng = () => number;

const defaultRng: Rng = () => Math.random();

export interface AttackRollResult {
  d20: number;
  modifier: number;
  total: number;
}

export interface DamageRollResult {
  total: number;
  breakdown: string;
}

export function rollD20(rng: Rng = defaultRng): number {
  return Math.floor(rng() * 20) + 1;
}

export function rollAttack(modifier: number, rng: Rng = defaultRng): AttackRollResult {
  const d20 = rollD20(rng);
  return { d20, modifier, total: d20 + modifier };
}

export interface RollDamageOptions {
  flatBonus?: number;
  flatBonusLabel?: string;
}

export function rollDamage(
  components: readonly DamageComponent[],
  options: RollDamageOptions = {},
  rng: Rng = defaultRng
): DamageRollResult {
  let total = 0;
  const parts: string[] = [];

  for (const comp of components) {
    let sub = 0;
    const dicePart =
      comp.dice && comp.dieSize ? `${comp.dice}d${comp.dieSize}` : '';
    if (comp.dice && comp.dieSize) {
      for (let i = 0; i < comp.dice; i++) {
        sub += Math.floor(rng() * comp.dieSize) + 1;
      }
    }
    const bonusPart = comp.bonus ? (comp.bonus > 0 ? `+${comp.bonus}` : `${comp.bonus}`) : '';
    if (comp.bonus) sub += comp.bonus;

    const persistent = comp.persistent ? ' persistent' : '';
    const tail = `${comp.type}${persistent}`;
    const formula = `${dicePart}${bonusPart}`;
    const label = formula ? `${formula} ${tail}` : tail;
    parts.push(`${label} (${sub})`);
    total += sub;
  }

  const flatBonus = options.flatBonus ?? 0;
  if (flatBonus !== 0) {
    const sign = flatBonus > 0 ? '+' : '';
    const label = options.flatBonusLabel ?? 'status';
    parts.push(`${sign}${flatBonus} ${label}`);
    total += flatBonus;
  }

  return { total, breakdown: parts.join(' + ') };
}
