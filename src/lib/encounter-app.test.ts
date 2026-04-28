import { describe, expect, test } from 'vitest';
import { dispatchEncounterCommand, makeCombatant, newEncounterState, toCommand } from './encounter-app';

describe('encounter app boundary', () => {
  test('dispatches domain commands and appends readable event feedback', () => {
    const goblin = makeCombatant({
      id: 'goblin-1',
      name: 'Goblin Warrior',
      maxHp: 18,
      ac: 16,
      fortitude: 6,
      reflex: 8,
      will: 5,
      perception: 7,
      speed: 25
    });
    const fighter = makeCombatant({
      id: 'fighter-1',
      name: 'Fighter',
      maxHp: 26,
      ac: 18,
      fortitude: 9,
      reflex: 7,
      will: 6,
      perception: 8,
      speed: 25
    });

    const withGoblin = dispatchEncounterCommand(
      newEncounterState(),
      [],
      toCommand('ADD_COMBATANT', { combatant: goblin }, 'cmd-1')
    );
    const withFighter = dispatchEncounterCommand(
      withGoblin.state,
      withGoblin.feedback,
      toCommand('ADD_COMBATANT', { combatant: fighter }, 'cmd-2')
    );
    const ordered = dispatchEncounterCommand(
      withFighter.state,
      withFighter.feedback,
      toCommand('SET_INITIATIVE_ORDER', { order: ['goblin-1', 'fighter-1'] }, 'cmd-3')
    );
    const started = dispatchEncounterCommand(ordered.state, ordered.feedback, toCommand('START_ENCOUNTER', undefined, 'cmd-4'));

    expect(started.state.phase).toBe('ACTIVE');
    expect(started.state.initiative.currentIndex).toBe(0);
    expect(started.feedback.map((entry) => entry.message)).toEqual([
      'Goblin Warrior joined the encounter.',
      'Fighter joined the encounter.',
      'Initiative order set: Goblin Warrior, Fighter.',
      'Encounter started. Goblin Warrior starts round 1.'
    ]);
  });

  test('records rejected commands without changing state', () => {
    const state = newEncounterState();

    const result = dispatchEncounterCommand(state, [], toCommand('START_ENCOUNTER', undefined, 'cmd-1'));

    expect(result.state).toBe(state);
    expect(result.feedback).toEqual([
      {
        id: 'log-cmd-1',
        commandId: 'cmd-1',
        severity: 'warn',
        message: 'START_ENCOUNTER rejected: START_ENCOUNTER requires at least 2 combatants'
      }
    ]);
  });
});
