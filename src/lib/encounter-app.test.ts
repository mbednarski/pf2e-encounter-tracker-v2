import { describe, expect, test } from 'vitest';
import { dispatchEncounterCommand, makeCombatant, makeCreatureCombatant, newEncounterState, toCommand } from './encounter-app';
import type { Creature } from '../domain';

describe('encounter app boundary', () => {
  test('creates a normal creature combatant through the app boundary', () => {
    const combatant = makeCreatureCombatant({
      creature: creatureTemplate(),
      combatantId: 'goblin-1',
      name: 'Goblin Scout',
      adjustment: 'normal'
    });

    expect(combatant).toMatchObject({
      id: 'goblin-1',
      creatureId: 'goblin-warrior',
      name: 'Goblin Scout',
      currentHp: 18,
      baseStats: {
        hp: 18,
        ac: 16,
        fortitude: 6,
        reflex: 8,
        will: 5,
        perception: 7,
        speed: 25
      },
      templateAdjustment: undefined
    });
  });

  test('creates weak and elite creature combatants with adjusted stats and template markers', () => {
    const creature = creatureTemplate();

    const elite = makeCreatureCombatant({
      creature,
      combatantId: 'elite-goblin-1',
      adjustment: 'elite'
    });
    const weak = makeCreatureCombatant({
      creature,
      combatantId: 'weak-goblin-1',
      adjustment: 'weak'
    });

    expect(elite).toMatchObject({
      id: 'elite-goblin-1',
      name: 'Goblin Warrior',
      currentHp: 28,
      baseStats: {
        hp: 28,
        ac: 18,
        fortitude: 8,
        reflex: 10,
        will: 7,
        perception: 9
      },
      level: 2,
      templateAdjustment: 'elite'
    });
    expect(weak).toMatchObject({
      id: 'weak-goblin-1',
      currentHp: 8,
      baseStats: {
        hp: 8,
        ac: 14,
        fortitude: 4,
        reflex: 6,
        will: 3,
        perception: 5
      },
      level: -1,
      templateAdjustment: 'weak'
    });
  });

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

function creatureTemplate(overrides: Partial<Creature> = {}): Creature {
  return {
    id: 'goblin-warrior',
    name: 'Goblin Warrior',
    level: 1,
    traits: ['goblin', 'humanoid'],
    size: 'small',
    rarity: 'common',
    ac: 16,
    fortitude: 6,
    reflex: 8,
    will: 5,
    perception: 7,
    hp: 18,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 25 },
    attacks: [
      {
        name: 'dogslicer',
        type: 'melee',
        modifier: 8,
        traits: ['agile', 'finesse'],
        damage: [{ dice: 1, dieSize: 6, bonus: 2, type: 'slashing' }]
      }
    ],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    skills: { acrobatics: 8, stealth: 10 },
    tags: [],
    ...overrides
  };
}
