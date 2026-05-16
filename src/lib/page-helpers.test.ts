import { describe, expect, test } from 'vitest';
import type { LogEntry } from '../domain';
import { combatant } from '../domain/test-support';
import {
  computeEncounterCounts,
  dedupeLogById,
  nextCombatantCounterFor,
  nextCommandCounterFor
} from './page-helpers';

function log(id: string): LogEntry {
  return { id, message: id, tone: 'info' };
}

describe('dedupeLogById', () => {
  test('returns empty array for empty input', () => {
    expect(dedupeLogById([])).toEqual([]);
  });

  test('passes through a log with no duplicates', () => {
    const entries = [log('a'), log('b'), log('c')];
    expect(dedupeLogById(entries)).toEqual(entries);
  });

  test('drops duplicates, preserving the first occurrence and surrounding order', () => {
    const result = dedupeLogById([log('a'), log('b'), log('a'), log('c'), log('b')]);
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  test('matches by id only, not by message or tone', () => {
    const result = dedupeLogById([
      { id: 'same', message: 'first', tone: 'info' },
      { id: 'same', message: 'second', tone: 'danger' }
    ]);
    expect(result).toEqual([{ id: 'same', message: 'first', tone: 'info' }]);
  });
});

describe('nextCommandCounterFor', () => {
  test('returns 1 for an empty log', () => {
    expect(nextCommandCounterFor([])).toBe(1);
  });

  test('returns max + 1 across cmd-N- prefixed ids', () => {
    expect(
      nextCommandCounterFor([log('cmd-1-foo'), log('cmd-5-bar'), log('cmd-3-baz')])
    ).toBe(6);
  });

  test('tolerates gaps in the numbering', () => {
    expect(nextCommandCounterFor([log('cmd-2-foo'), log('cmd-10-bar')])).toBe(11);
  });

  test('ignores non-matching ids', () => {
    expect(
      nextCommandCounterFor([log('cmd-abc-foo'), log('event-1'), log('cmd-7-x')])
    ).toBe(8);
  });

  test('returns 1 when no id matches', () => {
    expect(nextCommandCounterFor([log('hello'), log('cmd-x-y')])).toBe(1);
  });
});

describe('nextCombatantCounterFor', () => {
  test('returns 1 for empty combatants', () => {
    expect(nextCombatantCounterFor({ combatants: {} })).toBe(1);
  });

  test('returns max + 1 across ids ending in -N', () => {
    const state = {
      combatants: {
        'goblin-1': combatant('goblin-1'),
        'goblin-4': combatant('goblin-4'),
        'wolf-2': combatant('wolf-2')
      }
    };
    expect(nextCombatantCounterFor(state)).toBe(5);
  });

  test('ignores ids without a trailing -N', () => {
    const state = {
      combatants: {
        aric: combatant('aric'),
        'wolf-3': combatant('wolf-3')
      }
    };
    expect(nextCombatantCounterFor(state)).toBe(4);
  });

  test('returns 1 when no id has a trailing -N', () => {
    const state = {
      combatants: {
        aric: combatant('aric'),
        merisiel: combatant('merisiel')
      }
    };
    expect(nextCombatantCounterFor(state)).toBe(1);
  });
});

describe('computeEncounterCounts', () => {
  test('returns an empty record for no combatants', () => {
    expect(computeEncounterCounts({})).toEqual({});
  });

  test('skips combatants whose sourceType is not "creature"', () => {
    const result = computeEncounterCounts({
      'aric-1': combatant('aric-1', { sourceType: 'partyMember', sourceId: 'aric' }),
      'goblin-1': combatant('goblin-1', { sourceType: 'creature', sourceId: 'goblin' })
    });
    expect(result).toEqual({ goblin: 1 });
  });

  test('aggregates multiple combatants sharing a sourceId', () => {
    const result = computeEncounterCounts({
      'goblin-1': combatant('goblin-1', { sourceType: 'creature', sourceId: 'goblin' }),
      'goblin-2': combatant('goblin-2', { sourceType: 'creature', sourceId: 'goblin' }),
      'goblin-3': combatant('goblin-3', { sourceType: 'creature', sourceId: 'goblin' })
    });
    expect(result).toEqual({ goblin: 3 });
  });

  test('keys distinct sourceIds independently', () => {
    const result = computeEncounterCounts({
      'goblin-1': combatant('goblin-1', { sourceType: 'creature', sourceId: 'goblin' }),
      'wolf-1': combatant('wolf-1', { sourceType: 'creature', sourceId: 'wolf' }),
      'wolf-2': combatant('wolf-2', { sourceType: 'creature', sourceId: 'wolf' })
    });
    expect(result).toEqual({ goblin: 1, wolf: 2 });
  });
});
