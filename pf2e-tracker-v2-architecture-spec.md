# PF2e Encounter Tracker v2 — Architecture Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-21
**Author:** Mateusz + Claude (collaborative)
**Status:** Ready for implementation — architecture decisions locked, subsystem specs split into canonical topic specs

---

## 1. Project Overview

### 1.1 Purpose

A lightweight web application to reduce GM burden during Pathfinder 2e combat encounters. The tracker manages initiative, HP, conditions/effects with PF2e stacking rules, and creature statblocks — providing the GM with all mechanical information needed to run monsters efficiently.

### 1.2 Why V2

V1 suffered from tight coupling between game logic and the Svelte presentation layer. The effects/conditions system was built incrementally and became unmanageable spaghetti — adding spell effects and slot tracking proved impossible without a rewrite. V2 is a clean-room reimplementation with enforced architectural boundaries.

### 1.3 Design Principles

- **Domain purity.** All game logic is pure TypeScript with zero framework dependencies. The entire encounter can be "played" and tested without any UI code.
- **GM authority.** The system suggests, never auto-applies. The GM is always the final decision-maker. The tracker is a smart clipboard, not a rules engine.
- **Mechanical correctness where it matters.** PF2e bonus stacking rules are applied correctly by the system. Everything else (effect resolution, duration judgment calls) is the GM's responsibility.
- **Crash resilience.** Encounter state survives page reload. Accidental refresh on a tablet must not lose combat progress.
- **No server.** All data is client-side. No accounts, no cloud sync, no running costs.

---

## 2. Non-Functional Requirements

### 2.1 Performance & Architecture

- Web application, browser-based
- Fast initial load, minimal bundle size — no heavy frameworks, no unnecessary dependencies
- Responsive UI with no perceivable lag during combat operations
- Offline-capable after initial load: nice-to-have (PWA), not required for V2

### 2.2 Deployment

- Static site deployable to Cloudflare Pages (free tier)
- No server-side processing
- All data stored client-side in IndexedDB

### 2.3 Platform Support

- Desktop browsers (primary development target)
- Tablets (primary usage context at the table) — touch-friendly controls
- No mobile phone optimization required

### 2.4 Data Sovereignty

- No proprietary data stored on any server
- No telemetry, no analytics
- User's creature library, encounters, and API keys never leave the browser except for direct API calls initiated by the user

---

## 3. Technology Stack

- **Language:** TypeScript (strict mode)
- **UI framework:** Svelte (latest stable)
- **Build tool:** Vite + SvelteKit with static adapter
- **Storage:** IndexedDB (via a lightweight wrapper)
- **Testing:** Vitest (domain layer), Playwright (e2e, optional for V2)
- **Deployment:** Cloudflare Pages
- **Data format:** JSON internally, YAML for import/export

---

## 4. Architecture Overview

### 4.1 Core Principle — Unidirectional Dependencies

```
┌──────────────────────────────────────────────────┐
│                   UI (Svelte)                     │
│   Components, stores, event handlers, display     │
└────────────┬─────────────────────────┬───────────┘
             │ reads state             │ dispatches
             │ from store              │ commands
             ▼                         ▼
┌──────────────────────────────────────────────────┐
│                  Orchestrator                     │
│   Wires domain ↔ UI ↔ persistence                │
│   Manages undo/redo stack                         │
│   Holds Svelte store with current state           │
└────────┬──────────────┬──────────────┬───────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────┐
│    Domain    │ │ Persistence │ │  Importer   │
│  Pure TS,    │ │  IndexedDB  │ │  LLM parse  │
│  zero deps   │ │  YAML I/O   │ │  YAML import│
└──────────────┘ └─────────────┘ └─────────────┘
```

**Dependency rule:** Arrows point downward only. `domain` imports from nothing outside itself. `persistence` and `importer` import types from `domain`. `orchestrator` imports from all three. `ui` imports from `orchestrator` and `domain` types.

### 4.2 The Command Flow

Every state change follows this path:

1. User interacts with UI (click, tap, keyboard)
2. UI constructs a `Command` (plain serializable object)
3. UI calls `orchestrator.dispatch(command)`
4. Orchestrator calls `domain.applyCommand(currentState, command)`
5. Domain returns `{ newState: EncounterState, events: DomainEvent[] }`
6. Orchestrator pushes command + snapshot onto undo stack
7. Orchestrator sets Svelte store to `newState`
8. Orchestrator passes events to combat log
9. Orchestrator triggers persistence write (async, non-blocking)
10. Svelte reactivity updates the UI

The domain never calls the UI. The domain never calls persistence. It is a pure function: state + command in, new state + events out.

---

## 5. Module Structure

### 5.1 Directory Layout

```
src/
  domain/                 ← Pure TypeScript, ZERO external imports
    types/                ← All data types, interfaces, enums
      creature.ts
      combatant.ts
      encounter.ts
      effect.ts
      command.ts
      event.ts
      stats.ts
    effects/              ← Effect resolution and stat derivation
      stacking.ts         ← PF2e bonus stacking rules
      derivation.ts       ← deriveStats() pure function
      library.ts          ← Built-in conditions library (constants)
    encounter/            ← Encounter state machine
      reducer.ts          ← applyCommand() dispatcher
      initiative.ts       ← Turn ordering, advancement
      lifecycle.ts        ← Encounter phase transitions
    creatures/            ← Creature operations
      templates.ts        ← Weak/elite template application
      clone.ts            ← Deep clone creature → combatant

  orchestrator/           ← Thin glue layer
    dispatcher.ts         ← dispatch(), undo/redo management
    store.ts              ← Svelte store holding current state
    combat-log.ts         ← Event → log entry mapping

  persistence/            ← Storage layer
    indexeddb.ts          ← Read/write encounter state, creature library
    yaml.ts               ← YAML serialization/deserialization
    migration.ts          ← Schema versioning (stubbed for V2)

  importer/               ← Data import pipeline
    llm-parser.ts         ← Raw text + API key → Creature
    yaml-import.ts        ← YAML string → Creature
    validator.ts          ← Validates Creature against schema

  ui/                     ← Svelte components
    (structure TBD — not an architectural concern)
```

### 5.2 Boundary Enforcement

The `domain/` directory has its own `tsconfig.json` with no path aliases to `ui/`, `persistence/`, `orchestrator/`, or any Svelte-related package. Any import of framework code from within `domain/` produces a compile error.

This is the structural guardrail that prevents V1's coupling problem from recurring. It is not a convention — it is enforced by the toolchain.

---

## 6. Domain Core — State Machine

### 6.1 Command Sourcing

The system uses **command sourcing**: the authoritative data is the current state snapshot, not a log of events. Commands are the inputs that produce state transitions. If game logic is later fixed, replaying the same commands through corrected logic produces correct state.

Commands are **serializable plain objects** — no closures, no live references, no framework types. This enables: persistence, combat log generation, debugging (dump the command history to see exactly what happened).

### 6.2 State Shape (top-level)

```typescript
interface EncounterState {
  id: string
  name: string
  phase: EncounterPhase
  round: number
  initiative: InitiativeState
  combatants: Record<string, CombatantState>
  pendingPrompts: Prompt[]        // blocking turn-end resolution
  combatLog: LogEntry[]
}
```

### 6.3 Encounter Lifecycle

```
PREPARING  →  ACTIVE  →  COMPLETED
               ↕
            RESOLVING
```

- **PREPARING:** Encounter is being set up. Combatants can be added/removed, initiative set. No turn tracking.
- **ACTIVE:** Combat is running. Turn tracking, effects processing, full command vocabulary available.
- **RESOLVING:** Turn boundary processing. Only prompt-response commands are legal. System returns to ACTIVE when all prompts are cleared.
- **COMPLETED:** Combat is over. Read-only. Can be reset to PREPARING for re-run.

### 6.4 The `applyCommand` Function

```typescript
function applyCommand(
  state: EncounterState,
  command: Command,
  effectLibrary: EffectLibrary     // built-in + user-imported definitions
): { newState: EncounterState, events: DomainEvent[] }
```

This is the single entry point for all state mutations. It is a pure function. The `effectLibrary` is passed in rather than imported globally, making it testable with custom/mock effect definitions.

---

## 7. Initiative System

### 7.1 Data Model

```typescript
interface InitiativeState {
  order: CombatantId[]          // sorted sequence of combatant IDs
  currentIndex: number          // pointer into order — whose turn it is
  delaying: CombatantId[]       // combatants currently delaying
}
```

### 7.2 Behavior

- Initiative is a manually-orderable list. The GM sets initial order (typically by rolling), and can drag-reorder at any time.
- **Turn advancement:** `END_TURN` triggers turn-end processing and then moves `currentIndex` forward. When it wraps past the end, `round` increments.
- **Delay:** Combatant is moved from `order` to `delaying`. Pointer advances to next combatant. When the delaying combatant re-enters, they are inserted at the chosen position in `order`.
- **Ready:** Not an initiative mutation. The combatant's turn is spent normally; they gain a "readied action" effect (reminder-only).
- **Death/removal:** Combatant can be marked dead but remains in order (greyed out, skipped). Alternatively removed entirely. GM's choice.
- **Joining mid-combat:** New combatant inserted at the appropriate position in `order`.

### 7.3 Turn Signals to Effects Engine

The initiative system provides two signals consumed by the effects engine:

- `turnStarted(combatantId)` — fires when a combatant's turn begins
- `turnEnded(combatantId)` — fires when a combatant's turn ends (before advancing to next)

These are the **only** inputs the effects engine receives from initiative. Effect durations are anchored to combatant IDs, not positions, so reordering initiative never corrupts durations.

---

## 8. Effects Engine

### 8.1 Design Philosophy

The effects engine does three things:

1. **Stores** effects on combatants — what's active, with what value, from what source
2. **Derives stats** by applying modifiers with correct PF2e stacking rules — this is the only fully automated part
3. **Presents prompts** at turn boundaries with sensible suggestions the GM can accept, modify, or ignore

The engine never auto-modifies effects. All value changes, removals, and state transitions require explicit GM commands. The system suggests (e.g., "Frightened 3 → decrease to 2?"), the GM confirms, modifies, or dismisses.

### 8.2 Canonical Effect Types

`EffectDefinition`, `AppliedEffect`, `Duration`, `TurnBoundarySuggestion`, implied-effect behavior, source-label handling, persistence hydration, and `SET_EFFECT_DURATION` are canonical in `pf2e-effects-and-durations-spec.md`.

The architecture-level rules are:

- Effects live on combatants as applied instances.
- `targetId` is implicit from the containing combatant.
- `sourceId` is optional; `sourceLabel` preserves readable attribution when the source combatant no longer exists.
- `maxValue` is advisory only. The domain validates minimum values, not PF2e display caps.
- Hard-clock durations (`untilTurnEnd`, `untilTurnStart`) are the only automatic expirations.
- `rounds` is a manually adjusted display counter.
- Sustained effects use `untilTurnEnd` plus a `confirmSustained` prompt.

### 8.3 Turn Boundary Resolution Flow (Blocking)

When `END_TURN` is dispatched for combatant X:

1. State transitions to `RESOLVING` phase.
2. System collects all active effects on X (and sustained effects where X is the caster).
3. **Hard clock expirations** are applied automatically: effects with matching `untilTurnEnd` duration are removed. Events emitted for combat log.
4. **Suggestion prompts** are generated for remaining relevant effects and placed in `pendingPrompts`.
5. `RESOLVE_PROMPT` is the primary command in this phase. HP, effect, note, death-state, and spellcasting correction commands remain legal per command vocabulary phase restrictions.
6. GM resolves each prompt (accept suggestion, modify, dismiss).
7. When `pendingPrompts` is empty, state transitions back to `ACTIVE` and initiative advances to next combatant.

`START_TURN` for the next combatant then fires, processing `untilTurnStart` expirations and generating any start-of-turn prompts.

---

## 9. Stat Derivation

### 9.1 The Pure Function

```typescript
function deriveStats(
  baseStats: CreatureBaseStats,
  appliedEffects: AppliedEffect[],
  effectLibrary: EffectLibrary
): ComputedStats
```

This function is stateless, has no side effects, and is called on every render. Given ~10 combatants with ~5-10 effects each, performance is trivially fast (microseconds).

### 9.2 Modifier Shape

```typescript
interface Modifier {
  stat: StatTarget
  bonusType: BonusType
  value: number | "effectValue" | "-effectValue"
}

type BonusType = "status" | "circumstance" | "item" | "untyped"

type StatTarget =
  | "ac"
  | "fortitude" | "reflex" | "will" | "allSaves"
  | "perception"
  | "attackRolls"
  | "allDCs"
  | "allSkills"
  | string    // specific skill: "athletics", "stealth", etc.
```

`"effectValue"` resolves to the current value of the parent `AppliedEffect`. Frightened 2 with modifier `{ stat: "attackRolls", bonusType: "status", value: "-effectValue" }` resolves to a -2 status penalty to attack rolls.

**"All" variant expansion:** `allSaves` expands to `[fortitude, reflex, will]`. `allSkills` expands against the creature's actual skill list (creature-dependent). Both explicit targets and "all" variants are supported — explicit takes precedence if both exist.

### 9.3 PF2e Stacking Rules

The derivation pipeline per stat:

1. Collect all modifiers targeting this stat (including expanded "all" variants)
2. Group by `bonusType`
3. Per type: keep highest bonus (positive value) and lowest/worst penalty (negative value)
   - Exception: **untyped penalties always stack** (all are kept)
   - Untyped bonuses: highest only
4. Sum all surviving modifiers
5. Apply to base stat value

### 9.4 Output — ComputedStats

```typescript
interface ComputedStats {
  // Each stat includes final value + breakdown for UI display
  ac: { final: number; base: number; modifiers: AppliedModifier[] }
  fortitude: { final: number; base: number; modifiers: AppliedModifier[] }
  reflex: { final: number; base: number; modifiers: AppliedModifier[] }
  will: { final: number; base: number; modifiers: AppliedModifier[] }
  perception: { final: number; base: number; modifiers: AppliedModifier[] }
  attackRolls: { final: number; base: number; modifiers: AppliedModifier[] }
  skills: Record<string, { final: number; base: number; modifiers: AppliedModifier[] }>
  // ... other derivable stats
}

interface AppliedModifier {
  value: number                     // resolved numeric value
  bonusType: BonusType
  sourceName: string                // "Frightened 2", "Bless"
  suppressed: boolean               // true if this modifier lost stacking (for breakdown display)
}
```

The `suppressed` field enables the UI to show: "AC 18 (base 20, ~~+1 status from Bless~~ suppressed by -2 status from Frightened, -2 status from Frightened)". Full transparency into how the number was derived.

---

## 10. Creature Data Model

### 10.1 Creature (Library Template)

A creature in the library is a read-only template. It is never mutated during combat.

```typescript
interface Creature {
  id: string
  name: string
  level: number
  traits: string[]
  size: CreatureSize
  alignment?: string
  rarity: "common" | "uncommon" | "rare" | "unique"

  // Defense
  ac: number
  fortitude: number
  reflex: number
  will: number
  perception: number
  hp: number
  immunities: string[]
  resistances: { type: string; value: number }[]
  weaknesses: { type: string; value: number }[]

  // Offense
  speed: Record<string, number>     // { land: 25, fly: 40 }
  attacks: Attack[]
  spellcasting?: SpellcastingBlock[]

  // Abilities — categorized for quick-view
  passiveAbilities: Ability[]
  reactiveAbilities: Ability[]      // reactions, free actions with triggers
  activeAbilities: Ability[]        // 1-action, 2-action, 3-action

  // Skills
  skills: Record<string, number>    // { athletics: 12, stealth: 8 }

  // Meta
  source?: string
  tags: string[]
  notes?: string
}
```

### 10.2 Combatant (Encounter Instance)

When a creature is added to an encounter, it becomes a combatant — a deep clone with encounter-specific mutable state.

```typescript
interface CombatantState {
  id: CombatantId
  creatureId: string              // reference to library template (for display/lookup)
  name: string                    // display name ("Goblin 1", "Goblin 2")

  // Snapshot from creature template (possibly adjusted by weak/elite)
  baseStats: CreatureBaseStats    // the creature's stats at encounter start

  // Mutable encounter state
  currentHp: number
  tempHp: number
  appliedEffects: AppliedEffect[]
  reactionUsedThisRound: boolean
  isAlive: boolean
  notes?: string
}
```

### 10.3 Weak/Elite Templates

Applied mechanically at combatant creation time (deep clone stage). Monster Core weak/elite adjustments:

- **Elite:** raise level by 1, or by 2 if the starting level is -1 or 0; add +2 to AC, saves, attacks, DCs, perception, skills, and structured Strike damage; increase HP by starting-level band.
- **Weak:** lower level by 1, or by 2 if the starting level is 1; subtract 2 from AC, saves, attacks, DCs, perception, skills, and structured Strike damage; decrease HP by starting-level band, floored at 1 HP.

These are applied to the adjusted combatant display data and `baseStats`. The creature library template is never modified. If the published creature deviates from the mechanical template, the GM can manually edit the combatant's values after creation — the combatant is a mutable deep clone, not a live reference.

---

## 11. Encounter Model

### 11.1 No Templates — Direct Encounter Creation

There is no `EncounterTemplate` type. The encounter creation flow is:

1. GM creates a new encounter (just a name) → state enters PREPARING phase
2. GM adds combatants — from creature library (with optional weak/elite), from a party, or any combination
3. GM sets initiative order
4. GM dispatches START_ENCOUNTER → state enters ACTIVE phase

**"Re-running" an encounter:** Export the encounter state as YAML during PREPARING or after COMPLETED. Import it later to recreate the combatant list. This is strictly more flexible than templates because it captures the actual state, not a blueprint.

**Multi-phase encounters:** Reinforcements arrive mid-combat → GM adds combatants from the library during ACTIVE phase (ADD_COMBATANT is legal in ACTIVE). No template chaining needed.

### 11.2 Encounter State

`EncounterState` (§6.2) is the single encounter representation. It is the domain's working state, the persistence format, and the store value. There is no separate "runtime" vs "template" distinction.

---

## 12. Undo/Redo

### 12.1 Linear History Stack

Managed by the orchestrator, not the domain.

```typescript
interface UndoStack {
  snapshots: EncounterState[]     // parallel to commands
  commands: Command[]
  currentIndex: number            // pointer into the stack
}
```

- **New command:** truncate everything after `currentIndex`, push new snapshot and command, advance index.
- **Undo:** decrement `currentIndex`, set store to `snapshots[currentIndex]`.
- **Redo:** increment `currentIndex`, set store to that snapshot.
- **Not persisted.** On page reload, undo history is lost. Encounter state is restored from the IndexedDB snapshot.

### 12.2 Snapshot Strategy

Every command produces a full state snapshot stored alongside it. Given state is ~100KB for a 10-combatant encounter, storing 50-100 snapshots is ~5-10MB — negligible in memory. This makes undo O(1) instead of replaying commands.

---

## 13. Persistence

### 13.1 IndexedDB Stores

- **creatures** — Creature library. Keyed by `creature.id`. JSON objects.
- **spells** — Spell index entries. Keyed by `spell.slug`.
- **hazards** — Hazard library. Keyed by `hazard.id`.
- **partyMembers** — Persistent PC/NPC ally records. Keyed by `partyMember.id`.
- **companions** — Persistent companion records. Keyed by `companion.id`.
- **parties** — Saved party groupings. Keyed by `party.id`.
- **activeEncounter** — The currently running encounter state. Single record. Written on every command dispatch (async, non-blocking). Read on page load to restore.
- **userEffects** — User-imported custom effect definitions. Keyed by `effect.id`.
- **settings** — User preferences, API key (for LLM parser), UI config.

### 13.2 Crash Recovery

On page load:

1. Read `activeEncounter` from IndexedDB.
2. If present and `phase !== "COMPLETED"`: restore into Svelte store, resume where left off. Undo history is empty (lost).
3. If absent or completed: show encounter creation screen.

### 13.3 YAML Import/Export

YAML is the exchange format. Import/export covers:

- **Creatures:** Full creature data. YAML schema mirrors the `Creature` TypeScript interface. Round-trips cleanly.
- **Spells:** Spell index entries for tooltip/enrichment data.
- **Hazards:** Hazard library records.
- **Party records:** Party members, companions, and parties.
- **Encounters:** Full encounter state (combatant list with creature references). Exportable during PREPARING for re-use, or after COMPLETED for archival. Re-importing recreates the encounter in PREPARING phase.
- **Effect definitions:** Custom effects in the same shape as `EffectDefinition`.

The YAML schema is a direct serialization of the TypeScript types. `pf2e-yaml-schema-spec.md` defines the document envelope, supported document kinds, and import/export rules.

---

## 14. Importer — Creature Pipeline

### 14.1 Pipeline

```
Raw statblock text
  → LLM parser (API call with user-provided key)
    → YAML intermediate (reviewable/editable)
      → Validator (schema check)
        → Creature object
          → IndexedDB (creature library)
```

The user can intercept at the YAML stage to correct parser errors. This is the expected workflow: parse, review, fix, import.

### 14.2 LLM Parser

- Makes a direct API call from the browser using the user's API key
- Key is stored in IndexedDB `settings` store, never sent to any server other than the LLM provider
- If no key is configured, the parser feature is disabled in the UI (greyed out with setup instructions)
- The parser is a best-effort transformer — it will make mistakes. The YAML review step exists for this reason.

### 14.3 Manual Entry

No dedicated creature creation form. The expected workflow for manual creature creation is:

1. Write YAML (or copy/modify an existing export)
2. Import via YAML pipeline
3. Validate + store

An architectural stub for a future inline editor exists: the creature data model has clean field-level access, so building an editor later requires only UI work, no domain changes.

---

## 15. Effect Definitions Library

### 15.1 Two-Tier Library

**Built-in:** All standard PF2e conditions hardcoded as TypeScript constants. Ship with the app, always available, cannot be deleted.

**User-imported:** Custom effect definitions from YAML, stored in IndexedDB. Spell effects, AP-specific curses, homebrew conditions.

### 15.2 Lookup Order

```typescript
function resolveEffect(id: string): EffectDefinition | null {
  return userLibrary[id] ?? builtinLibrary[id] ?? null
}
```

User definitions override built-ins with the same ID. This allows house-ruling standard conditions.

### 15.3 Built-In Conditions

The complete built-in condition and persistent damage library is canonical in `pf2e-conditions-library-spec.md`. That spec defines modifiers, implied effects, value ranges, start/end turn suggestions, death tracking behavior, and persistent damage note conventions.

### 15.4 Detection Conditions (Concealed, Hidden, Undetected, Unnoticed)

These conditions are relational in PF2e rules (hidden *from* specific creatures). The tracker models them as regular effects applied to a combatant, meaning "relative to the opposing side." No per-pair tracking. An optional free-text `note` field on the `AppliedEffect` can specify "from Fighter and Cleric only" if needed.

These conditions have no stat modifiers in the system — they modify targeting procedures, which the tracker doesn't model. They are visual indicators the GM manages manually.

---

## 16. Command Vocabulary

The complete command vocabulary is canonical in `pf2e-command-vocabulary-spec.md`, with spell usage command behavior detailed in `pf2e-spellcasting-spec.md`.

### 16.1 Encounter Lifecycle
`START_ENCOUNTER`, `COMPLETE_ENCOUNTER`, `RESET_ENCOUNTER`

### 16.2 Combatant Management
`ADD_COMBATANT`, `REMOVE_COMBATANT`, `RENAME_COMBATANT`

### 16.3 Initiative
`SET_INITIATIVE_ORDER`, `REORDER_COMBATANT`, `END_TURN`, `DELAY`, `RESUME_FROM_DELAY`

### 16.4 HP & Damage
`APPLY_DAMAGE`, `APPLY_HEALING`, `SET_TEMP_HP`, `SET_HP`

### 16.5 Effects
`APPLY_EFFECT`, `REMOVE_EFFECT`, `SET_EFFECT_VALUE`, `MODIFY_EFFECT_VALUE`, `SET_EFFECT_DURATION`

### 16.6 Spellcasting
`USE_SPELL_SLOT`, `RESTORE_SPELL_SLOT`, `USE_FOCUS_POINT`, `RESTORE_FOCUS_POINT`, `USE_INNATE_SPELL`, `RESTORE_INNATE_SPELL`, `SET_SPELL_SLOT_USAGE`, `SET_FOCUS_USAGE`, `SET_INNATE_USAGE`, `RESET_SPELL_BLOCK`

### 16.7 Turn Resolution
`RESOLVE_PROMPT` (accept/modify/dismiss turn-end suggestions)

### 16.8 Combat State
`MARK_REACTION_USED`, `RESET_REACTION`, `SET_NOTE`, `MARK_DEAD`, `REVIVE`

This is a summary only. Payloads, phase restrictions, validation rules, and event outputs live in the command vocabulary spec.

---

## 17. Combat Log

Every command produces `DomainEvent[]`. The canonical event union, per-command emission table, and formatter contract live in `pf2e-domain-events-spec.md`.

The combat log is append-only and display-only. It does not drive state — it is derived from events. On undo, relevant log entries can be marked as "undone" rather than deleted, preserving the full history.

---

## 18. Testing Strategy

### 18.1 Domain Layer — Unit Tests (Vitest)

The domain is pure functions. Every command type gets tests:

- `applyCommand(state, APPLY_DAMAGE(...))` → assert HP changed correctly
- `deriveStats(base, [frightened2, bless])` → assert stacking resolved correctly
- Turn boundary → assert correct prompts generated
- Implied effects → assert Off-Guard created/removed with Grabbed
- Edge cases: applying same condition twice, removing an effect that has children, etc.

This is the highest-value, lowest-cost testing. No DOM, no browser, no mocking. Pure data in, data out.

### 18.2 Stat Derivation — Exhaustive Stacking Tests

The stacking rules engine is the one place the system claims mechanical correctness. It gets thorough combinatorial testing:

- Status bonus + status penalty (highest bonus, worst penalty)
- Two circumstance bonuses (only highest kept)
- Multiple untyped penalties (all stack)
- Mixed types on the same stat
- "All" variant expansion against creature skill lists

### 18.3 Orchestrator — Integration Tests

Test the dispatch → domain → store → persistence flow. Mock IndexedDB.

### 18.4 E2E — Optional for V2

Playwright tests against the running app. Nice to have, not blocking. The domain tests provide the core confidence.

---

## 19. Open Items & Future Considerations

### 19.1 Parked (Explicitly Not V2)

- **Multiple simultaneous combats:** Out of scope.
- **PWA/offline mode:** Nice-to-have. Static deployment already works offline-ish after cache.
- **Client-side LLM parsing:** Running the parser model in-browser. Future exploration.
- **Data versioning / migration:** Stubbed in persistence layer. Needed when schema evolves.
- **Inline creature editor UI:** Architectural stub exists. Build when YAML editing proves too cumbersome.

### 19.2 Canonical Specification Index

- `pf2e-tracker-v2-architecture-spec.md` — architecture, boundaries, stack, and state-machine overview.
- `pf2e-effects-and-durations-spec.md` — effect types, applied instances, durations, turn-boundary suggestions, and effect duration command.
- `pf2e-command-vocabulary-spec.md` — command union, payloads, phase restrictions, validation policy, and command count.
- `pf2e-domain-events-spec.md` — event union, event payloads, emission order, and combat log formatter contract.
- `pf2e-conditions-library-spec.md` — built-in conditions, persistent damage, and death tracking.
- `pf2e-creature-types-spec.md` — creature subtypes, spell index, spellcasting blocks, weak/elite adjustments.
- `pf2e-spellcasting-spec.md` — spell usage tracking commands and events.
- `pf2e-party-members-spec.md` — party members, companions, persistent effects, and sync-back.
- `pf2e-hazards-spec.md` — hazards as combatants and hazard factory behavior.
- `pf2e-afflictions-spec.md` — reminder-only afflictions with stage tracking and save prompts.
- `pf2e-llm-parser-spec.md` — parser prompts, validation, and error handling.
- `pf2e-yaml-schema-spec.md` — YAML envelope, document kinds, import/export rules.

---

## Appendix A: Key Architectural Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| A1 | Pure functional domain | Prevents V1 coupling. Enables testing without UI. |
| A2 | Command sourcing (not event sourcing) | Current rules should always apply. Bug fixes retroactively correct behavior. |
| A3 | Snapshots for undo, not replay | State is small (~100KB). O(1) undo beats O(n) replay. |
| A4 | GM authority — suggest, never auto-apply | Avoids silent wrong automation. GM always knows what changed and why. |
| A5 | Stat derivation is the only mechanical automation | Stacking rules are unambiguous and tedious. Everything else has judgment calls. |
| A6 | Hard clock expiry is automatic | "Until end of X's turn" is unambiguous. All other expirations are prompted. |
| A7 | Duration anchored to combatant ID, not position | Initiative reordering never corrupts effect durations. |
| A8 | Combatants are deep clones of templates | Creature library is never mutated. Weak/elite baked in at clone time. |
| A9 | YAML is the editing interface for creatures | No complex creation form needed. LLM → YAML → review → import. |
| A10 | Blocking turn-end resolution | Ensures no effect is forgotten. GM must explicitly resolve all prompts. |
| A11 | Two-tier effect library (built-in + user) | Standard conditions ship ready, custom effects are importable and can override. |
| A12 | No server, user-provided API key for LLM | Zero running cost. User controls their own API usage. |
| A13 | TSConfig boundary enforcement | Physical impossibility of importing Svelte in domain, not just a convention. |
