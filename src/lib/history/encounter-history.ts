import type { Command, EncounterState, LogEntry } from '../../domain';

export const ENCOUNTER_HISTORY_CAP = 50;

interface HistoryFrame {
  before: EncounterState;
  after: EncounterState;
  commandId: string;
  label: string;
}

export interface HistoryStep {
  state: EncounterState;
  label: string;
}

export interface EncounterHistory {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | undefined;
  readonly redoLabel: string | undefined;
  readonly size: number;
  record(before: EncounterState, after: EncounterState, command: Command): void;
  undo(current: EncounterState): HistoryStep | null;
  redo(current: EncounterState): HistoryStep | null;
  clear(): void;
}

export function createEncounterHistory(cap = ENCOUNTER_HISTORY_CAP): EncounterHistory {
  let past: HistoryFrame[] = [];
  let future: HistoryFrame[] = [];
  let auditCounter = 1;

  return {
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get undoLabel() {
      return past.at(-1)?.label;
    },
    get redoLabel() {
      return future.at(-1)?.label;
    },
    get size() {
      return past.length;
    },
    record(before, after, command) {
      if (before === after) return;
      past.push({
        before,
        after,
        commandId: command.id,
        label: commandLabel(command)
      });
      if (past.length > cap) past = past.slice(past.length - cap);
      future = [];
    },
    undo(current) {
      const frame = past.pop();
      if (!frame) return null;
      future.push(frame);
      return {
        state: withHistoryAudit(
          frame.before,
          current,
          frame.commandId,
          true,
          `history-${auditCounter++}`,
          `Undid ${frame.label}.`
        ),
        label: frame.label
      };
    },
    redo(current) {
      const frame = future.pop();
      if (!frame) return null;
      past.push(frame);
      return {
        state: withHistoryAudit(
          frame.after,
          current,
          frame.commandId,
          false,
          `history-${auditCounter++}`,
          `Redid ${frame.label}.`
        ),
        label: frame.label
      };
    },
    clear() {
      past = [];
      future = [];
      auditCounter = 1;
    }
  };
}

function withHistoryAudit(
  mechanicalState: EncounterState,
  current: EncounterState,
  commandId: string,
  undone: boolean,
  auditId: string,
  auditMessage: string
): EncounterState {
  const mechanicalIds = new Set(mechanicalState.combatLog.map((entry) => entry.id));
  const merged = [
    ...mechanicalState.combatLog,
    ...current.combatLog.filter((entry) => !mechanicalIds.has(entry.id))
  ];
  const retained = merged.map((entry) =>
    entry.commandId === commandId ? { ...entry, undone } : entry
  );
  const audit: LogEntry = { id: auditId, message: auditMessage, tone: 'info' };
  return { ...mechanicalState, combatLog: [...retained, audit].slice(-200) };
}

export function commandLabel(command: Command): string {
  const labels: Partial<Record<Command['type'], string>> = {
    START_ENCOUNTER: 'start encounter',
    COMPLETE_ENCOUNTER: 'complete encounter',
    RESET_ENCOUNTER: 'prepare rematch',
    ADD_COMBATANT: 'add combatant',
    REMOVE_COMBATANT: 'remove combatant',
    SET_INITIATIVE_ORDER: 'initiative order',
    SET_INITIATIVE_SCORES: 'initiative scores',
    REORDER_COMBATANT: 'initiative order',
    END_TURN: 'end turn',
    APPLY_DAMAGE: 'damage',
    APPLY_HEALING: 'healing',
    SET_TEMP_HP: 'temporary HP',
    SET_HP: 'HP',
    APPLY_EFFECT: 'apply effect',
    REMOVE_EFFECT: 'remove effect',
    SET_EFFECT_VALUE: 'effect value',
    MODIFY_EFFECT_VALUE: 'effect value',
    SET_EFFECT_DURATION: 'effect duration',
    RESOLVE_PROMPT: 'prompt resolution',
    MARK_REACTION_USED: 'reaction use',
    RESET_REACTION: 'reaction reset',
    SET_NOTE: 'note change',
    MARK_DEAD: 'mark dead',
    REVIVE: 'revive',
    SET_TEMPLATE_ADJUSTMENT: 'template adjustment'
  };
  return labels[command.type] ?? command.type.toLowerCase().replaceAll('_', ' ');
}
