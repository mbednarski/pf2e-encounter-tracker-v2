# PF2e Encounter Tracker v2 — Effects & Durations Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-25
**Status:** Ready for review
**Supersedes:** Architecture spec §8.2–§8.4 (those sections become references to this doc)

---

## 1. Purpose

This spec defines the canonical types and behavioral rules for the effects subsystem: `EffectDefinition`, `AppliedEffect`, `Duration`, and `TurnBoundarySuggestion`. It consolidates types previously scattered across the architecture spec, conditions library spec, and party members spec, and resolves ambiguities those specs left open.

---

## 2. EffectDefinition — Library Template

```typescript
interface EffectDefinition {
  id: string                           // "frightened", "bless", "giant-centipede-venom"
  name: string                         // display name
  category: EffectCategory
  description?: string                 // human-readable rules text

  // Mechanical effects
  modifiers: Modifier[]                // stat changes; empty for reminder-only

  // Value handling
  hasValue: boolean
  maxValue?: number                    // UI hint only — see §6.1, NOT validation

  // Composition
  impliedEffects?: string[]            // effect IDs auto-applied as children

  // Turn boundary behavior
  turnStartSuggestion?: TurnBoundarySuggestion
  turnEndSuggestion?: TurnBoundarySuggestion

  // Persistence across encounters
  persistAfterEncounter?: boolean      // default false; true for affliction, wounded, doomed, drained

  // Meta
  traits?: string[]
}

type EffectCategory =
  | "condition"
  | "spell"
  | "affliction"
  | "persistent-damage"
  | "custom"
```

**Amendments vs prior specs:**
- Added `turnStartSuggestion?` (was missing — Dying recovery, Persistent damage, Slowed/Stunned/Quickened reminders all fire at turn start).
- `maxValue` is now documented as advisory; behavioral rules in §6.1 confirm.
- `persistAfterEncounter` was added by party spec — restated here as canonical.

---

## 3. AppliedEffect — Instance on a Combatant

```typescript
interface AppliedEffect {
  instanceId: string                   // unique per application
  effectId: string                     // references EffectDefinition
  value?: number                       // current value (Frightened 2, Clumsy 3)

  // Source attribution
  sourceId?: CombatantId               // optional — undefined = no attributed source
  sourceLabel?: string                 // frozen display name at apply time

  // Composition
  parentInstanceId?: string            // set if this is an implied child

  // Lifecycle
  duration: Duration

  // Free-form
  note?: string                        // GM annotation; also stores persistent damage dice
}
```

**Amendments vs arch §8.3:**
- `sourceId` now optional. Required for: APPLY_EFFECT from an active combatant. Undefined for: persisted effects rehydrated from PartyMember/Companion records, system-implied effects with no clear source, GM-applied conditions where the GM doesn't bother attributing.
- `targetId` removed. The instance lives in `combatants[X].appliedEffects[]` — target is implicit. Where a Prompt or other structure needs to reference an effect across combatants, use `{ combatantId, instanceId }` pair.
- `sourceLabel` added. Populated at APPLY_EFFECT time from `combatants[sourceId].name` by the domain reducer. UI displays `sourceLabel` if `sourceId` lookup fails (combatant removed or missing). On rehydration from PersistedEffect, sourceLabel is preserved if it was set; sourceId stays undefined.

---

## 4. Duration

```typescript
type Duration =
  | { type: "untilTurnEnd"; combatantId: CombatantId }
  | { type: "untilTurnStart"; combatantId: CombatantId }
  | { type: "rounds"; count: number }
  | { type: "unlimited" }
  | { type: "conditional"; description: string }
```

**Amendments vs arch §8.4:**
- `sustained` removed from union. Sustained spells are modeled as `untilTurnEnd { combatantId: casterId }` + `turnEndSuggestion: { type: "confirmSustained" }`. On confirm, the orchestrator dispatches a `SET_EFFECT_DURATION` command (see §8) to push the end to the caster's next turn end. On dismiss, the hard clock removes it.
- `rounds` simplified to `{ type: "rounds"; count: number }`. No anchor combatant, no auto-decrement. It's a display-only counter the GM ticks down manually via `SET_EFFECT_DURATION`. If the GM wants automatic behavior, they use `untilTurnEnd`.
- `conditional` retained — distinguishes "ends on a trigger" from `unlimited` ("lasts forever"). Both are uncomputable; the type difference is purely semantic for UI.

**Hard clock expiry** remains the only automatic duration behavior: `untilTurnEnd` and `untilTurnStart` durations are removed when the specified combatant's turn reaches that boundary. No GM prompt — these are unambiguous (arch decision A6).

---

## 5. TurnBoundarySuggestion

```typescript
type TurnBoundarySuggestion =
  | { type: "suggestDecrement"; amount: number; description?: string }
  | { type: "suggestRemove"; description: string }
  | { type: "confirmSustained"; description?: string }
  | { type: "promptResolution"; description: string }
  | { type: "reminder"; description: string }
```

Template variables resolved by the prompt generator:
- `{value}` → current `AppliedEffect.value`
- `{note}` → current `AppliedEffect.note`

(Restated from conditions spec §5.3, no changes.)

---

## 6. Behavioral Rules

### 6.1 maxValue is Advisory

`EffectDefinition.maxValue` is a UI hint for stepper bounds and default ranges. The domain does not validate against it.

- APPLY_EFFECT: any `value >= 1` is accepted regardless of maxValue.
- SET_EFFECT_VALUE: any `value >= 1` is accepted. Setting to 0 is rejected; use REMOVE_EFFECT.
- MODIFY_EFFECT_VALUE: any resulting value `>= 1` is accepted. Resulting value `<= 0` triggers auto-removal (existing behavior).

The death subsystem enforces its own bounds via threshold checks (4 - doomed → dead). Wounded and Doomed don't need separate caps — exceeding their conventional max is harmless.

**Amendments to command vocab spec §4.5:** Drop maxValue rejection from APPLY_EFFECT, SET_EFFECT_VALUE, MODIFY_EFFECT_VALUE. Drop the "If resulting value exceeds maxValue: rejected" clause.

### 6.2 Multiple Instances of the Same Effect

APPLY_EFFECT always creates a new instance. If the target already has an instance of the same effectId, both coexist.

- The stacking engine (arch §9.3) handles correctness: same bonus type → only highest kept.
- UI displays all instances (typically grouped by effectId with badges showing each value/source).
- GM can REMOVE_EFFECT redundant instances if clutter bothers them.

This applies to all categories including persistent-damage. Two `persistent-fire` instances each prompt independently at turn start; the GM resolves each (apply damage, flat check). PF2e RAW says only highest applies — the GM enforces this manually by removing the lower-value instance, or by accepting one and dismissing the other prompts.

### 6.3 Source Label Freezing

At APPLY_EFFECT time, the domain reducer sets `sourceLabel` from `combatants[sourceId].name`. The label is never updated after — even if the source combatant is renamed.

UI display logic:
1. If `sourceId` is set and `combatants[sourceId]` exists → use current name (live).
2. Else if `sourceLabel` is set → use frozen label.
3. Else → display nothing or "—".

### 6.4 Implied Effect Application

(Restating arch §8.3 + conditions spec §5.2 with the value-1 convention.)

When an effect with non-empty `impliedEffects` is applied:
- For each child effect ID, recursively apply with:
  - `parentInstanceId` = the parent's `instanceId`
  - `value` = 1 if child `hasValue: true`, undefined otherwise
  - `duration` = `{ type: "unlimited" }`
  - `sourceId`, `sourceLabel` = inherited from parent
  - `note` = undefined

If the target already has an instance of the implied effect from a different parent (or no parent), the new implied instance is created anyway — they coexist. Removing one parent only removes its own implied children.

### 6.5 Implied Effect Removal Cascade

When REMOVE_EFFECT removes an instance, all instances on the same combatant where `parentInstanceId === removedInstanceId` are also removed. Cascade is recursive (implied effects of implied effects, though no built-in conditions chain that deep).

### 6.6 Source Combatant Removal Cleanup

REMOVE_COMBATANT (command vocab spec §4.2) removes a combatant entirely. Effects sourced from that combatant on other combatants remain active, but their live source reference is cleared.

Updated rule with optional sourceId: only effects with `sourceId === removedCombatantId` are changed. Set `sourceId` to `undefined` and keep the frozen `sourceLabel`. Effects with undefined `sourceId` are unaffected (they had no source attribution to begin with). No `effect-removed` or `effect-value-changed` events fire for this cleanup.

### 6.7 Hydration from PersistedEffect

When a party member or companion enters an encounter, their `persistentEffects` are expanded into full `AppliedEffect` instances:

```typescript
function hydratePersisted(persisted: PersistedEffect, ownCombatantId: CombatantId): AppliedEffect {
  return {
    instanceId: persisted.instanceId,
    effectId: persisted.effectId,
    value: persisted.value,
    note: persisted.note,
    parentInstanceId: persisted.parentInstanceId,
    duration: { type: "unlimited" },
    sourceId: undefined,                 // no live source available
    sourceLabel: persisted.sourceLabel,  // preserved if present
  }
}
```

**PersistedEffect type updated:**

```typescript
interface PersistedEffect {
  instanceId: string
  effectId: string
  value?: number
  note?: string
  parentInstanceId?: string
  sourceLabel?: string                   // preserved across encounters
}
```

This supersedes party spec §4.6, which set sourceId to the combatant's own ID as a workaround. With sourceId now optional, the workaround is unnecessary.

---

## 7. The {note} Convention for Persistent Damage

(Restated from conditions spec §5.3, unchanged.)

Persistent damage effects (`persistent-fire`, `persistent-cold`, etc.) have `hasValue: false`. The damage expression ("2d6", "5", "3d4+2") is stored in `AppliedEffect.note`. The `turnStartSuggestion.description` references `{note}` as the damage amount.

This is the one canonical use of `{note}` in built-in effects. Custom user-defined effects may use it for their own purposes.

---

## 8. New Domain Commands

The simplifications above introduce one missing command:

### SET_EFFECT_DURATION

Used by orchestrator when GM confirms a sustained spell, ticks down a `rounds` counter, or otherwise overwrites an effect's duration.

```typescript
interface SetEffectDurationPayload {
  targetId: CombatantId
  instanceId: string
  newDuration: Duration
}
```

**Validation:**
- Target combatant must exist
- Instance must exist on target combatant

**State changes:**
- `appliedEffects[instance].duration → newDuration`

**Events:**
- `{ type: "effect-duration-changed", combatantId, effectName, instanceId }`

For `rounds` countdown ticking, the orchestrator dispatches with `{ type: "rounds", count: oldCount - 1 }`. For sustained-confirm, it dispatches with `{ type: "untilTurnEnd", combatantId: casterId }` (the same shape, but the anchor is the caster's *next* turn end, which is what the hard clock will resolve to).

**Amendment to command vocab spec §4.5:** Add SET_EFFECT_DURATION to the Effects section.

---

## 9. Type Removals — Dropped from Earlier Specs

| Field/Type | Was | Now |
|---|---|---|
| `AppliedEffect.targetId` | required | removed (target is the container) |
| `AppliedEffect.sourceId` | required | optional |
| `Duration` type `"sustained"` | union variant | dropped — use untilTurnEnd + confirmSustained |
| `Duration` type `"rounds"` fields | `count, anchorCombatantId, anchorTiming` | just `count` |
| maxValue validation in commands | rejection on exceed | dropped — UI hint only |

---

## 10. Open Items

None. This spec resolves all flagged ambiguities for V2.

---

## 11. Test Priority

1. **Hydration round-trip** — PartyMember with persistentEffects → encounter → modify → COMPLETE → sync-back. Verify sourceLabel preserved, sourceId undefined throughout, parent/child chain intact.
2. **Multi-instance stacking** — apply Frightened 2 from Drow, Frightened 3 from Goblin, verify both AppliedEffects exist, derived stats use -3 status (the higher), UI breakdown shows both with the lower marked suppressed.
3. **Source removal** — apply effect from A to B, REMOVE_COMBATANT A, verify effect on B remains active, `sourceId` is cleared, `sourceLabel` is preserved, and no effect event is emitted.
4. **Sustained pattern** — caster ends turn, confirmSustained prompt fires, "Yes" dispatches SET_EFFECT_DURATION pushing duration to next turn end, hard clock doesn't expire it.
5. **Implied cascade** — apply Grabbed (implies Off-Guard, Immobilized), apply separate Off-Guard from another source. Remove Grabbed. Verify implied Off-Guard removed but standalone Off-Guard remains.
6. **maxValue non-enforcement** — APPLY_EFFECT with Frightened value 7 succeeds. SET_EFFECT_VALUE to 10 succeeds. UI should still cap stepper at maxValue but nothing blocks higher values via direct dispatch.

---

## 12. Amendments to Update Project Instructions

Add to the "Remaining Specification Topics" list as completed:

- [x] **Effects & durations** — Canonical AppliedEffect, Duration, EffectDefinition, TurnBoundarySuggestion types. Behavioral rules. Supersedes arch §8.2–§8.4.
