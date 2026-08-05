import { describe, expect, test } from 'vitest';
import type { AfflictionData, EffectDefinition } from '../types';
import { applyCommand } from '../reducer';
import { combatant, command, encounter } from '../test-support';
import { effectLibrary } from './library';
import {
  afflictionDataIssues,
  afflictionSaveDeltas,
  afflictionSaveLabel,
  afflictionStageDescription
} from './afflictions';

const venom = effectLibrary['spider-venom'];
const fever = effectLibrary['ghoul-fever'];

function afflictionDef(data: Partial<AfflictionData> = {}, category: EffectDefinition['category'] = 'affliction'): EffectDefinition {
  return {
    id: 'test-affliction',
    name: 'Test Affliction',
    category,
    modifiers: [],
    hasValue: true,
    afflictionData: {
      saveType: 'fortitude',
      saveDC: 15,
      interval: '1 round',
      stages: [{ stage: 1, description: 'stage one' }],
      ...data
    }
  };
}

describe('afflictionStageDescription (spec §6.1)', () => {
  test('value N shows stages[N-1]', () => {
    expect(afflictionStageDescription(venom, 2)).toBe('1d4 poison damage and enfeebled 2 (1 round)');
  });

  test('values past the highest defined stage clamp to the last stage', () => {
    expect(afflictionStageDescription(venom, 5)).toBe('2d4 poison damage and enfeebled 2 (1 round)');
  });

  test('undefined value defaults to stage 1; zero or below shows nothing', () => {
    expect(afflictionStageDescription(venom, undefined)).toBe('1d4 poison damage and enfeebled 1 (1 round)');
    expect(afflictionStageDescription(venom, 0)).toBeUndefined();
  });

  test('non-affliction definitions have no stage text', () => {
    expect(afflictionStageDescription(effectLibrary['frightened'], 1)).toBeUndefined();
  });
});

describe('save prompt generation (spec §5.1)', () => {
  function activeWithAffliction(effectId: string) {
    return encounter({
      phase: 'ACTIVE',
      round: 1,
      combatants: {
        'pc-1': combatant('pc-1', {
          appliedEffects: [{ instanceId: 'a-1', effectId, value: 1, duration: { type: 'unlimited' } }]
        }),
        'goblin-1': combatant('goblin-1')
      },
      initiative: { order: ['pc-1', 'goblin-1'], currentIndex: 0, scores: {} }
    });
  }

  test('a 1-round affliction prompts a save at the carrier turn end', () => {
    const result = applyCommand(activeWithAffliction('spider-venom'), command('END_TURN'), effectLibrary);
    expect(result.newState.phase).toBe('RESOLVING');
    const prompt = result.newState.pendingPrompts[0];
    expect(prompt).toMatchObject({ targetId: 'pc-1', effectName: 'Spider Venom' });
    expect(prompt.description).toContain('Fortitude save DC 22');
    expect(prompt.description).toContain('reduce by 2');
  });

  test('a long-interval affliction fires no combat prompt', () => {
    expect(fever.turnEndSuggestion).toBeUndefined();
    const result = applyCommand(activeWithAffliction('ghoul-fever'), command('END_TURN'), effectLibrary);
    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.pendingPrompts).toEqual([]);
  });
});

describe('stage changes through existing commands (spec §7, §13.3-4)', () => {
  test('MODIFY_EFFECT_VALUE to 0 auto-removes the affliction (recovery)', () => {
    const state = encounter({
      phase: 'ACTIVE',
      combatants: {
        'pc-1': combatant('pc-1', {
          appliedEffects: [
            { instanceId: 'a-1', effectId: 'spider-venom', value: 1, duration: { type: 'unlimited' } }
          ]
        })
      },
      initiative: { order: ['pc-1'], currentIndex: 0, scores: {} }
    });

    const result = applyCommand(
      state,
      command('MODIFY_EFFECT_VALUE', { targetId: 'pc-1', instanceId: 'a-1', delta: -1 }),
      effectLibrary
    );
    expect(result.newState.combatants['pc-1'].appliedEffects).toEqual([]);
  });
});

describe('afflictionSaveLabel and deltas (spec §5.2)', () => {
  test('standard label and deltas', () => {
    const data = venom.afflictionData!;
    expect(afflictionSaveLabel(data)).toBe('Fortitude DC 22');
    expect(afflictionSaveDeltas(data)).toEqual({ critSuccess: -2, success: -1, failure: 1, critFailure: 2 });
  });

  test('virulent label, deltas, and generated prompt template', () => {
    const def = afflictionDef({ virulent: true });
    expect(afflictionSaveLabel(def.afflictionData!)).toBe('Fortitude DC 15 (virulent)');
    expect(afflictionSaveDeltas(def.afflictionData!)).toEqual({ critSuccess: -1, success: 0, failure: 1, critFailure: 2 });
  });
});

describe('afflictionDataIssues (spec §10)', () => {
  test('built-in afflictions all validate clean', () => {
    for (const def of Object.values(effectLibrary)) {
      expect(afflictionDataIssues(def)).toEqual([]);
    }
  });

  test('affliction without afflictionData is rejected', () => {
    const def = { ...afflictionDef(), afflictionData: undefined };
    expect(afflictionDataIssues(def)).toEqual(['category "affliction" requires afflictionData']);
  });

  test('afflictionData on a non-affliction is rejected', () => {
    const def = afflictionDef({}, 'spell');
    expect(afflictionDataIssues(def)).toEqual([
      'afflictionData is only valid on category "affliction" (got "spell")'
    ]);
  });

  test('non-contiguous stages and bad fields are flagged', () => {
    const def = afflictionDef({
      saveDC: -1,
      interval: ' ',
      stages: [
        { stage: 1, description: 'ok' },
        { stage: 3, description: '' }
      ]
    });
    const issues = afflictionDataIssues(def);
    expect(issues).toContain('afflictionData.saveDC must be an integer >= 0');
    expect(issues).toContain('afflictionData.interval must be a non-empty string');
    expect(issues).toContain('afflictionData.stages[1].stage must be 2 (stages are 1-indexed and contiguous)');
    expect(issues).toContain('afflictionData.stages[1].description must be a non-empty string');
  });
});
