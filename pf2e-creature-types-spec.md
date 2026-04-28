# PF2e Encounter Tracker v2 — Creature Type Definitions Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-22
**Status:** Ready for review

---

## 1. Overview

This document defines the sub-types referenced by the `Creature` interface (arch spec §10.1) but not yet specified: `CreatureSize`, `Attack`, `Ability`, and `SpellcastingBlock`. It also introduces the **Spell Index** — a shared library of spell descriptions referenced by creature spell entries — and the **Weak/Elite adjustment tables**.

---

## 2. CreatureSize

```typescript
type CreatureSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan"
```

Display-only. No mechanical effect in the stat derivation — size-related modifiers in PF2e are already baked into the creature's published stats.

---

## 3. Attack

### 3.1 Attack Type

```typescript
interface Attack {
  name: string                         // "jaws", "longsword", "shortbow"
  type: "melee" | "ranged"
  modifier: number                     // attack roll modifier (+14, +12)
  traits: string[]                     // ["agile", "finesse", "deadly-d10", "range-60"]
  damage: DamageComponent[]            // structured damage
  effects?: string[]                   // slugs: ["grab", "knockdown", "giant-centipede-venom"]
}
```

### 3.2 DamageComponent

Each attack can deal multiple damage components (e.g., 2d8+5 piercing plus 1d6 fire).

```typescript
interface DamageComponent {
  dice?: number                        // number of dice (2 in "2d8")
  dieSize?: number                     // die size (8 in "2d8")
  bonus?: number                       // flat bonus (+5)
  type: string                         // "piercing", "fire", "mental", "bleed", etc.
  persistent?: boolean                 // true for persistent damage components
  conditional?: string                 // "only against undead", "on a critical hit"
}
```

**Design notes:**

- `dice` and `dieSize` are optional to support flat damage ("5 fire" has `bonus: 5`, no dice).
- `bonus` is optional to support dice-only damage ("1d6 persistent bleed" has no bonus).
- `persistent` marks components that apply persistent damage. The GM handles application via APPLY_EFFECT.
- `conditional` is free-text for components that only apply in certain cases. Display-only — the GM evaluates mentally.
- `effects` on the parent `Attack` are slugs referencing on-hit effects — Grab, Knockdown, Improved Push, afflictions, poisons. If the slug resolves to an entry in the effect library (e.g., `"grab"` → the Grabbed condition, `"giant-centipede-venom"` → a user-imported affliction), the UI can link to it and offer quick-apply. If it doesn't resolve, the slug renders as a formatted name (e.g., `"improved-push"` → "Improved Push") — still useful as a GM reminder. This keeps the data future-proof without requiring every effect to be in the library at import time.

### 3.3 Display Rendering

The UI renders attacks from structured data back into PF2e-standard format:

```
melee jaws +14 [+9/+4], Damage 2d8+5 piercing plus 1d6 fire
ranged shortbow +12 [+7/+2] (deadly d10, range 60 feet), Damage 1d6+3 piercing
```

**MAP (Multiple Attack Penalty) values** are derived at render time from the modifier and traits. If `agile` is in traits: [+0, -4, -8]. Otherwise: [+0, -5, -10]. Not stored — computed for display.

### 3.4 Trait Encoding Convention

Traits with parameters use a hyphenated slug: `"deadly-d10"`, `"fatal-d12"`, `"range-60"`, `"reach-10"`, `"thrown-20"`. The UI parser splits on the last hyphen-number segment for display ("deadly d10", "range 60 feet").

Simple traits are plain slugs: `"agile"`, `"finesse"`, `"forceful"`, `"sweep"`, `"backstabber"`.

---

## 4. Ability

### 4.1 Ability Type

All three ability categories on `Creature` (passive, reactive, active) share the same type. The categorization is structural (where they appear in the statblock), not type-level.

```typescript
interface Ability {
  name: string                         // "Attack of Opportunity", "Breath Weapon"
  actions?: ActionCost                 // null for passives, free actions with no cost
  traits?: string[]                    // ["arcane", "evocation", "fire"]
  trigger?: string                     // for reactions: "A creature within reach uses a manipulate action"
  frequency?: string                   // "once per round", "once per day", "1d4 rounds recharge"
  requirements?: string                // "The dragon hasn't used Breath Weapon in the last 1d4 rounds"
  description: string                  // full rules text — the GM reads this mid-combat
}

type ActionCost =
  | 1 | 2 | 3                          // 1-action, 2-action, 3-action activities
  | "free"                              // free action
  | "reaction"                          // reaction
```

### 4.2 Design Notes

- **`description` is the workhorse.** PF2e abilities are complex — areas, saves, damage, special outcomes, cooldowns. Attempting to decompose every ability into structured fields is a losing game. The `description` field carries the full rules text. The structured fields (`actions`, `trigger`, `frequency`, `requirements`) extract the metadata the GM scans for at a glance.

- **No mechanical automation.** Abilities are display-only in the tracker. The GM reads them and dispatches commands (APPLY_DAMAGE, APPLY_EFFECT) based on what happens. The tracker doesn't model ability usage, cooldowns, or areas.

- **Frequency tracking** is free-text, not a countdown. "Once per day", "1d4 rounds recharge", "3/day" — too varied to model structurally for V2. The GM tracks mentally or uses SET_NOTE. A future enhancement could add structured frequency tracking.

### 4.3 Categorization on Creature

The `Creature` interface splits abilities into three arrays:

| Field | Contains | Statblock Section |
|---|---|---|
| `passiveAbilities` | Always-on effects, auras, immunities notes | Top of statblock, no action icon |
| `reactiveAbilities` | Reactions and triggered free actions | Marked with ↺ or [free-action] + trigger |
| `activeAbilities` | Actions, activities, special attacks | Marked with ◆, ◆◆, ◆◆◆ |

The LLM parser assigns abilities to the correct array based on action cost and trigger presence. Passive = no action cost and no trigger. Reactive = has trigger (reaction or triggered free action). Active = has action cost, no trigger.

---

## 5. Spellcasting

### 5.1 Architecture

Creature spellcasting has two layers:

1. **Spell Index** — a shared library (`spells` store in IndexedDB). Each spell has its full description, stored once. Same pattern as the effect library.
2. **SpellcastingBlock** — on the creature template. References spells by slug, organized by spellcasting tradition and type, with creature-specific metadata (heightened levels, frequencies, slot counts).

During an encounter, the combatant carries a mutable copy of its spellcasting blocks with slot/usage tracking.

### 5.2 Spell Index Entry

```typescript
interface Spell {
  slug: string                         // "fireball", "wall-of-fire", "heal"
  name: string                         // "Fireball"
  level: number                        // base spell rank (3 for Fireball)
  traits: string[]                     // ["evocation", "fire"]
  traditions: string[]                 // ["arcane", "primal"]
  cast: SpellCast                      // action cost and components
  description: string                  // full rules text
  heightened?: HeightenedEntry[]       // heightening effects
  aonUrl?: string                      // optional AoN link
}

interface SpellCast {
  actions?: ActionCost                 // 1, 2, 3, "free", "reaction"
  time?: string                        // for non-action casts: "10 minutes", "1 hour"
  components?: string[]                // ["somatic", "verbal", "material"]
}

interface HeightenedEntry {
  level: string                        // "+1", "+2", "5th", "8th"
  description: string                  // what changes
}
```

**Keying:** `slug` is the primary key. Derived from the spell name: lowercase, hyphens for spaces, strip punctuation. Spell names are unique in PF2e post-remaster.

**Graceful degradation:** If a creature references a spell slug not in the index, the UI displays the spell name (derived from slug) with no description. The creature is still fully functional — the GM just doesn't get the description tooltip. They can enrich the spell index later.

**Population strategy:** The spell index is populated incrementally:

- LLM parser can batch-enrich: "here are 15 spell slugs from tonight's creatures, generate Spell entries"
- YAML import of spell definition files
- Manual entry via YAML

### 5.3 SpellcastingBlock (Creature Template)

A creature can have multiple spellcasting blocks (e.g., Arcane Prepared + Divine Innate). Each block has its own DC, attack modifier, and spell list.

```typescript
interface SpellcastingBlock {
  name: string                         // "Arcane Prepared Spells", "Divine Innate Spells"
  tradition: SpellTradition
  type: SpellcastingType
  dc: number
  attackModifier?: number              // not all blocks have attack rolls
  focusPoints?: number                 // only for type: "focus"
  entries: SpellListEntry[]            // all spells in this block
}

type SpellTradition = "arcane" | "divine" | "occult" | "primal"

type SpellcastingType = "prepared" | "spontaneous" | "innate" | "focus"
```

### 5.4 SpellListEntry

Each entry in a spellcasting block represents one spell at a specific level with creature-specific metadata.

```typescript
interface SpellListEntry {
  spellSlug: string                    // references Spell index
  name: string                        // denormalized for display when index lacks the entry
  level: number                        // the rank this creature casts it at (may be heightened)
  isCantrip?: boolean                  // cantrips — unlimited use
  frequency?: SpellFrequency           // for innate spells
  count?: number                       // for prepared: how many times prepared (×2)
}

type SpellFrequency =
  | { type: "atWill" }                 // unlimited
  | { type: "constant" }              // always active, no action
  | { type: "perDay"; uses: number }  // X/day
```

**Design notes:**

- `name` is denormalized from the spell index. If the index entry exists, it's authoritative. If not, `name` is the fallback display. This avoids broken rendering when the spell index is incomplete.
- `level` is the creature's cast level, not the spell's base level. Fireball at 6th level is `{ spellSlug: "fireball", level: 6 }`.
- `isCantrip` marks unlimited-use cantrips. Cantrips also have a heightened level (`level` field).
- `frequency` is only relevant for innate spells. Prepared/spontaneous spells have their usage tracked by slot counts at the block level (see §5.6).
- `count` is for prepared casters who prepare a spell multiple times. "magic missile (×2)" → `count: 2`.

### 5.5 Spell Slots (Prepared & Spontaneous)

Prepared and spontaneous casters have a fixed number of slots per spell rank. This isn't stored per-entry — it's a block-level concern.

Add to `SpellcastingBlock`:

```typescript
interface SpellcastingBlock {
  // ... fields from §5.3 ...
  slots?: Record<number, number>       // rank → slot count. { 1: 3, 2: 3, 3: 2, 4: 1 }
}
```

- **Prepared:** `slots` defines how many spells are prepared at each rank. The entries at that rank tell you which spells fill those slots. `count` on entries handles duplicates.
- **Spontaneous:** `slots` defines how many casts per rank. The entries at that rank are the repertoire (all available at that rank).
- **Innate/Focus:** `slots` is absent. Usage is tracked per-entry via `frequency` (innate) or `focusPoints` (focus).

### 5.6 Combatant Spellcasting — Mutable Encounter State

When a creature becomes a combatant, its `SpellcastingBlock[]` is deep-cloned into the combatant. Slot/usage tracking is added for the encounter.

```typescript
interface CombatantSpellcasting extends SpellcastingBlock {
  usedSlots?: Record<number, number>   // rank → slots used this encounter. { 3: 1 } = one 3rd-rank slot spent
  usedFocusPoints?: number             // for focus blocks: points spent
  usedEntries?: Record<string, number> // spellSlug → uses spent (for innate per-day and prepared duplicates)
}
```

**Tracking model:**

| Type | What's tracked | How |
|---|---|---|
| Prepared | Slots used per rank | `usedSlots[rank]++` when spell cast |
| Spontaneous | Slots used per rank | `usedSlots[rank]++` when spell cast |
| Innate (per day) | Uses per spell | `usedEntries[slug]++` when cast |
| Innate (at will) | Nothing | Unlimited |
| Innate (constant) | Nothing | Always active |
| Focus | Focus points spent | `usedFocusPoints++` when cast |
| Cantrips | Nothing | Unlimited |

**Remaining slots** = `slots[rank] - (usedSlots[rank] ?? 0)`. The UI displays remaining/total.

**Reset:** Spell usage is encounter-scoped. On RESET_ENCOUNTER, everything resets. Between encounters, the creature template is re-cloned fresh.

### 5.7 Spell Index — IndexedDB Store

New store: `spells`. Keyed by `slug`. JSON objects matching the `Spell` interface.

Lookup order mirrors the effect library: user-imported spells can override built-in entries (if we ever ship built-in spells — unlikely for V2, but the pattern is consistent).

### 5.8 YAML Import/Export

Spells are a new YAML entity type alongside creatures, encounters, and effect definitions.

```yaml
# Example spell entry
slug: fireball
name: Fireball
level: 3
traits: [evocation, fire]
traditions: [arcane, primal]
cast:
  actions: 2
  components: [somatic, verbal]
description: |
  You create a burst of flame that deals 6d6 fire damage. Each creature 
  in a 20-foot burst within 500 feet must attempt a Reflex save.
  Critical Success: Unaffected.
  Success: Half damage.
  Failure: Full damage.
  Critical Failure: Double damage.
heightened:
  - level: "+1"
    description: "Damage increases by 2d6."
aonUrl: https://2e.aonprd.com/Spells.aspx?ID=2241
```

Creature YAML references spells by slug in the spellcasting block:

```yaml
spellcasting:
  - name: Arcane Prepared Spells
    tradition: arcane
    type: prepared
    dc: 22
    attackModifier: 14
    slots:
      1: 3
      2: 3
      3: 2
      4: 1
    entries:
      - { spellSlug: fly, name: Fly, level: 4 }
      - { spellSlug: wall-of-fire, name: Wall of Fire, level: 4 }
      - { spellSlug: fireball, name: Fireball, level: 3 }
      - { spellSlug: haste, name: Haste, level: 3 }
      - { spellSlug: slow, name: Slow, level: 3 }
      # ...
```

---

## 6. Weak/Elite Adjustment Tables

### 6.1 Stat Adjustments

Applied at combatant creation time to the deep-cloned creature data. The creature template is never modified.

| Adjustment | Elite | Weak |
|---|---|---|
| Level | +1, or +2 if starting level is -1 or 0 | -1, or -2 if starting level is 1 |
| AC | +2 | -2 |
| Fortitude | +2 | -2 |
| Reflex | +2 | -2 |
| Will | +2 | -2 |
| Perception | +2 | -2 |
| All skill modifiers | +2 | -2 |
| Attack modifiers | +2 | -2 |
| Spell DCs | +2 | -2 |
| Spell attack modifiers | +2 | -2 |
| Ability DCs embedded in descriptions | GM adjusts mentally | GM adjusts mentally |
| Strike damage | +2 to the first structured damage component bonus | -2 to the first structured damage component bonus |
| HP | see §6.2 | see §6.2 |

**HP floor:** Weak adjustment cannot reduce HP below 1.

### 6.2 Hit Point Adjustment Tables

Hit Point adjustment uses the creature's starting level, before the weak/elite level change.

| Starting Level | Elite HP Increase |
|---|---|
| 1 or lower | +10 |
| 2-4 | +15 |
| 5-19 | +20 |
| 20+ | +30 |

| Starting Level | Weak HP Decrease |
|---|---|
| 1-2 | -10 |
| 3-5 | -15 |
| 6-20 | -20 |
| 21+ | -30 |

For starting levels below 1, use the 1-2 weak HP band and still apply the HP floor.

### 6.3 Where Adjustments Are Applied

```typescript
function applyEliteWeak(
  creature: Creature,
  adjustment: "elite" | "weak"
): Creature  // returns a new Creature with adjusted values
```

The function modifies:

1. **Numeric stats** — level, AC, saves, perception, skills, HP (on the top-level Creature fields)
2. **Attack modifiers** — each `Attack.modifier` adjusted
3. **Attack damage** — the first `DamageComponent.bonus` on each Strike adjusted by 2. If no `bonus` exists on the primary component, add one.
4. **Spellcasting DCs and attack modifiers** — each `SpellcastingBlock.dc` and `.attackModifier` adjusted
5. **Ability DCs** — not automatically parseable. DCs embedded in `Ability.description` text are not modified. The GM adjusts mentally (+2/-2). This is a known limitation — flagged in the UI when elite/weak is applied.

The result is a new `Creature` object. The combatant factory function calls this before building `CombatantState.baseStats`.

---

## 7. Amendments to Architecture Spec

### 7.1 CombatantState — Add Creature Display Data

The current `CombatantState` (arch spec §10.2, amended by party members spec §2.1) carries `baseStats` for stat derivation but has no field for attacks, abilities, or spellcasting. These are needed for:

- Displaying attacks and abilities to the GM during combat
- Mutable spell slot tracking during encounters
- Weak/elite adjusted attack values (can't look up from library — values differ)

Add to `CombatantState`:

```typescript
interface CombatantState {
  // ... existing fields ...

  // Display data — cloned from creature template (with weak/elite applied)
  attacks: Attack[]
  passiveAbilities: Ability[]
  reactiveAbilities: Ability[]
  activeAbilities: Ability[]
  spellcasting?: CombatantSpellcasting[]

  // Creature metadata — for display
  traits?: string[]
  size?: CreatureSize
  level?: number
}
```

These fields are populated at combatant creation time and are mutable (the GM might correct values mid-combat). Only `spellcasting` has meaningful mutation during normal play (slot tracking).

For party member combatants: `attacks`, abilities, and `spellcasting` are empty arrays / undefined. Party members don't have these — the player manages their own character.

For companion combatants: populated from the `Companion` record. Companions have attacks and abilities but typically no spellcasting (exceptions exist — eidolons with spell access).

### 7.2 CreatureBaseStats — Unchanged

`CreatureBaseStats` stays as defined (numeric stats only). It's the input to `deriveStats()` and doesn't need creature display data. The attacks/abilities/spellcasting live alongside `baseStats` on the combatant, not inside it.

### 7.3 New IndexedDB Store

Add `spells` to the persistence spec (arch spec §13.1). Keyed by `slug`. Same import/export treatment as creatures and effect definitions.

### 7.4 Spell Commands

Commands for tracking spell usage (USE_SPELL_SLOT, USE_FOCUS_POINT, etc.) are canonical in the **Spellcasting & Spell Slots** specification and included in the command vocabulary spec. The data structures defined here are sufficient for the domain layer to hold the data; the spellcasting spec defines how commands mutate it.

---

## 8. Implementation Notes

### 8.1 File Locations

| Type | File |
|---|---|
| `CreatureSize` | `domain/types/creature.ts` |
| `Attack`, `DamageComponent` | `domain/types/creature.ts` |
| `Ability`, `ActionCost` | `domain/types/creature.ts` |
| `SpellcastingBlock`, `SpellListEntry`, `SpellFrequency` | `domain/types/creature.ts` |
| `Spell`, `SpellCast`, `HeightenedEntry` | `domain/types/spell.ts` |
| `CombatantSpellcasting` | `domain/types/combatant.ts` |
| `applyEliteWeak()` | `domain/creatures/templates.ts` |

### 8.2 LLM Parser Implications

The parser needs to handle two distinct extraction tasks:

1. **Creature parsing** — extracts structured `Attack[]`, `Ability[]`, `SpellcastingBlock[]` from raw statblock text. Spellcasting entries carry `spellSlug` and `name` but the parser does NOT need to generate full `Spell` index entries from a statblock alone (statblocks rarely contain full spell descriptions).

2. **Spell index enrichment** — separate pipeline. Input: list of spell slugs. Output: `Spell[]` with full descriptions. The LLM can be prompted with spell names and asked to produce descriptions from its training data, or the user can provide source text (AoN pages, book text) for extraction.

These are separate API calls with different prompts. The creature parser is the primary workflow; spell enrichment is a batch operation the GM runs when they want descriptions populated.

### 8.3 Test Priority

1. **Weak/elite adjustments** — apply to a creature, verify all stat/attack/spell DC modifications. Edge case: weak reducing HP below 1.
2. **DamageComponent rendering** — structured data → display string round-trip. "2d8+5 piercing plus 1d6 fire" parses and renders correctly.
3. **MAP derivation** — verify agile vs non-agile penalty sequences from traits.
4. **Spell slot arithmetic** — remaining = total - used, no negative values.
5. **SpellcastingBlock cloning** — creature → combatant preserves all data, adds tracking fields initialized to zero/empty.

---

## 9. Summary

### 9.1 New Types

| Type | Purpose |
|---|---|
| `CreatureSize` | Size category enum |
| `Attack` | Structured melee/ranged attack |
| `DamageComponent` | Dice + bonus + type for one damage element |
| `Ability` | Passive, reactive, or active ability with full description |
| `ActionCost` | 1/2/3 actions, free, or reaction |
| `SpellcastingBlock` | One spellcasting tradition/type block on a creature |
| `SpellListEntry` | One spell in a spellcasting block |
| `SpellFrequency` | At will / constant / per day usage for innate spells |
| `Spell` | Spell index entry with full description |
| `SpellCast` | Action cost and components for casting |
| `HeightenedEntry` | Heightening effect description |
| `CombatantSpellcasting` | Mutable spellcasting block with usage tracking |

### 9.2 Modified Types

| Type | Change |
|---|---|
| `CombatantState` | Add `attacks`, `passiveAbilities`, `reactiveAbilities`, `activeAbilities`, `spellcasting?`, `traits?`, `size?`, `level?` |

### 9.3 New IndexedDB Store

`spells` — keyed by `slug`.

### 9.4 New Pure Functions

`applyEliteWeak(creature, adjustment)` — returns adjusted creature.
