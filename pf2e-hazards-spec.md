# PF2e Encounter Tracker v2 — Complex Hazards Specification

**Version:** 0.2
**Date:** 2026-05-22
**Status:** Implemented

> **v0.2 supersedes v0.1.** v0.1 (2026-04-22) predated the Foundry NPC importer
> and the `baseSnapshot: CreatureSnapshot` redesign, and assumed hand-authored
> hazards with structured disable checks. v0.2 reflects what shipped: hazards
> are imported from the Foundry pf2e module (same source as monsters), and a
> hazard's routine and disable instructions are stored as **free-form text**
> because that is all the Foundry data provides.

---

## 1. Overview

Complex hazards are encounter participants. They occupy initiative slots, act
on their turn via a fixed routine, can be damaged and destroyed, and can be
disabled via skill checks. Simple hazards are not tracked — they are a GM note,
not an encounter entity.

Complex hazards are modeled as combatants. The domain treats them **identically
to creature combatants** — same commands, same effects engine, same stat
derivation, same initiative. The differences are in the library type (what data
is stored) and display (what the UI shows). There are **no new domain commands
and no new domain events.**

---

## 2. Source: the Foundry pf2e module

Hazards are imported from the Foundry VTT pf2e module — the same source as
monsters. A Foundry complex hazard is an actor of `type: "hazard"`. The importer
(`src/lib/foundry/hazard-mapper.ts`) reuses the NPC importer's item-level
helpers (Strikes, actions, reactions) and rejects any document that is not a
`hazard` or whose `system.details.isComplex` is not `true`.

Foundry stores a hazard's **routine and disable instructions as free-form HTML
text**, not as machine-readable skill/DC/required-successes data. The importer
HTML-strips them into plain text. The GM reads that text at the table and
resolves outcomes with the standard command vocabulary. There is no structured
disable-progress tracking — that was the v0.1 design and it has been dropped
because the source data cannot populate it.

YAML import (`kind: hazard`) is also supported for parity with creatures.

---

## 3. Data Model

### 3.1 Hazard (library template)

`Hazard` lives in `src/domain/types.ts`:

```typescript
interface Hazard {
  id: string
  name: string
  level: number
  traits: string[]
  rarity: "common" | "uncommon" | "rare" | "unique"

  // Detection / initiative
  stealth: number              // Stealth value — the initiative modifier
  stealthNote?: string         // e.g. "DC 30 to detect; trained"

  // Defense
  ac: number
  fortitude: number
  reflex: number
  will: number
  hp: number
  hardness?: number
  immunities: CreatureImmunity[]
  resistances: { type: string; value: number }[]
  weaknesses: { type: string; value: number }[]

  // Free-form text blocks (HTML stripped on import)
  routine?: string             // what the hazard does each round
  disable?: string             // how it can be disabled (skills, DCs)
  reset?: string
  description?: string

  // Routine actions, reactions, and listed Strikes
  attacks: Attack[]
  passiveAbilities: Ability[]
  reactiveAbilities: Ability[]
  activeAbilities: Ability[]

  // Meta
  source?: string
  tags: string[]
  notes?: string
}
```

**Defensive stats are plain numbers, never null.** v0.1 proposed nullable
`ac`/saves to model "AC —" hazards; that rippled guard clauses through
`deriveStats`, `getAdjustedView`, and the UI for a rare edge case. Complex
hazards in practice always have AC, HP, saves, and (usually) hardness. The
importer maps whatever Foundry provides, defaulting a genuinely-absent value to
`0` with an import warning.

### 3.2 HazardData (combatant display bag)

Hazard-specific display data rides on `CombatantState` in an optional bag.
Creature, party-member, and companion combatants leave it `undefined`; the
domain reducer never reads it.

```typescript
interface HazardData {
  stealth: number
  stealthNote?: string
  hardness?: number
  routine?: string
  disable?: string
  reset?: string
  description?: string
}

interface CombatantState {
  // ... existing fields ...
  hazardData?: HazardData
}
```

`SourceType` includes `"hazard"`.

---

## 4. Encounter Integration

### 4.1 Factory

`createCombatantFromHazard(hazard): CombatantState` (`src/domain/hazards/factory.ts`)
mirrors `createCombatantFromCreature`:

- `sourceType: "hazard"`, `sourceId: hazard.id`, `templateAdjustment: "normal"`
- `currentHp` = `hazard.hp`
- copies `attacks` and the three ability arrays; `spellcasting: undefined`
- builds `hazardData` from the hazard's text/stealth/hardness fields
- `baseSnapshot.perception` = `hazard.stealth` — a complex hazard rolls Stealth
  for initiative, and `perception` is the snapshot slot the initiative logic
  reads. The UI labels that stat **"Stealth"** for `sourceType === "hazard"`.

### 4.2 Initiative

Complex hazards roll Stealth for initiative. The GM rolls and enters the score
like any other combatant; the snapshot carries the Stealth value so the
roll-all-initiative helper works unchanged.

### 4.3 Turn flow, damage, disable, destruction

Hazards use the existing command vocabulary entirely:

| Action | Command |
|---|---|
| Add to encounter | `ADD_COMBATANT` |
| Place in initiative | `SET_INITIATIVE_ORDER` / `SET_INITIATIVE_SCORES` |
| Take damage | `APPLY_DAMAGE` (GM subtracts hardness first) |
| Apply effect | `APPLY_EFFECT` |
| Advance turn | `END_TURN` |
| Destroy / fully disable | `MARK_DEAD` |
| Remove from encounter | `REMOVE_COMBATANT` |

At the hazard's turn the GM reads the routine text and resolves it. To disable a
hazard the GM reads the disable text, rolls the relevant checks, and then
dispatches `MARK_DEAD` (or `REMOVE_COMBATANT`) once the hazard is neutralized —
GM authority, no automation.

---

## 5. Hardness

Hardness is display-only. `APPLY_DAMAGE` takes final numbers; the GM subtracts
hardness mentally before entering the damage amount, exactly as with
resistances. The details panel surfaces hardness prominently (in the slot a
creature uses for Speed) so the GM remembers.

---

## 6. Persistence

The `hazardLibrary` IndexedDB object store (database v5) holds imported hazards,
keyed by `hazard.id`, with the same load/add/remove/dedupe treatment as the
creature library (`src/lib/storage/hazard-library.ts`).

---

## 7. UI

- **Library pane** — a Hazards section (`HazardsSection.svelte`) parallel to the
  Bestiary section, with import (`.json` / `.yaml`) and search. No weak/elite
  toggle: hazards take no template adjustment.
- **Manage modal** — `LibraryManageModal` lists creatures and hazards in
  separate sections.
- **Combatant card** — hazards already render with the `hazard` faction badge.
- **Details panel** — for `sourceType === "hazard"`: the initiative stat is
  labelled "Stealth", Speed is replaced by Hardness, and a Hazard section
  (`details/HazardStatBlock.svelte`) renders the Detection / Routine / Disable /
  Reset / Description text blocks. The template-adjustment toggle is hidden.

---

## 8. Out of Scope

- **Structured disable tracking** — dropped (see §2).
- **Multi-segment hazards** — model each destroyable segment as a separate
  combatant sharing the routine text.
- **Simple hazards** — not tracked.
- **Routine automation** — the GM resolves the routine manually, as with
  creature abilities.
