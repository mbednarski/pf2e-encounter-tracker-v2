import { describe, expect, test } from 'vitest';
import type { AppliedEffect, CombatantState, CommandResult, DomainEvent, EncounterState } from '../types';
import { effectLibrary } from './library';
import { conditionValue, dyingDeathThreshold, findConditionInstance } from './death';
import { applyCommand } from '../reducer';
import { combatant, command, encounter, expectSerializable } from '../test-support';

function pc(appliedEffects: AppliedEffect[] = []): CombatantState {
  return combatant('pc-1', { name: 'Valeros', sourceType: 'partyMember', appliedEffects });
}

function preparing(appliedEffects: AppliedEffect[] = []): EncounterState {
  return encounter({ combatants: { 'pc-1': pc(appliedEffects) } });
}

function effectOf(result: CommandResult, effectId: string): AppliedEffect | undefined {
  return findConditionInstance(result.newState.combatants['pc-1'], effectId);
}

function effectIds(result: CommandResult): string[] {
  return result.newState.combatants['pc-1'].appliedEffects.map((effect) => effect.effectId);
}

function applyDying(state: EncounterState, payload: { value?: number } = {}): CommandResult {
  const result = applyCommand(
    state,
    command('APPLY_EFFECT', { effectId: 'dying', targetId: 'pc-1', ...payload }),
    effectLibrary
  );
  expectSerializable(result);
  return result;
}

describe('death subsystem — pure helpers', () => {
  test('conditionValue reads the value of a value condition, 0 when absent', () => {
    const target = pc([{ instanceId: 'w', effectId: 'wounded', value: 2, duration: { type: 'unlimited' } }]);
    expect(conditionValue(target, 'wounded')).toBe(2);
    expect(conditionValue(target, 'doomed')).toBe(0);
  });

  test('dyingDeathThreshold is 4 − Doomed, floored at 1', () => {
    expect(dyingDeathThreshold(0)).toBe(4);
    expect(dyingDeathThreshold(1)).toBe(3);
    expect(dyingDeathThreshold(3)).toBe(1);
    expect(dyingDeathThreshold(5)).toBe(1);
  });
});

describe('gaining Dying (spec §3.2)', () => {
  test('applies Dying with implied Unconscious (and Off-Guard) when below the threshold', () => {
    const result = applyDying(preparing(), { value: 1 });

    expect(effectOf(result, 'dying')).toMatchObject({ value: 1 });
    expect(effectIds(result)).toEqual(expect.arrayContaining(['dying', 'unconscious', 'off-guard']));
    expect(result.newState.combatants['pc-1'].isAlive).toBe(true);
    expect(result.events.some((e) => e.type === 'combatant-died')).toBe(false);
    expect(result.newState.recentEffectIds).toContain('dying');
  });

  test('folds the Wounded value into the gained Dying value', () => {
    const result = applyDying(preparing([{ instanceId: 'w', effectId: 'wounded', value: 2, duration: { type: 'unlimited' } }]), {
      value: 1
    });

    // Dying 1 + Wounded 2 → Dying 3, still below the threshold of 4.
    expect(effectOf(result, 'dying')).toMatchObject({ value: 3 });
    expect(result.newState.combatants['pc-1'].isAlive).toBe(true);
  });

  test('Wounded pushing effective Dying to the threshold kills the combatant', () => {
    const result = applyDying(preparing([{ instanceId: 'w', effectId: 'wounded', value: 2, duration: { type: 'unlimited' } }]), {
      value: 2
    });

    // 2 + 2 = 4 ≥ threshold 4 → dead, Dying capped at the threshold, no Unconscious.
    expect(result.newState.combatants['pc-1'].isAlive).toBe(false);
    expect(effectOf(result, 'dying')).toMatchObject({ value: 4 });
    expect(effectIds(result)).not.toContain('unconscious');
    expect(result.events).toContainEqual({ type: 'combatant-died', combatantId: 'pc-1', cause: 'dying-threshold' });
  });

  test('Doomed lowers the death threshold so a small Dying is fatal', () => {
    const result = applyDying(preparing([{ instanceId: 'd', effectId: 'doomed', value: 3, duration: { type: 'unlimited' } }]), {
      value: 1
    });

    // Threshold 4 − 3 = 1, Dying 1 ≥ 1 → dead.
    expect(result.newState.combatants['pc-1'].isAlive).toBe(false);
    expect(effectOf(result, 'dying')).toMatchObject({ value: 1 });
    expect(result.events).toContainEqual({ type: 'combatant-died', combatantId: 'pc-1', cause: 'dying-threshold' });
  });

  test('rejects re-applying Dying to a combatant that is already Dying', () => {
    const dying = applyDying(preparing(), { value: 1 });
    const again = applyDying(dying.newState, { value: 1 });

    expect(again.events).toEqual([
      {
        type: 'command-rejected',
        commandType: 'APPLY_EFFECT',
        reason: 'Combatant pc-1 is already Dying; adjust the existing Dying value instead'
      }
    ]);
  });

  test('rejects a non-positive Dying value', () => {
    const result = applyDying(preparing(), { value: 0 });
    expect(result.events[0]).toMatchObject({ type: 'command-rejected', commandType: 'APPLY_EFFECT' });
  });
});

describe('increasing Dying (spec §3.3)', () => {
  function increase(delta: number, seed: AppliedEffect[] = []): CommandResult {
    const dying = applyDying(preparing(seed), { value: 1 });
    const instanceId = effectOf(dying, 'dying')!.instanceId;
    const result = applyCommand(
      dying.newState,
      command('MODIFY_EFFECT_VALUE', { targetId: 'pc-1', instanceId, delta }),
      effectLibrary
    );
    expectSerializable(result);
    return result;
  }

  test('raises the value without adding Wounded again', () => {
    const result = increase(1);
    expect(effectOf(result, 'dying')).toMatchObject({ value: 2 });
    expect(effectIds(result)).not.toContain('wounded');
    expect(result.newState.combatants['pc-1'].isAlive).toBe(true);
    expect(result.events).toContainEqual({
      type: 'effect-value-changed',
      combatantId: 'pc-1',
      effectId: 'dying',
      effectName: 'Dying',
      instanceId: effectOf(result, 'dying')!.instanceId,
      from: 1,
      to: 2
    });
  });

  test('crossing the threshold marks the combatant dead with Dying capped', () => {
    // Dying 1 → +3 would be 4 ≥ threshold 4.
    const result = increase(3);
    expect(effectOf(result, 'dying')).toMatchObject({ value: 4 });
    expect(result.newState.combatants['pc-1'].isAlive).toBe(false);
    expect(result.events).toContainEqual({ type: 'combatant-died', combatantId: 'pc-1', cause: 'dying-threshold' });
  });

  test('Doomed shifts the threshold for the increase check', () => {
    // Seeded Doomed 2 → threshold 2; Dying 1 → +1 = 2 ≥ 2 → dead.
    const result = increase(1, [{ instanceId: 'd', effectId: 'doomed', value: 2, duration: { type: 'unlimited' } }]);
    expect(result.newState.combatants['pc-1'].isAlive).toBe(false);
    expect(effectOf(result, 'dying')).toMatchObject({ value: 2 });
  });

  test('SET_EFFECT_VALUE above the threshold caps and kills', () => {
    const dying = applyDying(preparing(), { value: 1 });
    const instanceId = effectOf(dying, 'dying')!.instanceId;
    const result = applyCommand(
      dying.newState,
      command('SET_EFFECT_VALUE', { targetId: 'pc-1', instanceId, newValue: 9 }),
      effectLibrary
    );

    expect(effectOf(result, 'dying')).toMatchObject({ value: 4 });
    expect(result.newState.combatants['pc-1'].isAlive).toBe(false);
  });
});

describe('recovering from Dying (spec §3.4)', () => {
  test('MODIFY to 0 removes Dying (and implied conditions) and grants Wounded 1', () => {
    const dying = applyDying(preparing(), { value: 1 });
    const instanceId = effectOf(dying, 'dying')!.instanceId;
    const result = applyCommand(
      dying.newState,
      command('MODIFY_EFFECT_VALUE', { targetId: 'pc-1', instanceId, delta: -1 }),
      effectLibrary
    );
    expectSerializable(result);

    expect(effectIds(result)).toEqual(['wounded']);
    expect(effectOf(result, 'wounded')).toMatchObject({ value: 1 });
    expect(result.newState.combatants['pc-1'].isAlive).toBe(true);

    const types = result.events.map((e: DomainEvent) => e.type);
    expect(types).toContain('effect-removed');
    expect(types).toContain('effect-applied');
  });

  test('recovering with existing Wounded raises it by one', () => {
    const dying = applyDying(preparing([{ instanceId: 'w', effectId: 'wounded', value: 1, duration: { type: 'unlimited' } }]), {
      value: 1
    });
    // Gained Dying folded Wounded 1 → Dying 2.
    expect(effectOf(dying, 'dying')).toMatchObject({ value: 2 });

    const instanceId = effectOf(dying, 'dying')!.instanceId;
    const result = applyCommand(
      dying.newState,
      command('MODIFY_EFFECT_VALUE', { targetId: 'pc-1', instanceId, delta: -2 }),
      effectLibrary
    );

    expect(effectIds(result)).toEqual(['wounded']);
    expect(effectOf(result, 'wounded')).toMatchObject({ value: 2 });
    expect(result.events).toContainEqual({
      type: 'effect-value-changed',
      combatantId: 'pc-1',
      effectId: 'wounded',
      effectName: 'Wounded',
      instanceId: 'w',
      from: 1,
      to: 2
    });
  });

  test('REMOVE_EFFECT on Dying recovers and grants Wounded', () => {
    const dying = applyDying(preparing(), { value: 1 });
    const instanceId = effectOf(dying, 'dying')!.instanceId;
    const result = applyCommand(
      dying.newState,
      command('REMOVE_EFFECT', { targetId: 'pc-1', instanceId }),
      effectLibrary
    );

    expect(effectIds(result)).toEqual(['wounded']);
    expect(effectOf(result, 'wounded')).toMatchObject({ value: 1 });
  });

  test('Wounded does not exceed its maximum on repeated recovery', () => {
    const dying = applyDying(preparing([{ instanceId: 'w', effectId: 'wounded', value: 3, duration: { type: 'unlimited' } }]), {
      value: 1
    });
    const instanceId = effectOf(dying, 'dying')!.instanceId;
    const result = applyCommand(
      dying.newState,
      command('REMOVE_EFFECT', { targetId: 'pc-1', instanceId }),
      effectLibrary
    );

    expect(effectOf(result, 'wounded')).toMatchObject({ value: 3 });
    expect(result.events.some((e) => e.type === 'effect-value-changed')).toBe(false);
  });

  test('removing Dying from a dead combatant is plain cleanup (no Wounded)', () => {
    // 2 + Wounded 2 = 4 → dead.
    const fatal = applyDying(preparing([{ instanceId: 'w', effectId: 'wounded', value: 2, duration: { type: 'unlimited' } }]), {
      value: 2
    });
    expect(fatal.newState.combatants['pc-1'].isAlive).toBe(false);

    const instanceId = effectOf(fatal, 'dying')!.instanceId;
    const result = applyCommand(
      fatal.newState,
      command('REMOVE_EFFECT', { targetId: 'pc-1', instanceId }),
      effectLibrary
    );

    expect(effectIds(result)).not.toContain('dying');
    expect(conditionValue(result.newState.combatants['pc-1'], 'wounded')).toBe(2);
  });
});

describe('Doomed changes recheck the threshold (spec §3.5)', () => {
  test('raising Doomed under the current Dying value kills the combatant', () => {
    const dying = applyDying(preparing([{ instanceId: 'd', effectId: 'doomed', value: 1, duration: { type: 'unlimited' } }]), {
      value: 2
    });
    // Threshold 3, Dying 2 → alive.
    expect(dying.newState.combatants['pc-1'].isAlive).toBe(true);

    const result = applyCommand(
      dying.newState,
      command('SET_EFFECT_VALUE', { targetId: 'pc-1', instanceId: 'd', newValue: 2 }),
      effectLibrary
    );
    expectSerializable(result);

    // Threshold now 2, Dying 2 ≥ 2 → dead.
    expect(result.newState.combatants['pc-1'].isAlive).toBe(false);
    expect(result.events).toContainEqual({ type: 'combatant-died', combatantId: 'pc-1', cause: 'dying-threshold' });
  });

  test('lowering Doomed raises the threshold and never kills', () => {
    const dying = applyDying(preparing([{ instanceId: 'd', effectId: 'doomed', value: 1, duration: { type: 'unlimited' } }]), {
      value: 2
    });
    const result = applyCommand(
      dying.newState,
      command('MODIFY_EFFECT_VALUE', { targetId: 'pc-1', instanceId: 'd', delta: -1 }),
      effectLibrary
    );

    expect(effectIds(result)).not.toContain('doomed');
    expect(result.newState.combatants['pc-1'].isAlive).toBe(true);
  });
});

describe('recovery check at turn start (spec §3.6)', () => {
  test('a Dying combatant gets a recovery prompt; accepting it recovers and grants Wounded', () => {
    const base = encounter({
      phase: 'ACTIVE',
      round: 1,
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'pc-1': pc()
      },
      initiative: { order: ['goblin-1', 'pc-1'], currentIndex: 0, delaying: [], scores: {} }
    });

    const dying = applyCommand(base, command('APPLY_EFFECT', { effectId: 'dying', targetId: 'pc-1', value: 1 }), effectLibrary);

    const ended = applyCommand(dying.newState, command('END_TURN'), effectLibrary);
    expect(ended.newState.phase).toBe('RESOLVING');
    const prompt = ended.newState.pendingPrompts.find((p) => p.effectName === 'Dying');
    expect(prompt).toBeDefined();

    const resolved = applyCommand(
      ended.newState,
      command('RESOLVE_PROMPT', { promptId: prompt!.id, resolution: { type: 'accept' } }),
      effectLibrary
    );
    expectSerializable(resolved);

    const pcAfter = resolved.newState.combatants['pc-1'];
    expect(pcAfter.appliedEffects.map((e) => e.effectId)).toEqual(['wounded']);
    expect(pcAfter.isAlive).toBe(true);
    expect(resolved.newState.phase).toBe('ACTIVE');
  });
});
