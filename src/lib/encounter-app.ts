import {
  applyCommand,
  createCombatantFromCreature,
  createCombatantFromHazard,
  createCombatantFromPartyMember,
  deriveStats,
  durationFromSpec,
  effectLibrary,
  getAdjustedView
} from '../domain';
import type {
  AppliedEffect,
  AppliedModifier,
  CombatantState,
  Command,
  CommandType,
  ComputedStats,
  Creature,
  CreatureTemplateAdjustment,
  DomainEvent,
  Duration,
  EffectDefinition,
  EffectLibrary,
  EncounterState,
  Hazard,
  LogEntry,
  PartyMember
} from '../domain';
import { formatEvents } from './combat-log/format';

/**
 * Runtime-imported effect definitions (the IndexedDB spell-effect library)
 * merged over the built-in library. Built-ins win on id collisions so imports
 * can never shadow core conditions. The registry only grows within a session:
 * deleting an effect from the stored library must not strand instances already
 * applied in the active encounter, whose reducer paths reject on missing
 * definitions.
 */
let registeredEffects: Record<string, EffectDefinition> = {};
let mergedEffectLibrary: EffectLibrary = effectLibrary;

export function registerLibraryEffects(effects: readonly EffectDefinition[]): void {
  if (effects.length === 0) return;
  for (const effect of effects) {
    registeredEffects[effect.id] = effect;
  }
  mergedEffectLibrary = { ...registeredEffects, ...effectLibrary };
}

export function activeEffectLibrary(): EffectLibrary {
  return mergedEffectLibrary;
}

export function getEffectDefinition(effectId: string): EffectDefinition | undefined {
  return mergedEffectLibrary[effectId];
}

export function __resetEffectRegistryForTests(): void {
  registeredEffects = {};
  mergedEffectLibrary = effectLibrary;
}

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
      scores: {}
    },
    combatants: {},
    pendingPrompts: [],
    combatLog: [],
    recentEffectIds: []
  };
}

export function makeCombatant(input: ManualCombatantInput): CombatantState {
  return {
    id: input.id,
    sourceId: `${input.id}-manual`,
    name: input.name,
    sourceType: 'creature',
    baseSnapshot: {
      level: 0,
      hp: input.maxHp,
      ac: input.ac,
      fortitude: input.fortitude,
      reflex: input.reflex,
      will: input.will,
      perception: input.perception,
      speed: input.speed,
      skills: {}
    },
    templateAdjustment: 'normal',
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

export interface HazardCombatantInput {
  hazard: Hazard;
  combatantId: string;
  name?: string;
}

export function makeHazardCombatant(input: HazardCombatantInput): CombatantState {
  return createCombatantFromHazard({
    hazard: input.hazard,
    combatantId: input.combatantId,
    name: input.name
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
  const result = applyCommand(state, command, mergedEffectLibrary);
  const rejected = result.events.some((event) => event.type === 'command-rejected');
  const entries = formatEvents(result.events, {
    commandId: command.id,
    state: result.newState
  }).map((entry) => (rejected ? entry : { ...entry, commandId: command.id }));
  return appendLogEntries(result.newState, result.events, entries);
}

function appendLogEntries(
  state: EncounterState,
  events: DomainEvent[],
  entries: LogEntry[]
): DispatchResult {
  if (entries.length === 0) {
    return { state, events };
  }
  const merged = [...state.combatLog, ...entries];
  const cappedLog: LogEntry[] =
    merged.length > COMBAT_LOG_CAP ? merged.slice(merged.length - COMBAT_LOG_CAP) : merged;
  return { state: { ...state, combatLog: cappedLog }, events };
}

// Appends a single log entry to encounter.combatLog without going through the
// reducer. Used for client-side dice rolls that don't (and shouldn't) mutate
// domain state. The entry id must be unique within the log; callers typically
// use a monotonic counter to guarantee that.
export function appendInfoLog(
  state: EncounterState,
  entryId: string,
  message: string,
  tone: LogEntry['tone'] = 'info'
): EncounterState {
  const entry: LogEntry = { id: entryId, message, tone };
  const merged = [...state.combatLog, entry];
  const cappedLog =
    merged.length > COMBAT_LOG_CAP ? merged.slice(merged.length - COMBAT_LOG_CAP) : merged;
  return { ...state, combatLog: cappedLog };
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

export type CombatantFaction = 'pc' | 'ally' | 'enemy' | 'hazard';

export function combatantFaction(combatant: CombatantState): CombatantFaction {
  switch (combatant.sourceType) {
    case 'partyMember':
      return 'pc';
    case 'companion':
      return 'ally';
    case 'hazard':
      return 'hazard';
    case 'creature':
    default:
      return 'enemy';
  }
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
  /** Human label for a spell effect's default duration, e.g. "1 round". */
  durationHint?: string;
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
  duration: Duration;
  durationLabel: string;
  note?: string;
  source: AppliedEffectSource;
}

export type ApplyConditionChoice =
  | { kind: 'valued'; effectId: string; value: number; note?: string }
  | { kind: 'unvalued'; effectId: string; note?: string };

export type EffectModalTab =
  | 'applied'
  | 'conditions'
  | 'persistent'
  | 'afflictions'
  | 'effects';

export function listConditionDefinitions(): EffectDefinition[] {
  return Object.values(mergedEffectLibrary)
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

export function resolveApplyChoice(
  option: ConditionOption,
  rawValue: number,
  note?: string
): ApplyConditionChoice {
  const trimmedNote = note?.trim() ? note : undefined;
  if (option.value.kind === 'unvalued') {
    return { kind: 'unvalued', effectId: option.id, note: trimmedNote };
  }
  return {
    kind: 'valued',
    effectId: option.id,
    value: clampValue(rawValue, option.value.maxValue),
    note: trimmedNote
  };
}

export function formatDuration(duration: Duration, state: EncounterState): string {
  switch (duration.type) {
    case 'unlimited':
      return 'unlimited';
    case 'rounds': {
      const base = duration.count === 1 ? '1 round' : `${duration.count} rounds`;
      return duration.anchorId
        ? `${base} (ticks on ${combatantName(state, duration.anchorId)}'s turn)`
        : base;
    }
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
  const definition = mergedEffectLibrary[effect.effectId];
  const parent = effect.parentInstanceId
    ? combatant.appliedEffects.find((candidate) => candidate.instanceId === effect.parentInstanceId)
    : undefined;
  const parentDefinition = parent ? mergedEffectLibrary[parent.effectId] : undefined;

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
    duration: effect.duration,
    durationLabel: formatDuration(effect.duration, state),
    note: effect.note,
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
  // Duration labels can outlive their combatant (e.g. the caster was removed);
  // a raw internal id would leak into the UI, so name the absence instead.
  return state.combatants[combatantId]?.name ?? 'a departed combatant';
}

export interface ConditionWedgeCounts {
  conditions: number;
  persistent: number;
  spells: number;
  afflictions: number;
}

export type ConditionWedgeCategory = keyof ConditionWedgeCounts;

export function listConditionWedgeCounts(): ConditionWedgeCounts {
  const counts: ConditionWedgeCounts = { conditions: 0, persistent: 0, spells: 0, afflictions: 0 };
  for (const definition of Object.values(mergedEffectLibrary)) {
    switch (definition.category) {
      case 'condition':
        counts.conditions++;
        break;
      case 'persistent-damage':
        counts.persistent++;
        break;
      case 'affliction':
        counts.afflictions++;
        break;
      case 'spell':
        counts.spells++;
        break;
    }
  }
  return counts;
}

export function listRecentConditionOptions(state: EncounterState): ConditionOption[] {
  const options: ConditionOption[] = [];
  for (const effectId of state.recentEffectIds) {
    const definition = mergedEffectLibrary[effectId];
    if (!definition) continue;
    options.push({
      id: definition.id,
      name: definition.name,
      value: definition.hasValue
        ? { kind: 'valued', defaultValue: 1, maxValue: definition.maxValue }
        : { kind: 'unvalued' },
      description: definition.description
    });
  }
  return options;
}

function definitionToOption(definition: EffectDefinition): ConditionOption {
  return {
    id: definition.id,
    name: definition.name,
    value: definition.hasValue
      ? { kind: 'valued', defaultValue: 1, maxValue: definition.maxValue }
      : { kind: 'unvalued' },
    description: definition.description,
    durationHint: durationSpecLabel(definition.defaultDuration)
  };
}

function durationSpecLabel(
  spec: EffectDefinition['defaultDuration']
): string | undefined {
  if (!spec || spec.unit === 'unlimited') return undefined;
  const value = spec.value ?? 1;
  const unit = value === 1 ? spec.unit.replace(/s$/, '') : spec.unit;
  return `${value} ${unit}${spec.sustained ? ', sustained' : ''}`;
}

function listOptionsByCategory(category: EffectDefinition['category']): ConditionOption[] {
  return Object.values(mergedEffectLibrary)
    .filter((definition) => definition.category === category)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(definitionToOption);
}

export function listPersistentDamageOptions(): ConditionOption[] {
  return listOptionsByCategory('persistent-damage');
}

export function listAfflictionOptions(): ConditionOption[] {
  return listOptionsByCategory('affliction');
}

export function listSpellEffectOptions(): ConditionOption[] {
  return listOptionsByCategory('spell');
}

/**
 * Spell-effect options built from the built-in library plus an explicit list
 * of imported effects. Unlike `listSpellEffectOptions` (which reads the
 * session registry and never forgets), this reflects deletions from the
 * stored library, so pass the live stored list from UI call sites.
 */
export function listSpellEffectOptionsFrom(
  importedEffects: readonly EffectDefinition[]
): ConditionOption[] {
  const seen = new Set<string>();
  const superseded = supersededBuiltinIds(importedEffects);
  const definitions: EffectDefinition[] = [];
  for (const definition of [...importedEffects, ...Object.values(effectLibrary)]) {
    if (definition.category !== 'spell' || seen.has(definition.id) || superseded.has(definition.id)) {
      continue;
    }
    seen.add(definition.id);
    definitions.push(definition);
  }
  return definitions.sort((a, b) => a.name.localeCompare(b.name)).map(definitionToOption);
}

/**
 * Indexes spell-effect definitions by the slug of the spell that grants them,
 * for spell-list matching in the details panel. Built-in spell effects use
 * their own id as the slug; imported Foundry effects carry `sourceSpellSlug`.
 * Takes the imported effects explicitly (rather than reading the registry) so
 * Svelte call sites recompute when the stored library changes.
 */
export function buildSpellEffectIndex(
  importedEffects: readonly EffectDefinition[]
): Record<string, EffectDefinition[]> {
  const index: Record<string, EffectDefinition[]> = {};
  const seenIds = new Set<string>();
  const superseded = supersededBuiltinIds(importedEffects);
  const add = (definition: EffectDefinition) => {
    if (definition.category !== 'spell' || seenIds.has(definition.id)) return;
    seenIds.add(definition.id);
    const slug = definition.sourceSpellSlug ?? definition.id;
    (index[slug] ??= []).push(definition);
  };
  for (const definition of importedEffects) add(definition);
  for (const definition of Object.values(effectLibrary)) {
    if (!superseded.has(definition.id)) add(definition);
  }
  return index;
}

/**
 * Built-in spell effects whose spell is also covered by an imported effect
 * (imported `sourceSpellSlug` equals the built-in's id). The imported Foundry
 * data is richer, so the built-in is hidden from pickers to avoid duplicate
 * same-name entries; it stays resolvable for already-applied instances.
 */
function supersededBuiltinIds(importedEffects: readonly EffectDefinition[]): Set<string> {
  const ids = new Set<string>();
  for (const definition of importedEffects) {
    if (definition.category !== 'spell' || !definition.sourceSpellSlug) continue;
    const builtin = effectLibrary[definition.sourceSpellSlug];
    if (builtin?.category === 'spell') ids.add(builtin.id);
  }
  return ids;
}

/**
 * The concrete duration an effect should get when applied. Spell effects use
 * their default duration anchored to the caster (or the target itself when
 * applied outside a cast flow); everything else keeps the legacy unlimited
 * default.
 */
export function defaultApplyDuration(effectId: string, anchorId: string): Duration {
  const definition = mergedEffectLibrary[effectId];
  if (!definition?.defaultDuration) return { type: 'unlimited' };
  return durationFromSpec(definition.defaultDuration, anchorId);
}

export interface ConditionGroup {
  label: string;
  options: ConditionOption[];
}

const CONDITION_GROUP_ORDER = [
  'Common',
  'Diminishment',
  'Detection',
  'Disabling',
  'Mental',
  'Other'
] as const;

type ConditionGroupLabel = (typeof CONDITION_GROUP_ORDER)[number];

// Maps condition id → group label. Anything not listed falls into 'Other'.
const CONDITION_GROUPS: Record<string, ConditionGroupLabel> = {
  'off-guard': 'Common',
  frightened: 'Common',
  sickened: 'Common',
  stunned: 'Common',
  slowed: 'Common',
  prone: 'Common',
  dying: 'Common',
  wounded: 'Common',

  clumsy: 'Diminishment',
  enfeebled: 'Diminishment',
  drained: 'Diminishment',
  stupefied: 'Diminishment',
  doomed: 'Diminishment',

  concealed: 'Detection',
  hidden: 'Detection',
  invisible: 'Detection',
  observed: 'Detection',
  undetected: 'Detection',
  unnoticed: 'Detection',

  paralyzed: 'Disabling',
  petrified: 'Disabling',
  unconscious: 'Disabling',
  restrained: 'Disabling',
  grabbed: 'Disabling',
  immobilized: 'Disabling',
  encumbered: 'Disabling',
  quickened: 'Disabling',

  confused: 'Mental',
  controlled: 'Mental',
  fascinated: 'Mental',
  fleeing: 'Mental',
  fatigued: 'Mental'
};

export function groupConditionsByCategory(): ConditionGroup[] {
  const buckets = new Map<ConditionGroupLabel, ConditionOption[]>();
  for (const label of CONDITION_GROUP_ORDER) buckets.set(label, []);

  for (const definition of listConditionDefinitions()) {
    const label: ConditionGroupLabel = CONDITION_GROUPS[definition.id] ?? 'Other';
    buckets.get(label)!.push(definitionToOption(definition));
  }

  return CONDITION_GROUP_ORDER
    .map((label) => ({ label, options: buckets.get(label) ?? [] }))
    .filter((group) => group.options.length > 0);
}

export interface RemovableEffectOption {
  instanceId: string;
  effectId: string;
  name: string;
  valueLabel?: string;
  durationLabel: string;
  source: AppliedEffectSource;
}

export function listRemovableEffects(
  combatant: CombatantState,
  state: EncounterState
): RemovableEffectOption[] {
  return combatant.appliedEffects
    .filter((effect) => !effect.parentInstanceId)
    .map((effect) => {
      const definition = mergedEffectLibrary[effect.effectId];
      const valueLabel =
        definition?.hasValue && typeof effect.value === 'number' ? String(effect.value) : undefined;
      return {
        instanceId: effect.instanceId,
        effectId: effect.effectId,
        name: definition?.name ?? effect.effectId,
        valueLabel,
        durationLabel: formatDuration(effect.duration, state),
        source: { kind: 'direct' as const }
      };
    });
}

export function computeCombatantStats(combatant: CombatantState): ComputedStats {
  return deriveStats(getAdjustedView(combatant), combatant.appliedEffects, mergedEffectLibrary);
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function formatModifierBreakdown(mods: readonly AppliedModifier[]): string {
  return mods
    .filter((m) => !m.suppressed)
    .map((m) => `${m.sourceName}: ${signed(m.value)} ${m.bonusType}`)
    .join('; ');
}

export function formatStatTooltip(
  base: number,
  final: number,
  mods: readonly AppliedModifier[]
): string {
  const active = mods.filter((m) => !m.suppressed);
  if (active.length === 0) return String(base);
  const parts = active.map((m) => `${signed(m.value)} ${m.sourceName}`).join(' ');
  return `${base} ${parts} = ${final}`;
}
