import { expect } from 'vitest';
import type {
  CombatantId,
  CombatantState,
  Command,
  CommandResult,
  CommandType,
  DomainEvent,
  EffectLibrary,
  EncounterState,
  Prompt,
  TurnBoundarySuggestion
} from './types';

export const emptyEffects: EffectLibrary = {};

export function command<T extends Command['type']>(
  type: T,
  payload?: Extract<Command, { type: T }>['payload']
): Extract<Command, { type: T }> {
  return { id: `cmd-${type}`, type, payload: payload ?? {} } as Extract<Command, { type: T }>;
}

export interface PromptOverrides {
  id?: string;
  boundaryType?: 'turnStart' | 'turnEnd';
  ownerId?: CombatantId;
  targetId?: CombatantId;
  effectInstanceId?: string;
  effectName?: string;
  description?: string;
  suggestionType?: TurnBoundarySuggestion;
  currentValue?: number;
  suggestedValue?: number;
}

export function prompt(overrides: PromptOverrides = {}): Prompt {
  return {
    id: overrides.id ?? 'prompt-1',
    boundary: {
      type: overrides.boundaryType ?? 'turnEnd',
      ownerId: overrides.ownerId ?? 'goblin-1'
    },
    targetId: overrides.targetId ?? overrides.ownerId ?? 'goblin-1',
    effectInstanceId: overrides.effectInstanceId ?? 'instance-1',
    effectName: overrides.effectName ?? 'Frightened',
    description: overrides.description ?? 'Frightened decreases by 1 at end of turn.',
    suggestionType: overrides.suggestionType ?? { type: 'reminder', description: 'Resolve pending save.' },
    currentValue: overrides.currentValue,
    suggestedValue: overrides.suggestedValue
  };
}

export function combatant(id: string, overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    id,
    creatureId: `${id}-creature`,
    name: id,
    sourceType: 'creature',
    baseStats: {
      hp: 20,
      ac: 16,
      fortitude: 7,
      reflex: 8,
      will: 5,
      perception: 6,
      speed: 25,
      skills: {}
    },
    currentHp: 20,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    ...overrides
  };
}

export function encounter(overrides: Partial<EncounterState> = {}): EncounterState {
  return {
    id: 'encounter-1',
    name: 'Test Encounter',
    phase: 'PREPARING',
    round: 0,
    initiative: {
      order: [],
      currentIndex: -1,
      delaying: []
    },
    combatants: {},
    pendingPrompts: [],
    combatLog: [],
    ...overrides
  };
}

export function preparingEncounter(overrides: Partial<EncounterState> = {}): EncounterState {
  const combatants = fixtureCombatants();

  return encounter({
    combatants,
    initiative: {
      order: Object.keys(combatants),
      currentIndex: -1,
      delaying: []
    },
    ...overrides
  });
}

export function activeEncounter(overrides: Partial<EncounterState> = {}): EncounterState {
  return preparingEncounter({
    phase: 'ACTIVE',
    round: 1,
    initiative: {
      order: ['goblin-1', 'fighter-1'],
      currentIndex: 0,
      delaying: []
    },
    ...overrides
  });
}

export function resolvingEncounter(overrides: Partial<EncounterState> = {}): EncounterState {
  return activeEncounter({
    phase: 'RESOLVING',
    pendingPrompts: [
      {
        id: 'prompt-1',
        boundary: { type: 'turnStart', ownerId: 'goblin-1' },
        targetId: 'goblin-1',
        effectInstanceId: 'effect-1',
        effectName: 'Test Effect',
        description: 'Resolve pending save',
        suggestionType: { type: 'reminder', description: 'Resolve pending save' }
      }
    ],
    ...overrides
  });
}

export function completedEncounter(overrides: Partial<EncounterState> = {}): EncounterState {
  return activeEncounter({
    phase: 'COMPLETED',
    initiative: {
      order: ['goblin-1', 'fighter-1'],
      currentIndex: 1,
      delaying: []
    },
    ...overrides
  });
}

export function expectEvents(actual: CommandResult | DomainEvent[], expected: DomainEvent[]): void {
  const events = Array.isArray(actual) ? actual : actual.events;

  expect(events).toEqual(expected);
  expectSerializable(events);
}

export function expectRejected(
  result: CommandResult,
  commandType: CommandType,
  reason: string,
  unchangedState?: EncounterState
): void {
  if (unchangedState) {
    expect(result.newState).toBe(unchangedState);
  }

  expectEvents(result, [{ type: 'command-rejected', commandType, reason }]);
}

export function expectSerializable<T>(value: T): T {
  const serialized = JSON.stringify(value);
  expect(serialized).toBeTypeOf('string');

  const parsed = JSON.parse(serialized) as T;
  expect(parsed).toEqual(value);

  return parsed;
}

function fixtureCombatants(): Record<string, CombatantState> {
  return {
    'goblin-1': combatant('goblin-1', { name: 'Goblin Warrior' }),
    'fighter-1': combatant('fighter-1', { name: 'Fighter' })
  };
}
