# PF2e Encounter Tracker v2 — Complex Hazards Specification

**Version:** 0.2 (draft)
**Date:** 2026-05-11
**Status:** Implemented

---

## 1. Overview

Complex hazards are encounter participants. They occupy initiative slots, act on their turn via a fixed routine, can be damaged and destroyed, and can be disabled via skill checks. Simple hazards are not tracked — they are a GM note, not an encounter entity.

Complex hazards are modeled as combatants. The domain treats them identically to creature combatants — same commands, same effects engine, same stat derivation. The differences are in the library type (what data is stored) and display (what the UI shows).

---

## 2. Amendments to Existing Specs

### 2.1 CombatantState — Add `"hazard"` Source Type

Amend the `sourceType` union (party members spec §2.1):

```typescript
interface CombatantState {
  // ...
  sourceType: "creature" | "partyMember" | "companion" | "hazard"
  // ...
}
```

No other changes to `CombatantState`. Hazard combatants use the same fields as creature combatants: `baseStats`, `attacks`, `abilities`, `appliedEffects`, etc.

### 2.2 Discriminated baseStats: keep `CreatureBaseStats` strict, add `HazardBaseStats`

`CreatureBaseStats` stays strict — `ac`, `fortitude`, `reflex`, `will` remain required numbers. The 0.1 draft proposed making them `number | null` on the shared type, but that pushes null checks across every reader (UI, roll handlers, all existing creature/PC tests). The implemented design adds a separate `HazardBaseStats` and discriminates `CombatantState.baseStats` as a union narrowed by `sourceType`.

```typescript
interface CreatureBaseStats {
  ac: number
  fortitude: number
  reflex: number
  will: number
  perception: number
  hp: number
  speed: number
  skills: Record<string, number>
  hardness?: number                 // NEW — flat DR, display-only
}

interface HazardBaseStats {
  ac: number | null                 // null = "AC —" in the statblock
  fortitude: number | null
  reflex: number | null
  will: number | null
  perception: number                // factory defaults to 0; hazards roll Stealth
  hp: number                        // 0 for indestructible hazards
  speed: number                     // factory defaults to 0
  skills: Record<string, number>    // typically empty
  hardness?: number
  stealth: number                   // initiative modifier
  stealthNote?: string              // "expert", "trained in Perception", etc.
  immunities?: string[]
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]
}

interface CombatantState {
  // ...
  sourceType: "creature" | "partyMember" | "companion" | "hazard"
  baseStats: CreatureBaseStats | HazardBaseStats   // narrowed by sourceType
  // ...
}
```

**Impact on `deriveStats()`:** Accepts `CreatureBaseStats | HazardBaseStats`. When `ac`, `fortitude`, `reflex`, or `will` is `null`, the entry is omitted from `ComputedStats` and any modifier targeting that stat is silently dropped (no `suppressed` entry). Creature/PC code paths see numbers everywhere; only hazard derivations skip stats.

**Impact on `ComputedStats`:** AC and the three saves become optional. `perception` and the buckets (`attackRolls`, `damageRolls`, `allDCs`, `spellDcs`, `spellAttacks`) always populate.

```typescript
interface ComputedStats {
  ac?: ComputedStat
  fortitude?: ComputedStat
  reflex?: ComputedStat
  will?: ComputedStat
  perception: ComputedStat
  skills: Record<string, ComputedStat>
  // ...buckets unchanged...
}
```

**Impact on `Creature`:** Add optional `hardness?: number` (some creatures — golems, animated objects — have hardness). All other fields unchanged. The creature factory passes `hardness` through into `CreatureBaseStats.hardness`.

**Impact on `PartyMember` / Companion:** Unchanged.

**Hardness and APPLY_DAMAGE:** No automation. `APPLY_DAMAGE` takes the final number; the GM subtracts hardness mentally, the same pattern used for resistances and weaknesses. The UI shows hardness as a chip next to AC so the GM remembers.

### 2.3 Creature — Add Optional Hardness

Some creatures (golems, animated objects) have hardness. Add it to the `Creature` interface alongside resistances/weaknesses:

```typescript
interface Creature {
  // ... existing fields ...

  // Defense
  // ...
  hardness?: number               // NEW
  // ...
}
```

The creature factory copies `hardness` into `CreatureBaseStats.hardness`.

### 2.4 New IndexedDB Store

Add `hazards` to the persistence spec (arch spec §13.1). Keyed by `hazard.id`. Same import/export treatment as creatures.

### 2.5 YAML Import/Export

Hazards are a new YAML entity type alongside creatures, encounters, party members, and effect definitions.

---

## 3. Data Model

### 3.1 Hazard (Library Template)

The `complexity` field from the 0.1 draft is dropped — only complex hazards are tracked today, and a literal-`"complex"` field carries no information. If simple hazards are ever modeled, reintroduce it then.

```typescript
interface Hazard {
  id: string
  name: string
  level: number
  traits: string[]
  rarity: "common" | "uncommon" | "rare" | "unique"

  // Detection
  stealth: number                    // Stealth DC (or initiative modifier for complex)
  stealthNote?: string               // "trained in Perception" — minimum proficiency to notice

  // Defense
  ac: number
  fortitude?: number                 // some hazards lack certain saves
  reflex?: number
  will?: number
  hp: number
  hardness?: number
  immunities?: string[]
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]

  // Disable
  disableChecks: DisableCheck[]      // one or more ways to disable

  // Routine
  routine: HazardRoutine

  // Abilities
  passiveAbilities: Ability[]        // e.g., "Darkness" aura
  reactiveAbilities: Ability[]       // many hazards have reactions
  activeAbilities: Ability[]         // beyond the routine, some have special actions

  // Attacks — some hazards have listed Strikes
  attacks: Attack[]

  // Meta
  description?: string               // flavor text / GM notes
  source?: string
  tags: string[]
  notes?: string
}
```

### 3.2 DisableCheck

```typescript
interface DisableCheck {
  skill: string                      // "thievery", "religion", "athletics"
  dc: number
  requiredSuccesses: number          // how many successes needed (typically 1-3)
  note?: string                      // "requires master proficiency", "only while adjacent"
}
```

**Design notes:**

- Multiple entries = multiple ways to disable (OR logic). "Thievery DC 22 or Religion DC 26" is two entries.
- `requiredSuccesses > 1` models "Thievery DC 22 (×2)" — two separate successful checks needed.
- Disable check tracking during encounter is mutable state (§4.3).

### 3.3 HazardRoutine

```typescript
interface HazardRoutine {
  actions: number                    // how many actions per turn (typically 1-2)
  description: string                // full text: what the hazard does each turn
}
```

The routine is display-only. The GM reads it at the start of the hazard's turn and dispatches commands (APPLY_DAMAGE, APPLY_EFFECT) based on the outcome. No automation — same as creature abilities.

---

## 4. Encounter Integration

### 4.1 Adding Hazards to an Encounter

Same pattern as creatures. Factory function creates a `CombatantState` from a `Hazard` library entry.

```typescript
function createCombatantFromHazard(
  hazard: Hazard
): CombatantState
```

The factory:

1. Generates a unique `CombatantId`
2. Builds `baseStats` from the hazard's defensive stats (`null` for missing saves)
3. Sets `currentHp` to `hazard.hp`
4. Sets `sourceType: "hazard"`, `sourceId: hazard.id`
5. Copies `attacks`, `passiveAbilities`, `reactiveAbilities`, `activeAbilities`
6. Copies hazard-specific display data (§4.2)
7. No `masterId` — hazards are independent combatants in initiative

The GM dispatches `ADD_COMBATANT` with the result. Standard flow.

### 4.2 CombatantState — Hazard-Specific Display Data (split)

The 0.1 draft put everything (routine, disable checks/progress, stealth, stealth note) into one `hazardData?` bag. The implemented design splits these by their nature:

- **Defensive sense stats (`stealth`, `stealthNote`)** live on `HazardBaseStats` — parallel to `perception` on `CreatureBaseStats`. With the discriminated union, narrowing `sourceType === 'hazard'` gives you `combatant.baseStats.stealth` directly.
- **Encounter mechanics (routine, disable checks, disable progress)** live in a smaller `hazardData?` bag on `CombatantState`. `disableProgress` is mutable encounter state indexed against `disableChecks`, so they need to stay grouped.

```typescript
interface CombatantState {
  // ... existing fields ...

  hazardData?: {
    routine: HazardRoutine
    disableChecks: DisableCheck[]
    disableProgress: DisableProgress[]   // mutable — tracks successes during encounter
  }
}
```

Creatures, PCs, and companions have `hazardData: undefined`. The factory `createCombatantFromHazard` is the only place that populates the bag.

### 4.3 Disable Progress Tracking — domain command

```typescript
interface DisableProgress {
  checkIndex: number                 // index into disableChecks array
  successesRemaining: number         // starts at requiredSuccesses, decremented on success
}
```

Initialized by the factory from `disableChecks`:

```typescript
disableProgress: hazard.disableChecks.map((check, i) => ({
  checkIndex: i,
  successesRemaining: check.requiredSuccesses,
}))
```

The 0.1 draft proposed orchestrator-level mutation (no command). The implemented design uses a domain command so disable attempts go through the same command-sourced path as every other mutation and appear in the combat log.

```typescript
// Command
{ type: 'RECORD_DISABLE_PROGRESS',
  payload: { combatantId, checkIndex, delta: number } }

// Events
{ type: 'disable-progress-recorded',
  combatantId, checkIndex, previous, next }
{ type: 'hazard-disabled', combatantId }
```

- `delta` is signed: typically `-1` on a success, `-2` on a critical success, `+1` to undo, etc.
- Reducer clamps `successesRemaining` to `[0, requiredSuccesses]` and rejects no-op deltas.
- Reducer rejects if the target isn't a hazard or `checkIndex` is out of range.
- `hazard-disabled` fires exactly once, the first time all entries transition to `successesRemaining: 0`.

**Full disable behavior:** Domain does not auto-`MARK_DEAD`. The UI shows a "Fully disabled" badge, and the GM dispatches `MARK_DEAD` or `REMOVE_COMBATANT` to take the hazard out of initiative. GM authority for the actual removal stays intact.

### 4.4 Initiative

Complex hazards roll Stealth for initiative (the PCs' Perception determines if they act before or after the hazard). The GM places the hazard in initiative via `SET_INITIATIVE_ORDER` like any other combatant.

### 4.5 Turn Flow

Hazard turns work identically to creature turns. `turn-started` fires, effects are processed, the GM reads the routine and resolves it, `END_TURN` fires when done.

The UI could display the routine text prominently at turn start — a UI concern, not a domain concern.

### 4.6 Destruction and Disable

Two ways a hazard leaves combat:

1. **Destroyed:** HP reaches 0. GM dispatches `MARK_DEAD` (or the `hp-reached-zero` event triggers the GM to decide). Same as creatures.
2. **Disabled:** All disable checks complete. GM dispatches `MARK_DEAD` or `REMOVE_COMBATANT`. The hazard stops acting.

No new commands needed for either path.

---

## 5. Edge Cases

### 5.1 Hazards Without AC

Some complex hazards can't be targeted by attacks — "AC —" in the statblock. On the `Hazard` template, `ac?: number` (optional). The factory maps `undefined → null` into `HazardBaseStats.ac`. `deriveStats()` omits the `ac` entry from `ComputedStats`. UI renders "—".

`CreatureBaseStats.ac` stays required `number`. The null path lives entirely on `HazardBaseStats`. See §2.2 for the full type shapes.

### 5.2 Hazards With Multiple HP Pools

Some complex hazards have separately destroyable components (e.g., a hallway of spinning blades where each blade segment has its own HP). PF2e represents these as "Blade HP 40 (4 segments)" with per-segment hardness.

**V2 approach:** Model each segment as a separate combatant (same `sourceId`, different `CombatantId`, names like "Blade Trap — Segment 1"). The GM adds as many combatants as segments. Each has its own HP, hardness, AC. They share a routine (copy the routine text to each).

This isn't elegant but it works without new data structures. A "grouped display" UI enhancement could cluster them visually — that's a UI concern for later.

### 5.3 Effects on Hazards

Most conditions don't make sense on hazards (a spinning blade can't be Frightened). But some do — a hazard could be Slowed by a spell, or have a condition applied by a player ability. The effects engine handles this mechanically; the GM decides what's narratively appropriate.

No filtering or restriction on which effects can be applied to hazards. GM authority.

### 5.4 Hazards Without HP

Some hazards can only be disabled, not destroyed (no HP listed). Set `hp` to 0 and hardness to undefined. The UI displays "—" for HP. Damage commands are technically valid but do nothing meaningful — `currentHp` is already 0. The GM disables the hazard via skill checks.

Actually, `hp: 0` would trigger `hp-reached-zero` on creation. Better approach: make `hp` optional on `Hazard`:

```typescript
interface Hazard {
  // ...
  hp?: number                         // undefined = can't be destroyed by damage
  // ...
}
```

The factory sets `baseStats.hp` and `currentHp` to 0 if `hp` is undefined, and sets `isAlive` to true. APPLY_DAMAGE to a 0-HP combatant floors at 0 and emits no `hp-reached-zero` (already at 0, not transitioning to 0). This works without changes to the domain.

Wait — APPLY_DAMAGE only emits `hp-reached-zero` when `currentHp` reaches 0 *and* was previously above 0. So dispatching damage against a 0-HP hazard just does nothing. Correct.

---

## 6. Hazard YAML Example

```yaml
id: poisoned-dart-gallery
name: Poisoned Dart Gallery
level: 8
traits: [mechanical, trap]
rarity: common

stealth: 28
stealthNote: "expert"

ac: 27
fortitude: 13
reflex: 17
hp: 100
hardness: 10
immunities: [critical-hits, object-immunities, precision]

disableChecks:
  - skill: thievery
    dc: 26
    requiredSuccesses: 3
    note: "at a control panel on the far wall"
  - skill: athletics
    dc: 22
    requiredSuccesses: 1
    note: "to jam a single dart launcher (disables one attack)"

routine:
  actions: 2
  description: |
    The trap fires a volley of poisoned darts. It uses each action 
    to make a poisoned dart Strike against a random creature in the 
    gallery. It cannot target the same creature twice per round.

attacks:
  - name: poisoned dart
    type: ranged
    modifier: 21
    traits: [range-60]
    damage:
      - dice: 3
        dieSize: 4
        bonus: 2
        type: piercing
    effects: [poisoned-dart-gallery-poison]

reactiveAbilities:
  - name: Dart Volley
    actions: reaction
    trigger: "A creature enters the gallery"
    description: "The trap makes a poisoned dart Strike against the triggering creature."

passiveAbilities: []
activeAbilities: []

source: "Extinction Curse #3"
tags: [extinction-curse]
```

---

## 7. Command Vocabulary

Complex hazards reuse the existing command vocabulary plus one new command for disable tracking:

| Action | Command |
|---|---|
| Add to encounter | ADD_COMBATANT |
| Place in initiative | SET_INITIATIVE_ORDER / REORDER_COMBATANT |
| Take damage | APPLY_DAMAGE (GM subtracts hardness) |
| Apply effect | APPLY_EFFECT |
| Advance turn | END_TURN |
| Destroy | MARK_DEAD |
| Remove from encounter | REMOVE_COMBATANT |
| Track disable progress | **RECORD_DISABLE_PROGRESS** (see §4.3) |

The 0.1 draft proposed orchestrator-level mutation for disable tracking. The implemented design adds one domain command and two events (`disable-progress-recorded`, `hazard-disabled`) to keep disable attempts within the command-sourced model and surface them in the combat log.

---

## 8. Summary

### 8.1 New Types

| Type | Location | Purpose |
|---|---|---|
| `Hazard` | `domain/types.ts` | Library template for complex hazards |
| `HazardBaseStats` | `domain/types.ts` | Defensive stats for hazard combatants (nullable AC/saves, stealth) |
| `DisableCheck` | `domain/types.ts` | Skill + DC + required successes to disable |
| `HazardRoutine` | `domain/types.ts` | Fixed actions per turn with description |
| `DisableProgress` | `domain/types.ts` | Mutable encounter tracking for disable checks |
| `HazardData` | `domain/types.ts` | Bag carrying routine + disable checks + progress on `CombatantState` |

### 8.2 Modified Types

| Type | Change |
|---|---|
| `CombatantState.sourceType` | Already had `"hazard"` in union (verified) |
| `CombatantState.baseStats` | Now `CreatureBaseStats \| HazardBaseStats` (discriminated by `sourceType`) |
| `CombatantState` | Add optional `hazardData?: HazardData` field |
| `CreatureBaseStats` | Add `hardness?`. Saves stay required `number`. |
| `ComputedStats` | Make `ac`, `fortitude`, `reflex`, `will` entries optional. |
| `Creature` | Add optional `hardness?` field. |
| `Command` | Add `RECORD_DISABLE_PROGRESS` variant. |
| `DomainEvent` | Add `disable-progress-recorded` and `hazard-disabled` variants. |

### 8.3 New IndexedDB Store

`hazards` — keyed by `hazard.id`.

### 8.4 New Factory Function

`createCombatantFromHazard(input: { hazard, combatantId, name? })` — implemented at `domain/hazards/factory.ts`. Mirrors `createCombatantFromCreature` shape.

### 8.5 New Command

`RECORD_DISABLE_PROGRESS` (see §4.3). Two new events: `disable-progress-recorded`, `hazard-disabled`.

### 8.6 Orchestrator Logic

- Hazard factory invocation on "Add Hazard" UI action (via `makeHazardCombatant` in `src/lib/encounter-app.ts`).
- `isHazardCombatant(combatant)` type guard narrows for UI sites that need hazard-specific fields.
- Initiative roll uses `baseStats.stealth` when `sourceType === 'hazard'`, otherwise computed perception.

### 8.7 Test Priority

1. **Nullable AC/saves** — `deriveStats()` with `HazardBaseStats` and null fields. ComputedStats entries omitted; modifiers targeting null stats fall on the floor.
2. **Hardness display** — chip on the card and dd in the details panel for any combatant with `baseStats.hardness !== undefined`. Not consumed by automated damage logic.
3. **Hazard factory** — produces correct CombatantState. Handles missing AC, missing saves, missing HP, stealth note.
4. **Disable progress** — initialization from `DisableCheck[]`, decrement clamps at 0, undo clamps at `requiredSuccesses`, `hazard-disabled` fires exactly once on transition.
5. **YAML import** — round-trip the poisoned-dart-gallery fixture; reject missing required fields (`routine`, `disableChecks`).
6. **IDB store** — load/add/remove with fake-indexeddb; v4 → v5 migration preserves prior records.