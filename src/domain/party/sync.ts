import type { AppliedEffect, CombatantState, EffectLibrary } from '../types';

/**
 * Extract the effects that survive encounter completion for a party-member
 * combatant (party-members spec §4.5).
 *
 * An effect persists when its definition sets `persistAfterEncounter`, when it
 * is Wounded or Doomed (hardcoded safety net — these must never be lost even if
 * a custom library omits the flag), or when its parent instance persists
 * (implied effects follow their parents so chains like Dying → Unconscious are
 * never restored half-broken).
 *
 * Surviving effects are stripped of encounter-specific attribution
 * (`sourceId`, `sourceLabel`) and their duration is reset to unlimited —
 * between encounters there is no clock to anchor to. The factory re-expands
 * them on the next encounter without re-running implication logic.
 */
export function extractPersistentEffects(
  combatant: CombatantState,
  effectLibrary: EffectLibrary
): AppliedEffect[] {
  const persists = (effect: AppliedEffect): boolean =>
    effectLibrary[effect.effectId]?.persistAfterEncounter === true ||
    effect.effectId === 'wounded' ||
    effect.effectId === 'doomed';

  const kept = new Map(
    combatant.appliedEffects.filter(persists).map((effect) => [effect.instanceId, effect])
  );

  // Implied effects persist alongside their parents. Chains can nest, so loop
  // until no new children join the kept set.
  let grew = true;
  while (grew) {
    grew = false;
    for (const effect of combatant.appliedEffects) {
      if (kept.has(effect.instanceId)) continue;
      if (effect.parentInstanceId !== undefined && kept.has(effect.parentInstanceId)) {
        kept.set(effect.instanceId, effect);
        grew = true;
      }
    }
  }

  return combatant.appliedEffects
    .filter((effect) => kept.has(effect.instanceId))
    .map((effect) => ({
      instanceId: effect.instanceId,
      effectId: effect.effectId,
      ...(effect.value !== undefined ? { value: effect.value } : {}),
      ...(effect.note !== undefined ? { note: effect.note } : {}),
      ...(effect.parentInstanceId !== undefined
        ? { parentInstanceId: effect.parentInstanceId }
        : {}),
      duration: { type: 'unlimited' }
    }));
}
