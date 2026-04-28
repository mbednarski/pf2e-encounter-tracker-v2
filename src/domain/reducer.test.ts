import { describe, expect, test } from 'vitest';
import { applyCommand } from './reducer';
import { combatant, command, emptyEffects, encounter, expectEvents, expectRejected } from './test-support';

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
    expectEvents(result, [
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

    expectRejected(result, 'START_ENCOUNTER', 'START_ENCOUNTER requires at least 2 combatants', state);
  });

  test('rejects initiative orders with duplicate, unknown, or dead combatants', () => {
    const state = encounter({
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false })
      }
    });

    expectRejected(
      applyCommand(state, command('SET_INITIATIVE_ORDER', { order: ['goblin-1', 'goblin-1'] }), emptyEffects),
      'SET_INITIATIVE_ORDER',
      'Initiative order contains duplicate combatant goblin-1',
      state
    );
    expectRejected(
      applyCommand(state, command('SET_INITIATIVE_ORDER', { order: ['missing-1'] }), emptyEffects),
      'SET_INITIATIVE_ORDER',
      'Combatant missing-1 not found',
      state
    );
    expectRejected(
      applyCommand(state, command('SET_INITIATIVE_ORDER', { order: ['fallen-1'] }), emptyEffects),
      'SET_INITIATIVE_ORDER',
      'Combatant fallen-1 is not alive',
      state
    );
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
    expectEvents(result, [
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
    expectEvents(overridden, [
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
    expectEvents(result, [
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
