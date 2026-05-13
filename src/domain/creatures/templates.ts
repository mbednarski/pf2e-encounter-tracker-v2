import type { Creature, TemplateAdjustment } from '../types';
import {
  adjustedAttack,
  adjustedDC,
  adjustedHp,
  adjustedSpellBlock,
  getEffectiveLevel
} from './adjusted-view';

export type CreatureTemplateAdjustment = 'elite' | 'weak';

export function applyEliteWeak(creature: Creature, adjustment: CreatureTemplateAdjustment): Creature {
  const adj: TemplateAdjustment = adjustment;
  const next: Creature = structuredClone(creature);
  next.level = getEffectiveLevel(creature.level, adj);
  next.hp = adjustedHp(creature.hp, creature.level, adj);
  next.ac = adjustedDC(creature.ac, adj);
  next.fortitude = adjustedDC(creature.fortitude, adj);
  next.reflex = adjustedDC(creature.reflex, adj);
  next.will = adjustedDC(creature.will, adj);
  next.perception = adjustedDC(creature.perception, adj);
  next.skills = Object.fromEntries(
    Object.entries(creature.skills).map(([k, v]) => [k, adjustedDC(v, adj)])
  );
  next.attacks = creature.attacks.map((attack) => adjustedAttack(attack, adj));
  if (next.spellcasting) {
    next.spellcasting = next.spellcasting.map((b) => adjustedSpellBlock(b, adj));
  }
  return next;
}

export function adjustedLevel(level: number, adjustment: CreatureTemplateAdjustment): number {
  return getEffectiveLevel(level, adjustment);
}
