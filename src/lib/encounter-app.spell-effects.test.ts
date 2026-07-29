import { afterEach, describe, expect, it } from 'vitest';
import type { EffectDefinition } from '../domain';
import {
  __resetEffectRegistryForTests,
  activeEffectLibrary,
  buildSpellEffectIndex,
  defaultApplyDuration,
  dispatchEncounterCommand,
  getEffectDefinition,
  listSpellEffectOptionsFrom,
  makeCombatant,
  newEncounterState,
  registerLibraryEffects,
  toCommand
} from './encounter-app';

function anthem(overrides: Partial<EffectDefinition> = {}): EffectDefinition {
  return {
    id: 'spell-effect-rallying-anthem',
    name: 'Rallying Anthem',
    category: 'spell',
    hasValue: false,
    modifiers: [
      { stat: 'ac', bonusType: 'status', value: 1 },
      { stat: 'allSaves', bonusType: 'status', value: 1 }
    ],
    defaultDuration: { unit: 'rounds', value: 1, expiry: 'turnStart' },
    sourceSpellSlug: 'rallying-anthem',
    ...overrides
  };
}

afterEach(() => {
  __resetEffectRegistryForTests();
});

describe('effect registry', () => {
  it('resolves registered effects and keeps built-ins on collision', () => {
    registerLibraryEffects([anthem(), anthem({ id: 'frightened', name: 'Impostor' })]);
    expect(getEffectDefinition('spell-effect-rallying-anthem')?.name).toBe('Rallying Anthem');
    // Built-in frightened must win over the impostor.
    expect(activeEffectLibrary()['frightened'].name).toBe('Frightened');
  });

  it('lets a registered effect be applied through dispatchEncounterCommand', () => {
    registerLibraryEffects([anthem()]);
    let state = newEncounterState();
    state = dispatchEncounterCommand(
      state,
      toCommand(
        'ADD_COMBATANT',
        {
          combatant: makeCombatant({
            id: 'fighter-1',
            name: 'Fighter',
            maxHp: 20,
            ac: 18,
            fortitude: 8,
            reflex: 6,
            will: 5,
            perception: 6,
            speed: 25
          })
        },
        'cmd-1'
      )
    ).state;

    const result = dispatchEncounterCommand(
      state,
      toCommand(
        'APPLY_EFFECT',
        {
          effectId: 'spell-effect-rallying-anthem',
          targetId: 'fighter-1',
          duration: { type: 'rounds', count: 1, anchorId: 'fighter-1', expiry: 'turnStart' }
        },
        'cmd-2'
      )
    );

    expect(result.state.combatants['fighter-1'].appliedEffects).toHaveLength(1);
    expect(result.events.some((e) => e.type === 'command-rejected')).toBe(false);
  });
});

describe('buildSpellEffectIndex', () => {
  it('keys imported effects by sourceSpellSlug and built-ins by id', () => {
    const index = buildSpellEffectIndex([anthem()]);
    expect(index['rallying-anthem']?.map((e) => e.id)).toEqual(['spell-effect-rallying-anthem']);
    expect(index['heroism']?.map((e) => e.id)).toEqual(['heroism']);
    // Conditions never appear.
    expect(index['frightened']).toBeUndefined();
  });

  it('suppresses a built-in when an imported effect covers the same spell', () => {
    const importedHaste = anthem({
      id: 'spell-effect-haste',
      name: 'Haste',
      sourceSpellSlug: 'haste'
    });
    const index = buildSpellEffectIndex([importedHaste]);
    expect(index['haste']?.map((e) => e.id)).toEqual(['spell-effect-haste']);

    const options = listSpellEffectOptionsFrom([importedHaste]);
    expect(options.filter((o) => o.name === 'Haste').map((o) => o.id)).toEqual([
      'spell-effect-haste'
    ]);
  });
});

describe('defaultApplyDuration', () => {
  it('uses the effect default duration anchored to the given combatant', () => {
    registerLibraryEffects([anthem()]);
    expect(defaultApplyDuration('spell-effect-rallying-anthem', 'bard-1')).toEqual({
      type: 'rounds',
      count: 1,
      anchorId: 'bard-1',
      expiry: 'turnStart'
    });
  });

  it('falls back to unlimited for conditions and unknown effects', () => {
    expect(defaultApplyDuration('frightened', 'bard-1')).toEqual({ type: 'unlimited' });
    expect(defaultApplyDuration('nope', 'bard-1')).toEqual({ type: 'unlimited' });
  });
});

describe('listSpellEffectOptionsFrom', () => {
  it('merges built-ins with the stored list and reflects deletions', () => {
    const withAnthem = listSpellEffectOptionsFrom([anthem()]);
    expect(withAnthem.some((option) => option.id === 'spell-effect-rallying-anthem')).toBe(true);
    expect(withAnthem.find((option) => option.id === 'spell-effect-rallying-anthem')?.durationHint).toBe(
      '1 round'
    );

    const without = listSpellEffectOptionsFrom([]);
    expect(without.some((option) => option.id === 'spell-effect-rallying-anthem')).toBe(false);
    expect(without.some((option) => option.id === 'heroism')).toBe(true);
  });
});
