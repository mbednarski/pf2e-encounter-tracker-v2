import { describe, expect, test } from 'vitest';
import type { EffectLibrary, Prompt } from './types';
import { effectLibrary } from './effects/library';
import { applyCommand } from './reducer';
import {
  activeEncounter,
  combatant,
  command,
  emptyEffects,
  encounter,
  expectEvents,
  expectRejected,
  expectSerializable
} from './test-support';

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

  test('starts an encounter into resolving when first combatant has start-turn prompts', () => {
    const state = encounter({
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'slowed-1',
              effectId: 'slowed',
              value: 2,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      },
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: -1,
        delaying: []
      }
    });

    const result = applyCommand(state, command('START_ENCOUNTER'), effectLibrary);

    expect(result.newState.phase).toBe('RESOLVING');
    expect(result.newState.pendingPrompts).toEqual<Prompt[]>([
      {
        id: 'prompt:turnStart:goblin-1:goblin-1:slowed-1',
        boundary: { type: 'turnStart', ownerId: 'goblin-1' },
        targetId: 'goblin-1',
        effectInstanceId: 'slowed-1',
        effectName: 'Slowed',
        description: 'Loses 2 action(s) this turn.',
        suggestionType: { type: 'reminder', description: 'Loses {value} action(s) this turn.' },
        currentValue: 2
      }
    ]);
    expectEvents(result, [
      { type: 'encounter-started' },
      { type: 'phase-changed', from: 'PREPARING', to: 'ACTIVE' },
      { type: 'turn-started', combatantId: 'goblin-1', round: 1 },
      {
        type: 'prompt-generated',
        promptId: 'prompt:turnStart:goblin-1:goblin-1:slowed-1',
        boundary: { type: 'turnStart', ownerId: 'goblin-1' },
        targetId: 'goblin-1',
        effectInstanceId: 'slowed-1',
        effectName: 'Slowed',
        suggestionType: 'reminder',
        description: 'Loses 2 action(s) this turn.'
      },
      { type: 'phase-changed', from: 'ACTIVE', to: 'RESOLVING' }
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

describe('applyCommand prompt resolution slice', () => {
  test('accepts a decrement prompt and continues advancement after the last end-turn prompt', () => {
    const resolving = applyCommand(
      activeEncounter({
        combatants: {
          'goblin-1': combatant('goblin-1', {
            appliedEffects: [
              {
                instanceId: 'frightened-1',
                effectId: 'frightened',
                value: 2,
                duration: { type: 'unlimited' }
              }
            ]
          }),
          'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
        }
      }),
      command('END_TURN'),
      effectLibrary
    ).newState;

    const result = applyCommand(
      resolving,
      command('RESOLVE_PROMPT', {
        promptId: 'prompt:turnEnd:goblin-1:goblin-1:frightened-1',
        resolution: { type: 'accept' }
      }),
      effectLibrary
    );

    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.pendingPrompts).toEqual([]);
    expect(result.newState.initiative.currentIndex).toBe(1);
    expect(result.newState.combatants['goblin-1'].appliedEffects[0].value).toBe(1);
    expect(result.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      {
        type: 'effect-value-changed',
        combatantId: 'goblin-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'frightened-1',
        from: 2,
        to: 1
      },
      {
        type: 'prompt-resolved',
        promptId: 'prompt:turnEnd:goblin-1:goblin-1:frightened-1',
        resolution: { type: 'accept' }
      },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 },
      { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }
    ]);
    expectSerializable(result.newState);
  });

  test('resolves setValue, dismiss, and remove prompts without advancing while prompts remain', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-set',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'frightened-1',
          effectName: 'Frightened',
          description: 'Frightened 3',
          suggestionType: { type: 'promptResolution', description: 'Adjust frightened.' },
          currentValue: 3
        },
        {
          id: 'prompt-dismiss',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Slowed reminder',
          suggestionType: { type: 'reminder', description: 'Check actions.' },
          currentValue: 1
        },
        {
          id: 'prompt-remove',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Remove slowed',
          suggestionType: { type: 'suggestRemove', description: 'Remove slowed.' },
          currentValue: 1
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'frightened-1',
              effectId: 'frightened',
              value: 3,
              duration: { type: 'unlimited' }
            },
            {
              instanceId: 'slowed-1',
              effectId: 'slowed',
              value: 1,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const set = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-set', resolution: { type: 'setValue', value: 1 } }),
      effectLibrary
    );
    const dismissed = applyCommand(
      set.newState,
      command('RESOLVE_PROMPT', { promptId: 'prompt-dismiss', resolution: { type: 'dismiss' } }),
      effectLibrary
    );
    const removed = applyCommand(
      dismissed.newState,
      command('RESOLVE_PROMPT', { promptId: 'prompt-remove', resolution: { type: 'remove' } }),
      effectLibrary
    );

    expect(set.newState.phase).toBe('RESOLVING');
    expect(set.newState.pendingPrompts.map((prompt) => prompt.id)).toEqual(['prompt-dismiss', 'prompt-remove']);
    expect(set.newState.combatants['goblin-1'].appliedEffects[0].value).toBe(1);
    expectEvents(set, [
      {
        type: 'effect-value-changed',
        combatantId: 'goblin-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'frightened-1',
        from: 3,
        to: 1
      },
      { type: 'prompt-resolved', promptId: 'prompt-set', resolution: { type: 'setValue', value: 1 } }
    ]);

    expect(dismissed.newState.phase).toBe('RESOLVING');
    expect(dismissed.newState.pendingPrompts.map((prompt) => prompt.id)).toEqual(['prompt-remove']);
    expectEvents(dismissed, [
      { type: 'prompt-resolved', promptId: 'prompt-dismiss', resolution: { type: 'dismiss' } }
    ]);

    expect(removed.newState.phase).toBe('ACTIVE');
    expect(removed.newState.pendingPrompts).toEqual([]);
    expect(removed.newState.combatants['goblin-1'].appliedEffects).toEqual([
      {
        instanceId: 'frightened-1',
        effectId: 'frightened',
        value: 1,
        duration: { type: 'unlimited' }
      }
    ]);
    expectEvents(removed, [
      {
        type: 'effect-removed',
        combatantId: 'goblin-1',
        effectId: 'slowed',
        effectName: 'Slowed',
        instanceId: 'slowed-1',
        reason: 'removed'
      },
      { type: 'prompt-resolved', promptId: 'prompt-remove', resolution: { type: 'remove' } },
      { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }
    ]);
  });

  test('resolves promptResolution accept by removing the effect', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-persistent',
          boundary: { type: 'turnStart', ownerId: 'fighter-1' },
          targetId: 'fighter-1',
          effectInstanceId: 'persistent-fire-1',
          effectName: 'Persistent Fire',
          description: 'Take 2d6 fire damage, then flat check DC 15 to remove.',
          suggestionType: {
            type: 'promptResolution',
            description: 'Take {note} fire damage, then flat check DC 15 to remove.'
          }
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', {
          appliedEffects: [
            {
              instanceId: 'persistent-fire-1',
              effectId: 'persistent-fire',
              duration: { type: 'unlimited' },
              note: '2d6'
            }
          ]
        })
      }
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-persistent', resolution: { type: 'accept' } }),
      effectLibrary
    );

    expect(result.newState.combatants['fighter-1'].appliedEffects).toEqual([]);
    expectEvents(result, [
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'persistent-fire',
        effectName: 'Persistent Fire',
        instanceId: 'persistent-fire-1',
        reason: 'removed'
      },
      { type: 'prompt-resolved', promptId: 'prompt-persistent', resolution: { type: 'accept' } },
      { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }
    ]);
  });

  test('rejects unknown prompt ids', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-known',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Check actions.',
          suggestionType: { type: 'reminder', description: 'Check actions.' },
          currentValue: 1
        }
      ]
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'missing-prompt', resolution: { type: 'dismiss' } }),
      effectLibrary
    );

    expectRejected(result, 'RESOLVE_PROMPT', 'Prompt missing-prompt not found', state);
  });

  test('rejects prompt resolution choices that do not match the prompt suggestion', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-reminder',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Check actions.',
          suggestionType: { type: 'reminder', description: 'Check actions.' },
          currentValue: 1
        }
      ]
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-reminder', resolution: { type: 'accept' } }),
      effectLibrary
    );

    expectRejected(result, 'RESOLVE_PROMPT', 'accept does not match reminder', state);
  });

  test('retags delegated prompt resolution rejections as RESOLVE_PROMPT', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-off-guard',
          boundary: { type: 'turnStart', ownerId: 'fighter-1' },
          targetId: 'fighter-1',
          effectInstanceId: 'off-guard-1',
          effectName: 'Off-Guard',
          description: 'Adjust off-guard.',
          suggestionType: { type: 'promptResolution', description: 'Adjust off-guard.' }
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', {
          appliedEffects: [
            {
              instanceId: 'off-guard-1',
              effectId: 'off-guard',
              duration: { type: 'unlimited' }
            }
          ]
        })
      }
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-off-guard', resolution: { type: 'setValue', value: 1 } }),
      effectLibrary
    );

    expectRejected(result, 'RESOLVE_PROMPT', 'SET_EFFECT_VALUE requires a value effect', state);
  });

  test('rejects invalid runtime prompt and resolution shapes without throwing', () => {
    const missingTarget = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-invalid-target',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          combatantId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Check actions.',
          suggestionType: { type: 'reminder', description: 'Check actions.' }
        } as unknown as Prompt
      ]
    });
    const invalidSuggestion = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-invalid-suggestion',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Check actions.',
          suggestionType: { type: 'unknown' }
        } as unknown as Prompt
      ]
    });
    const invalidResolution = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-valid',
          boundary: { type: 'turnStart', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Check actions.',
          suggestionType: { type: 'reminder', description: 'Check actions.' }
        }
      ]
    });

    expectRejected(
      applyCommand(
        missingTarget,
        command('RESOLVE_PROMPT', { promptId: 'prompt-invalid-target', resolution: { type: 'dismiss' } }),
        effectLibrary
      ),
      'RESOLVE_PROMPT',
      'Prompt prompt-invalid-target has an invalid target',
      missingTarget
    );
    expectRejected(
      applyCommand(
        invalidSuggestion,
        command('RESOLVE_PROMPT', { promptId: 'prompt-invalid-suggestion', resolution: { type: 'dismiss' } }),
        effectLibrary
      ),
      'RESOLVE_PROMPT',
      'Prompt prompt-invalid-suggestion has an invalid suggestion',
      invalidSuggestion
    );
    expectRejected(
      applyCommand(
        invalidResolution,
        command('RESOLVE_PROMPT', {
          promptId: 'prompt-valid',
          resolution: { type: 'unknown' } as unknown as { type: 'dismiss' }
        }),
        effectLibrary
      ),
      'RESOLVE_PROMPT',
      'RESOLVE_PROMPT resolution type is invalid',
      invalidResolution
    );
  });

  test('continues end-turn advancement after dismissing the last end-turn prompt', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      turnResolution: { type: 'advanceAfterTurnEnd', startIndex: 1 },
      pendingPrompts: [
        {
          id: 'prompt-frightened',
          boundary: { type: 'turnEnd', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'frightened-1',
          effectName: 'Frightened',
          description: 'Frightened 1',
          suggestionType: { type: 'suggestDecrement', amount: 1 },
          currentValue: 1,
          suggestedValue: 0
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'frightened-1',
              effectId: 'frightened',
              value: 1,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
      }
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-frightened', resolution: { type: 'dismiss' } }),
      effectLibrary
    );

    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.initiative.currentIndex).toBe(1);
    expect(result.newState.pendingPrompts).toEqual([]);
    expect(result.newState.turnResolution).toBeUndefined();
    expectEvents(result, [
      { type: 'prompt-resolved', promptId: 'prompt-frightened', resolution: { type: 'dismiss' } },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 },
      { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }
    ]);
  });

  test('continues end-turn advancement after removing the last end-turn prompt effect', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      turnResolution: { type: 'advanceAfterTurnEnd', startIndex: 1 },
      pendingPrompts: [
        {
          id: 'prompt-slowed',
          boundary: { type: 'turnEnd', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Remove slowed',
          suggestionType: { type: 'suggestRemove', description: 'Remove slowed.' },
          currentValue: 1
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'slowed-1',
              effectId: 'slowed',
              value: 1,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-slowed', resolution: { type: 'remove' } }),
      effectLibrary
    );

    expect(result.newState.phase).toBe('ACTIVE');
    expect(result.newState.initiative.currentIndex).toBe(1);
    expect(result.newState.combatants['goblin-1'].appliedEffects).toEqual([]);
    expectEvents(result, [
      {
        type: 'effect-removed',
        combatantId: 'goblin-1',
        effectId: 'slowed',
        effectName: 'Slowed',
        instanceId: 'slowed-1',
        reason: 'removed'
      },
      { type: 'prompt-resolved', promptId: 'prompt-slowed', resolution: { type: 'remove' } },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 },
      { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }
    ]);
  });

  test('does not emit a resolving-to-active phase event when continuation finds all combatants dead', () => {
    const state = activeEncounter({
      phase: 'RESOLVING',
      turnResolution: { type: 'advanceAfterTurnEnd', startIndex: 1 },
      pendingPrompts: [
        {
          id: 'prompt-dead',
          boundary: { type: 'turnEnd', ownerId: 'goblin-1' },
          targetId: 'goblin-1',
          effectInstanceId: 'slowed-1',
          effectName: 'Slowed',
          description: 'Check actions.',
          suggestionType: { type: 'reminder', description: 'Check actions.' }
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1', { isAlive: false }),
        'fighter-1': combatant('fighter-1', { isAlive: false })
      }
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-dead', resolution: { type: 'dismiss' } }),
      effectLibrary
    );

    expect(result.newState.phase).toBe('ACTIVE');
    expectEvents(result, [
      { type: 'prompt-resolved', promptId: 'prompt-dead', resolution: { type: 'dismiss' } },
      { type: 'all-combatants-dead' }
    ]);
  });

  test('confirmSustained anchors refreshed duration to the effect source when present', () => {
    const sustainedLibrary: EffectLibrary = {
      sustainedBless: {
        id: 'sustainedBless',
        name: 'Sustained Bless',
        category: 'spell',
        hasValue: false,
        modifiers: [],
        turnEndSuggestion: { type: 'confirmSustained', description: 'Sustain Bless?' }
      }
    };
    const state = activeEncounter({
      phase: 'RESOLVING',
      pendingPrompts: [
        {
          id: 'prompt-bless',
          boundary: { type: 'turnEnd', ownerId: 'fighter-1' },
          targetId: 'fighter-1',
          effectInstanceId: 'bless-1',
          effectName: 'Sustained Bless',
          description: 'Sustain Bless?',
          suggestionType: { type: 'confirmSustained', description: 'Sustain Bless?' }
        }
      ],
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', {
          appliedEffects: [
            {
              instanceId: 'bless-1',
              effectId: 'sustainedBless',
              sourceId: 'goblin-1',
              duration: { type: 'unlimited' }
            }
          ]
        })
      }
    });

    const result = applyCommand(
      state,
      command('RESOLVE_PROMPT', { promptId: 'prompt-bless', resolution: { type: 'accept' } }),
      sustainedLibrary
    );

    expect(result.newState.combatants['fighter-1'].appliedEffects[0].duration).toEqual({
      type: 'untilTurnEnd',
      combatantId: 'goblin-1'
    });
    expectEvents(result, [
      {
        type: 'effect-duration-changed',
        combatantId: 'fighter-1',
        effectId: 'sustainedBless',
        effectName: 'Sustained Bless',
        instanceId: 'bless-1'
      },
      { type: 'prompt-resolved', promptId: 'prompt-bless', resolution: { type: 'accept' } },
      { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }
    ]);
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

  test('generates end-turn prompts after hard-clock expiry and blocks advancement', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'expired-frightened',
              effectId: 'frightened',
              value: 2,
              duration: { type: 'untilTurnEnd', combatantId: 'goblin-1' }
            },
            {
              instanceId: 'active-frightened',
              effectId: 'frightened',
              value: 3,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState.phase).toBe('RESOLVING');
    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.newState.combatants['goblin-1'].appliedEffects).toEqual([
      {
        instanceId: 'active-frightened',
        effectId: 'frightened',
        value: 3,
        duration: { type: 'unlimited' }
      }
    ]);
    expect(result.newState.pendingPrompts).toEqual<Prompt[]>([
      {
        id: 'prompt:turnEnd:goblin-1:goblin-1:active-frightened',
        boundary: { type: 'turnEnd', ownerId: 'goblin-1' },
        targetId: 'goblin-1',
        effectInstanceId: 'active-frightened',
        effectName: 'Frightened',
        description: 'Frightened 3',
        suggestionType: { type: 'suggestDecrement', amount: 1 },
        currentValue: 3,
        suggestedValue: 2
      }
    ]);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      {
        type: 'effect-removed',
        combatantId: 'goblin-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'expired-frightened',
        reason: 'expired'
      },
      {
        type: 'prompt-generated',
        promptId: 'prompt:turnEnd:goblin-1:goblin-1:active-frightened',
        boundary: { type: 'turnEnd', ownerId: 'goblin-1' },
        targetId: 'goblin-1',
        effectInstanceId: 'active-frightened',
        effectName: 'Frightened',
        suggestionType: 'suggestDecrement',
        description: 'Frightened 3'
      },
      { type: 'phase-changed', from: 'ACTIVE', to: 'RESOLVING' }
    ]);
  });

  test('generates start-turn prompts after hard-clock expiry and enters resolving', () => {
    const state = activeEncounter({
      round: 2,
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 1,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1', {
          reactionUsedThisRound: true,
          appliedEffects: [
            {
              instanceId: 'expired-slowed',
              effectId: 'slowed',
              value: 1,
              duration: { type: 'untilTurnStart', combatantId: 'goblin-1' }
            },
            {
              instanceId: 'active-slowed',
              effectId: 'slowed',
              value: 2,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState.phase).toBe('RESOLVING');
    expect(result.newState.initiative.currentIndex).toBe(0);
    expect(result.newState.round).toBe(3);
    expect(result.newState.combatants['goblin-1'].appliedEffects).toEqual([
      {
        instanceId: 'active-slowed',
        effectId: 'slowed',
        value: 2,
        duration: { type: 'unlimited' }
      }
    ]);
    expect(result.newState.pendingPrompts[0]).toMatchObject({
      id: 'prompt:turnStart:goblin-1:goblin-1:active-slowed',
      boundary: { type: 'turnStart', ownerId: 'goblin-1' },
      targetId: 'goblin-1',
      effectInstanceId: 'active-slowed',
      effectName: 'Slowed',
      description: 'Loses 2 action(s) this turn.',
      suggestionType: { type: 'reminder', description: 'Loses {value} action(s) this turn.' },
      currentValue: 2
    });
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'fighter-1' },
      { type: 'reaction-reset', combatantId: 'goblin-1', cause: 'auto' },
      { type: 'round-started', round: 3 },
      {
        type: 'effect-removed',
        combatantId: 'goblin-1',
        effectId: 'slowed',
        effectName: 'Slowed',
        instanceId: 'expired-slowed',
        reason: 'expired'
      },
      { type: 'turn-started', combatantId: 'goblin-1', round: 3 },
      {
        type: 'prompt-generated',
        promptId: 'prompt:turnStart:goblin-1:goblin-1:active-slowed',
        boundary: { type: 'turnStart', ownerId: 'goblin-1' },
        targetId: 'goblin-1',
        effectInstanceId: 'active-slowed',
        effectName: 'Slowed',
        suggestionType: 'reminder',
        description: 'Loses 2 action(s) this turn.'
      },
      { type: 'phase-changed', from: 'ACTIVE', to: 'RESOLVING' }
    ]);
  });

  test('retains prior end-boundary events when prompt generation rejects', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'missing-1',
              effectId: 'missing-effect',
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), emptyEffects);

    expect(result.newState).toMatchObject({
      phase: 'ACTIVE',
      initiative: { currentIndex: 0 }
    });
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'command-rejected', commandType: 'END_TURN', reason: 'Effect missing-effect not found' }
    ]);
  });

  test('retains prior start-boundary events when prompt generation rejects', () => {
    const state = activeEncounter({
      initiative: {
        order: ['goblin-1', 'fighter-1'],
        currentIndex: 0,
        delaying: []
      },
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', {
          reactionUsedThisRound: true,
          appliedEffects: [
            {
              instanceId: 'missing-1',
              effectId: 'missing-effect',
              duration: { type: 'unlimited' }
            }
          ]
        })
      }
    });

    const result = applyCommand(state, command('END_TURN'), emptyEffects);

    expect(result.newState.initiative.currentIndex).toBe(1);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 },
      { type: 'command-rejected', commandType: 'END_TURN', reason: 'Effect missing-effect not found' }
    ]);
  });

  test('uses effect instance ids to keep duplicate effect prompts distinct', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'frightened-a',
              effectId: 'frightened',
              value: 1,
              duration: { type: 'unlimited' }
            },
            {
              instanceId: 'frightened-b',
              effectId: 'frightened',
              value: 2,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState.pendingPrompts.map((prompt) => prompt.id)).toEqual([
      'prompt:turnEnd:goblin-1:goblin-1:frightened-a',
      'prompt:turnEnd:goblin-1:goblin-1:frightened-b'
    ]);
  });

  test('keeps intermediate resolving continuation state serializable', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1', {
          appliedEffects: [
            {
              instanceId: 'frightened-1',
              effectId: 'frightened',
              value: 2,
              duration: { type: 'unlimited' }
            }
          ]
        }),
        'fighter-1': combatant('fighter-1')
      }
    });

    const result = applyCommand(state, command('END_TURN'), effectLibrary);

    expect(result.newState).toMatchObject({
      phase: 'RESOLVING',
      turnResolution: { type: 'advanceAfterTurnEnd', startIndex: 1 }
    });
    expectSerializable(result.newState);
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

describe('applyCommand effect slice', () => {
  const customEffectLibrary: EffectLibrary = {
    parent: {
      id: 'parent',
      name: 'Parent',
      category: 'custom',
      hasValue: false,
      modifiers: [],
      impliedEffects: ['child']
    },
    child: {
      id: 'child',
      name: 'Child',
      category: 'custom',
      hasValue: false,
      modifiers: []
    }
  };

  test('applies a value effect with defaults and freezes the source label', () => {
    const state = activeEncounter();

    const result = applyCommand(
      state,
      command('APPLY_EFFECT', {
        effectId: 'frightened',
        targetId: 'fighter-1',
        sourceId: 'goblin-1'
      }),
      effectLibrary
    );

    const applied = result.newState.combatants['fighter-1'].appliedEffects;
    const instanceId = applied[0].instanceId;
    expect(instanceId).toBeTypeOf('string');
    expect(applied).toEqual([
      {
        instanceId,
        effectId: 'frightened',
        value: 1,
        sourceId: 'goblin-1',
        sourceLabel: 'Goblin Warrior',
        duration: { type: 'unlimited' }
      }
    ]);
    expect(applied[0].sourceId).toBe('goblin-1');
    expect(applied[0].sourceLabel).toBe('Goblin Warrior');
    expect(result.events).toEqual([
      {
        type: 'effect-applied',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId,
        value: 1
      }
    ]);
  });

  test('rejects invalid effect application payloads', () => {
    const state = activeEncounter();

    expectRejected(
      applyCommand(state, command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'missing-1' }), effectLibrary),
      'APPLY_EFFECT',
      'Combatant missing-1 not found',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1', sourceId: 'missing-1' }),
        effectLibrary
      ),
      'APPLY_EFFECT',
      'Source combatant missing-1 not found',
      state
    );
    expectRejected(
      applyCommand(state, command('APPLY_EFFECT', { effectId: 'missing-effect', targetId: 'fighter-1' }), effectLibrary),
      'APPLY_EFFECT',
      'Effect missing-effect not found',
      state
    );
    expectRejected(
      applyCommand(state, command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1', value: 0 }), effectLibrary),
      'APPLY_EFFECT',
      'APPLY_EFFECT value must be >= 1 for Frightened',
      state
    );
    expectRejected(
      applyCommand(state, command('APPLY_EFFECT', { effectId: 'off-guard', targetId: 'fighter-1', value: 1 }), effectLibrary),
      'APPLY_EFFECT',
      'APPLY_EFFECT value is not allowed for Off-Guard',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('APPLY_EFFECT', {
          effectId: 'frightened',
          targetId: 'fighter-1',
          duration: { type: 'untilTurnEnd', combatantId: 'missing-1' }
        }),
        effectLibrary
      ),
      'APPLY_EFFECT',
      'APPLY_EFFECT duration is invalid',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('APPLY_EFFECT', {
          effectId: 'frightened',
          targetId: 'fighter-1',
          duration: { type: 'untilTurnStart', combatantId: 'missing-1' }
        }),
        effectLibrary
      ),
      'APPLY_EFFECT',
      'APPLY_EFFECT duration is invalid',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('APPLY_EFFECT', {
          effectId: 'frightened',
          targetId: 'fighter-1',
          duration: { type: 'conditional', description: '   ' }
        }),
        effectLibrary
      ),
      'APPLY_EFFECT',
      'APPLY_EFFECT duration is invalid',
      state
    );
  });

  test('rejects missing implied effects and implied effect cycles', () => {
    const state = activeEncounter();
    const missingChildLibrary: EffectLibrary = {
      parent: {
        ...customEffectLibrary.parent,
        impliedEffects: ['missing-child']
      }
    };
    const cyclicLibrary: EffectLibrary = {
      parent: {
        ...customEffectLibrary.parent,
        impliedEffects: ['child']
      },
      child: {
        ...customEffectLibrary.child,
        impliedEffects: ['parent']
      }
    };

    expectRejected(
      applyCommand(state, command('APPLY_EFFECT', { effectId: 'parent', targetId: 'fighter-1' }), missingChildLibrary),
      'APPLY_EFFECT',
      'Effect missing-child not found',
      state
    );
    expectRejected(
      applyCommand(state, command('APPLY_EFFECT', { effectId: 'parent', targetId: 'fighter-1' }), cyclicLibrary),
      'APPLY_EFFECT',
      'Effect parent implied effect cycle detected',
      state
    );
  });

  test('creates duplicate same-effect instances and does not enforce maxValue', () => {
    const state = activeEncounter();
    const first = applyCommand(
      state,
      command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1', value: 7 }),
      effectLibrary
    );
    const second = applyCommand(
      first.newState,
      command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1', value: 10 }),
      effectLibrary
    );

    expect(second.newState.combatants['fighter-1'].appliedEffects).toMatchObject([
      { effectId: 'frightened', value: 7 },
      { effectId: 'frightened', value: 10 }
    ]);
    expect(first.events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'command-rejected' })]));
    expect(second.events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'command-rejected' })]));

    const instanceId = second.newState.combatants['fighter-1'].appliedEffects[0].instanceId;
    const set = applyCommand(
      second.newState,
      command('SET_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, newValue: 12 }),
      effectLibrary
    );

    expect(set.newState.combatants['fighter-1'].appliedEffects[0].value).toBe(12);
  });

  test('sets, modifies, and auto-removes effect values', () => {
    const state = applyCommand(
      activeEncounter(),
      command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1', value: 2 }),
      effectLibrary
    ).newState;
    const instanceId = state.combatants['fighter-1'].appliedEffects[0].instanceId;

    const set = applyCommand(
      state,
      command('SET_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, newValue: 10 }),
      effectLibrary
    );
    const modified = applyCommand(
      set.newState,
      command('MODIFY_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, delta: -3 }),
      effectLibrary
    );
    const removed = applyCommand(
      modified.newState,
      command('MODIFY_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, delta: -7 }),
      effectLibrary
    );

    expect(set.newState.combatants['fighter-1'].appliedEffects[0].value).toBe(10);
    expectEvents(set, [
      {
        type: 'effect-value-changed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId,
        from: 2,
        to: 10
      }
    ]);
    expect(modified.newState.combatants['fighter-1'].appliedEffects[0].value).toBe(7);
    expectEvents(modified, [
      {
        type: 'effect-value-changed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId,
        from: 10,
        to: 7
      }
    ]);
    expect(removed.newState.combatants['fighter-1'].appliedEffects).toEqual([]);
    expectEvents(removed, [
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId,
        reason: 'auto-decremented'
      }
    ]);
  });

  test('rejects invalid value and duration changes', () => {
    const state = applyCommand(
      activeEncounter(),
      command('APPLY_EFFECT', { effectId: 'off-guard', targetId: 'fighter-1' }),
      effectLibrary
    ).newState;
    const instanceId = state.combatants['fighter-1'].appliedEffects[0].instanceId;

    expectRejected(
      applyCommand(state, command('SET_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, newValue: 1 }), effectLibrary),
      'SET_EFFECT_VALUE',
      'SET_EFFECT_VALUE requires a value effect',
      state
    );
    expectRejected(
      applyCommand(state, command('SET_EFFECT_DURATION', { targetId: 'fighter-1', instanceId, newDuration: { type: 'rounds', count: 0 } }), effectLibrary),
      'SET_EFFECT_DURATION',
      'SET_EFFECT_DURATION duration is invalid',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('SET_EFFECT_DURATION', {
          targetId: 'fighter-1',
          instanceId,
          newDuration: { type: 'conditional', description: '   ' }
        }),
        effectLibrary
      ),
      'SET_EFFECT_DURATION',
      'SET_EFFECT_DURATION duration is invalid',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('SET_EFFECT_DURATION', {
          targetId: 'fighter-1',
          instanceId,
          newDuration: { type: 'untilTurnEnd', combatantId: 'missing-1' }
        }),
        effectLibrary
      ),
      'SET_EFFECT_DURATION',
      'SET_EFFECT_DURATION duration is invalid',
      state
    );
    expectRejected(
      applyCommand(
        state,
        command('SET_EFFECT_DURATION', {
          targetId: 'fighter-1',
          instanceId,
          newDuration: { type: 'untilTurnStart', combatantId: 'missing-1' }
        }),
        effectLibrary
      ),
      'SET_EFFECT_DURATION',
      'SET_EFFECT_DURATION duration is invalid',
      state
    );
    expectRejected(
      applyCommand(state, command('MODIFY_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, delta: 1 }), effectLibrary),
      'MODIFY_EFFECT_VALUE',
      'MODIFY_EFFECT_VALUE requires a value effect',
      state
    );
    expectRejected(
      applyCommand(state, command('SET_EFFECT_VALUE', { targetId: 'fighter-1', instanceId, newValue: 0 }), effectLibrary),
      'SET_EFFECT_VALUE',
      'SET_EFFECT_VALUE requires a value effect',
      state
    );

    const frightenedState = applyCommand(
      activeEncounter(),
      command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1' }),
      effectLibrary
    ).newState;
    const frightenedId = frightenedState.combatants['fighter-1'].appliedEffects[0].instanceId;

    expectRejected(
      applyCommand(
        frightenedState,
        command('SET_EFFECT_VALUE', { targetId: 'fighter-1', instanceId: frightenedId, newValue: 0 }),
        effectLibrary
      ),
      'SET_EFFECT_VALUE',
      'SET_EFFECT_VALUE newValue must be >= 1',
      frightenedState
    );
    expectRejected(
      applyCommand(
        frightenedState,
        command('MODIFY_EFFECT_VALUE', { targetId: 'fighter-1', instanceId: frightenedId, delta: 0.5 }),
        effectLibrary
      ),
      'MODIFY_EFFECT_VALUE',
      'MODIFY_EFFECT_VALUE delta must be an integer',
      frightenedState
    );
  });

  test('updates effect duration', () => {
    const state = applyCommand(
      activeEncounter(),
      command('APPLY_EFFECT', { effectId: 'frightened', targetId: 'fighter-1', value: 2 }),
      effectLibrary
    ).newState;
    const instanceId = state.combatants['fighter-1'].appliedEffects[0].instanceId;

    const result = applyCommand(
      state,
      command('SET_EFFECT_DURATION', {
        targetId: 'fighter-1',
        instanceId,
        newDuration: { type: 'rounds', count: 3 }
      }),
      effectLibrary
    );

    expect(result.newState.combatants['fighter-1'].appliedEffects[0].duration).toEqual({ type: 'rounds', count: 3 });
    expectEvents(result, [
      {
        type: 'effect-duration-changed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId
      }
    ]);

    const hardClock = applyCommand(
      result.newState,
      command('SET_EFFECT_DURATION', {
        targetId: 'fighter-1',
        instanceId,
        newDuration: { type: 'untilTurnEnd', combatantId: 'goblin-1' }
      }),
      effectLibrary
    );
    const startClock = applyCommand(
      hardClock.newState,
      command('SET_EFFECT_DURATION', {
        targetId: 'fighter-1',
        instanceId,
        newDuration: { type: 'untilTurnStart', combatantId: 'fighter-1' }
      }),
      effectLibrary
    );

    expect(hardClock.newState.combatants['fighter-1'].appliedEffects[0].duration).toEqual({
      type: 'untilTurnEnd',
      combatantId: 'goblin-1'
    });
    expect(startClock.newState.combatants['fighter-1'].appliedEffects[0].duration).toEqual({
      type: 'untilTurnStart',
      combatantId: 'fighter-1'
    });
  });

  test('rejects removing or modifying effects without library definitions', () => {
    const state = activeEncounter({
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'fighter-1': combatant('fighter-1', {
          appliedEffects: [
            {
              instanceId: 'unknown-effect-1',
              effectId: 'missing-effect',
              duration: { type: 'unlimited' }
            }
          ]
        })
      }
    });

    expectRejected(
      applyCommand(state, command('REMOVE_EFFECT', { targetId: 'fighter-1', instanceId: 'unknown-effect-1' }), effectLibrary),
      'REMOVE_EFFECT',
      'Effect missing-effect not found',
      state
    );
    expectRejected(
      applyCommand(state, command('REMOVE_EFFECT', { targetId: 'missing-1', instanceId: 'unknown-effect-1' }), effectLibrary),
      'REMOVE_EFFECT',
      'Combatant missing-1 not found',
      state
    );
    expectRejected(
      applyCommand(state, command('REMOVE_EFFECT', { targetId: 'fighter-1', instanceId: 'missing-instance' }), effectLibrary),
      'REMOVE_EFFECT',
      'Effect instance missing-instance not found on fighter-1',
      state
    );
    expectRejected(
      applyCommand(state, command('SET_EFFECT_VALUE', { targetId: 'fighter-1', instanceId: 'unknown-effect-1', newValue: 2 }), effectLibrary),
      'SET_EFFECT_VALUE',
      'Effect missing-effect not found',
      state
    );
  });

  test('expires until-turn-end effects across combatants before advancing turns', () => {
    const state = applyCommand(
      activeEncounter({
        combatants: {
          'goblin-1': combatant('goblin-1'),
          'fighter-1': combatant('fighter-1', { reactionUsedThisRound: true })
        }
      }),
      command('APPLY_EFFECT', {
        effectId: 'grabbed',
        targetId: 'fighter-1',
        duration: { type: 'untilTurnEnd', combatantId: 'goblin-1' }
      }),
      effectLibrary
    ).newState;

    const result = applyCommand(state, command('END_TURN'), effectLibrary);
    const [grabbed, offGuard, immobilized] = state.combatants['fighter-1'].appliedEffects;

    expect(result.newState.combatants['fighter-1'].appliedEffects).toEqual([]);
    expect(result.newState.combatants['fighter-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'grabbed',
        effectName: 'Grabbed',
        instanceId: grabbed.instanceId,
        reason: 'expired'
      },
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'off-guard',
        effectName: 'Off-Guard',
        instanceId: offGuard.instanceId,
        reason: 'cascade',
        parentInstanceId: grabbed.instanceId
      },
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'immobilized',
        effectName: 'Immobilized',
        instanceId: immobilized.instanceId,
        reason: 'cascade',
        parentInstanceId: grabbed.instanceId
      },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 1 }
    ]);
  });

  test('expires until-turn-start effects across combatants immediately before the starting turn', () => {
    const state = applyCommand(
      activeEncounter({
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
      }),
      command('APPLY_EFFECT', {
        effectId: 'frightened',
        targetId: 'fighter-1',
        duration: { type: 'untilTurnStart', combatantId: 'goblin-1' }
      }),
      effectLibrary
    ).newState;

    const result = applyCommand(state, command('END_TURN'), effectLibrary);
    const frightened = state.combatants['fighter-1'].appliedEffects[0];

    expect(result.newState.combatants['fighter-1'].appliedEffects).toEqual([]);
    expect(result.newState.combatants['goblin-1'].reactionUsedThisRound).toBe(false);
    expectEvents(result, [
      { type: 'turn-ended', combatantId: 'fighter-1' },
      { type: 'reaction-reset', combatantId: 'goblin-1', cause: 'auto' },
      { type: 'round-started', round: 3 },
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: frightened.instanceId,
        reason: 'expired'
      },
      { type: 'turn-started', combatantId: 'goblin-1', round: 3 }
    ]);
  });

  test('creates implied children and removal cascades only through the parent chain', () => {
    const withStandalone = applyCommand(
      activeEncounter(),
      command('APPLY_EFFECT', { effectId: 'off-guard', targetId: 'fighter-1' }),
      effectLibrary
    ).newState;
    const standaloneId = withStandalone.combatants['fighter-1'].appliedEffects[0].instanceId;

    const grabbed = applyCommand(
      withStandalone,
      command('APPLY_EFFECT', { effectId: 'grabbed', targetId: 'fighter-1', sourceId: 'goblin-1' }),
      effectLibrary
    );

    const effects = grabbed.newState.combatants['fighter-1'].appliedEffects;
    const grabbedInstance = effects.find((effect) => effect.effectId === 'grabbed');
    const impliedOffGuard = effects.find(
      (effect) => effect.effectId === 'off-guard' && effect.parentInstanceId === grabbedInstance?.instanceId
    );
    const impliedImmobilized = effects.find(
      (effect) => effect.effectId === 'immobilized' && effect.parentInstanceId === grabbedInstance?.instanceId
    );
    expect(grabbedInstance).toBeDefined();
    expect(impliedOffGuard).toBeDefined();
    expect(impliedImmobilized).toBeDefined();
    expect(effects).toMatchObject([
      { instanceId: standaloneId, effectId: 'off-guard' },
      {
        instanceId: grabbedInstance!.instanceId,
        effectId: 'grabbed',
        sourceId: 'goblin-1',
        sourceLabel: 'Goblin Warrior'
      },
      {
        instanceId: impliedOffGuard!.instanceId,
        effectId: 'off-guard',
        parentInstanceId: grabbedInstance!.instanceId,
        sourceId: 'goblin-1',
        sourceLabel: 'Goblin Warrior'
      },
      {
        instanceId: impliedImmobilized!.instanceId,
        effectId: 'immobilized',
        parentInstanceId: grabbedInstance!.instanceId,
        sourceId: 'goblin-1',
        sourceLabel: 'Goblin Warrior'
      }
    ]);
    expectEvents(grabbed, [
      {
        type: 'effect-applied',
        combatantId: 'fighter-1',
        effectId: 'grabbed',
        effectName: 'Grabbed',
        instanceId: grabbedInstance!.instanceId
      },
      {
        type: 'effect-applied',
        combatantId: 'fighter-1',
        effectId: 'off-guard',
        effectName: 'Off-Guard',
        instanceId: impliedOffGuard!.instanceId,
        parentInstanceId: grabbedInstance!.instanceId
      },
      {
        type: 'effect-applied',
        combatantId: 'fighter-1',
        effectId: 'immobilized',
        effectName: 'Immobilized',
        instanceId: impliedImmobilized!.instanceId,
        parentInstanceId: grabbedInstance!.instanceId
      }
    ]);

    const removed = applyCommand(
      grabbed.newState,
      command('REMOVE_EFFECT', { targetId: 'fighter-1', instanceId: grabbedInstance!.instanceId }),
      effectLibrary
    );

    expect(removed.newState.combatants['fighter-1'].appliedEffects).toEqual([
      {
        instanceId: standaloneId,
        effectId: 'off-guard',
        duration: { type: 'unlimited' }
      }
    ]);
    expectEvents(removed, [
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'grabbed',
        effectName: 'Grabbed',
        instanceId: grabbedInstance!.instanceId,
        reason: 'removed'
      },
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'off-guard',
        effectName: 'Off-Guard',
        instanceId: impliedOffGuard!.instanceId,
        parentInstanceId: grabbedInstance!.instanceId,
        reason: 'cascade'
      },
      {
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'immobilized',
        effectName: 'Immobilized',
        instanceId: impliedImmobilized!.instanceId,
        parentInstanceId: grabbedInstance!.instanceId,
        reason: 'cascade'
      }
    ]);
  });
});
