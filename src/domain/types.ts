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
}

export interface Prompt {
  id: string;
  combatantId: CombatantId;
  description: string;
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
  combatLog: LogEntry[];
}

interface BaseCommand<TType extends CommandType, TPayload> {
  id: string;
  type: TType;
  payload: TPayload;
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
  | BaseCommand<'APPLY_EFFECT', Record<string, unknown>>
  | BaseCommand<'REMOVE_EFFECT', Record<string, unknown>>
  | BaseCommand<'SET_EFFECT_VALUE', Record<string, unknown>>
  | BaseCommand<'MODIFY_EFFECT_VALUE', Record<string, unknown>>
  | BaseCommand<'SET_EFFECT_DURATION', Record<string, unknown>>
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
  | BaseCommand<'RESOLVE_PROMPT', Record<string, unknown>>
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
  | { type: 'turn-started'; combatantId: CombatantId; round: number }
  | { type: 'turn-ended'; combatantId: CombatantId }
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

export type EffectLibrary = Record<string, unknown>;

export interface CommandResult {
  newState: EncounterState;
  events: DomainEvent[];
}
