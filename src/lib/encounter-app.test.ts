import { describe, expect, test } from 'vitest';
import {
  combatantCardActions,
  combatantVisualState,
  dispatchEncounterCommand,
  makeCombatant,
  makeCreatureCombatant,
  newEncounterState,
  toCommand
} from './encounter-app';
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

describe('combatantCardActions', () => {
  test('returns all-false for an unknown combatant', () => {
    const state = newEncounterState();

    expect(combatantCardActions(state, 'missing')).toEqual({
      canEndTurn: false,
      canMarkReactionUsed: false,
      canMarkDead: false,
      canRevive: false
    });
  });

  test('in PREPARING phase only mark-dead is enabled for living combatants', () => {
    const state = stateWithTwoCombatants();

    expect(combatantCardActions(state, 'goblin-1')).toEqual({
      canEndTurn: false,
      canMarkReactionUsed: false,
      canMarkDead: true,
      canRevive: false
    });
  });

  test('in ACTIVE phase enables end-turn only for the current combatant', () => {
    const state = startedState();

    expect(state.initiative.order[state.initiative.currentIndex]).toBe('goblin-1');
    expect(combatantCardActions(state, 'goblin-1').canEndTurn).toBe(true);
    expect(combatantCardActions(state, 'fighter-1').canEndTurn).toBe(false);
  });

  test('in ACTIVE phase enables mark-reaction-used until used, then disables it', () => {
    const started = startedState();

    expect(combatantCardActions(started, 'goblin-1').canMarkReactionUsed).toBe(true);

    const reacted = dispatchEncounterCommand(
      started,
      [],
      toCommand('MARK_REACTION_USED', { combatantId: 'goblin-1' }, 'cmd-react')
    );

    expect(reacted.state.combatants['goblin-1'].reactionUsedThisRound).toBe(true);
    expect(combatantCardActions(reacted.state, 'goblin-1').canMarkReactionUsed).toBe(false);
    expect(combatantCardActions(reacted.state, 'fighter-1').canMarkReactionUsed).toBe(true);
  });

  test('mark-dead and revive are mutually exclusive and toggle on isAlive', () => {
    const started = startedState();
    const before = combatantCardActions(started, 'fighter-1');

    expect(before.canMarkDead).toBe(true);
    expect(before.canRevive).toBe(false);

    const killed = dispatchEncounterCommand(
      started,
      [],
      toCommand('MARK_DEAD', { combatantId: 'fighter-1' }, 'cmd-kill')
    );
    const after = combatantCardActions(killed.state, 'fighter-1');

    expect(killed.state.combatants['fighter-1'].isAlive).toBe(false);
    expect(after.canMarkDead).toBe(false);
    expect(after.canRevive).toBe(true);
    expect(after.canEndTurn).toBe(false);
    expect(after.canMarkReactionUsed).toBe(false);
  });

  test('all actions are disabled in COMPLETED phase', () => {
    const state = { ...startedState(), phase: 'COMPLETED' as const };

    expect(combatantCardActions(state, 'goblin-1')).toEqual({
      canEndTurn: false,
      canMarkReactionUsed: false,
      canMarkDead: false,
      canRevive: false
    });
  });
});

describe('combatantVisualState', () => {
  test('returns "alive" for a living combatant above 0 HP', () => {
    const state = stateWithTwoCombatants();

    expect(combatantVisualState(state.combatants['goblin-1'])).toBe('alive');
  });

  test('returns "unconscious" when a living combatant is at 0 HP', () => {
    const state = stateWithTwoCombatants();
    const downed = dispatchEncounterCommand(
      state,
      [],
      toCommand('APPLY_DAMAGE', { combatantId: 'goblin-1', amount: 999 }, 'cmd-down')
    );

    expect(downed.state.combatants['goblin-1'].currentHp).toBe(0);
    expect(downed.state.combatants['goblin-1'].isAlive).toBe(true);
    expect(combatantVisualState(downed.state.combatants['goblin-1'])).toBe('unconscious');
  });

  test('returns "dead" once the combatant is marked dead, regardless of HP', () => {
    const state = stateWithTwoCombatants();
    const killed = dispatchEncounterCommand(
      state,
      [],
      toCommand('MARK_DEAD', { combatantId: 'goblin-1' }, 'cmd-kill')
    );

    expect(killed.state.combatants['goblin-1'].isAlive).toBe(false);
    expect(combatantVisualState(killed.state.combatants['goblin-1'])).toBe('dead');
  });

  test('reviving a dead combatant restores the "alive" visual state', () => {
    const state = stateWithTwoCombatants();
    const killed = dispatchEncounterCommand(
      state,
      [],
      toCommand('MARK_DEAD', { combatantId: 'goblin-1' }, 'cmd-kill')
    );
    const revived = dispatchEncounterCommand(
      killed.state,
      killed.feedback,
      toCommand('REVIVE', { combatantId: 'goblin-1' }, 'cmd-revive')
    );

    expect(revived.state.combatants['goblin-1'].isAlive).toBe(true);
    expect(revived.state.combatants['goblin-1'].currentHp).toBeGreaterThan(0);
    expect(combatantVisualState(revived.state.combatants['goblin-1'])).toBe('alive');
  });
});

describe('end-to-end turn-control dispatches', () => {
  test('dispatches END_TURN, MARK_REACTION_USED, MARK_DEAD, and REVIVE through the orchestrator', () => {
    const started = startedState();

    const reacted = dispatchEncounterCommand(
      started,
      [],
      toCommand('MARK_REACTION_USED', { combatantId: 'goblin-1' }, 'cmd-react')
    );
    expect(reacted.state.combatants['goblin-1'].reactionUsedThisRound).toBe(true);

    const ended = dispatchEncounterCommand(
      reacted.state,
      reacted.feedback,
      toCommand('END_TURN', undefined, 'cmd-end')
    );
    expect(ended.state.initiative.order[ended.state.initiative.currentIndex]).toBe('fighter-1');

    const killed = dispatchEncounterCommand(
      ended.state,
      ended.feedback,
      toCommand('MARK_DEAD', { combatantId: 'fighter-1' }, 'cmd-kill')
    );
    expect(killed.state.combatants['fighter-1'].isAlive).toBe(false);

    const revived = dispatchEncounterCommand(
      killed.state,
      killed.feedback,
      toCommand('REVIVE', { combatantId: 'fighter-1' }, 'cmd-revive')
    );
    expect(revived.state.combatants['fighter-1'].isAlive).toBe(true);

    const allFeedback = revived.feedback.map((entry) => entry.message).join(' | ');
    expect(allFeedback).toContain('reaction-used');
    expect(allFeedback).toContain('turn-ended');
    expect(allFeedback).toContain('combatant-died');
    expect(allFeedback).toContain('combatant-revived');
    expect(revived.feedback.every((entry) => entry.severity === 'info')).toBe(true);
  });
});

function stateWithTwoCombatants() {
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
    toCommand('ADD_COMBATANT', { combatant: goblin }, 'setup-1')
  );
  const withFighter = dispatchEncounterCommand(
    withGoblin.state,
    withGoblin.feedback,
    toCommand('ADD_COMBATANT', { combatant: fighter }, 'setup-2')
  );
  const ordered = dispatchEncounterCommand(
    withFighter.state,
    withFighter.feedback,
    toCommand('SET_INITIATIVE_ORDER', { order: ['goblin-1', 'fighter-1'] }, 'setup-3')
  );

  return ordered.state;
}

function startedState() {
  const prepared = stateWithTwoCombatants();
  const started = dispatchEncounterCommand(
    prepared,
    [],
    toCommand('START_ENCOUNTER', undefined, 'setup-4')
  );
  return started.state;
}

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
