export type CombatantId = string;

export type EncounterPhase = 'PREPARING' | 'ACTIVE' | 'RESOLVING' | 'COMPLETED';

export interface InitiativeState {
  order: CombatantId[];
  currentIndex: number;
  delaying: CombatantId[];
}

export interface CreatureBaseStats {
  hp: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  speed: number;
  skills: Record<string, number>;
}

export type SourceType = 'creature' | 'partyMember' | 'companion' | 'hazard';

export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export type CreatureRarity = 'common' | 'uncommon' | 'rare' | 'unique';

export type AttackType = 'melee' | 'ranged';

export interface DamageComponent {
  dice?: number;
  dieSize?: number;
  bonus?: number;
  type: string;
  persistent?: boolean;
  conditional?: string;
}

export interface Attack {
  name: string;
  type: AttackType;
  modifier: number;
  traits: string[];
  damage: DamageComponent[];
  effects?: string[];
}

export type ActionCost = 1 | 2 | 3 | 'free' | 'reaction';

export interface Ability {
  name: string;
  actions?: ActionCost;
  traits?: string[];
  trigger?: string;
  frequency?: string;
  requirements?: string;
  description: string;
}

export type SpellTradition = 'arcane' | 'divine' | 'occult' | 'primal';

export type SpellcastingType = 'prepared' | 'spontaneous' | 'innate' | 'focus';

export type SpellFrequency = { type: 'atWill' } | { type: 'constant' } | { type: 'perDay'; uses: number };

export interface SpellListEntry {
  spellSlug: string;
  name: string;
  level: number;
  isCantrip?: boolean;
  frequency?: SpellFrequency;
  count?: number;
}

export interface SpellcastingBlock {
  blockId: string;
  name: string;
  tradition: SpellTradition;
  type: SpellcastingType;
  dc: number;
  attackModifier?: number;
  focusPoints?: number;
  slots?: Record<number, number>;
  entries: SpellListEntry[];
}

export interface CombatantSpellcasting extends SpellcastingBlock {
  usedSlots?: Record<number, number>;
  usedFocusPoints?: number;
  usedEntries?: Record<string, number>;
}

export interface Creature {
  id: string;
  name: string;
  level: number;
  traits: string[];
  size: CreatureSize;
  alignment?: string;
  rarity: CreatureRarity;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  hp: number;
  immunities: string[];
  resistances: { type: string; value: number }[];
  weaknesses: { type: string; value: number }[];
  speed: Record<string, number>;
  attacks: Attack[];
  spellcasting?: SpellcastingBlock[];
  passiveAbilities: Ability[];
  reactiveAbilities: Ability[];
  activeAbilities: Ability[];
  skills: Record<string, number>;
  source?: string;
  tags: string[];
  notes?: string;
}

export type Duration =
  | { type: 'untilTurnEnd'; combatantId: CombatantId }
  | { type: 'untilTurnStart'; combatantId: CombatantId }
  | { type: 'rounds'; count: number }
  | { type: 'unlimited' }
  | { type: 'conditional'; description: string };

export interface AppliedEffect {
  instanceId: string;
  effectId: string;
  value?: number;
  sourceId?: CombatantId;
  sourceLabel?: string;
  parentInstanceId?: string;
  duration: Duration;
  note?: string;
}

export interface CombatantState {
  id: CombatantId;
  creatureId: string;
  name: string;
  sourceType: SourceType;
  masterId?: CombatantId;
  baseStats: CreatureBaseStats;
  currentHp: number;
  tempHp: number;
  appliedEffects: AppliedEffect[];
  reactionUsedThisRound: boolean;
  isAlive: boolean;
  notes?: string;
  attacks: Attack[];
  passiveAbilities: Ability[];
  reactiveAbilities: Ability[];
  activeAbilities: Ability[];
  spellcasting?: CombatantSpellcasting[];
  traits?: string[];
  size?: CreatureSize;
  level?: number;
  templateAdjustment?: 'elite' | 'weak';
}

export type PromptBoundary = { type: 'turnStart' | 'turnEnd'; ownerId: CombatantId };

export interface Prompt {
  id: string;
  boundary: PromptBoundary;
  targetId: CombatantId;
  effectInstanceId: string;
  effectName: string;
  description: string;
  suggestionType: TurnBoundarySuggestion;
  currentValue?: number;
  suggestedValue?: number;
}

export interface LogEntry {
  id: string;
  message: string;
}

export interface EncounterState {
  id: string;
  name: string;
  phase: EncounterPhase;
  round: number;
  initiative: InitiativeState;
  combatants: Record<CombatantId, CombatantState>;
  pendingPrompts: Prompt[];
  turnResolution?: TurnResolutionContinuation;
  combatLog: LogEntry[];
}

interface BaseCommand<TType extends CommandType, TPayload> {
  id: string;
  type: TType;
  payload: TPayload;
}

export interface ApplyEffectPayload {
  effectId: string;
  targetId: CombatantId;
  sourceId?: CombatantId;
  /**
   * Only allowed for value effects. Omitted value effects default to 1;
   * provided values must be integers >= 1.
   */
  value?: number;
  duration?: Duration;
  note?: string;
}

export interface RemoveEffectPayload {
  targetId: CombatantId;
  instanceId: string;
}

export interface SetEffectValuePayload {
  targetId: CombatantId;
  instanceId: string;
  newValue: number;
}

export interface ModifyEffectValuePayload {
  targetId: CombatantId;
  instanceId: string;
  delta: number;
}

export interface SetEffectDurationPayload {
  targetId: CombatantId;
  instanceId: string;
  newDuration: Duration;
}

export type PromptResolution =
  | { type: 'accept' }
  | { type: 'setValue'; value: number }
  | { type: 'dismiss' }
  | { type: 'remove' };

export interface ResolvePromptPayload {
  promptId: string;
  resolution: PromptResolution;
}

export interface TurnResolutionContinuation {
  type: 'advanceAfterTurnEnd';
  startIndex: number;
}

export type Command =
  | BaseCommand<'START_ENCOUNTER', Record<string, never>>
  | BaseCommand<'COMPLETE_ENCOUNTER', Record<string, never>>
  | BaseCommand<'RESET_ENCOUNTER', Record<string, never>>
  | BaseCommand<'ADD_COMBATANT', { combatant: CombatantState }>
  | BaseCommand<'REMOVE_COMBATANT', { combatantId: CombatantId }>
  | BaseCommand<'RENAME_COMBATANT', { combatantId: CombatantId; newName: string }>
  | BaseCommand<'SET_INITIATIVE_ORDER', { order: CombatantId[] }>
  | BaseCommand<'REORDER_COMBATANT', { combatantId: CombatantId; newIndex: number }>
  | BaseCommand<'END_TURN', Record<string, never>>
  | BaseCommand<'DELAY', Record<string, never>>
  | BaseCommand<'RESUME_FROM_DELAY', { combatantId: CombatantId; insertIndex: number }>
  | BaseCommand<'APPLY_DAMAGE', { combatantId: CombatantId; amount: number; damageType?: string }>
  | BaseCommand<'APPLY_HEALING', { combatantId: CombatantId; amount: number }>
  | BaseCommand<'SET_TEMP_HP', { combatantId: CombatantId; amount: number }>
  | BaseCommand<'SET_HP', { combatantId: CombatantId; amount: number }>
  | BaseCommand<'APPLY_EFFECT', ApplyEffectPayload>
  | BaseCommand<'REMOVE_EFFECT', RemoveEffectPayload>
  | BaseCommand<'SET_EFFECT_VALUE', SetEffectValuePayload>
  | BaseCommand<'MODIFY_EFFECT_VALUE', ModifyEffectValuePayload>
  | BaseCommand<'SET_EFFECT_DURATION', SetEffectDurationPayload>
  | BaseCommand<'USE_SPELL_SLOT', Record<string, unknown>>
  | BaseCommand<'RESTORE_SPELL_SLOT', Record<string, unknown>>
  | BaseCommand<'USE_FOCUS_POINT', Record<string, unknown>>
  | BaseCommand<'RESTORE_FOCUS_POINT', Record<string, unknown>>
  | BaseCommand<'USE_INNATE_SPELL', Record<string, unknown>>
  | BaseCommand<'RESTORE_INNATE_SPELL', Record<string, unknown>>
  | BaseCommand<'SET_SPELL_SLOT_USAGE', Record<string, unknown>>
  | BaseCommand<'SET_FOCUS_USAGE', Record<string, unknown>>
  | BaseCommand<'SET_INNATE_USAGE', Record<string, unknown>>
  | BaseCommand<'RESET_SPELL_BLOCK', Record<string, unknown>>
  | BaseCommand<'RESOLVE_PROMPT', ResolvePromptPayload>
  | BaseCommand<'MARK_REACTION_USED', { combatantId: CombatantId }>
  | BaseCommand<'RESET_REACTION', { combatantId: CombatantId }>
  | BaseCommand<'SET_NOTE', { combatantId: CombatantId; note: string | null }>
  | BaseCommand<'MARK_DEAD', { combatantId: CombatantId }>
  | BaseCommand<'REVIVE', { combatantId: CombatantId }>;

export type CommandType =
  | 'START_ENCOUNTER'
  | 'COMPLETE_ENCOUNTER'
  | 'RESET_ENCOUNTER'
  | 'ADD_COMBATANT'
  | 'REMOVE_COMBATANT'
  | 'RENAME_COMBATANT'
  | 'SET_INITIATIVE_ORDER'
  | 'REORDER_COMBATANT'
  | 'END_TURN'
  | 'DELAY'
  | 'RESUME_FROM_DELAY'
  | 'APPLY_DAMAGE'
  | 'APPLY_HEALING'
  | 'SET_TEMP_HP'
  | 'SET_HP'
  | 'APPLY_EFFECT'
  | 'REMOVE_EFFECT'
  | 'SET_EFFECT_VALUE'
  | 'MODIFY_EFFECT_VALUE'
  | 'SET_EFFECT_DURATION'
  | 'USE_SPELL_SLOT'
  | 'RESTORE_SPELL_SLOT'
  | 'USE_FOCUS_POINT'
  | 'RESTORE_FOCUS_POINT'
  | 'USE_INNATE_SPELL'
  | 'RESTORE_INNATE_SPELL'
  | 'SET_SPELL_SLOT_USAGE'
  | 'SET_FOCUS_USAGE'
  | 'SET_INNATE_USAGE'
  | 'RESET_SPELL_BLOCK'
  | 'RESOLVE_PROMPT'
  | 'MARK_REACTION_USED'
  | 'RESET_REACTION'
  | 'SET_NOTE'
  | 'MARK_DEAD'
  | 'REVIVE';

export type DomainEvent =
  | { type: 'encounter-started' }
  | { type: 'encounter-completed' }
  | { type: 'encounter-reset' }
  | { type: 'phase-changed'; from: EncounterPhase; to: EncounterPhase }
  | { type: 'round-started'; round: number }
  | { type: 'all-combatants-dead' }
  | { type: 'combatant-added'; combatantId: CombatantId; name: string; sourceType: SourceType; masterId?: CombatantId }
  | { type: 'combatant-removed'; combatantId: CombatantId; name: string }
  | { type: 'combatant-renamed'; combatantId: CombatantId; oldName: string; newName: string }
  | { type: 'initiative-set'; order: CombatantId[] }
  | { type: 'initiative-changed'; combatantId: CombatantId; newIndex: number }
  | { type: 'combatant-delayed'; combatantId: CombatantId }
  | { type: 'combatant-resumed-from-delay'; combatantId: CombatantId; insertIndex: number }
  | { type: 'turn-started'; combatantId: CombatantId; round: number }
  | { type: 'turn-ended'; combatantId: CombatantId }
  | { type: 'combatant-died'; combatantId: CombatantId; cause: 'marked-dead' | 'dying-threshold' }
  | { type: 'combatant-revived'; combatantId: CombatantId }
  | { type: 'reaction-used'; combatantId: CombatantId }
  | { type: 'reaction-reset'; combatantId: CombatantId; cause: 'auto' | 'manual' }
  | { type: 'note-changed'; combatantId: CombatantId }
  | {
      type: 'effect-applied';
      combatantId: CombatantId;
      effectId: string;
      effectName: string;
      instanceId: string;
      value?: number;
      parentInstanceId?: string;
    }
  | {
      type: 'effect-removed';
      combatantId: CombatantId;
      effectId: string;
      effectName: string;
      instanceId: string;
      reason: 'removed' | 'expired' | 'cascade' | 'auto-decremented';
      parentInstanceId?: string;
    }
  | {
      type: 'effect-value-changed';
      combatantId: CombatantId;
      effectId: string;
      effectName: string;
      instanceId: string;
      from: number;
      to: number;
    }
  | {
      type: 'effect-duration-changed';
      combatantId: CombatantId;
      effectId: string;
      effectName: string;
      instanceId: string;
    }
  | {
      type: 'prompt-generated';
      promptId: string;
      boundary: PromptBoundary;
      targetId: CombatantId;
      effectInstanceId: string;
      effectName: string;
      suggestionType: TurnBoundarySuggestion['type'];
      description: string;
    }
  | { type: 'prompt-resolved'; promptId: string; resolution: PromptResolution }
  | {
      type: 'hp-changed';
      combatantId: CombatantId;
      hpFrom: number;
      hpTo: number;
      tempHpFrom: number;
      tempHpTo: number;
      cause: 'damage' | 'healing' | 'set' | 'set-temp';
      damageType?: string;
    }
  | { type: 'hp-reached-zero'; combatantId: CombatantId }
  | { type: 'command-rejected'; commandType: CommandType; reason: string };

export type EffectCategory = 'condition' | 'spell' | 'affliction' | 'persistent-damage' | 'custom';

export type BonusType = 'status' | 'circumstance' | 'item' | 'untyped';

export type StatTarget =
  | 'ac'
  | 'fortitude'
  | 'reflex'
  | 'will'
  | 'allSaves'
  | 'perception'
  | 'attackRolls'
  | 'allDCs'
  | 'allSkills'
  | 'strSkills'
  | 'dexSkills'
  | 'intSkills'
  | 'wisSkills'
  | 'chaSkills'
  | 'mentalSkills'
  | (string & {});

export interface Modifier {
  stat: StatTarget;
  bonusType: BonusType;
  value: ModifierValue;
}

export type ModifierValue = number | { kind: 'effectValue'; sign: 1 | -1 };

export interface AppliedModifier {
  effectId: string;
  instanceId: string;
  sourceName: string;
  bonusType: BonusType;
  value: number;
  suppressed: boolean;
}

export interface ComputedStat {
  base: number;
  final: number;
  modifiers: AppliedModifier[];
}

export interface ComputedModifierBucket {
  total: number;
  modifiers: AppliedModifier[];
}

export interface ComputedStats {
  ac: ComputedStat;
  fortitude: ComputedStat;
  reflex: ComputedStat;
  will: ComputedStat;
  perception: ComputedStat;
  skills: Record<string, ComputedStat>;
  attackRolls: ComputedModifierBucket;
  allDCs: ComputedModifierBucket;
}

export type TurnBoundarySuggestion =
  | { type: 'suggestDecrement'; amount: number; description?: string }
  | { type: 'suggestRemove'; description: string }
  | { type: 'confirmSustained'; description?: string }
  | { type: 'promptResolution'; description: string }
  | { type: 'reminder'; description: string };

export interface EffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description?: string;
  modifiers: Modifier[];
  hasValue: boolean;
  maxValue?: number;
  impliedEffects?: string[];
  turnStartSuggestion?: TurnBoundarySuggestion;
  turnEndSuggestion?: TurnBoundarySuggestion;
  persistAfterEncounter?: boolean;
  traits?: string[];
}

export type EffectLibrary = Record<string, EffectDefinition>;

export interface CommandResult {
  newState: EncounterState;
  events: DomainEvent[];
}
