import { describe, expect, test } from 'vitest';
import {
  emptySelection,
  followActive,
  pickCombatant,
  reconcileWithCombatants,
  type Selection
} from './selection-state';

describe('emptySelection', () => {
  test('has no id and is not pinned', () => {
    expect(emptySelection).toEqual({ id: undefined, pinned: false });
  });
});

describe('followActive', () => {
  test('adopts the active id when not pinned', () => {
    expect(followActive(emptySelection, 'goblin-1')).toEqual({ id: 'goblin-1', pinned: false });
  });

  test('updates to the new active id when not pinned', () => {
    const prev: Selection = { id: 'goblin-1', pinned: false };
    expect(followActive(prev, 'goblin-2')).toEqual({ id: 'goblin-2', pinned: false });
  });

  test('does not change when pinned', () => {
    const prev: Selection = { id: 'goblin-1', pinned: true };
    expect(followActive(prev, 'goblin-2')).toBe(prev);
  });

  test('returns same reference when active id is unchanged and not pinned', () => {
    const prev: Selection = { id: 'goblin-1', pinned: false };
    expect(followActive(prev, 'goblin-1')).toBe(prev);
  });

  test('clears id when active becomes undefined and not pinned', () => {
    const prev: Selection = { id: 'goblin-1', pinned: false };
    expect(followActive(prev, undefined)).toEqual(emptySelection);
  });
});

describe('pickCombatant', () => {
  test('pins selection to the picked id from empty', () => {
    expect(pickCombatant(emptySelection, 'goblin-1')).toEqual({ id: 'goblin-1', pinned: true });
  });

  test('repins to a different id', () => {
    const prev: Selection = { id: 'goblin-1', pinned: true };
    expect(pickCombatant(prev, 'goblin-2')).toEqual({ id: 'goblin-2', pinned: true });
  });

  test('upgrades unpinned auto-followed selection to pinned for the same id', () => {
    const prev: Selection = { id: 'goblin-1', pinned: false };
    expect(pickCombatant(prev, 'goblin-1')).toEqual({ id: 'goblin-1', pinned: true });
  });

  test('returns same reference when re-picking already-pinned id', () => {
    const prev: Selection = { id: 'goblin-1', pinned: true };
    expect(pickCombatant(prev, 'goblin-1')).toBe(prev);
  });
});

describe('reconcileWithCombatants', () => {
  test('keeps selection when its id is still present', () => {
    const prev: Selection = { id: 'goblin-1', pinned: true };
    expect(reconcileWithCombatants(prev, new Set(['goblin-1', 'goblin-2']))).toBe(prev);
  });

  test('clears selection when its id is gone (pinned)', () => {
    const prev: Selection = { id: 'goblin-1', pinned: true };
    expect(reconcileWithCombatants(prev, new Set(['goblin-2']))).toEqual(emptySelection);
  });

  test('clears selection when its id is gone (auto-follow)', () => {
    const prev: Selection = { id: 'goblin-1', pinned: false };
    expect(reconcileWithCombatants(prev, new Set(['goblin-2']))).toEqual(emptySelection);
  });

  test('returns same reference when there is no selection', () => {
    expect(reconcileWithCombatants(emptySelection, new Set(['goblin-1']))).toBe(emptySelection);
  });
});

describe('selection rules — encounter scenarios', () => {
  test('encounter starts: follows active', () => {
    let s: Selection = emptySelection;
    s = followActive(s, 'goblin-1');
    expect(s).toEqual({ id: 'goblin-1', pinned: false });
  });

  test('turn changes while not pinned: selection follows', () => {
    let s: Selection = { id: 'goblin-1', pinned: false };
    s = followActive(s, 'goblin-2');
    expect(s).toEqual({ id: 'goblin-2', pinned: false });
  });

  test('user clicks then turn changes: selection holds', () => {
    let s: Selection = { id: 'goblin-1', pinned: false };
    s = pickCombatant(s, 'goblin-3');
    expect(s).toEqual({ id: 'goblin-3', pinned: true });
    s = followActive(s, 'goblin-2');
    expect(s).toEqual({ id: 'goblin-3', pinned: true });
  });

  test('reset clears everything', () => {
    const s: Selection = { id: 'goblin-1', pinned: true };
    expect(emptySelection).not.toBe(s);
    expect(emptySelection).toEqual({ id: undefined, pinned: false });
  });

  test('combatant whose id was selected is removed: selection clears', () => {
    let s: Selection = { id: 'goblin-1', pinned: true };
    s = reconcileWithCombatants(s, new Set(['goblin-2', 'goblin-3']));
    expect(s).toEqual(emptySelection);
  });
});
