import { describe, expect, test } from 'vitest';
import type { AppliedEffect } from '../types';
import { combatant, expectSerializable } from '../test-support';
import { effectLibrary } from '../effects/library';
import { extractPersistentEffects } from './sync';

function applied(overrides: Partial<AppliedEffect> & Pick<AppliedEffect, 'instanceId' | 'effectId'>): AppliedEffect {
  return { duration: { type: 'unlimited' }, ...overrides };
}

describe('extractPersistentEffects', () => {
  test('keeps flagged conditions and drops combat-only ones', () => {
    const pc = combatant('pc-1', {
      sourceType: 'partyMember',
      appliedEffects: [
        applied({ instanceId: 'a', effectId: 'drained', value: 2 }),
        applied({ instanceId: 'b', effectId: 'frightened', value: 1 }),
        applied({ instanceId: 'c', effectId: 'prone' })
      ]
    });

    const persisted = extractPersistentEffects(pc, effectLibrary);
    expect(persisted.map((e) => e.effectId)).toEqual(['drained']);
    expect(persisted[0].value).toBe(2);
  });

  test('keeps wounded and doomed even when the library lacks the flag', () => {
    const pc = combatant('pc-1', {
      appliedEffects: [
        applied({ instanceId: 'w', effectId: 'wounded', value: 1 }),
        applied({ instanceId: 'd', effectId: 'doomed', value: 2 })
      ]
    });

    const persisted = extractPersistentEffects(pc, {});
    expect(persisted.map((e) => e.effectId)).toEqual(['wounded', 'doomed']);
  });

  test('afflictions persist via the category-wide flag', () => {
    const afflictionId = Object.values(effectLibrary).find(
      (def) => def.category === 'affliction'
    )?.id;
    expect(afflictionId).toBeDefined();

    const pc = combatant('pc-1', {
      appliedEffects: [applied({ instanceId: 'x', effectId: afflictionId! })]
    });

    expect(extractPersistentEffects(pc, effectLibrary)).toHaveLength(1);
  });

  test('implied effects persist alongside their parents, transitively', () => {
    const pc = combatant('pc-1', {
      appliedEffects: [
        applied({ instanceId: 'root', effectId: 'doomed', value: 1 }),
        applied({ instanceId: 'child', effectId: 'unconscious', parentInstanceId: 'root' }),
        applied({ instanceId: 'grandchild', effectId: 'off-guard', parentInstanceId: 'child' }),
        applied({ instanceId: 'orphan', effectId: 'off-guard', parentInstanceId: 'gone' })
      ]
    });

    const persisted = extractPersistentEffects(pc, effectLibrary);
    expect(persisted.map((e) => e.instanceId)).toEqual(['root', 'child', 'grandchild']);
    expect(persisted[1].parentInstanceId).toBe('root');
  });

  test('strips encounter attribution and resets duration', () => {
    const pc = combatant('pc-1', {
      appliedEffects: [
        applied({
          instanceId: 'w',
          effectId: 'wounded',
          value: 2,
          note: 'from the ogre',
          sourceId: 'ogre-1',
          sourceLabel: 'Ogre',
          duration: { type: 'rounds', count: 3, expiry: 'turnEnd', anchorId: 'ogre-1' }
        })
      ]
    });

    const [persisted] = extractPersistentEffects(pc, effectLibrary);
    expect(persisted).toEqual({
      instanceId: 'w',
      effectId: 'wounded',
      value: 2,
      note: 'from the ogre',
      duration: { type: 'unlimited' }
    });
    expectSerializable(persisted);
  });

  test('returns empty for a combatant with no persistent effects', () => {
    const pc = combatant('pc-1', {
      appliedEffects: [applied({ instanceId: 'b', effectId: 'frightened', value: 1 })]
    });
    expect(extractPersistentEffects(pc, effectLibrary)).toEqual([]);
  });
});
