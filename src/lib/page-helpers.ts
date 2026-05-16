import type { CombatantState, LogEntry } from '../domain';

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
    const match = /^cmd-(\d+)-/.exec(entry.id);
    if (match) {
      const n = Number(match[1]);
      if (n > highest) highest = n;
    }
  }
  return highest + 1;
}

export function nextCombatantCounterFor(state: {
  combatants: Record<string, CombatantState>;
}): number {
  let highest = 0;
  for (const id of Object.keys(state.combatants)) {
    const match = /-(\d+)$/.exec(id);
    if (match) {
      const n = Number(match[1]);
      if (n > highest) highest = n;
    }
  }
  return highest + 1;
}

export function computeEncounterCounts(
  combatants: Record<string, CombatantState>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const combatant of Object.values(combatants)) {
    if (combatant.sourceType !== 'creature') continue;
    counts[combatant.sourceId] = (counts[combatant.sourceId] ?? 0) + 1;
  }
  return counts;
}
