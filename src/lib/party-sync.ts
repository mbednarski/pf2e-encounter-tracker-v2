import { extractPersistentEffects } from '../domain';
import type { CombatantState, EffectLibrary, PartyMember } from '../domain';

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
