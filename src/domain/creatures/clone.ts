import type { CombatantState, CombatantSpellcasting, Creature, SpellcastingBlock } from '../types';
import { applyEliteWeak, type CreatureTemplateAdjustment } from './templates';

export interface CreateCombatantFromCreatureInput {
  creature: Creature;
  combatantId: string;
  name?: string;
  adjustment?: CreatureTemplateAdjustment;
}

export function createCombatantFromCreature({
  creature,
  combatantId,
  name,
  adjustment
}: CreateCombatantFromCreatureInput): CombatantState {
  const combatantCreature = adjustment ? applyEliteWeak(creature, adjustment) : creature;

  return {
    id: combatantId,
    creatureId: creature.id,
    name: name ?? combatantCreature.name,
    sourceType: 'creature',
    baseStats: {
      hp: combatantCreature.hp,
      ac: combatantCreature.ac,
      fortitude: combatantCreature.fortitude,
      reflex: combatantCreature.reflex,
      will: combatantCreature.will,
      perception: combatantCreature.perception,
      speed: primarySpeed(combatantCreature.speed),
      skills: cloneValue(combatantCreature.skills)
    },
    currentHp: combatantCreature.hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: cloneValue(combatantCreature.attacks),
    passiveAbilities: cloneValue(combatantCreature.passiveAbilities),
    reactiveAbilities: cloneValue(combatantCreature.reactiveAbilities),
    activeAbilities: cloneValue(combatantCreature.activeAbilities),
    spellcasting: combatantCreature.spellcasting ? hydrateSpellcasting(combatantCreature.spellcasting) : undefined,
    traits: cloneValue(combatantCreature.traits),
    size: combatantCreature.size,
    level: combatantCreature.level,
    templateAdjustment: adjustment
  };
}

function hydrateSpellcasting(blocks: SpellcastingBlock[]): CombatantSpellcasting[] {
  return blocks.map((block) => ({
    ...cloneValue(block),
    usedSlots: block.slots ? {} : undefined,
    usedFocusPoints: block.type === 'focus' ? 0 : undefined,
    usedEntries: hasInnatePerDayEntries(block) ? {} : undefined
  }));
}

function hasInnatePerDayEntries(block: SpellcastingBlock): boolean {
  return block.type === 'innate' && block.entries.some((entry) => entry.frequency?.type === 'perDay');
}

function primarySpeed(speed: Record<string, number>): number {
  return speed.land ?? Object.values(speed)[0] ?? 0;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
