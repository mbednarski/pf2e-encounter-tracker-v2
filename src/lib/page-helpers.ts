import type { CombatantState, LogEntry } from '../domain';

export const COMMAND_ID_PREFIX = 'cmd-';

const COMMAND_LOG_ENTRY_PATTERN = new RegExp(`^${COMMAND_ID_PREFIX}(\\d+)-`);
const COMBATANT_INSTANCE_SUFFIX_PATTERN = /-(\d+)$/;

export type CountsBySourceId = Record<string, number>;

export function dedupeLogById(log: LogEntry[]): LogEntry[] {
  const seen = new Set<string>();
  const out: LogEntry[] = [];
  for (const entry of log) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function nextCommandCounterFor(log: LogEntry[]): number {
  let highest = 0;
  for (const entry of log) {
    const match = COMMAND_LOG_ENTRY_PATTERN.exec(entry.id);
    if (match) {
      const n = Number(match[1]);
      if (n > highest) highest = n;
    }
  }
  return highest + 1;
}

export function nextCombatantCounterFor(combatants: Record<string, CombatantState>): number {
  let highest = 0;
  for (const id of Object.keys(combatants)) {
    const match = COMBATANT_INSTANCE_SUFFIX_PATTERN.exec(id);
    if (match) {
      const n = Number(match[1]);
      if (n > highest) highest = n;
    }
  }
  return highest + 1;
}

export function computeEncounterCounts(
  combatants: Record<string, CombatantState>
): CountsBySourceId {
  const counts: CountsBySourceId = {};
  for (const combatant of Object.values(combatants)) {
    if (combatant.sourceType !== 'creature') continue;
    counts[combatant.sourceId] = (counts[combatant.sourceId] ?? 0) + 1;
  }
  return counts;
}
