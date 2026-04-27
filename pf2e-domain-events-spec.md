# PF2e Encounter Tracker v2 — Domain Event Catalog Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-25
**Status:** Ready for review
**Supersedes:** Command vocabulary spec §6, architecture spec §17 (those become references to this doc)

---

## 1. Purpose

This spec is the canonical, exhaustive list of `DomainEvent` types emitted by the domain. It consolidates events scattered across command vocab §6, architecture §17, the conditions library spec, the effects-and-durations spec, and the hazards spec. It defines payload shapes, emission rules, and the contract between the domain and the combat log formatter.

Events are the **read-side** counterpart to commands. Commands describe what should happen; events describe what did happen. The orchestrator routes events to the combat log, optionally to UI toasts, and to any future analytics or replay tooling.

---

## 2. Design Decisions

### 2.1 Events Are Not State

Events are emitted alongside `newState` from `applyCommand`. They are not stored in state — the state already reflects the changes. Events exist for downstream consumers (combat log, UI feedback) that need to know *what changed* without diffing state.

The combat log itself is the only persistent consumer that retains events (as derived `LogEntry` objects). Other consumers process and discard.

### 2.2 One Event Per State Change

Each atomic state change produces one event. A single command may emit multiple events when it cascades (e.g., APPLY_EFFECT with implied effects emits `effect-applied` for the parent and one for each child). This is deliberate — the formatter can group events by command (using the `id` from the originating Command, attached by the orchestrator at log-write time).

### 2.3 Events Carry Identifiers, Not Snapshots

Payloads carry IDs (`combatantId`, `effectId`, `instanceId`) and minimal display data (`effectName` for stable formatting after combatant deletion). They do NOT carry full state snapshots. The combat log formatter reads from current state when it needs more context. This keeps event payloads small and avoids stale data in events.

Exception: events that describe a transition (`hp-changed`, `effect-value-changed`) carry `from` and `to` values because those are the change itself.

### 2.4 Events Are Append-Only Per Command

The order of events within a single command's emission is deterministic and meaningful. The formatter can rely on event ordering to construct narrative messages.

### 2.5 No Events for Pure Reads

`deriveStats()` is a pure function called on every render. It does not emit events. Stat changes are derived from underlying state — when `effect-applied` fires, the formatter knows derived stats may have changed. It does not need an explicit `stats-derived` event.

---

## 3. Base Type

```typescript
type DomainEvent =
  // §4.1 Encounter lifecycle
  | EncounterStartedEvent
  | EncounterCompletedEvent
  | EncounterResetEvent
  | PhaseChangedEvent
  | RoundStartedEvent
  | AllCombatantsDeadEvent

  // §4.2 Combatant management
  | CombatantAddedEvent
  | CombatantRemovedEvent
  | CombatantRenamedEvent

  // §4.3 Initiative
  | InitiativeSetEvent
  | InitiativeChangedEvent
  | CombatantDelayedEvent
  | CombatantResumedFromDelayEvent

  // §4.4 Turn boundaries
  | TurnStartedEvent
  | TurnEndedEvent

  // §4.5 HP & damage
  | HpChangedEvent
  | HpReachedZeroEvent

  // §4.6 Effects
  | EffectAppliedEvent
  | EffectRemovedEvent
  | EffectValueChangedEvent
  | EffectDurationChangedEvent

  // §4.7 Prompts
  | PromptGeneratedEvent
  | PromptResolvedEvent

  // §4.8 Combat state
  | CombatantDiedEvent
  | CombatantRevivedEvent
  | ReactionUsedEvent
  | ReactionResetEvent
  | NoteChangedEvent

  // §4.9 Errors
  | CommandRejectedEvent
```

Each variant has a `type: string` discriminator. Payloads use `CombatantId` (a branded string alias) consistently rather than raw `string`.

---

## 4. Event Definitions

### 4.1 Encounter Lifecycle

#### EncounterStartedEvent

```typescript
interface EncounterStartedEvent {
  type: "encounter-started"
}
```

**Emitted by:** START_ENCOUNTER (when phase transitions PREPARING → ACTIVE).

**Notes:** Always followed by a `phase-changed` event and a `turn-started` event for the first combatant. The orchestrator can use this as a hook to start any encounter-scoped timing or logging.

---

#### EncounterCompletedEvent

```typescript
interface EncounterCompletedEvent {
  type: "encounter-completed"
}
```

**Emitted by:** COMPLETE_ENCOUNTER.

**Notes:** Orchestrator listens for this to trigger party member / companion sync-back per party spec §4.5.

---

#### EncounterResetEvent

```typescript
interface EncounterResetEvent {
  type: "encounter-reset"
}
```

**Emitted by:** RESET_ENCOUNTER (COMPLETED → PREPARING).

---

#### PhaseChangedEvent

```typescript
interface PhaseChangedEvent {
  type: "phase-changed"
  from: EncounterPhase
  to: EncounterPhase
}
```

**Emitted by:** Any command that transitions phase (START_ENCOUNTER, COMPLETE_ENCOUNTER, RESET_ENCOUNTER, END_TURN entering RESOLVING, RESOLVE_PROMPT exiting RESOLVING).

**Notes:** Lets the combat log naturally segment narrative ("--- Resolving Goblin 1's turn end ---"). Lets the UI gate input on phase changes.

---

#### RoundStartedEvent

```typescript
interface RoundStartedEvent {
  type: "round-started"
  round: number
}
```

**Emitted by:** END_TURN, RESOLVE_PROMPT (the ones that wrap initiative past the end of order). Fires immediately before the `turn-started` for the new round's first combatant.

---

#### AllCombatantsDeadEvent

```typescript
interface AllCombatantsDeadEvent {
  type: "all-combatants-dead"
}
```

**Emitted by:** Turn advancement (END_TURN, RESOLVE_PROMPT, DELAY) when no live combatants remain in initiative.

**Notes:** Informational. The orchestrator can suggest COMPLETE_ENCOUNTER. The domain does not auto-complete.

---

### 4.2 Combatant Management

#### CombatantAddedEvent

```typescript
interface CombatantAddedEvent {
  type: "combatant-added"
  combatantId: CombatantId
  name: string
  sourceType: "creature" | "partyMember" | "companion" | "hazard"
  masterId?: CombatantId       // present if this is a minion
}
```

**Emitted by:** ADD_COMBATANT.

**Notes:** `sourceType` and `masterId` help the formatter distinguish "Drow Wizard joined combat" from "Animal Companion (Mira's wolf) joined combat".

---

#### CombatantRemovedEvent

```typescript
interface CombatantRemovedEvent {
  type: "combatant-removed"
  combatantId: CombatantId
  name: string
}
```

**Emitted by:** REMOVE_COMBATANT.

**Notes:** Per effects-and-durations spec §6.6 (decision (b)), removing a combatant clears `sourceId` on effects others received from this combatant; `sourceLabel` is preserved. No additional events fire for these orphan-cleanup operations — the formatter narrates it from state if it cares.

If the removed combatant has minions (per party spec), each minion's removal also emits a `combatant-removed`. The cascade is visible in the event stream.

---

#### CombatantRenamedEvent

```typescript
interface CombatantRenamedEvent {
  type: "combatant-renamed"
  combatantId: CombatantId
  oldName: string
  newName: string
}
```

**Emitted by:** RENAME_COMBATANT.

---

### 4.3 Initiative

#### InitiativeSetEvent

```typescript
interface InitiativeSetEvent {
  type: "initiative-set"
  order: CombatantId[]
}
```

**Emitted by:** SET_INITIATIVE_ORDER.

---

#### InitiativeChangedEvent

```typescript
interface InitiativeChangedEvent {
  type: "initiative-changed"
  combatantId: CombatantId
  newIndex: number
}
```

**Emitted by:** REORDER_COMBATANT.

---

#### CombatantDelayedEvent

```typescript
interface CombatantDelayedEvent {
  type: "combatant-delayed"
  combatantId: CombatantId
}
```

**Emitted by:** DELAY.

---

#### CombatantResumedFromDelayEvent

```typescript
interface CombatantResumedFromDelayEvent {
  type: "combatant-resumed-from-delay"
  combatantId: CombatantId
  insertIndex: number
}
```

**Emitted by:** RESUME_FROM_DELAY.

**Notes:** Distinct from `initiative-changed` because resumption has additional semantics (turn starts immediately, reactions reset, start-of-turn effects process).

---

### 4.4 Turn Boundaries

#### TurnStartedEvent

```typescript
interface TurnStartedEvent {
  type: "turn-started"
  combatantId: CombatantId
  round: number
}
```

**Emitted by:** START_ENCOUNTER (first turn), END_TURN, RESOLVE_PROMPT (when last prompt clears and turn advances), DELAY, RESUME_FROM_DELAY, MARK_DEAD (if killing the active combatant advances the turn).

**Notes:** Always preceded by a `turn-ended` event for the prior combatant (except for the very first turn after START_ENCOUNTER). Hard clock expirations (`untilTurnStart`) for this combatant fire before this event; their `effect-removed` events appear immediately before. `prompt-generated` events for start-of-turn suggestions fire immediately after.

---

#### TurnEndedEvent

```typescript
interface TurnEndedEvent {
  type: "turn-ended"
  combatantId: CombatantId
}
```

**Emitted by:** END_TURN, DELAY, MARK_DEAD (active combatant), RESUME_FROM_DELAY (interrupts active combatant).

**Notes:** Hard clock expirations (`untilTurnEnd`) fire after this event. Then `prompt-generated` events. Then phase transitions to RESOLVING (if prompts) or `turn-started` for next combatant (if no prompts).

---

### 4.5 HP & Damage

#### HpChangedEvent

```typescript
interface HpChangedEvent {
  type: "hp-changed"
  combatantId: CombatantId
  hpFrom: number
  hpTo: number
  tempHpFrom: number
  tempHpTo: number
  cause: "damage" | "healing" | "set" | "set-temp"
  damageType?: string          // cosmetic — only set for cause: "damage"
}
```

**Emitted by:** APPLY_DAMAGE, APPLY_HEALING, SET_HP, SET_TEMP_HP.

**Notes:**
- This is the **single HP-related event**. `temp-hp-changed` from the prior spec is removed; SET_TEMP_HP emits `hp-changed` with cause `"set-temp"` and only the temp fields differing.
- All four fields are always populated (full picture). The formatter inspects `cause` and the deltas to construct messages.
- `damageType` is only meaningful for `cause: "damage"`; ignored otherwise.

---

#### HpReachedZeroEvent

```typescript
interface HpReachedZeroEvent {
  type: "hp-reached-zero"
  combatantId: CombatantId
}
```

**Emitted by:** APPLY_DAMAGE, SET_HP — when `currentHp` transitions from > 0 to 0.

**Notes:** Per arch decision A4 / amendment 8.6 (command vocab §8.6), the domain does NOT auto-apply Dying or mark dead. This event is the orchestrator's signal to surface a UI hint.

Not re-emitted if currentHp is already 0 and damage hits temp HP only, or if SET_HP sets to 0 from already-0.

---

### 4.6 Effects

#### EffectAppliedEvent

```typescript
interface EffectAppliedEvent {
  type: "effect-applied"
  combatantId: CombatantId
  effectId: string
  effectName: string
  instanceId: string
  value?: number
  parentInstanceId?: string    // present for implied effects
}
```

**Emitted by:** APPLY_EFFECT, RESOLVE_PROMPT (when applying a new effect during prompt resolution — e.g., death subsystem applying Wounded after recovery).

**Notes:**
- `effectId` (library key) added — enables filtering combat log by effect type.
- `parentInstanceId` lets the formatter group "Grabbed (and Off-Guard, Immobilized as implied effects)" into a single rendered line.
- For implied effects, one `effect-applied` event fires per child after the parent's event.

---

#### EffectRemovedEvent

```typescript
interface EffectRemovedEvent {
  type: "effect-removed"
  combatantId: CombatantId
  effectId: string
  effectName: string
  instanceId: string
  reason: "removed" | "expired" | "cascade" | "auto-decremented"
  parentInstanceId?: string    // present if this was an implied child
}
```

**Emitted by:** REMOVE_EFFECT, MODIFY_EFFECT_VALUE (when delta brings value ≤ 0), END_TURN / TURN_STARTED (hard clock expiry), RESOLVE_PROMPT.

**Reason values:**
- `"removed"` — explicit REMOVE_EFFECT or RESOLVE_PROMPT remove
- `"expired"` — hard clock duration ended (`untilTurnEnd` / `untilTurnStart`)
- `"cascade"` — implied child removed because parent was removed
- `"auto-decremented"` — MODIFY_EFFECT_VALUE brought value to 0 or below

---

#### EffectValueChangedEvent

```typescript
interface EffectValueChangedEvent {
  type: "effect-value-changed"
  combatantId: CombatantId
  effectId: string
  effectName: string
  instanceId: string
  from: number
  to: number
}
```

**Emitted by:** SET_EFFECT_VALUE, MODIFY_EFFECT_VALUE (when the result is ≥ 1), RESOLVE_PROMPT.

**Notes:** If MODIFY_EFFECT_VALUE results in ≤ 0, an `effect-removed` event fires instead with reason `"auto-decremented"`.

---

#### EffectDurationChangedEvent

```typescript
interface EffectDurationChangedEvent {
  type: "effect-duration-changed"
  combatantId: CombatantId
  effectId: string
  effectName: string
  instanceId: string
}
```

**Emitted by:** SET_EFFECT_DURATION (effects-and-durations spec §8).

**Notes:** Payload deliberately doesn't carry the `Duration` shape — the formatter reads from state if it needs the new duration. This avoids serializing a discriminated union into the event payload for marginal benefit.

---

### 4.7 Prompts

#### PromptGeneratedEvent

```typescript
interface PromptGeneratedEvent {
  type: "prompt-generated"
  promptId: string
  combatantId: CombatantId
  effectInstanceId: string
  description: string         // human-readable summary, pre-rendered
}
```

**Emitted by:** END_TURN, START_TURN (via the turn boundary processing in END_TURN / RESOLVE_PROMPT), and any command that newly enters RESOLVING.

**Notes:** Combat log entries for prompts are informational. The actual prompt object lives in `state.pendingPrompts` — the formatter or UI looks it up by `promptId` if structured access is needed.

---

#### PromptResolvedEvent

```typescript
interface PromptResolvedEvent {
  type: "prompt-resolved"
  promptId: string
  combatantId: CombatantId
  resolution: string           // free-form: "accepted decrement", "remove", "dismissed", "passed flat check"
}
```

**Emitted by:** RESOLVE_PROMPT.

**Notes:** Loose `resolution` string per design decision. The formatter constructs rich messages from current state and the additional effect-* events that fire alongside this one.

---

### 4.8 Combat State

#### CombatantDiedEvent

```typescript
interface CombatantDiedEvent {
  type: "combatant-died"
  combatantId: CombatantId
  cause: "marked-dead" | "dying-threshold"
}
```

**Emitted by:** MARK_DEAD (cause `"marked-dead"`), death subsystem when Dying ≥ threshold (cause `"dying-threshold"`).

**Notes:** Single event, multiple causes — a dead combatant is dead regardless of how. The `cause` distinguishes for the formatter.

---

#### CombatantRevivedEvent

```typescript
interface CombatantRevivedEvent {
  type: "combatant-revived"
  combatantId: CombatantId
}
```

**Emitted by:** REVIVE.

---

#### ReactionUsedEvent

```typescript
interface ReactionUsedEvent {
  type: "reaction-used"
  combatantId: CombatantId
}
```

**Emitted by:** MARK_REACTION_USED.

---

#### ReactionResetEvent

```typescript
interface ReactionResetEvent {
  type: "reaction-reset"
  combatantId: CombatantId
  cause: "auto" | "manual"
}
```

**Emitted by:** RESET_REACTION (cause `"manual"`), turn-started auto-reset (cause `"auto"` — see command vocab §8.5).

**Notes:** `cause` lets the formatter suppress noise — `"auto"` resets are routine and may be filtered out of the combat log by default.

---

#### NoteChangedEvent

```typescript
interface NoteChangedEvent {
  type: "note-changed"
  combatantId: CombatantId
}
```

**Emitted by:** SET_NOTE.

**Notes:** Payload deliberately omits the note content — combat log entry is just "GM updated note for Goblin 1". The formatter reads new content from state if it wants to display.

---

### 4.9 Errors

#### CommandRejectedEvent

```typescript
interface CommandRejectedEvent {
  type: "command-rejected"
  commandType: CommandType
  reason: string             // human-readable: "Combatant goblin-1 not found"
}
```

**Emitted by:** Any command that fails validation. The accompanying state is unchanged (per command vocab §1.2).

**Notes:** The orchestrator does not push rejected commands onto the undo stack. The combat log may surface these as warnings or hide them based on user preference.

---

## 5. Emission Rules — Per Command

This table is the source of truth for what each command emits. Where multiple events fire, order is top-to-bottom.

| Command | Events Emitted (in order) |
|---|---|
| START_ENCOUNTER | `encounter-started`, `phase-changed`, `turn-started`, [start-of-turn `effect-removed` ×N], [start-of-turn `prompt-generated` ×N] |
| COMPLETE_ENCOUNTER | `phase-changed`, `encounter-completed` |
| RESET_ENCOUNTER | `phase-changed`, `encounter-reset` |
| ADD_COMBATANT | `combatant-added` |
| REMOVE_COMBATANT | `combatant-removed` (and one per cascaded minion if applicable) |
| RENAME_COMBATANT | `combatant-renamed` |
| SET_INITIATIVE_ORDER | `initiative-set` |
| REORDER_COMBATANT | `initiative-changed` |
| END_TURN | `turn-ended`, [`effect-removed` ×N (hard clock)], [`prompt-generated` ×N], then either `phase-changed` (→RESOLVING) OR `turn-started` (+ start-of-turn cascade, see START_ENCOUNTER) |
| DELAY | `turn-ended`, `combatant-delayed`, `turn-started` (+ start-of-turn cascade) |
| RESUME_FROM_DELAY | `turn-ended` (interrupts current), `combatant-resumed-from-delay`, `reaction-reset` (auto), `turn-started`, [start-of-turn cascade] |
| APPLY_DAMAGE | `hp-changed`, optional `hp-reached-zero` |
| APPLY_HEALING | `hp-changed` |
| SET_HP | `hp-changed`, optional `hp-reached-zero` |
| SET_TEMP_HP | `hp-changed` |
| APPLY_EFFECT | `effect-applied` (parent), [`effect-applied` ×N (implied children)], [death subsystem events if effectId is `"dying"`] |
| REMOVE_EFFECT | `effect-removed` (target), [`effect-removed` ×N (cascaded children)], [death subsystem events if effectId is `"dying"`] |
| SET_EFFECT_VALUE | `effect-value-changed`, [death subsystem events if effectId is `"dying"`] |
| MODIFY_EFFECT_VALUE | Either `effect-value-changed` OR `effect-removed` (reason `"auto-decremented"`), [death subsystem events] |
| SET_EFFECT_DURATION | `effect-duration-changed` |
| RESOLVE_PROMPT | `prompt-resolved`, [resolution-specific effect events], [if last prompt: `phase-changed` → ACTIVE, `turn-started` for next combatant + start-of-turn cascade] |
| MARK_REACTION_USED | `reaction-used` |
| RESET_REACTION | `reaction-reset` (cause `"manual"`) |
| SET_NOTE | `note-changed` |
| MARK_DEAD | `combatant-died` (cause `"marked-dead"`), optional [`turn-ended`, `turn-started`] if active combatant |
| REVIVE | `combatant-revived` |
| (any rejected) | `command-rejected` (only) |

---

## 6. Death Subsystem Event Composition

The death subsystem (conditions library spec §3) does not introduce new event types. It composes the existing event types:

| Death subsystem path | Events |
|---|---|
| Apply Dying N (under threshold) | `effect-applied` (dying), `effect-applied` (unconscious, implied) |
| Apply Dying N (≥ threshold) | `effect-applied` (dying, capped at threshold), `combatant-died` (cause `"dying-threshold"`) |
| Increase Dying (still under threshold) | `effect-value-changed` (dying) |
| Increase Dying (≥ threshold) | `effect-value-changed` (dying), `combatant-died` (cause `"dying-threshold"`) |
| Remove Dying (recovery, no Wounded) | `effect-removed` (dying, cascade removes Unconscious), `effect-applied` (wounded, value 1) |
| Remove Dying (recovery, has Wounded) | `effect-removed` (dying, cascade Unconscious), `effect-value-changed` (wounded) |
| Doomed change pushes existing Dying past threshold | `effect-value-changed` (doomed), `combatant-died` |

The combat log formatter constructs human-readable narratives like "Goblin 1 gained Dying 1 + Wounded 2 → Dying 3" by reading the emitted events plus state context (the existing Wounded value at apply time). This is a formatter concern, not a new event type.

---

## 7. Combat Log — Formatter Contract

### 7.1 LogEntry Type

```typescript
interface LogEntry {
  id: string                    // UUID, generated by orchestrator
  timestamp: number             // ms since encounter start (orchestrator-stamped)
  round?: number                // round number when entry was created
  commandId?: string            // links back to the originating Command (for grouping)
  events: DomainEvent[]         // raw events from this command
  message: string               // formatted human-readable text
  severity: "info" | "warn" | "error"   // info default, warn for rejected, error reserved
}
```

The combat log is `LogEntry[]` stored in `EncounterState.combatLog`. It is part of the encounter snapshot and persisted with the rest of the state.

### 7.2 Formatting Pipeline

```
DomainEvent[] → formatLogEntry(events, state) → LogEntry
```

The formatter is a pure function in the orchestrator (not the domain — it has access to the full state for lookups). It runs once per `applyCommand` call, batching all emitted events into one entry.

```typescript
function formatLogEntry(
  events: DomainEvent[],
  stateAfter: EncounterState,
  command: Command
): LogEntry
```

**Inputs:**
- `events` — the events array from `applyCommand`
- `stateAfter` — the post-command state (for name lookups, current values, etc.)
- `command` — the originating command (for command-id linking and rejection details)

**Output:** Single LogEntry. If events is empty (rare — only true no-op commands), no entry is created.

### 7.3 Formatter Responsibilities

The formatter handles:

- **Name resolution.** Convert `combatantId` to display name from state. If the combatant is gone (REMOVE_COMBATANT path), the formatter must extract the name from the `combatant-removed` event itself (which carries `name`).
- **Event grouping.** Multiple `effect-applied` events from one APPLY_EFFECT (parent + implied) become one line: "Goblin 1 became Grabbed (Off-Guard, Immobilized)".
- **Death subsystem narrative.** Compose Dying/Wounded/Doomed interactions per §6 above into single readable lines.
- **Phase narration.** Use `phase-changed` events to insert section dividers in the log when transitioning to RESOLVING.
- **Rejection messaging.** `command-rejected` becomes a warning entry.
- **Filtering.** Some events (e.g., `reaction-reset` cause `"auto"`) may be suppressed at format time based on user preference. This is configurable in settings.

### 7.4 Undo Interaction

Undoing a command does not delete its log entry. Instead, the orchestrator marks the entry as undone (display: struck-through, dimmed). Redoing un-marks it.

This requires a small extension to LogEntry:

```typescript
interface LogEntry {
  // ... fields above ...
  undone: boolean             // marked when user undoes the originating command
}
```

The undone flag is purely cosmetic — it doesn't affect state. Persistence stores it as part of the snapshot.

### 7.5 Combat Log is Display-Only

Per arch §17, the combat log does not drive state. It is derived from events. State changes are authoritative. If a future replay/debug tool needs to reconstruct timing, it can replay commands through `applyCommand` and re-format from the resulting events.

---

## 8. Type Removals & Renames

| Item | Was | Now |
|---|---|---|
| `temp-hp-changed` event | separate event variant | merged into `hp-changed` with cause `"set-temp"` |
| `effect-applied` payload | `combatantId, effectName, value?, instanceId` | adds `effectId`, `parentInstanceId?` |
| `effect-removed` payload | `combatantId, effectName, reason: string, instanceId` | adds `effectId`, `parentInstanceId?`, `reason` is now a typed enum |
| `effect-value-changed` payload | `combatantId, effectName, from, to, instanceId` | adds `effectId` |
| `combatant-died` payload | `combatantId` only | adds `cause` enum |
| `reaction-reset` payload | `combatantId` only | adds `cause: "auto" \| "manual"` |
| `combatant-added` payload | `combatantId, name` | adds `sourceType`, `masterId?` |

---

## 9. Amendments to Existing Specs

### 9.1 Command Vocabulary Spec §6

Replace the existing `DomainEvent` union with a reference to this spec.

### 9.2 Command Vocabulary Spec §1.2

The rejected-command pattern returns events including `command-rejected`. Type definition for `CommandRejectedEvent` moves to §4.9 here.

### 9.3 Architecture Spec §17

Replace the partial DomainEvent union and combat log description with a reference to this spec.

### 9.4 Effects-and-Durations Spec §8

The `effect-duration-changed` event referenced in SET_EFFECT_DURATION is now formally typed in §4.6 here.

### 9.5 Conditions Library Spec §3.7

Restate: the death subsystem composes existing events. See §6 for the composition table.

### 9.6 Hazards Spec — No Changes

Hazards spec already states "no new domain events" (§7). Confirmed — hazards reuse the catalog as-is.

---

## 10. Open Items

None. This spec resolves all flagged event-related ambiguities for V2.

---

## 11. Test Priority

1. **Event ordering invariants** — END_TURN with hard clock expirations and turn-end suggestions emits events in the documented order (turn-ended → effect-removed × N → prompt-generated × N → phase-changed). Snapshot test the event sequence for representative scenarios.
2. **Death subsystem event composition** — Apply Dying with Wounded; verify exactly the events listed in §6 fire in correct order. Apply Dying past threshold; verify capped value and combatant-died.
3. **HP event coverage** — APPLY_DAMAGE consuming temp HP only emits one `hp-changed` with hpFrom == hpTo and tempHp delta. APPLY_DAMAGE spanning both emits one event with both deltas. SET_HP to 0 from > 0 emits `hp-changed` and `hp-reached-zero`. SET_HP to 0 from 0 emits only `hp-changed`.
4. **Implied effect cascade events** — APPLY_EFFECT with Grabbed emits 3 `effect-applied` events with correct `parentInstanceId` linkage. REMOVE_EFFECT of Grabbed emits 3 `effect-removed` events with reason `"removed"` for parent, `"cascade"` for children.
5. **Phase transition coverage** — Every phase transition produces exactly one `phase-changed` event. END_TURN entering RESOLVING produces `phase-changed` after the prompts are generated.
6. **CommandRejected does not pollute** — Rejected commands emit only `command-rejected`, no other events. State is unchanged.
7. **Rename-after-remove formatter robustness** — Combatant A applies Frightened to B, A is removed, then RENAME_COMBATANT B. The formatter constructs valid messages using B's current name and the frozen `sourceLabel` for A's removed reference.

---

## 12. Update Project Instructions

Add to "Remaining Specification Topics" as completed:

- [x] **Domain event catalog** — Canonical DomainEvent types, payloads, emission rules per command. Combat log formatter contract. Supersedes command vocab §6 and arch §17.