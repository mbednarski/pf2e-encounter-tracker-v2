import { extractPersistentEffects } from '../domain';
import type { CombatantState, Companion, EffectLibrary, PartyMember } from '../domain';

/**
 * Sync-back on encounter completion (party-members spec §4.5): fold each
 * party-member combatant's surviving effects into its persistent record.
 *
 * Pure merge — the caller saves the returned records and refreshes its own
 * copy of the stored list. Combatants whose sourceId no longer matches a
 * stored member (deleted mid-encounter) are skipped. If the same member was
 * added to the encounter more than once, the last combatant in iteration
 * order wins.
 */
export function syncPartyMembersAfterEncounter(
  combatants: Record<string, CombatantState>,
  storedMembers: readonly PartyMember[],
  effectLibrary: EffectLibrary
): PartyMember[] {
  const bySourceId = new Map(storedMembers.map((member) => [member.id, member]));
  const updated = new Map<string, PartyMember>();

  for (const combatant of Object.values(combatants)) {
    if (combatant.sourceType !== 'partyMember') continue;
    const member = bySourceId.get(combatant.sourceId);
    if (!member) continue;
    updated.set(member.id, {
      ...member,
      persistentEffects: extractPersistentEffects(combatant, effectLibrary)
    });
  }

  return [...updated.values()];
}

/**
 * Companion counterpart to syncPartyMembersAfterEncounter (spec §4.5 applies
 * to both persistent kinds). Same contract: pure merge, caller saves.
 */
export function syncCompanionsAfterEncounter(
  combatants: Record<string, CombatantState>,
  storedCompanions: readonly Companion[],
  effectLibrary: EffectLibrary
): Companion[] {
  const bySourceId = new Map(storedCompanions.map((companion) => [companion.id, companion]));
  const updated = new Map<string, Companion>();

  for (const combatant of Object.values(combatants)) {
    if (combatant.sourceType !== 'companion') continue;
    const companion = bySourceId.get(combatant.sourceId);
    if (!companion) continue;
    updated.set(companion.id, {
      ...companion,
      persistentEffects: extractPersistentEffects(combatant, effectLibrary)
    });
  }

  return [...updated.values()];
}
