import type { Creature, DamageComponent } from '../types';

export type CreatureTemplateAdjustment = 'elite' | 'weak';

export function applyEliteWeak(creature: Creature, adjustment: CreatureTemplateAdjustment): Creature {
  const adjusted = structuredClone(creature);
  const statDelta = adjustment === 'elite' ? 2 : -2;

  adjusted.level = adjustedLevel(creature.level, adjustment);
  adjusted.hp = adjustedHp(creature.hp, creature.level, adjustment);
  adjusted.ac += statDelta;
  adjusted.fortitude += statDelta;
  adjusted.reflex += statDelta;
  adjusted.will += statDelta;
  adjusted.perception += statDelta;
  adjusted.skills = adjustRecord(creature.skills, statDelta);
  adjusted.attacks = adjusted.attacks.map((attack) => ({
    ...attack,
    modifier: attack.modifier + statDelta,
    damage: adjustStrikeDamage(attack.damage, statDelta)
  }));
  adjusted.spellcasting = adjusted.spellcasting?.map((block) => ({
    ...block,
    dc: block.dc + statDelta,
    attackModifier: block.attackModifier === undefined ? undefined : block.attackModifier + statDelta
  }));

  return adjusted;
}

function adjustedLevel(level: number, adjustment: CreatureTemplateAdjustment): number {
  if (adjustment === 'elite') {
    return level <= 0 ? level + 2 : level + 1;
  }

  return level === 1 ? level - 2 : level - 1;
}

function adjustedHp(hp: number, level: number, adjustment: CreatureTemplateAdjustment): number {
  if (adjustment === 'elite') {
    return hp + eliteHpIncrease(level);
  }

  return Math.max(1, hp - weakHpDecrease(level));
}

function eliteHpIncrease(level: number): number {
  if (level <= 1) {
    return 10;
  }
  if (level <= 4) {
    return 15;
  }
  if (level <= 19) {
    return 20;
  }
  return 30;
}

function weakHpDecrease(level: number): number {
  if (level <= 2) {
    return 10;
  }
  if (level <= 5) {
    return 15;
  }
  if (level <= 20) {
    return 20;
  }
  return 30;
}

function adjustRecord(record: Record<string, number>, delta: number): Record<string, number> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value + delta]));
}

function adjustStrikeDamage(damage: DamageComponent[], delta: number): DamageComponent[] {
  if (damage.length === 0) {
    return damage;
  }

  const [primary, ...rest] = damage;
  return [{ ...primary, bonus: (primary.bonus ?? 0) + delta }, ...rest];
}
