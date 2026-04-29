import { describe, expect, test } from 'vitest';
import { applyCommand } from './reducer';
import { activeEncounter, combatant, command, emptyEffects, encounter, expectEvents, expectRejected } from './test-support';

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

describe('applyCommand turn advancement slice', () => {
  test('ends the current turn and advances to the next live combatant', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fallen-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false }),
        'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
      }
    });

    const result = applyCommand(state, command('END_TURN'), emptyEffects);

    expect(result.newState.initiative.currentIndex).toBe(2);
    expect(result.newState.round).toBe(1);
    expect(result.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('wraps to the next round when advancement passes the end of initiative', () => {
    const state = activeEncounter({
      round: 3,
      initiative: {
        order: ['goblin-1', 'fallen-1', 'fighter-1'],
        currentIndex: 2,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1', { reactionUsedThisRound: true }),
        'fallen-1': combatant('fallen-1', { isAlive: false }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), emptyEffects);

    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.newState.round).toBe(4);
    expect(result.newState.combatants['goblin-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'fighter-1' },
      { type: 'reaction-reset', combatantId: 'goblin-1', cause: 'auto' },
      { type: 'round-started', round: 4 },
      { type: 'turn-started', combatantId: 'goblin-1', round: 4 }
    ]);
  });

  test('emits all-combatants-dead without completing the encounter when no live combatants remain', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1', { isAlive: false }),
        'fighter-1': combatant('fighter-1', { isAlive: false })
      }
    });

    const result = applyCommand(state, command('END_TURN'), emptyEffects);

    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.newState.round).toBe(1);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'all-combatants-dead' }
    ]);
  });

  test('rejects END_TURN when the current initiative pointer is invalid', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 8,
        delaying: []
      }
    });

    const result = applyCommand(state, command('END_TURN'), emptyEffects);

    expectRejected(result, 'END_TURN', 'END_TURN requires a valid current combatant', state);
  });
});

describe('applyCommand delay and resume slice', () => {
  test('delays the middle combatant and starts the next live turn', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1', 'cleric-1'],
        currentIndex: 1,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'cleric-1': combatant('cleric-1', { reactionUsedThisRound: true })
      }
    });

    const result = applyCommand(state, command('DELAY'), emptyEffects);

    expect(result.newState.initiative).toEqual({
      order: ['goblin-1', 'cleric-1'],
      currentIndex: 1,
      delaying: ['fighter-1']
    });
    expect(result.newState.round).toBe(1);
    expect(result.newState.combatants['cleric-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'fighter-1' },
      { type: 'combatant-delayed', combatantId: 'fighter-1' },
      { type: 'reaction-reset', combatantId: 'cleric-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'cleric-1', round: 1 }
    ]);
  });

  test('delays the first combatant without advancing the round', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1', 'cleric-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'cleric-1': combatant('cleric-1')
      }
    });

    const result = applyCommand(state, command('DELAY'), emptyEffects);

    expect(result.newState.initiative).toEqual({
      order: ['fighter-1', 'cleric-1'],
      currentIndex: 0,
      delaying: ['goblin-1']
    });
    expect(result.newState.round).toBe(1);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'combatant-delayed', combatantId: 'goblin-1' },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('delays the final combatant and wraps to the next round', () => {
    const state = activeEncounter({
      round: 4,
      initiative: {
        order: ['goblin-1', 'fighter-1', 'cleric-1'],
        currentIndex: 2,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1', { reactionUsedThisRound: true }),
        'fighter-1': combatant('fighter-1'),
        'cleric-1': combatant('cleric-1')
      }
    });

    const result = applyCommand(state, command('DELAY'), emptyEffects);

    expect(result.newState.initiative).toEqual({
      order: ['goblin-1', 'fighter-1'],
      currentIndex: 0,
      delaying: ['cleric-1']
    });
    expect(result.newState.round).toBe(5);
    expect(result.newState.combatants['goblin-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'cleric-1' },
      { type: 'combatant-delayed', combatantId: 'cleric-1' },
      { type: 'reaction-reset', combatantId: 'goblin-1', cause: 'auto' },
      { type: 'round-started', round: 5 },
      { type: 'turn-started', combatantId: 'goblin-1', round: 5 }
    ]);
  });

  test('delay skips dead combatants after removing the current combatant', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fallen-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false }),
        'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
      }
    });

    const result = applyCommand(state, command('DELAY'), emptyEffects);

    expect(result.newState.initiative).toEqual({
      order: ['fallen-1', 'fighter-1'],
      currentIndex: 1,
      delaying: ['goblin-1']
    });
    expect(result.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'combatant-delayed', combatantId: 'goblin-1' },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('rejects delay when the current initiative pointer is invalid', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: -1,
        delaying: []
      }
    });

    const result = applyCommand(state, command('DELAY'), emptyEffects);

    expectRejected(result, 'DELAY', 'DELAY requires a valid current combatant', state);
  });

  test('resumes a delaying combatant at the requested index and starts their turn', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'cleric-1'],
        currentIndex: 0,
        delaying: ['fighter-1']
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true }),
        'cleric-1': combatant('cleric-1')
      }
    });

    const result = applyCommand(
      state,
      command('RESUME_FROM_DELAY', { combatantId: 'fighter-1', insertIndex: 1 }),
      emptyEffects
    );

    expect(result.newState.initiative).toEqual({
      order: ['goblin-1', 'fighter-1', 'cleric-1'],
      currentIndex: 1,
      delaying: []
    });
    expect(result.newState.round).toBe(1);
    expect(result.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'combatant-resumed-from-delay', combatantId: 'fighter-1', insertIndex: 1 },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('resumes at the end of initiative with deterministic insertion', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'cleric-1'],
        currentIndex: 1,
        delaying: ['fighter-1', 'ranger-1']
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'cleric-1': combatant('cleric-1'),
        'ranger-1': combatant('ranger-1')
      }
    });

    const result = applyCommand(
      state,
      command('RESUME_FROM_DELAY', { combatantId: 'fighter-1', insertIndex: 2 }),
      emptyEffects
    );

    expect(result.newState.initiative).toEqual({
      order: ['goblin-1', 'cleric-1', 'fighter-1'],
      currentIndex: 2,
      delaying: ['ranger-1']
    });
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'cleric-1' },
      { type: 'combatant-resumed-from-delay', combatantId: 'fighter-1', insertIndex: 2 },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('rejects resume for combatants that are not delaying', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      }
    });

    const result = applyCommand(
      state,
      command('RESUME_FROM_DELAY', { combatantId: 'fighter-1', insertIndex: 1 }),
      emptyEffects
    );

    expectRejected(result, 'RESUME_FROM_DELAY', 'Combatant fighter-1 is not delaying', state);
  });

  test('rejects resume when the insert index is out of range', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'cleric-1'],
        currentIndex: 0,
        delaying: ['fighter-1']
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'cleric-1': combatant('cleric-1')
      }
    });

    const result = applyCommand(
      state,
      command('RESUME_FROM_DELAY', { combatantId: 'fighter-1', insertIndex: 3 }),
      emptyEffects
    );

    expectRejected(result, 'RESUME_FROM_DELAY', 'RESUME_FROM_DELAY insertIndex must be between 0 and 2', state);
  });
});

describe('applyCommand combat state slice', () => {
  test('marks and manually resets a combatant reaction', () => {
    const state = activeEncounter();

    const marked = applyCommand(state, command('MARK_REACTION_USED', { combatantId: 'fighter-1' }), emptyEffects);
    const reset = applyCommand(marked.newState, command('RESET_REACTION', { combatantId: 'fighter-1' }), emptyEffects);

    expect(marked.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(true);
    expectEvents(marked, [{ type: 'reaction-used', combatantId: 'fighter-1' }]);
    expect(reset.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(reset, [{ type: 'reaction-reset', combatantId: 'fighter-1', cause: 'manual' }]);
  });

  test('rejects reaction commands for invalid targets', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false })
      }
    });

    expectRejected(
      applyCommand(state, command('MARK_REACTION_USED', { combatantId: 'fallen-1' }), emptyEffects),
      'MARK_REACTION_USED',
      'Combatant fallen-1 is not alive',
      state
    );
    expectRejected(
      applyCommand(state, command('RESET_REACTION', { combatantId: 'missing-1' }), emptyEffects),
      'RESET_REACTION',
      'Combatant missing-1 not found',
      state
    );
  });

  test('sets and clears combatant notes', () => {
    const state = activeEncounter();

    const noted = applyCommand(state, command('SET_NOTE', { combatantId: 'goblin-1', note: 'Grabbed by the bridge.' }), emptyEffects);
    const cleared = applyCommand(noted.newState, command('SET_NOTE', { combatantId: 'goblin-1', note: null }), emptyEffects);

    expect(noted.newState.combatants['goblin-1'].notes).toBe('Grabbed by the bridge.');
    expectEvents(noted, [{ type: 'note-changed', combatantId: 'goblin-1' }]);
    expect(cleared.newState.combatants['goblin-1']).not.toHaveProperty('notes');
    expectEvents(cleared, [{ type: 'note-changed', combatantId: 'goblin-1' }]);
  });

  test('rejects setting a note for an unknown combatant', () => {
    const state = activeEncounter();

    const result = applyCommand(state, command('SET_NOTE', { combatantId: 'missing-1', note: 'Hidden' }), emptyEffects);

    expectRejected(result, 'SET_NOTE', 'Combatant missing-1 not found', state);
  });

  test('marks a non-current combatant dead without advancing the turn', () => {
    const state = activeEncounter();

    const result = applyCommand(state, command('MARK_DEAD', { combatantId: 'fighter-1' }), emptyEffects);

    expect(result.newState.combatants['fighter-1'].isAlive).toBe(false);
    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.newState.round).toBe(1);
    expectEvents(result, [{ type: 'combatant-died', combatantId: 'fighter-1', cause: 'marked-dead' }]);
  });

  test('marks the current combatant dead and advances to the next live combatant', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fallen-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false }),
        'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
      }
    });

    const result = applyCommand(state, command('MARK_DEAD', { combatantId: 'goblin-1' }), emptyEffects);

    expect(result.newState.combatants['goblin-1'].isAlive).toBe(false);
    expect(result.newState.initiative.currentIndex).toBe(2);
    expect(result.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'combatant-died', combatantId: 'goblin-1', cause: 'marked-dead' },
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('marks the current combatant dead and wraps to the next round', () => {
    const state = activeEncounter({
      round: 2,
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 1,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1', { reactionUsedThisRound: true }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(state, command('MARK_DEAD', { combatantId: 'fighter-1' }), emptyEffects);

    expect(result.newState.combatants['fighter-1'].isAlive).toBe(false);
    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.newState.round).toBe(3);
    expect(result.newState.combatants['goblin-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'combatant-died', combatantId: 'fighter-1', cause: 'marked-dead' },
      { type: 'turn-ended', combatantId: 'fighter-1' },
      { type: 'reaction-reset', combatantId: 'goblin-1', cause: 'auto' },
      { type: 'round-started', round: 3 },
      { type: 'turn-started', combatantId: 'goblin-1', round: 3 }
    ]);
  });

  test('emits all-combatants-dead when marking the final live combatant dead', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', { isAlive: false })
      }
    });

    const result = applyCommand(state, command('MARK_DEAD', { combatantId: 'goblin-1' }), emptyEffects);

    expect(result.newState.combatants['goblin-1'].isAlive).toBe(false);
    expect(result.newState.phase).toBe('ACTIVE');
    expectEvents(result, [
      { type: 'combatant-died', combatantId: 'goblin-1', cause: 'marked-dead' },
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'all-combatants-dead' }
    ]);
  });

  test('rejects invalid mark dead commands', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1'),
        'fallen-1': combatant('fallen-1', { isAlive: false })
      }
    });

    expectRejected(
      applyCommand(state, command('MARK_DEAD', { combatantId: 'missing-1' }), emptyEffects),
      'MARK_DEAD',
      'Combatant missing-1 not found',
      state
    );
    expectRejected(
      applyCommand(state, command('MARK_DEAD', { combatantId: 'fallen-1' }), emptyEffects),
      'MARK_DEAD',
      'Combatant fallen-1 is not alive',
      state
    );
  });

  test('revives a dead combatant without changing HP', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', { currentHp: 0, isAlive: false })
      }
    });

    const result = applyCommand(state, command('REVIVE', { combatantId: 'fighter-1' }), emptyEffects);

    expect(result.newState.combatants['fighter-1'].isAlive).toBe(true);
    expect(result.newState.combatants['fighter-1'].currentHp).toBe(0);
    expectEvents(result, [{ type: 'combatant-revived', combatantId: 'fighter-1' }]);
  });

  test('rejects invalid revive commands', () => {
    const state = activeEncounter();

    expectRejected(
      applyCommand(state, command('REVIVE', { combatantId: 'missing-1' }), emptyEffects),
      'REVIVE',
      'Combatant missing-1 not found',
      state
    );
    expectRejected(
      applyCommand(state, command('REVIVE', { combatantId: 'fighter-1' }), emptyEffects),
      'REVIVE',
      'Combatant fighter-1 is already alive',
      state
    );
  });
});
