import { describe, expect, test } from 'vitest';
import { activeEncounter, command } from '../../domain/test-support';
import { createEncounterHistory, ENCOUNTER_HISTORY_CAP } from './encounter-history';

describe('encounter history', () => {
  test('undoes and redoes a state-changing command in O(1) snapshots', () => {
    const history = createEncounterHistory();
    const before = activeEncounter();
    const after = {
      ...before,
      combatants: {
        ...before.combatants,
        'goblin-1': { ...before.combatants['goblin-1'], currentHp: 15 }
      },
      combatLog: [
        { id: 'cmd-damage-0', commandId: 'cmd-damage', message: 'Goblin took damage.', tone: 'danger' as const }
      ]
    };
    history.record(
      before,
      after,
      { ...command('APPLY_DAMAGE', { combatantId: 'goblin-1', amount: 5 }), id: 'cmd-damage' }
    );

    const undone = history.undo(after)!;
    expect(undone.state.combatants['goblin-1'].currentHp).toBe(20);
    expect(undone.state.combatLog[0].undone).toBe(true);
    expect(history.canRedo).toBe(true);

    const redone = history.redo(undone.state)!;
    expect(redone.state.combatants['goblin-1'].currentHp).toBe(15);
    expect(redone.state.combatLog[0].undone).toBe(false);
  });

  test('a new command after undo truncates the redo branch', () => {
    const history = createEncounterHistory();
    const one = activeEncounter();
    const two = { ...one, round: 2 };
    const three = { ...two, round: 3 };
    history.record(one, two, command('END_TURN'));
    history.undo(two);
    history.record(one, three, command('MARK_REACTION_USED', { combatantId: 'goblin-1' }));
    expect(history.canRedo).toBe(false);
  });

  test('keeps only the latest 50 accepted state changes', () => {
    const history = createEncounterHistory();
    let state = activeEncounter();
    for (let index = 0; index < ENCOUNTER_HISTORY_CAP + 7; index += 1) {
      const next = { ...state, round: index + 2 };
      history.record(state, next, { ...command('END_TURN'), id: `cmd-${index}` });
      state = next;
    }
    expect(history.size).toBe(ENCOUNTER_HISTORY_CAP);
  });

  test('does not add rejected or no-op commands', () => {
    const history = createEncounterHistory();
    const state = activeEncounter();
    history.record(state, state, command('END_TURN'));
    expect(history.canUndo).toBe(false);
  });

  test('retains the pre-reset audit trail when undoing a command that cleared the log', () => {
    const history = createEncounterHistory();
    const before = activeEncounter({
      combatLog: [{ id: 'old-0', message: 'Earlier action.', tone: 'info' }]
    });
    const after = {
      ...before,
      phase: 'PREPARING' as const,
      combatLog: [
        {
          id: 'reset-0',
          commandId: 'reset',
          message: 'Encounter reset.',
          tone: 'info' as const
        }
      ]
    };
    history.record(before, after, { ...command('RESET_ENCOUNTER'), id: 'reset' });

    const undone = history.undo(after)!;
    expect(undone.state.combatLog.map((entry) => entry.id)).toEqual([
      'old-0',
      'reset-0',
      'history-1'
    ]);
    expect(undone.state.combatLog[1].undone).toBe(true);
  });
});
