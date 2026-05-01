export interface Selection {
  id: string | undefined;
  pinned: boolean;
}

export const emptySelection: Selection = { id: undefined, pinned: false };

export function followActive(prev: Selection, activeId: string | undefined): Selection {
  if (prev.pinned) return prev;
  if (prev.id === activeId) return prev;
  return { id: activeId, pinned: false };
}

export function pickCombatant(prev: Selection, id: string): Selection {
  if (prev.id === id && prev.pinned) return prev;
  return { id, pinned: true };
}

export function reconcileWithCombatants(
  prev: Selection,
  combatantIds: ReadonlySet<string>
): Selection {
  if (prev.id === undefined) return prev;
  if (combatantIds.has(prev.id)) return prev;
  return emptySelection;
}
