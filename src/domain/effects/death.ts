import type { AppliedEffect, CombatantState } from '../types';

/**
 * Death-tracking subsystem helpers (PF2e conditions library spec §3).
 *
 * Dying, Wounded, and Doomed interact mechanically and unambiguously, so the
 * reducer resolves them automatically (no prompts) — the same justification as
 * stacking rules and hard-clock expiry. These are the pure queries the reducer
 * builds that automation on; the orchestration (creating/removing effects,
 * marking dead, emitting events) lives in `reducer.ts`, which owns the effect
 * instance machinery.
 */

/** Base death threshold. A creature dies at Dying >= (4 − Doomed). */
export const DYING_DEATH_BASE = 4;

/**
 * The first applied instance of `effectId` on a combatant, or undefined.
 *
 * Dying, Wounded, and Doomed are single-instance, directly-applied conditions
 * in practice, so scanning for the first match is sufficient.
 */
export function findConditionInstance(
  combatant: CombatantState,
  effectId: string
): AppliedEffect | undefined {
  return combatant.appliedEffects.find((effect) => effect.effectId === effectId);
}

/** Current value of a value condition (Dying/Wounded/Doomed), or 0 if absent. */
export function conditionValue(combatant: CombatantState, effectId: string): number {
  return findConditionInstance(combatant, effectId)?.value ?? 0;
}

/**
 * Death threshold given a Doomed value: 4 − Doomed, floored at 1 so a creature
 * always dies *at* some positive Dying value even if Doomed is pushed past its
 * nominal max of 3.
 */
export function dyingDeathThreshold(doomedValue: number): number {
  return Math.max(1, DYING_DEATH_BASE - doomedValue);
}
