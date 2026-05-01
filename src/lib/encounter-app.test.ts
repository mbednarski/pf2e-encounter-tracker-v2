import { describe, expect, test } from 'vitest';
import {
  clampValue,
  combatantCardActions,
  combatantVisualState,
  dispatchEncounterCommand,
  formatDuration,
  listConditionDefinitions,
  listConditionOptions,
  makeCombatant,
  makeCreatureCombatant,
  newEncounterState,
  resolveApplyChoice,
  toCommand,
  viewAppliedEffects,
  type ConditionOption
} from './encounter-app';
import { effectLibrary } from '../domain';
import type { CombatantState, Creature, EncounterState } from '../domain';

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

describe('listConditionDefinitions', () => {
  test('returns only condition-category definitions, alphabetized by name', () => {
    const definitions = listConditionDefinitions();
    const expectedCount = Object.values(effectLibrary).filter((d) => d.category === 'condition').length;

    expect(definitions.length).toBe(expectedCount);
    expect(definitions.every((d) => d.category === 'condition')).toBe(true);

    const names = definitions.map((d) => d.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  test('listConditionOptions projects only the fields the UI needs', () => {
    const options = listConditionOptions();
    const frightened = options.find((o) => o.id === 'frightened');

    expect(frightened).toEqual({
      id: 'frightened',
      name: 'Frightened',
      value: { kind: 'valued', defaultValue: 1, maxValue: 4 },
      description: 'Decreases by 1 at end of your turn.'
    });
  });

  test('listConditionOptions marks unvalued conditions with kind "unvalued"', () => {
    const options = listConditionOptions();
    const offGuard = options.find((o) => o.id === 'off-guard');

    expect(offGuard?.value).toEqual({ kind: 'unvalued' });
  });
});

describe('clampValue', () => {
  test('floors fractional input via Math.trunc rather than rounding', () => {
    expect(clampValue(2.7, 4)).toBe(2);
    expect(clampValue(2.99, 4)).toBe(2);
  });

  test('returns 1 for non-finite input (NaN, +/-Infinity)', () => {
    expect(clampValue(Number.NaN, 4)).toBe(1);
    expect(clampValue(Number.POSITIVE_INFINITY, 4)).toBe(1);
    expect(clampValue(Number.NEGATIVE_INFINITY, 4)).toBe(1);
  });

  test('floors zero and negatives to 1', () => {
    expect(clampValue(0, 4)).toBe(1);
    expect(clampValue(-5, 4)).toBe(1);
  });

  test('caps at maxValue when provided', () => {
    expect(clampValue(99, 4)).toBe(4);
    expect(clampValue(5, 4)).toBe(4);
  });

  test('does not cap when maxValue is undefined', () => {
    expect(clampValue(99, undefined)).toBe(99);
  });

  test('respects maxValue of 0 instead of treating it as unbounded', () => {
    expect(clampValue(5, 0)).toBe(0);
  });
});

describe('resolveApplyChoice', () => {
  const valuedOption: ConditionOption = {
    id: 'frightened',
    name: 'Frightened',
    value: { kind: 'valued', defaultValue: 1, maxValue: 4 }
  };
  const unvaluedOption: ConditionOption = {
    id: 'off-guard',
    name: 'Off-Guard',
    value: { kind: 'unvalued' }
  };

  test('returns kind "unvalued" for unvalued conditions and ignores rawValue', () => {
    expect(resolveApplyChoice(unvaluedOption, 7)).toEqual({
      kind: 'unvalued',
      effectId: 'off-guard'
    });
  });

  test('returns kind "valued" with the clamped raw value for valued conditions', () => {
    expect(resolveApplyChoice(valuedOption, 99)).toEqual({
      kind: 'valued',
      effectId: 'frightened',
      value: 4
    });
    expect(resolveApplyChoice(valuedOption, Number.NaN)).toEqual({
      kind: 'valued',
      effectId: 'frightened',
      value: 1
    });
  });
});

describe('formatDuration', () => {
  const state = newEncounterState();

  test('renders unlimited durations', () => {
    expect(formatDuration({ type: 'unlimited' }, state)).toBe('unlimited');
  });

  test('renders rounds with singular and plural forms', () => {
    expect(formatDuration({ type: 'rounds', count: 1 }, state)).toBe('1 round');
    expect(formatDuration({ type: 'rounds', count: 4 }, state)).toBe('4 rounds');
  });

  test('renders turn-bound durations using the combatant name', () => {
    const populated = stateWithTwoCombatants();

    expect(formatDuration({ type: 'untilTurnEnd', combatantId: 'goblin-1' }, populated))
      .toBe("until end of Goblin Warrior's turn");
    expect(formatDuration({ type: 'untilTurnStart', combatantId: 'fighter-1' }, populated))
      .toBe("until start of Fighter's turn");
  });

  test('falls back to combatant id when the target is missing', () => {
    expect(formatDuration({ type: 'untilTurnEnd', combatantId: 'ghost' }, state))
      .toBe("until end of ghost's turn");
  });

  test('renders conditional durations using the description text', () => {
    expect(formatDuration({ type: 'conditional', description: 'until next save' }, state))
      .toBe('until next save');
  });
});

describe('viewAppliedEffects', () => {
  test('returns an empty list for a combatant with no effects', () => {
    const state = stateWithTwoCombatants();
    expect(viewAppliedEffects(state.combatants['goblin-1'], state)).toEqual([]);
  });

  test('hydrates name, hasValue, value, duration label, and parent attribution', () => {
    const started = startedState();
    const fightened = dispatchEncounterCommand(
      started,
      [],
      toCommand('APPLY_EFFECT', {
        effectId: 'frightened',
        targetId: 'fighter-1',
        value: 2,
        duration: { type: 'unlimited' }
      }, 'cmd-frighten')
    );
    const dyingApplied = dispatchEncounterCommand(
      fightened.state,
      fightened.feedback,
      toCommand('APPLY_EFFECT', {
        effectId: 'dying',
        targetId: 'fighter-1',
        value: 1,
        duration: { type: 'unlimited' }
      }, 'cmd-dying')
    );

    const fighter = dyingApplied.state.combatants['fighter-1'];
    const views = viewAppliedEffects(fighter, dyingApplied.state);

    const frightenedView = views.find((v) => v.effectId === 'frightened');
    expect(frightenedView).toMatchObject({
      effectId: 'frightened',
      name: 'Frightened',
      value: { kind: 'valued', current: 2, maxValue: 4 },
      durationLabel: 'unlimited',
      source: { kind: 'direct' }
    });

    const dyingView = views.find((v) => v.effectId === 'dying');
    expect(dyingView).toMatchObject({
      name: 'Dying',
      value: { kind: 'valued', current: 1 },
      source: { kind: 'direct' }
    });

    const unconsciousView = views.find((v) => v.effectId === 'unconscious');
    expect(unconsciousView).toMatchObject({
      name: 'Unconscious',
      value: { kind: 'unvalued' },
      source: { kind: 'implied', parentName: 'Dying' }
    });

    const offGuardView = views.find((v) => v.effectId === 'off-guard');
    expect(offGuardView).toMatchObject({
      name: 'Off-Guard',
      source: { kind: 'implied', parentName: 'Unconscious' }
    });
  });

  test('falls back to the raw effectId when the definition is missing from the library', () => {
    const orphan: CombatantState = {
      ...stateWithTwoCombatants().combatants['fighter-1'],
      appliedEffects: [
        {
          instanceId: 'inst-1',
          effectId: 'custom-status',
          duration: { type: 'unlimited' }
        }
      ]
    };

    const [view] = viewAppliedEffects(orphan, stateWithTwoCombatants());

    expect(view).toMatchObject({
      effectId: 'custom-status',
      name: 'custom-status',
      value: { kind: 'unvalued' },
      source: { kind: 'direct' }
    });
  });

  test('falls back to the parent effectId when the parent definition is missing', () => {
    const fighter: CombatantState = {
      ...stateWithTwoCombatants().combatants['fighter-1'],
      appliedEffects: [
        {
          instanceId: 'parent-inst',
          effectId: 'custom-source',
          duration: { type: 'unlimited' }
        },
        {
          instanceId: 'child-inst',
          effectId: 'off-guard',
          parentInstanceId: 'parent-inst',
          duration: { type: 'unlimited' }
        }
      ]
    };

    const views = viewAppliedEffects(fighter, stateWithTwoCombatants());
    const child = views.find((v) => v.effectId === 'off-guard');

    expect(child?.source).toEqual({ kind: 'implied', parentName: 'custom-source' });
  });
});

describe('end-to-end condition dispatches', () => {
  test('apply, modify, and auto-remove a value condition through the orchestrator', () => {
    const started = startedState();

    const applied = dispatchEncounterCommand(
      started,
      [],
      toCommand('APPLY_EFFECT', {
        effectId: 'frightened',
        targetId: 'fighter-1',
        value: 2,
        duration: { type: 'unlimited' }
      }, 'cmd-apply')
    );
    const fightenedInstance = applied.state.combatants['fighter-1'].appliedEffects[0];
    expect(fightenedInstance).toMatchObject({ effectId: 'frightened', value: 2 });

    const decremented = dispatchEncounterCommand(
      applied.state,
      applied.feedback,
      toCommand('MODIFY_EFFECT_VALUE', {
        targetId: 'fighter-1',
        instanceId: fightenedInstance.instanceId,
        delta: -1
      }, 'cmd-mod-1')
    );
    expect(decremented.state.combatants['fighter-1'].appliedEffects[0]).toMatchObject({
      effectId: 'frightened',
      value: 1
    });

    const removed = dispatchEncounterCommand(
      decremented.state,
      decremented.feedback,
      toCommand('MODIFY_EFFECT_VALUE', {
        targetId: 'fighter-1',
        instanceId: fightenedInstance.instanceId,
        delta: -1
      }, 'cmd-mod-2')
    );

    expect(removed.state.combatants['fighter-1'].appliedEffects).toEqual([]);

    const firstDecrementFeedback = decremented.feedback
      .slice(applied.feedback.length)
      .map((entry) => entry.message)
      .join(' | ');
    expect(firstDecrementFeedback).toContain('effect-value-changed');
    expect(firstDecrementFeedback).not.toContain('effect-removed');

    const autoRemoveFeedback = removed.feedback
      .slice(decremented.feedback.length)
      .map((entry) => entry.message)
      .join(' | ');
    expect(autoRemoveFeedback).toContain('effect-removed');
  });

  test('SET_EFFECT_VALUE replaces the current value without removing the effect', () => {
    const started = startedState();

    const applied = dispatchEncounterCommand(
      started,
      [],
      toCommand('APPLY_EFFECT', {
        effectId: 'frightened',
        targetId: 'fighter-1',
        value: 1,
        duration: { type: 'unlimited' }
      }, 'cmd-apply')
    );
    const instance = applied.state.combatants['fighter-1'].appliedEffects[0];

    const setTo3 = dispatchEncounterCommand(
      applied.state,
      applied.feedback,
      toCommand('SET_EFFECT_VALUE', {
        targetId: 'fighter-1',
        instanceId: instance.instanceId,
        newValue: 3
      }, 'cmd-set')
    );

    expect(setTo3.state.combatants['fighter-1'].appliedEffects[0]).toMatchObject({
      effectId: 'frightened',
      value: 3
    });
  });

  test('REMOVE_EFFECT cascades to implied children', () => {
    const started = startedState();

    const applied = dispatchEncounterCommand(
      started,
      [],
      toCommand('APPLY_EFFECT', {
        effectId: 'dying',
        targetId: 'fighter-1',
        value: 1,
        duration: { type: 'unlimited' }
      }, 'cmd-apply')
    );

    const dying = applied.state.combatants['fighter-1'].appliedEffects.find(
      (e: CombatantState['appliedEffects'][number]) => e.effectId === 'dying'
    );
    expect(dying).toBeDefined();
    expect(applied.state.combatants['fighter-1'].appliedEffects.some(
      (e: CombatantState['appliedEffects'][number]) => e.effectId === 'unconscious'
    )).toBe(true);

    const removed = dispatchEncounterCommand(
      applied.state,
      applied.feedback,
      toCommand('REMOVE_EFFECT', {
        targetId: 'fighter-1',
        instanceId: dying!.instanceId
      }, 'cmd-remove')
    );

    expect(removed.state.combatants['fighter-1'].appliedEffects).toEqual([]);
  });
});

function stateWithTwoCombatants(): EncounterState {
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
