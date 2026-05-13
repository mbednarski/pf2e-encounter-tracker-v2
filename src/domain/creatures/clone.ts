import type {
  CombatantState,
  CombatantSpellcasting,
  Creature,
  CreatureSnapshot,
  SpellcastingBlock
} from '../types';
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
  const baseSnapshot: CreatureSnapshot = {
    level: creature.level,
    ac: creature.ac,
    fortitude: creature.fortitude,
    reflex: creature.reflex,
    will: creature.will,
    perception: creature.perception,
    hp: creature.hp,
    speed: primarySpeed(creature.speed),
    skills: cloneValue(creature.skills)
  };

  return {
    id: combatantId,
    sourceId: creature.id,
    name: name ?? combatantCreature.name,
    sourceType: 'creature',
    baseSnapshot,
    templateAdjustment: adjustment ?? 'normal',
    currentHp: combatantCreature.hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: cloneValue(creature.attacks),
    passiveAbilities: cloneValue(creature.passiveAbilities),
    reactiveAbilities: cloneValue(creature.reactiveAbilities),
    activeAbilities: cloneValue(creature.activeAbilities),
    spellcasting: creature.spellcasting ? hydrateSpellcasting(creature.spellcasting) : undefined,
    traits: cloneValue(creature.traits),
    size: creature.size
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
