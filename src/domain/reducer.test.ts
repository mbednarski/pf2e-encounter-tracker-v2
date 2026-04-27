import { describe, expect, test } from 'vitest';
import { applyCommand } from './reducer';
import type { CombatantState, Command, EncounterState } from './types';

const emptyEffects = {};

function command<T extends Command['type']>(
  type: T,
  payload?: Extract<Command, { type: T }>['payload']
): Extract<Command, { type: T }> {
  return { id: `cmd-${type}`, type, payload: payload ?? {} } as Extract<Command, { type: T }>;
}

function combatant(id: string, overrides: Partial<CombatantState> = {}): CombatantState {
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
    ...overrides
  };
}

function encounter(overrides: Partial<EncounterState> = {}): EncounterState {
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

describe('applyCommand lifecycle and initiative slice', () => {
  test('adds combatants and starts an encounter with the first turn active', () => {
    const first = combatant('goblin-1');
    const second = combatant('fighter-1');
    const withFirst = applyCommand(encounter(), command('ADD_COMBATANT', { combatant: first }), emptyEffects).newState;
    const withSecond = applyCommand(withFirst, command('ADD_COMBATANT', { combatant: second }), emptyEffects).newState;
    const ordered = applyCommand(
      withSecond,
      command('SET_INITIATIVE_ORDER', { order: ['goblin-1', 'fighter-1'] }),
      emptyEffects
    ).newState;

    const result = applyCommand(ordered, command('START_ENCOUNTER'), emptyEffects);

    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.round).toBe(1);
    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.events).toEqual([
      { type: 'encounter-started' },
      { type: 'phase-changed', from: 'PREPARING', to: 'ACTIVE' },
      { type: 'turn-started', combatantId: 'goblin-1', round: 1 }
    ]);
  });

  test('rejects starting an encounter without at least two combatants and initiative order', () => {
    const state = encounter({
      combatants: { 'goblin-1': combatant('goblin-1') },
      initiative: { order: ['goblin-1'], currentIndex: -1, delaying: [] }
    });

    const result = applyCommand(state, command('START_ENCOUNTER'), emptyEffects);

    expect(result.newState).toBe(state);
    expect(result.events).toEqual([
      {
        type: 'command-rejected',
        commandType: 'START_ENCOUNTER',
        reason: 'START_ENCOUNTER requires at least 2 combatants'
      }
    ]);
  });

  test('rejects initiative orders with duplicate, unknown, or dead combatants', () => {
    const state = encounter({
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false })
      }
    });

    expect(
      applyCommand(state, command('SET_INITIATIVE_ORDER', { order: ['goblin-1', 'goblin-1'] }), emptyEffects).events
    ).toEqual([
      { type: 'command-rejected', commandType: 'SET_INITIATIVE_ORDER', reason: 'Initiative order contains duplicate combatant goblin-1' }
    ]);
    expect(
      applyCommand(state, command('SET_INITIATIVE_ORDER', { order: ['missing-1'] }), emptyEffects).events
    ).toEqual([
      { type: 'command-rejected', commandType: 'SET_INITIATIVE_ORDER', reason: 'Combatant missing-1 not found' }
    ]);
    expect(
      applyCommand(state, command('SET_INITIATIVE_ORDER', { order: ['fallen-1'] }), emptyEffects).events
    ).toEqual([
      { type: 'command-rejected', commandType: 'SET_INITIATIVE_ORDER', reason: 'Combatant fallen-1 is not alive' }
    ]);
  });
});

describe('applyCommand HP slice', () => {
  test('damage consumes temporary HP before current HP and emits zero transition', () => {
    const state = encounter({
      combatants: {
        'goblin-1': combatant('goblin-1', { currentHp: 10, tempHp: 3 })
      }
    });

    const result = applyCommand(
      state,
      command('APPLY_DAMAGE', { combatantId: 'goblin-1', amount: 15, damageType: 'fire' }),
      emptyEffects
    );

    expect(result.newState.combatants['goblin-1'].currentHp).toBe(0);
    expect(result.newState.combatants['goblin-1'].tempHp).toBe(0);
    expect(result.events).toEqual([
      {
        type: 'hp-changed',
        combatantId: 'goblin-1',
        hpFrom: 10,
        hpTo: 0,
        tempHpFrom: 3,
        tempHpTo: 0,
        cause: 'damage',
        damageType: 'fire'
      },
      { type: 'hp-reached-zero', combatantId: 'goblin-1' }
    ]);
  });

  test('healing caps at max HP and set HP allows GM override above max', () => {
    const state = encounter({
      combatants: {
        'fighter-1': combatant('fighter-1', { currentHp: 12 })
      }
    });

    const healed = applyCommand(state, command('APPLY_HEALING', { combatantId: 'fighter-1', amount: 99 }), emptyEffects);
    const overridden = applyCommand(healed.newState, command('SET_HP', { combatantId: 'fighter-1', amount: 30 }), emptyEffects);

    expect(healed.newState.combatants['fighter-1'].currentHp).toBe(20);
    expect(overridden.newState.combatants['fighter-1'].currentHp).toBe(30);
    expect(overridden.events).toEqual([
      {
        type: 'hp-changed',
        combatantId: 'fighter-1',
        hpFrom: 20,
        hpTo: 30,
        tempHpFrom: 0,
        tempHpTo: 0,
        cause: 'set'
      }
    ]);
  });

  test('set temporary HP emits a full hp-changed event without changing current HP', () => {
    const state = encounter({
      combatants: {
        'fighter-1': combatant('fighter-1', { currentHp: 12, tempHp: 2 })
      }
    });

    const result = applyCommand(state, command('SET_TEMP_HP', { combatantId: 'fighter-1', amount: 5 }), emptyEffects);

    expect(result.newState.combatants['fighter-1'].currentHp).toBe(12);
    expect(result.newState.combatants['fighter-1'].tempHp).toBe(5);
    expect(result.events).toEqual([
      {
        type: 'hp-changed',
        combatantId: 'fighter-1',
        hpFrom: 12,
        hpTo: 12,
        tempHpFrom: 2,
        tempHpTo: 5,
        cause: 'set-temp'
      }
    ]);
  });
});
