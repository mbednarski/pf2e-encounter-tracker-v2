import type { CombatantState, CombatantSpellcasting, Creature, SpellcastingBlock } from '../types';

export interface CreateCombatantFromCreatureInput {
  creature: Creature;
  combatantId: string;
  name?: string;
}

export function createCombatantFromCreature({
  creature,
  combatantId,
  name
}: CreateCombatantFromCreatureInput): CombatantState {
  return {
    id: combatantId,
    creatureId: creature.id,
    name: name ?? creature.name,
    sourceType: 'creature',
    baseStats: {
      hp: creature.hp,
      ac: creature.ac,
      fortitude: creature.fortitude,
      reflex: creature.reflex,
      will: creature.will,
      perception: creature.perception,
      speed: primarySpeed(creature.speed),
      skills: cloneValue(creature.skills)
    },
    currentHp: creature.hp,
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
    size: creature.size,
    level: creature.level
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
