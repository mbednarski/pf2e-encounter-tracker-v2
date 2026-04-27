# PF2e Encounter Tracker v2 — Complex Hazards Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-22
**Status:** Ready for review

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

### 2.2 CreatureBaseStats — Add Hardness, Make Saves Optional

Hardness is not hazard-specific — creatures can have it too (golems, animated objects, constructs). Add it to `CreatureBaseStats`. Additionally, some hazards lack certain saves. Make saves nullable.

```typescript
interface CreatureBaseStats {
  ac: number
  fortitude: number | null          // null = hazard/entity doesn't have this save
  reflex: number | null
  will: number | null
  perception: number
  hp: number
  hardness?: number                 // flat damage reduction, display-only
  skills: Record<string, number>
  speed?: Record<string, number>
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]
  immunities?: string[]
}
```

**Impact on `deriveStats()`:** When a save is `null`, the derivation skips it — no modifiers applied, no entry in `ComputedStats`. The UI displays "—" for missing saves. All existing creature and party member factories continue to set saves as numbers. Only hazard factories may produce `null`.

**Impact on `ComputedStats`:** Save entries become optional:

```typescript
interface ComputedStats {
  ac: { final: number; base: number; modifiers: AppliedModifier[] }
  fortitude?: { final: number; base: number; modifiers: AppliedModifier[] }
  reflex?: { final: number; base: number; modifiers: AppliedModifier[] }
  will?: { final: number; base: number; modifiers: AppliedModifier[] }
  // ... rest unchanged
}
```

**Impact on `Creature` type:** Unchanged. All creatures have saves. The `Creature` interface keeps `fortitude: number`, etc. The nullable saves are a `CreatureBaseStats` concern — the factory that builds base stats from a `Hazard` is where `null` enters.

**Impact on `PartyMember` and `Companion`:** Unchanged. PCs and companions always have all saves.

**Hardness and APPLY_DAMAGE:** No change. `APPLY_DAMAGE` takes final numbers (command vocab spec §1.3). The GM subtracts hardness mentally before entering the damage amount, same as resistances and weaknesses. The UI displays hardness prominently so the GM remembers.

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

```typescript
interface Hazard {
  id: string
  name: string
  level: number
  traits: string[]
  complexity: "complex"              // always complex — simple hazards aren't tracked
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

### 4.2 CombatantState — Hazard-Specific Display Data

Hazards need a few display fields that creatures don't have. Rather than polluting `CombatantState` with hazard-specific required fields, these go in an optional bag:

```typescript
interface CombatantState {
  // ... existing fields ...

  // Hazard-specific display data (only populated for sourceType: "hazard")
  hazardData?: {
    routine: HazardRoutine
    disableChecks: DisableCheck[]
    disableProgress: DisableProgress[]   // mutable — tracks successes during encounter
    stealth: number
    stealthNote?: string
  }
}
```

This keeps the hazard-specific data contained. The domain ignores `hazardData` entirely — it's display data for the UI and mutable state for disable tracking. Creatures, party members, and companions have `hazardData: undefined`.

### 4.3 Disable Progress Tracking

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

**Tracking is manual.** The GM rolls, tells the system the result. No dedicated command — the GM uses SET_NOTE or a UI action that decrements `successesRemaining` directly (orchestrator-level mutation, not a domain command).

**Why not a domain command?** Disable progress isn't domain state in the command-sourcing sense. It doesn't interact with effects, HP, initiative, or any other domain concept. It's a counter the GM ticks down. Putting it in the domain would require a new command type for minimal benefit. The orchestrator can handle the mutation and persist it as part of the combatant state snapshot.

**Full disable:** When all `disableProgress` entries have `successesRemaining === 0`, the hazard is fully disabled. The UI indicates this. The GM dispatches `MARK_DEAD` or `REMOVE_COMBATANT` to take it out of initiative. The domain doesn't auto-remove — GM authority.

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

Some complex hazards can't be targeted by attacks — they have no AC. In PF2e this is represented as "AC —" in the statblock.

Handle the same way as missing saves: make AC nullable on `Hazard`.

```typescript
interface Hazard {
  // ...
  ac?: number                         // undefined = can't be targeted by attacks
  // ...
}
```

`CreatureBaseStats.ac` stays required (`number`). If a hazard lacks AC, the factory sets it to... actually, this is a problem. `deriveStats()` expects `ac: number`.

**Resolution:** Make `CreatureBaseStats.ac` nullable too: `ac: number | null`. Same treatment as saves. `deriveStats()` skips null AC. The UI displays "—". This is a rare edge case (most complex hazards have AC) but the type system should handle it cleanly.

Updated `CreatureBaseStats`:

```typescript
interface CreatureBaseStats {
  ac: number | null                  // null for hazards that can't be targeted
  fortitude: number | null
  reflex: number | null
  will: number | null
  perception: number
  hp: number
  hardness?: number
  skills: Record<string, number>
  speed?: Record<string, number>
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]
  immunities?: string[]
}
```

**For creatures, party members, and companions:** factories always set AC and saves to numbers. The `null` path only activates for hazards. Existing code that reads `baseStats.ac` needs a null check — but since this stat is consumed in exactly one place (`deriveStats`), the blast radius is small.

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
complexity: complex
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

## 7. No New Commands

Complex hazards use the existing command vocabulary entirely:

| Action | Command |
|---|---|
| Add to encounter | ADD_COMBATANT |
| Place in initiative | SET_INITIATIVE_ORDER / REORDER_COMBATANT |
| Take damage | APPLY_DAMAGE (GM subtracts hardness) |
| Apply effect | APPLY_EFFECT |
| Advance turn | END_TURN |
| Destroy | MARK_DEAD |
| Remove from encounter | REMOVE_COMBATANT |
| Track disable progress | Orchestrator-level mutation (not a domain command) |

No new domain commands. No new domain events.

---

## 8. Summary

### 8.1 New Types

| Type | Location | Purpose |
|---|---|---|
| `Hazard` | `domain/types/hazard.ts` | Library template for complex hazards |
| `DisableCheck` | `domain/types/hazard.ts` | Skill + DC + required successes to disable |
| `HazardRoutine` | `domain/types/hazard.ts` | Fixed actions per turn with description |
| `DisableProgress` | `domain/types/hazard.ts` | Mutable encounter tracking for disable checks |

### 8.2 Modified Types

| Type | Change |
|---|---|
| `CombatantState.sourceType` | Add `"hazard"` to union |
| `CombatantState` | Add optional `hazardData?` field |
| `CreatureBaseStats` | Add `hardness?`. Make `ac`, `fortitude`, `reflex`, `will` nullable (`number \| null`). |
| `ComputedStats` | Make `ac`, `fortitude`, `reflex`, `will` entries optional. |
| `Creature` | Add optional `hardness?` field. |

### 8.3 New IndexedDB Store

`hazards` — keyed by `hazard.id`.

### 8.4 New Factory Function

`createCombatantFromHazard(hazard: Hazard): CombatantState` — in `domain/creatures/` or new `domain/hazards/`.

### 8.5 No New Commands

Zero. Existing command vocabulary handles all hazard interactions.

### 8.6 Orchestrator Logic

- Disable progress tracking: orchestrator-level mutation, not domain command
- Hazard factory invocation on "Add Hazard" UI action

### 8.7 Test Priority

1. **CreatureBaseStats nullability** — `deriveStats()` with null AC, null saves. Verify modifiers targeting null stats are skipped, ComputedStats entries omitted.
2. **Hardness display** — verify it appears in the stat display and isn't consumed by any automated logic.
3. **Hazard factory** — produces correct CombatantState from Hazard library entry. Handles missing AC, missing saves, missing HP.
4. **Disable progress** — initialization from DisableCheck[], decrement, full-disable detection.