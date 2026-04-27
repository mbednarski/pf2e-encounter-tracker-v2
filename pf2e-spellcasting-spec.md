# PF2e Encounter Tracker v2 — Spellcasting & Spell Slots Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-25
**Status:** Ready for review
**Builds on:** Creature types spec §5 (data model already defined there)

---

## 1. Purpose & Scope

This spec defines the spellcasting subsystem: how spell usage is tracked during encounters, the commands for mutating spell state, the events emitted, and the validation rules. The data model is already specified in creature types spec §5 — this spec consolidates a small addition (`blockId`) and fully specifies the command vocabulary that was deferred there.

**In scope:** Spell slot tracking, focus point tracking, per-day innate spell tracking. For creature combatants only.

**Out of scope:** PC and companion spellcasting (player-managed; the tracker does not model). Spell description rendering (UI concern). Affliction-style spell effects (handled by the effects subsystem). Multi-encounter slot persistence (creatures are re-cloned each encounter).

---

## 2. Design Decisions

### 2.1 Creature-Only Tracking

Spell slot tracking applies only to creature combatants. Party members and companions never have a `spellcasting` field populated — those characters' slots live on the player's sheet outside the tracker.

This is consistent with party spec: PCs are minimal in the tracker (HP, AC, perception, saves, persistent effects). Companions follow the same pattern.

### 2.2 Encounter-Scoped Reset via Re-Clone

Spell slots reset between encounters because creatures are deep-cloned from their templates each time they enter combat. There is no explicit "rest" or "long rest" command — the act of building an encounter from a fresh creature template provides clean state.

For multi-encounter scenarios where the same creature persists (boss escapes, returns later in the session): the GM manually adjusts the re-added combatant's slots. SET_SPELL_SLOT_USAGE handles this without needing dedicated continuation logic.

### 2.3 Granular Restore vs Whole-Block Reset

Two restoration paths exist for different scenarios:

- **RESTORE_SPELL_SLOT** — gives back one slot at one rank. For "Wait, that fizzled" or "I miscounted my action cost" mid-encounter corrections. The natural counterpart to USE_SPELL_SLOT.
- **RESET_SPELL_BLOCK** — wipes all usage tracking on one block. For narrative resets ("the dragon meditates and recovers its 1/day breath weapon").

Most adjustments use RESTORE (granular, common). RESET is the rare narrative case.

### 2.4 USE Validation Rejects, SET Bypasses

USE_* commands reject when at zero remaining (slots, focus, innate uses). The GM is forced to acknowledge the depletion explicitly via SET_* if they want to push past it (homebrew rulings, custom resources). This catches accidental over-use while preserving GM authority.

### 2.5 No Tracking for Cantrips and At-Will Spells

Cantrips, at-will innate spells, and constant innate spells produce no commands and emit no events. The GM narrates and dispatches resulting damage/effect commands directly. Tracking unlimited resources would just clutter the log.

### 2.6 Single Event with Discriminator

All spell-usage state changes emit a single `spell-usage-changed` event with a `kind` discriminator and an `action` field. This keeps the event union focused (events spec §3) while preserving enough information for the combat log formatter to construct readable narratives.

---

## 3. Types — Reference

The full data model is defined in creature types spec §5. Restated here briefly for clarity.

```typescript
interface SpellcastingBlock {
  blockId: string                       // NEW — see §4
  name: string
  tradition: SpellTradition
  type: SpellcastingType
  dc: number
  attackModifier?: number
  focusPoints?: number                  // for type: "focus" only
  slots?: Record<number, number>        // for prepared/spontaneous: rank → count
  entries: SpellListEntry[]
}

interface CombatantSpellcasting extends SpellcastingBlock {
  usedSlots?: Record<number, number>    // rank → slots spent
  usedFocusPoints?: number              // focus points spent
  usedEntries?: Record<string, number>  // slug → uses spent (innate per-day)
}
```

`CombatantState.spellcasting` is `CombatantSpellcasting[]` — present only for creature combatants, undefined for party members and (typically) companions.

---

## 4. Block Identification — `blockId`

Creature types spec §5 keyed blocks by name. This spec replaces that with an explicit `blockId`.

### 4.1 The Field

```typescript
interface SpellcastingBlock {
  blockId: string                       // stable unique identifier within the creature
  // ... rest unchanged
}
```

### 4.2 Generation

`blockId` is generated at one of three points:

1. **YAML import** — if the YAML omits `blockId`, the importer generates one (UUID, or a deterministic slug from the name).
2. **LLM parser output** — the parser does NOT generate `blockId`. Imports flow through the YAML importer.
3. **Combatant creation (deep clone)** — `blockId` is preserved from the creature template; not regenerated.

**Why:** a creature can have two blocks with the same name in pathological cases (homebrew "Arcane Innate" + another "Arcane Innate"). Names aren't reliable. Array index is fragile if blocks ever get reordered. A stable opaque ID solves both.

### 4.3 YAML Schema

YAML files may include `blockId` (round-trip from prior export). If absent, the importer generates one and the export round-trips it back. This is handled silently — the GM doesn't author `blockId` by hand.

```yaml
spellcasting:
  - blockId: drow-priestess-divine-prepared    # auto-generated, slug-style
    name: Divine Prepared Spells
    tradition: divine
    type: prepared
    dc: 24
    # ...
```

### 4.4 Amendments to Existing Specs

- **Creature types spec §5.3** — Add `blockId: string` to `SpellcastingBlock`. Note that it's auto-generated on import.
- **LLM parser spec §11** — No change. Parser does not produce `blockId`; importer generates it.

---

## 5. Hydration — Creature Template → Combatant

When ADD_COMBATANT creates a creature combatant, the `SpellcastingBlock[]` from the template is deep-cloned into `CombatantSpellcasting[]` with usage fields initialized:

```typescript
function hydrateSpellcasting(blocks: SpellcastingBlock[]): CombatantSpellcasting[] {
  return blocks.map(block => ({
    ...structuredClone(block),
    usedSlots: block.slots ? {} : undefined,        // empty object means 0 used at every rank
    usedFocusPoints: block.type === "focus" ? 0 : undefined,
    usedEntries: hasInnatePerDayEntries(block) ? {} : undefined,
  }));
}
```

Initial state: zero used at every rank, zero focus spent, no innate uses tracked. Display reads `slots[rank] - (usedSlots[rank] ?? 0)` for remaining.

---

## 6. Commands

All commands target a specific block via `blockId`. Validation common to all spell commands:

- Combatant must exist
- Combatant must have `spellcasting` populated (creatures only — fails for party members and companions)
- Block with matching `blockId` must exist on the combatant

These are restated as "[standard validation]" in each command below.

### 6.1 USE_SPELL_SLOT

Marks one slot at the specified rank as spent.

```typescript
interface UseSpellSlotPayload {
  combatantId: CombatantId
  blockId: string
  rank: number
}
```

**Validation:**
- [standard validation]
- Block must have `slots` defined (rejects on innate, focus, cantrip-only blocks)
- `rank` must be a key in `block.slots`
- `(usedSlots[rank] ?? 0) < slots[rank]` — at least one slot remaining

**State changes:**
- `usedSlots[rank] = (usedSlots[rank] ?? 0) + 1`

**Events:**
- `spell-usage-changed` with `kind: "slot"`, `action: "used"`, `rank`, no slug

### 6.2 RESTORE_SPELL_SLOT

Returns one slot at the specified rank.

```typescript
interface RestoreSpellSlotPayload {
  combatantId: CombatantId
  blockId: string
  rank: number
}
```

**Validation:**
- [standard validation]
- Block must have `slots` defined
- `(usedSlots[rank] ?? 0) > 0`

**State changes:**
- `usedSlots[rank] = usedSlots[rank] - 1`
- If result is 0, the entry can be left as 0 or deleted; behavior is equivalent.

**Events:**
- `spell-usage-changed` with `kind: "slot"`, `action: "restored"`, `rank`

### 6.3 USE_FOCUS_POINT

Marks one focus point spent on a focus-spellcasting block.

```typescript
interface UseFocusPointPayload {
  combatantId: CombatantId
  blockId: string
}
```

**Validation:**
- [standard validation]
- `block.type === "focus"`
- `block.focusPoints` defined
- `(usedFocusPoints ?? 0) < block.focusPoints`

**State changes:**
- `usedFocusPoints = (usedFocusPoints ?? 0) + 1`

**Events:**
- `spell-usage-changed` with `kind: "focus"`, `action: "used"`

### 6.4 RESTORE_FOCUS_POINT

```typescript
interface RestoreFocusPointPayload {
  combatantId: CombatantId
  blockId: string
}
```

**Validation:**
- [standard validation]
- `block.type === "focus"`
- `(usedFocusPoints ?? 0) > 0`

**State changes:**
- `usedFocusPoints = usedFocusPoints - 1`

**Events:**
- `spell-usage-changed` with `kind: "focus"`, `action: "restored"`

### 6.5 USE_INNATE_SPELL

Marks one use of a per-day innate spell.

```typescript
interface UseInnateSpellPayload {
  combatantId: CombatantId
  blockId: string
  spellSlug: string
}
```

**Validation:**
- [standard validation]
- An entry with `entries[i].spellSlug === spellSlug` must exist on the block
- Entry's `frequency.type === "perDay"` (rejects for `atWill`, `constant`)
- `(usedEntries[spellSlug] ?? 0) < entry.frequency.uses`

**State changes:**
- `usedEntries[spellSlug] = (usedEntries[spellSlug] ?? 0) + 1`

**Events:**
- `spell-usage-changed` with `kind: "innate"`, `action: "used"`, `spellSlug`, `spellName` (from entry)

### 6.6 RESTORE_INNATE_SPELL

```typescript
interface RestoreInnateSpellPayload {
  combatantId: CombatantId
  blockId: string
  spellSlug: string
}
```

**Validation:**
- [standard validation]
- Entry must exist on block
- `(usedEntries[spellSlug] ?? 0) > 0`

**State changes:**
- `usedEntries[spellSlug] = usedEntries[spellSlug] - 1`

**Events:**
- `spell-usage-changed` with `kind: "innate"`, `action: "restored"`, `spellSlug`, `spellName`

### 6.7 SET_SPELL_SLOT_USAGE

Direct override of slots-used count at a specific rank. Bypasses use/restore validation. Allows the GM to set arbitrary values for unusual rulings or to fix up state mid-encounter.

```typescript
interface SetSpellSlotUsagePayload {
  combatantId: CombatantId
  blockId: string
  rank: number
  value: number                         // any non-negative integer
}
```

**Validation:**
- [standard validation]
- Block must have `slots` defined
- `rank` must be a key in `block.slots`
- `value >= 0`

**State changes:**
- `usedSlots[rank] = value`

Note: `value` may exceed `block.slots[rank]` — this represents a homebrew over-cast scenario the GM has explicitly decided to allow. Validation does NOT cap at maximum.

**Events:**
- `spell-usage-changed` with `kind: "slot"`, `action: "set"`, `rank`, `toValue: value`

### 6.8 SET_FOCUS_USAGE

```typescript
interface SetFocusUsagePayload {
  combatantId: CombatantId
  blockId: string
  value: number                         // any non-negative integer
}
```

**Validation:**
- [standard validation]
- `block.type === "focus"`
- `value >= 0`

**State changes:**
- `usedFocusPoints = value`

**Events:**
- `spell-usage-changed` with `kind: "focus"`, `action: "set"`, `toValue: value`

### 6.9 SET_INNATE_USAGE

```typescript
interface SetInnateUsagePayload {
  combatantId: CombatantId
  blockId: string
  spellSlug: string
  value: number
}
```

**Validation:**
- [standard validation]
- Entry must exist on block
- Entry's `frequency.type === "perDay"`
- `value >= 0`

**State changes:**
- `usedEntries[spellSlug] = value`

**Events:**
- `spell-usage-changed` with `kind: "innate"`, `action: "set"`, `spellSlug`, `spellName`, `toValue: value`

### 6.10 RESET_SPELL_BLOCK

Wipes all usage tracking for one block.

```typescript
interface ResetSpellBlockPayload {
  combatantId: CombatantId
  blockId: string
}
```

**Validation:**
- [standard validation]

**State changes:**
- `usedSlots = block.slots ? {} : undefined`
- `usedFocusPoints = block.type === "focus" ? 0 : undefined`
- `usedEntries = hasInnatePerDayEntries(block) ? {} : undefined`

(Same shape as fresh hydration §5.)

**Events:**
- `spell-usage-changed` with `kind: "slot"`, `action: "reset"`, no `rank` or `slug` (block-wide)

If GM wants to reset all blocks across a creature, the orchestrator dispatches RESET_SPELL_BLOCK once per block. No mass-reset command at the domain level.

---

## 7. Domain Events

Add one variant to the event union (events spec §3):

### SpellUsageChangedEvent

```typescript
interface SpellUsageChangedEvent {
  type: "spell-usage-changed"
  combatantId: CombatantId
  blockId: string
  blockName: string                    // denormalized for log readability
  kind: "slot" | "focus" | "innate"
  action: "used" | "restored" | "set" | "reset"
  rank?: number                        // for kind: "slot"
  spellSlug?: string                   // for kind: "innate"
  spellName?: string                   // for kind: "innate" — denormalized
  toValue?: number                     // for action: "set" — the new absolute value
}
```

**Emitted by:** All ten spell commands (§6.1–§6.10).

**Notes:**
- Single event variant covers all spell usage state changes. The combat log formatter inspects `kind` and `action` to construct messages.
- `blockName` and `spellName` are denormalized to keep the log readable even if the source data changes (analogous to `effectName` in effect events).
- For `action: "reset"`, the formatter narrates "Drow Priestess's Divine Prepared Spells reset (all slots restored)".
- `toValue` only meaningful for `action: "set"`. Other actions imply ±1 deltas the formatter can compute from prior state if needed.

### Combat Log Formatting Examples

| Event payload | Formatted message |
|---|---|
| kind: slot, action: used, rank: 3 | "Drow Wizard cast a 3rd-rank spell (2/3 remaining)" |
| kind: slot, action: restored, rank: 3 | "Drow Wizard recovered a 3rd-rank slot" |
| kind: focus, action: used | "Druid spent a focus point (0/1 remaining)" |
| kind: innate, action: used, spellName: "Wall of Fire" | "Dragon used Wall of Fire (innate)" |
| kind: slot, action: reset | "Reset Drow Wizard's spell slots" |
| kind: slot, action: set, rank: 3, toValue: 0 | "Set Drow Wizard's 3rd-rank slots to 0/3 used" |

The "(2/3 remaining)" detail is computed by the formatter from current state — it reads `block.slots[rank] - block.usedSlots[rank]`.

---

## 8. Validation Summary Table

| Command | Key validations | Rejects when… |
|---|---|---|
| USE_SPELL_SLOT | `slots[rank]` defined, slot remaining | At zero remaining |
| RESTORE_SPELL_SLOT | `slots[rank]` defined, used > 0 | At zero used |
| USE_FOCUS_POINT | `type: focus`, points remaining | At zero remaining |
| RESTORE_FOCUS_POINT | `type: focus`, used > 0 | At zero used |
| USE_INNATE_SPELL | Entry exists, perDay, uses remaining | At zero remaining or wrong frequency type |
| RESTORE_INNATE_SPELL | Entry exists, used > 0 | At zero used |
| SET_SPELL_SLOT_USAGE | Block has slots, rank exists, value ≥ 0 | Negative value |
| SET_FOCUS_USAGE | type: focus, value ≥ 0 | Negative value |
| SET_INNATE_USAGE | Entry exists, perDay, value ≥ 0 | Negative value or wrong type |
| RESET_SPELL_BLOCK | Block exists | (only standard validation) |

USE_* commands enforce the upper bound (cannot exceed maximum). SET_* commands do NOT — the GM can deliberately set any non-negative value.

---

## 9. UI Display Notes (Brief)

This is not a UI spec, but the data model makes certain display patterns natural:

- **Spell slots:** "3rd: ●●○" or "3rd: 2/3" — both equivalent. Dispatch USE_SPELL_SLOT on tap, RESTORE_SPELL_SLOT on long-press or tap-while-empty-slot.
- **Focus points:** Pip indicator for blocks with focus.
- **Per-day innate:** Per-spell counter next to the spell name.
- **At-will / constant:** Show with a marker, no counter.
- **Cantrips:** No tracking UI.

Direct SET commands surface in an "edit spellcasting" modal or long-press menu — they are not the primary interaction. The primary interaction during play is one-tap USE.

---

## 10. Out of Scope for V2

| Feature | Reason |
|---|---|
| PC and companion spell slots | Player-managed; tracker doesn't model |
| Multi-encounter slot persistence | Re-clone provides clean state per encounter |
| Heightened spell selection at cast time | The entry's `level` field is the cast level; no runtime heightening |
| Wizard "drain bonded item" or similar restoration class features | GM uses RESTORE_SPELL_SLOT manually |
| Spell substitution (free archetype, etc.) | Edit creature template offline |
| Counterspell / dispel mechanics | Resolved by GM, dispatch USE/RESTORE as appropriate |
| Sustain action tracking | Already covered by effects-and-durations spec §4 (sustained pattern) |
| Action economy validation (cast cost vs available actions) | Tracker doesn't model action economy |

---

## 11. Test Priority

1. **Use/restore symmetry** — USE_SPELL_SLOT then RESTORE_SPELL_SLOT returns to initial state.
2. **Reject at boundaries** — USE at zero remaining rejects with command-rejected event. RESTORE at zero used rejects.
3. **SET bypasses bounds** — SET_SPELL_SLOT_USAGE to a value > slots[rank] succeeds. (Homebrew over-cast scenario.)
4. **Innate frequency type filtering** — USE_INNATE_SPELL on an at-will entry rejects. On constant rejects.
5. **PC/companion rejection** — Any spell command on a party member or companion combatant rejects with "no spellcasting block" (or similar).
6. **Hydration initial state** — Creature with prepared block (slots: {1:3, 2:2}) becomes combatant with usedSlots: {} and remaining = 3 at rank 1, 2 at rank 2.
7. **RESET_SPELL_BLOCK invariants** — After reset, all derived "remaining" values match initial hydration.
8. **blockId stability** — Two creatures with same name "Arcane Innate" both work; commands target via blockId, not name.
9. **Event denormalization** — `blockName` and `spellName` in events match the values in state at emit time, even if a future SET_NOTE or similar changes things.
10. **Focus block without focusPoints** — A block declared `type: focus` with `focusPoints: undefined` (malformed but possible) — USE_FOCUS_POINT rejects cleanly.

---

## 12. Amendments to Existing Specs

### 12.1 Creature Types Spec §5.3

Add `blockId: string` to `SpellcastingBlock`. Note: auto-generated on import, preserved on round-trip.

### 12.2 Creature Types Spec §5.6

Replace "Spell Commands — Deferred" subsection with reference to this spec.

### 12.3 Command Vocabulary Spec

Add the ten commands from §6 to the command type union. Add the validation table from §8 to the spec's validation summary.

### 12.4 Domain Events Spec §3 / §4

Add `SpellUsageChangedEvent` to the union and §4 catalog. Add to the per-command emission table in §5 of that spec.

### 12.5 LLM Parser Spec §11

No change. Parser produces blocks without `blockId`; importer generates them.

### 12.6 Combat Log Formatter (Events Spec §7)

Add formatting cases for `spell-usage-changed` event variants per §7 of this spec.

---

## 13. Open Items

None. This spec resolves the deferred command vocabulary from creature types §5.6.

---

## 14. Update Project Instructions

Add to "Remaining Specification Topics" as completed:

- [x] **Spellcasting & spell slots** — Block identification (blockId), hydration, ten commands for usage tracking, single domain event with discriminator. Builds on creature types spec §5.