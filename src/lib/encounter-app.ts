import { applyCommand, createCombatantFromCreature, effectLibrary } from '../domain';
import type {
  AppliedEffect,
  CombatantState,
  Command,
  CommandType,
  Creature,
  CreatureTemplateAdjustment,
  DomainEvent,
  Duration,
  EffectDefinition,
  EncounterState
} from '../domain';

export interface ManualCombatantInput {
  id: string;
  name: string;
  maxHp: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  speed: number;
}

export type TemplateAdjustmentChoice = 'normal' | CreatureTemplateAdjustment;

export interface CreatureCombatantInput {
  creature: Creature;
  combatantId: string;
  name?: string;
  adjustment: TemplateAdjustmentChoice;
}

export interface FeedbackEntry {
  id: string;
  commandId: string;
  severity: 'info' | 'warn';
  message: string;
}

export interface DispatchResult {
  state: EncounterState;
  feedback: FeedbackEntry[];
  events: DomainEvent[];
}

export function newEncounterState(): EncounterState {
  return {
    id: 'local-encounter',
    name: 'Local Encounter',
    phase: 'PREPARING',
    round: 0,
    initiative: {
      order: [],
      currentIndex: -1,
      delaying: []
    },
    combatants: {},
    pendingPrompts: [],
    combatLog: []
  };
}

export function makeCombatant(input: ManualCombatantInput): CombatantState {
  return {
    id: input.id,
    creatureId: `${input.id}-manual`,
    name: input.name,
    sourceType: 'creature',
    baseStats: {
      hp: input.maxHp,
      ac: input.ac,
      fortitude: input.fortitude,
      reflex: input.reflex,
      will: input.will,
      perception: input.perception,
      speed: input.speed,
      skills: {}
    },
    currentHp: input.maxHp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: []
  };
}

export function makeCreatureCombatant(input: CreatureCombatantInput): CombatantState {
  return createCombatantFromCreature({
    creature: input.creature,
    combatantId: input.combatantId,
    name: input.name,
    adjustment: input.adjustment === 'normal' ? undefined : input.adjustment
  });
}

export function toCommand<T extends CommandType>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'] | undefined,
  id: string
): Extract<Command, { type: T }> {
  return { id, type, payload: payload ?? {} } as Extract<Command, { type: T }>;
}

export function dispatchEncounterCommand(
  state: EncounterState,
  feedback: FeedbackEntry[],
  command: Command
): DispatchResult {
  const result = applyCommand(state, command, effectLibrary);
  const entry = formatFeedbackEntry(result.events, result.newState, command);

  return {
    state: result.newState,
    feedback: entry ? [...feedback, entry].slice(-12) : feedback,
    events: result.events
  };
}

export function currentCombatant(state: EncounterState): CombatantState | undefined {
  const currentId = state.initiative.order[state.initiative.currentIndex];
  return currentId ? state.combatants[currentId] : undefined;
}

export type CombatantVisualState = 'alive' | 'unconscious' | 'dead';

export function combatantVisualState(combatant: CombatantState): CombatantVisualState {
  if (!combatant.isAlive) return 'dead';
  if (combatant.currentHp === 0) return 'unconscious';
  return 'alive';
}

export interface CombatantCardActionAvailability {
  canEndTurn: boolean;
  canMarkReactionUsed: boolean;
  canMarkDead: boolean;
  canRevive: boolean;
}

export interface ConditionOption {
  id: string;
  name: string;
  hasValue: boolean;
  maxValue?: number;
  description?: string;
}

export interface AppliedEffectView {
  instanceId: string;
  effectId: string;
  name: string;
  hasValue: boolean;
  maxValue?: number;
  value?: number;
  durationLabel: string;
  isImplied: boolean;
  parentName?: string;
}

export function listConditionDefinitions(): EffectDefinition[] {
  return Object.values(effectLibrary)
    .filter((definition) => definition.category === 'condition')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listConditionOptions(): ConditionOption[] {
  return listConditionDefinitions().map((definition) => ({
    id: definition.id,
    name: definition.name,
    hasValue: definition.hasValue,
    maxValue: definition.maxValue,
    description: definition.description
  }));
}

export function formatDuration(duration: Duration, state: EncounterState): string {
  switch (duration.type) {
    case 'unlimited':
      return 'unlimited';
    case 'rounds':
      return duration.count === 1 ? '1 round' : `${duration.count} rounds`;
    case 'untilTurnEnd':
      return `until end of ${combatantName(state, duration.combatantId)}'s turn`;
    case 'untilTurnStart':
      return `until start of ${combatantName(state, duration.combatantId)}'s turn`;
    case 'conditional':
      return duration.description;
  }
}

export function viewAppliedEffects(
  combatant: CombatantState,
  state: EncounterState
): AppliedEffectView[] {
  return combatant.appliedEffects.map((effect) => toAppliedEffectView(effect, combatant, state));
}

function toAppliedEffectView(
  effect: AppliedEffect,
  combatant: CombatantState,
  state: EncounterState
): AppliedEffectView {
  const definition = effectLibrary[effect.effectId];
  const parent = effect.parentInstanceId
    ? combatant.appliedEffects.find((candidate) => candidate.instanceId === effect.parentInstanceId)
    : undefined;
  const parentDefinition = parent ? effectLibrary[parent.effectId] : undefined;

  return {
    instanceId: effect.instanceId,
    effectId: effect.effectId,
    name: definition?.name ?? effect.effectId,
    hasValue: definition?.hasValue ?? false,
    maxValue: definition?.maxValue,
    value: effect.value,
    durationLabel: formatDuration(effect.duration, state),
    isImplied: Boolean(effect.parentInstanceId),
    parentName: parentDefinition?.name ?? parent?.effectId
  };
}

export function combatantCardActions(
  state: EncounterState,
  combatantId: string
): CombatantCardActionAvailability {
  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return { canEndTurn: false, canMarkReactionUsed: false, canMarkDead: false, canRevive: false };
  }

  const phase = state.phase;
  const isCurrent = state.initiative.order[state.initiative.currentIndex] === combatantId;
  const inCombatPhase = phase === 'ACTIVE' || phase === 'RESOLVING';
  const inEditablePhase = phase === 'PREPARING' || inCombatPhase;

  return {
    canEndTurn: phase === 'ACTIVE' && isCurrent && combatant.isAlive,
    canMarkReactionUsed: inCombatPhase && combatant.isAlive && !combatant.reactionUsedThisRound,
    canMarkDead: inEditablePhase && combatant.isAlive,
    canRevive: inEditablePhase && !combatant.isAlive
  };
}

function formatFeedbackEntry(events: DomainEvent[], state: EncounterState, command: Command): FeedbackEntry | undefined {
  if (events.length === 0) {
    return undefined;
  }

  const rejected = events.find((event): event is Extract<DomainEvent, { type: 'command-rejected' }> => event.type === 'command-rejected');

  return {
    id: `log-${command.id}`,
    commandId: command.id,
    severity: rejected ? 'warn' : 'info',
    message: rejected ? `${rejected.commandType} rejected: ${rejected.reason}` : formatEvents(events, state)
  };
}

function formatEvents(events: DomainEvent[], state: EncounterState): string {
  const first = events[0];

  switch (first.type) {
    case 'combatant-added':
      return `${first.name} joined the encounter.`;
    case 'initiative-set':
      return `Initiative order set: ${first.order.map((id) => combatantName(state, id)).join(', ')}.`;
    case 'encounter-started': {
      const turnStarted = events.find((event): event is Extract<DomainEvent, { type: 'turn-started' }> => event.type === 'turn-started');
      return turnStarted
        ? `Encounter started. ${combatantName(state, turnStarted.combatantId)} starts round ${turnStarted.round}.`
        : 'Encounter started.';
    }
    case 'hp-changed': {
      const target = combatantName(state, first.combatantId);
      if (first.cause === 'damage') {
        return `${target} took ${first.hpFrom - first.hpTo + first.tempHpFrom - first.tempHpTo} damage.`;
      }
      if (first.cause === 'healing') {
        return `${target} healed ${first.hpTo - first.hpFrom} HP.`;
      }
      if (first.cause === 'set-temp') {
        return `${target} temp HP set to ${first.tempHpTo}.`;
      }
      return `${target} HP set to ${first.hpTo}.`;
    }
    case 'encounter-completed':
      return 'Encounter completed.';
    case 'encounter-reset':
      return 'Encounter reset.';
    default:
      return events.map((event) => event.type).join(', ');
  }
}

function combatantName(state: EncounterState, combatantId: string): string {
  return state.combatants[combatantId]?.name ?? combatantId;
}
