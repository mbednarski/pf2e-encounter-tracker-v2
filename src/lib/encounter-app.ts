import {
  applyCommand,
  createCombatantFromCreature,
  createCombatantFromPartyMember,
  effectLibrary
} from '../domain';
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
  EncounterState,
  LogEntry,
  PartyMember
} from '../domain';
import { formatEvents } from './combat-log/format';

/** Maximum number of log entries retained on EncounterState.combatLog. Older entries are dropped. */
export const COMBAT_LOG_CAP = 200;

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
  severity: 'info' | 'warn' | 'success';
  message: string;
}

export interface DispatchResult {
  state: EncounterState;
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
    sourceId: `${input.id}-manual`,
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

export interface PartyMemberCombatantInput {
  partyMember: PartyMember;
  combatantId: string;
  name?: string;
}

export function makePartyMemberCombatant(input: PartyMemberCombatantInput): CombatantState {
  return createCombatantFromPartyMember({
    partyMember: input.partyMember,
    combatantId: input.combatantId,
    name: input.name
  });
}

export function toCommand<T extends CommandType>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'] | undefined,
  id: string
): Extract<Command, { type: T }> {
  return { id, type, payload: payload ?? {} } as Extract<Command, { type: T }>;
}

export function dispatchEncounterCommand(state: EncounterState, command: Command): DispatchResult {
  const result = applyCommand(state, command, effectLibrary);
  const newEntries = formatEvents(result.events, {
    commandId: command.id,
    state: result.newState
  });

  if (newEntries.length === 0) {
    return { state: result.newState, events: result.events };
  }

  const merged = [...result.newState.combatLog, ...newEntries];
  const cappedLog: LogEntry[] =
    merged.length > COMBAT_LOG_CAP ? merged.slice(merged.length - COMBAT_LOG_CAP) : merged;

  return {
    state: { ...result.newState, combatLog: cappedLog },
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

export type ConditionOptionValue =
  | { kind: 'valued'; defaultValue: number; maxValue?: number }
  | { kind: 'unvalued' };

export interface ConditionOption {
  id: string;
  name: string;
  value: ConditionOptionValue;
  description?: string;
}

export type AppliedEffectValue =
  | { kind: 'valued'; current: number; maxValue?: number }
  | { kind: 'unvalued' };

export type AppliedEffectSource =
  | { kind: 'direct' }
  | { kind: 'implied'; parentName: string };

export interface AppliedEffectView {
  instanceId: string;
  effectId: string;
  name: string;
  value: AppliedEffectValue;
  durationLabel: string;
  source: AppliedEffectSource;
}

export type ApplyConditionChoice =
  | { kind: 'valued'; effectId: string; value: number }
  | { kind: 'unvalued'; effectId: string };

export function listConditionDefinitions(): EffectDefinition[] {
  return Object.values(effectLibrary)
    .filter((definition) => definition.category === 'condition')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listConditionOptions(): ConditionOption[] {
  return listConditionDefinitions().map((definition) => ({
    id: definition.id,
    name: definition.name,
    value: definition.hasValue
      ? { kind: 'valued', defaultValue: 1, maxValue: definition.maxValue }
      : { kind: 'unvalued' },
    description: definition.description
  }));
}

// PF2e condition values are 1..maxValue. Non-finite or sub-1 input falls back to 1.
export function clampValue(value: number, maxValue: number | undefined): number {
  const integer = Number.isFinite(value) ? Math.trunc(value) : 1;
  const lowerBounded = Math.max(1, integer);
  return maxValue !== undefined ? Math.min(lowerBounded, maxValue) : lowerBounded;
}

export function resolveApplyChoice(option: ConditionOption, rawValue: number): ApplyConditionChoice {
  if (option.value.kind === 'unvalued') {
    return { kind: 'unvalued', effectId: option.id };
  }
  return {
    kind: 'valued',
    effectId: option.id,
    value: clampValue(rawValue, option.value.maxValue)
  };
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

  const value: AppliedEffectValue = definition?.hasValue
    ? { kind: 'valued', current: effect.value ?? 1, maxValue: definition.maxValue }
    : { kind: 'unvalued' };

  const source: AppliedEffectSource = effect.parentInstanceId
    ? { kind: 'implied', parentName: parentDefinition?.name ?? parent?.effectId ?? effect.parentInstanceId }
    : { kind: 'direct' };

  return {
    instanceId: effect.instanceId,
    effectId: effect.effectId,
    name: definition?.name ?? effect.effectId,
    value,
    durationLabel: formatDuration(effect.duration, state),
    source
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

function combatantName(state: EncounterState, combatantId: string): string {
  return state.combatants[combatantId]?.name ?? combatantId;
}
