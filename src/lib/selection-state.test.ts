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

  test('re-picking already-pinned id keeps it pinned (value contract)', () => {
    const prev: Selection = { id: 'goblin-1', pinned: true };
    const next = pickCombatant(prev, 'goblin-1');
    expect(next.pinned).toBe(true);
    expect(next.id).toBe('goblin-1');
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

  test('combatant whose id was selected is removed: selection clears', () => {
    let s: Selection = { id: 'goblin-1', pinned: true };
    s = reconcileWithCombatants(s, new Set(['goblin-2', 'goblin-3']));
    expect(s).toEqual(emptySelection);
  });
});

describe('selection rules — composition (mirrors +page.svelte reactive order)', () => {
  // The route composes the helpers as:
  //   selection = reconcileWithCombatants(selection, ids)
  //   selection = followActive(selection, activeId)
  // Reordering those two lines silently breaks the "active combatant was just removed,
  // active rotated to a survivor" path. This test pins that order.
  function step(prev: Selection, ids: ReadonlySet<string>, activeId: string | undefined): Selection {
    return followActive(reconcileWithCombatants(prev, ids), activeId);
  }

  test('removed active combatant + rotation: selection lands on the new active', () => {
    const before: Selection = { id: 'goblin-1', pinned: false };
    const after = step(before, new Set(['fighter-1', 'goblin-2']), 'fighter-1');
    expect(after).toEqual({ id: 'fighter-1', pinned: false });
  });

  test('removed pinned combatant + rotation: selection clears, then auto-follows new active', () => {
    const before: Selection = { id: 'goblin-1', pinned: true };
    const after = step(before, new Set(['fighter-1']), 'fighter-1');
    expect(after).toEqual({ id: 'fighter-1', pinned: false });
  });
});
