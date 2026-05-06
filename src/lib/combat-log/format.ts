import type { CombatantId, DomainEvent, EncounterState, LogEntry, LogEntryTone } from '../../domain';

export interface FormatOptions {
  /** Used as a stable id base — typically the originating command id. */
  commandId: string;
  /** Position of this event among events emitted from the same command, used to make the LogEntry id unique. */
  index: number;
  /**
   * State *after* the reducer ran. The formatter looks combatant names up here so renamed/added
   * combatants resolve correctly. For events that involve combatants who were just removed,
   * fall back to the event payload (event carries `name` for those cases).
   */
  state: EncounterState;
}

/**
 * Pure formatter from a domain event to a single log line. Exhaustive over DomainEvent.
 * Returns null only for events deliberately suppressed from the log (currently none).
 */
export function formatEvent(event: DomainEvent, options: FormatOptions): LogEntry | null {
  const { commandId, index, state } = options;
  const id = `${commandId}-${index}`;

  switch (event.type) {
    case 'encounter-started':
      return entry(id, 'Encounter started.', 'success');
    case 'encounter-completed':
      return entry(id, 'Encounter completed.', 'success');
    case 'encounter-reset':
      return entry(id, 'Encounter reset.', 'info');
    case 'phase-changed':
      return entry(id, `Phase: ${event.from} → ${event.to}.`, 'info');
    case 'round-started':
      return entry(id, `Round ${event.round} started.`, 'info');
    case 'all-combatants-dead':
      return entry(id, 'All combatants are down.', 'danger');
    case 'combatant-added':
      return entry(id, `${event.name} joined the encounter.`, 'info');
    case 'combatant-removed':
      return entry(id, `${event.name} removed from the encounter.`, 'info');
    case 'combatant-renamed':
      return entry(id, `${event.oldName} renamed to ${event.newName}.`, 'info');
    case 'initiative-set':
      return entry(
        id,
        `Initiative order: ${event.order.map((cid) => nameOf(state, cid)).join(', ')}.`,
        'info'
      );
    case 'initiative-changed':
      return entry(
        id,
        `${nameOf(state, event.combatantId)} moved to position ${event.newIndex + 1} in the order.`,
        'info'
      );
    case 'combatant-delayed':
      return entry(id, `${nameOf(state, event.combatantId)} is delaying.`, 'info');
    case 'combatant-resumed-from-delay':
      return entry(id, `${nameOf(state, event.combatantId)} resumed from delay.`, 'info');
    case 'turn-started':
      return entry(
        id,
        `${nameOf(state, event.combatantId)}'s turn (round ${event.round}).`,
        'info'
      );
    case 'turn-ended':
      return entry(id, `${nameOf(state, event.combatantId)} ended their turn.`, 'info');
    case 'combatant-died': {
      const cause = event.cause === 'dying-threshold' ? ' (dying threshold reached)' : '';
      return entry(id, `${nameOf(state, event.combatantId)} died${cause}.`, 'danger');
    }
    case 'combatant-revived':
      return entry(id, `${nameOf(state, event.combatantId)} revived.`, 'success');
    case 'reaction-used':
      return entry(id, `${nameOf(state, event.combatantId)} used a reaction.`, 'info');
    case 'reaction-reset':
      return event.cause === 'manual'
        ? entry(id, `${nameOf(state, event.combatantId)} reaction reset.`, 'info')
        : null;
    case 'note-changed': {
      const target = nameOf(state, event.combatantId);
      const cleared = !state.combatants[event.combatantId]?.notes;
      return entry(id, cleared ? `${target} note cleared.` : `${target} note updated.`, 'info');
    }
    case 'effect-applied': {
      const target = nameOf(state, event.combatantId);
      const valueSuffix = event.value !== undefined ? ` ${event.value}` : '';
      const source = event.parentInstanceId ? ' (implied)' : '';
      return entry(id, `${target} gained ${event.effectName}${valueSuffix}${source}.`, 'info');
    }
    case 'effect-removed': {
      const target = nameOf(state, event.combatantId);
      const reasonText = effectRemovedReason(event.reason);
      return entry(id, `${target} lost ${event.effectName}${reasonText}.`, 'info');
    }
    case 'effect-value-changed':
      return entry(
        id,
        `${nameOf(state, event.combatantId)} ${event.effectName}: ${event.from} → ${event.to}.`,
        'info'
      );
    case 'effect-duration-changed':
      return entry(
        id,
        `${nameOf(state, event.combatantId)} ${event.effectName} duration changed.`,
        'info'
      );
    case 'prompt-generated':
      return entry(
        id,
        `Prompt: ${nameOf(state, event.targetId)} ${event.effectName} — ${event.description}.`,
        'info'
      );
    case 'prompt-resolved':
      return entry(id, `Prompt resolved: ${promptResolutionLabel(event.resolution)}.`, 'info');
    case 'hp-changed': {
      const target = nameOf(state, event.combatantId);
      switch (event.cause) {
        case 'damage': {
          const total = event.hpFrom - event.hpTo + (event.tempHpFrom - event.tempHpTo);
          const typeSuffix = event.damageType ? ` ${event.damageType}` : '';
          return entry(id, `${target} took ${total}${typeSuffix} damage.`, 'danger');
        }
        case 'healing':
          return entry(id, `${target} healed ${event.hpTo - event.hpFrom} HP.`, 'success');
        case 'set':
          return entry(id, `${target} HP set to ${event.hpTo}.`, 'info');
        case 'set-temp':
          return entry(id, `${target} temp HP set to ${event.tempHpTo}.`, 'info');
      }
      return null;
    }
    case 'hp-reached-zero':
      return entry(id, `${nameOf(state, event.combatantId)} dropped to 0 HP.`, 'danger');
    case 'command-rejected':
      return entry(id, `${event.commandType} rejected: ${event.reason}.`, 'danger');
  }
}

/**
 * Format a batch of events from a single command. Useful when we want to collapse the whole
 * batch into the log in order.
 */
export function formatEvents(
  events: readonly DomainEvent[],
  options: Omit<FormatOptions, 'index'>
): LogEntry[] {
  const out: LogEntry[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const formatted = formatEvent(events[i], { ...options, index: i });
    if (formatted) out.push(formatted);
  }
  return out;
}

function entry(id: string, message: string, tone: LogEntryTone): LogEntry {
  return { id, message, tone };
}

function nameOf(state: EncounterState, combatantId: CombatantId): string {
  return state.combatants[combatantId]?.name ?? combatantId;
}

function effectRemovedReason(reason: 'removed' | 'expired' | 'cascade' | 'auto-decremented'): string {
  switch (reason) {
    case 'removed':
      return '';
    case 'expired':
      return ' (expired)';
    case 'cascade':
      return ' (cascade)';
    case 'auto-decremented':
      return ' (decremented)';
  }
}

function promptResolutionLabel(resolution: { type: string; value?: number }): string {
  switch (resolution.type) {
    case 'accept':
      return 'accepted';
    case 'dismiss':
      return 'dismissed';
    case 'remove':
      return 'removed effect';
    case 'setValue':
      return resolution.value !== undefined ? `set to ${resolution.value}` : 'set value';
    default:
      return resolution.type;
  }
}
