import { describe, expect, test } from 'vitest';
import type { AppliedEffect, EncounterState } from '../types';
import { applyCommand } from '../reducer';
import { effectLibrary } from '../effects/library';
import { combatant, command, encounter, expectRejected, expectSerializable } from '../test-support';

function applied(overrides: Partial<AppliedEffect> & Pick<AppliedEffect, 'instanceId' | 'effectId'>): AppliedEffect {
  return { duration: { type: 'unlimited' }, ...overrides };
}

function minionEncounter(overrides: Partial<EncounterState> = {}): EncounterState {
  return encounter({
    phase: 'ACTIVE',
    round: 1,
    combatants: {
      'pc-1': combatant('pc-1', { sourceType: 'partyMember' }),
      'wolf-1': combatant('wolf-1', { sourceType: 'companion', masterId: 'pc-1' }),
      'goblin-1': combatant('goblin-1')
    },
    initiative: { order: ['pc-1', 'goblin-1'], currentIndex: 0, scores: {} },
    ...overrides
  });
}

describe('ADD_COMBATANT minion validation (spec §8.4)', () => {
  test('rejects a minion whose master is not in the encounter', () => {
    const state = encounter({
      phase: 'PREPARING',
      combatants: {}
    });
    const result = applyCommand(
      state,
      command('ADD_COMBATANT', {
        combatant: combatant('wolf-1', { masterId: 'missing' })
      }),
      effectLibrary
    );
    expectRejected(result, 'ADD_COMBATANT', 'Master combatant missing not found');
  });

  test('rejects a minion chained under another minion', () => {
    const state = minionEncounter({ phase: 'PREPARING' });
    const result = applyCommand(
      state,
      command('ADD_COMBATANT', {
        combatant: combatant('pup-1', { masterId: 'wolf-1' })
      }),
      effectLibrary
    );
    expectRejected(result, 'ADD_COMBATANT', 'Master combatant wolf-1 is itself a minion');
  });

  test('accepts a minion with a valid master and tags the event', () => {
    const state = minionEncounter({ phase: 'PREPARING' });
    const result = applyCommand(
      state,
      command('ADD_COMBATANT', {
        combatant: combatant('owl-1', { masterId: 'pc-1' })
      }),
      effectLibrary
    );
    expect(result.events).toEqual([
      expect.objectContaining({ type: 'combatant-added', combatantId: 'owl-1', masterId: 'pc-1' })
    ]);
    expectSerializable(result);
  });
});

describe('SET_INITIATIVE_ORDER minion exclusion (spec §4.4)', () => {
  test('rejects an order containing a minion', () => {
    const state = minionEncounter({ phase: 'PREPARING' });
    const result = applyCommand(
      state,
      command('SET_INITIATIVE_ORDER', { order: ['pc-1', 'wolf-1', 'goblin-1'] }),
      effectLibrary
    );
    expectRejected(
      result,
      'SET_INITIATIVE_ORDER',
      'Combatant wolf-1 is a minion and cannot be placed in initiative'
    );
  });
});

describe('REMOVE_COMBATANT cascade (spec §9.1)', () => {
  test('removing a master removes its minions too', () => {
    const state = minionEncounter();
    const result = applyCommand(state, command('REMOVE_COMBATANT', { combatantId: 'pc-1' }), effectLibrary);

    expect(Object.keys(result.newState.combatants)).toEqual(['goblin-1']);
    expect(result.newState.initiative.order).toEqual(['goblin-1']);
    expect(result.events.map((e) => e.type === 'combatant-removed' && e.combatantId)).toEqual([
      'pc-1',
      'wolf-1'
    ]);
  });

  test('removing a minion leaves the master untouched', () => {
    const state = minionEncounter();
    const result = applyCommand(state, command('REMOVE_COMBATANT', { combatantId: 'wolf-1' }), effectLibrary);

    expect(Object.keys(result.newState.combatants).sort()).toEqual(['goblin-1', 'pc-1']);
    expect(result.newState.initiative.order).toEqual(['pc-1', 'goblin-1']);
  });
});

describe('minion turn-boundary processing (spec §2.3)', () => {
  test("a minion's turn-end suggestion prompts at the master's END_TURN, targeting the minion", () => {
    const state = minionEncounter({
      combatants: {
        'pc-1': combatant('pc-1', { sourceType: 'partyMember' }),
        'wolf-1': combatant('wolf-1', {
          sourceType: 'companion',
          masterId: 'pc-1',
          appliedEffects: [applied({ instanceId: 'f-1', effectId: 'frightened', value: 2 })]
        }),
        'goblin-1': combatant('goblin-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState.phase).toBe('RESOLVING');
    expect(result.newState.pendingPrompts).toEqual([
      expect.objectContaining({ targetId: 'wolf-1', effectName: 'Frightened' })
    ]);
    expectSerializable(result);
  });

  test("a dead minion's effects stay silent at the master's boundary", () => {
    const state = minionEncounter({
      combatants: {
        'pc-1': combatant('pc-1', { sourceType: 'partyMember' }),
        'wolf-1': combatant('wolf-1', {
          sourceType: 'companion',
          masterId: 'pc-1',
          isAlive: false,
          appliedEffects: [applied({ instanceId: 'f-1', effectId: 'frightened', value: 2 })]
        }),
        'goblin-1': combatant('goblin-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.pendingPrompts).toEqual([]);
  });

  test("a duration anchored to the minion expires at the master's turn end", () => {
    const state = minionEncounter({
      combatants: {
        'pc-1': combatant('pc-1', { sourceType: 'partyMember' }),
        'wolf-1': combatant('wolf-1', {
          sourceType: 'companion',
          masterId: 'pc-1',
          appliedEffects: [
            applied({
              instanceId: 'g-1',
              effectId: 'grabbed',
              duration: { type: 'untilTurnEnd', combatantId: 'wolf-1' }
            })
          ]
        }),
        'goblin-1': combatant('goblin-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState.combatants['wolf-1'].appliedEffects).toEqual([]);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'effect-removed', combatantId: 'wolf-1', reason: 'expired' })
    );
  });

  test("rounds anchored to the minion tick down at the master's boundary", () => {
    const state = minionEncounter({
      combatants: {
        'pc-1': combatant('pc-1', { sourceType: 'partyMember' }),
        'wolf-1': combatant('wolf-1', {
          sourceType: 'companion',
          masterId: 'pc-1',
          appliedEffects: [
            applied({
              instanceId: 'b-1',
              effectId: 'blinded',
              duration: { type: 'rounds', count: 2, anchorId: 'wolf-1', expiry: 'turnEnd' }
            })
          ]
        }),
        'goblin-1': combatant('goblin-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    const effect = result.newState.combatants['wolf-1'].appliedEffects[0];
    expect(effect.duration).toEqual({ type: 'rounds', count: 1, anchorId: 'wolf-1', expiry: 'turnEnd' });
  });
});
