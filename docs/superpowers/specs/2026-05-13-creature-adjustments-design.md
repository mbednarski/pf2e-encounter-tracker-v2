# Creature Adjustments (Weak/Elite) — Redesign

**Status:** Draft for review
**Date:** 2026-05-13
**Scope:** Domain + orchestrator + YAML schema + Foundry mapper + UI surfaces

## 1. Purpose

The current weak/elite implementation correctly handles the *flat* numbers (AC, saves, Perception, skills, strike attack mod, strike damage, HP, spellcasting block DCs/attack) but is incomplete and lossy in three structural ways:

1. **Lossy at creation.** `applyEliteWeak` runs once inside `createCombatantFromCreature` and writes the adjusted numbers directly into `CombatantState.baseStats`. The original values are discarded, so toggling adjustment on an existing combatant is not possible without re-adding from the library.
2. **Description prose is opaque.** Abilities (passive/reactive/active) and spell list entries store DCs and damage only as text inside `description`. The PF2e rules say that an elite creature also *increases the DCs of its abilities by 2* and *increases damage on damaging Strikes and other offensive abilities by 2* (or by 4 for limited-use abilities such as breath weapons or per-day spells). None of that can be computed against text.
3. **Strike damage adjustment is positional.** `applyEliteWeak` adds the ±2 bonus to `damage[0]`. When the first listed component is a non-physical rider (e.g., `1d6 fire` listed before the physical `2d6+8 piercing`), the wrong line absorbs the adjustment.

This spec replaces the bake-at-creation approach with a snapshot-and-derive-on-read model, extends `Ability`, `Attack`, and `SpellListEntry` with optional structured fields so adjustments can be applied where the rules say they apply, and adds a command to toggle adjustment mid-encounter.

## 2. Non-Goals

- **Parsing description prose.** Existing creatures without structured `save`/`damage` retain their current behavior: the description string is shown unchanged, no auto-adjustment of embedded DCs.
- **Authoring tools for filling structured fields.** Manual YAML edits and improved Foundry mapping are in scope; a UI editor for ability damage/DC is not.
- **Spellcasting commands.** The M6 spellcasting wiring (USE_SPELL_SLOT etc.) remains deferred. This work only ensures that the *display* of spell DCs/damage is adjusted; usage commands are untouched.
- **Hazards/afflictions.** Those subsystems have their own specs and are not adjusted here.

## 3. Reference Rules

Per Pathfinder 2e Bestiary p. 6 / Monster Core p. 7:

**Elite Adjustments**
- Level: +1 (or +2 if starting level ≤ 0)
- HP based on starting level: +10 (≤ 1), +15 (2–4), +20 (5–19), +30 (≥ 20)
- +2 to AC, saving throws, Perception, skills, DCs, attack rolls, strike damage
- Limited-use damaging abilities: +4 damage instead of +2

**Weak Adjustments**
- Level: −1 (or −2 if starting level is 1; result is level −1)
- HP based on starting level: −10 (≤ 2), −15 (3–5), −20 (6–20), −30 (≥ 21)
- −2 to AC, saving throws, Perception, skills, DCs, attack rolls, strike damage
- Limited-use damaging abilities: −4 damage instead of −2
- HP floor of 1

## 4. Architecture Shifts

### 4.1 Snapshot + derive on read (replaces bake-at-creation)

Today:

```
Bestiary add → applyEliteWeak(creature) → bake into baseStats → store templateAdjustment marker
```

Proposed:

```
Bestiary add → snapshot original creature stats → store snapshot + templateAdjustment
                                                ↓
                          computeCombatantStats(combatant) → adjusted view + effect modifiers
```

The combatant carries a `baseSnapshot` (immutable copy of the source creature's relevant stat block at add time). All adjusted values are derived at read time. Effects-engine modifiers stack on top of the adjusted base.

**Why immutable snapshot rather than `sourceId` reference back to library?** The library is mutable (manage modal, future re-imports). An encounter should be reproducible after a library edit. Snapshot guarantees determinism.

### 4.2 Structured optional fields for adjustable data

Adjustments must be applied where the rules apply them, not approximated. Adding optional structured fields to `Ability`, `Attack`, and `SpellListEntry` keeps backwards compatibility: any creature whose YAML doesn't include them keeps today's behavior (description shown verbatim, no auto-DC/damage adjustment).

### 4.3 Mid-encounter adjustment toggle

A new domain command `SET_TEMPLATE_ADJUSTMENT` and event let the GM change adjustment after add. Combined with the snapshot model, this is a pure function over existing state.

## 5. Data Model Changes

### 5.1 `Attack`

```ts
interface Attack {
  name: string;
  type: AttackType;
  modifier: number;
  traits: string[];
  damage: DamageComponent[];
  effects?: string[];
  // NEW
  primaryDamageIndex?: number;     // which component absorbs the ±2; default 0
}
```

The mapper / authoring tools should set `primaryDamageIndex` when the first listed damage line is a rider rather than the physical base. Default `0` preserves current behavior for all already-imported creatures.

### 5.2 `Ability`

```ts
interface Ability {
  name: string;
  actions?: ActionCost;
  traits?: string[];
  trigger?: string;
  frequency?: string;
  requirements?: string;
  description: string;
  // NEW (all optional)
  save?: AbilitySave;
  damage?: DamageComponent[];
  isLimitedUse?: boolean;          // true ⇒ ±4 rule applies to damage
}

interface AbilitySave {
  defense: 'fortitude' | 'reflex' | 'will';
  dc: number;
  basic?: boolean;
}
```

`isLimitedUse` is `true` when the ability has a `frequency` string that indicates a cap (e.g., "once per day", "1 per hour"). For backward compatibility we leave it explicit rather than deriving from prose; the Foundry mapper sets it from `system.frequency`, and YAML authors set it manually.

### 5.3 `SpellListEntry`

```ts
interface SpellListEntry {
  spellSlug: string;
  name: string;
  level: number;
  isCantrip?: boolean;
  frequency?: SpellFrequency;
  count?: number;
  // NEW (all optional)
  save?: { defense: 'fortitude' | 'reflex' | 'will'; basic?: boolean };
  damage?: DamageComponent[];
}
```

Per-entry `save.dc` is implicit (= block DC after adjustment). `damage` is optional structured damage that should be adjusted. `isLimitedUse` is derived per entry: any frequency that is `perDay` (or anything in a non-cantrip slotted block) counts as limited-use for the ±4 rule.

### 5.4 `CombatantState`

```ts
interface CombatantState {
  id: CombatantId;
  sourceId: string;
  name: string;
  sourceType: SourceType;
  masterId?: CombatantId;

  // REPLACES baseStats
  baseSnapshot: CreatureSnapshot;
  templateAdjustment: TemplateAdjustment;   // 'normal' | 'elite' | 'weak'

  currentHp: number;
  tempHp: number;
  appliedEffects: AppliedEffect[];
  reactionUsedThisRound: boolean;
  isAlive: boolean;
  notes?: string;

  // Display data — still kept as a copy on the combatant so GM edits during
  // an encounter don't leak back into the library, but the snapshot holds the
  // canonical pre-adjustment values for any field that adjustments can touch.
  attacks: Attack[];
  passiveAbilities: Ability[];
  reactiveAbilities: Ability[];
  activeAbilities: Ability[];
  spellcasting?: CombatantSpellcasting[];
  traits?: string[];
  size?: CreatureSize;
}

interface CreatureSnapshot {
  level: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  hp: number;                       // pre-adjustment max HP
  speed: number;
  skills: Record<string, number>;
}

type TemplateAdjustment = 'normal' | 'elite' | 'weak';
```

Two things to call out:

- `level` moves into the snapshot. The current `CombatantState.level` (post-adjustment) becomes a derived value read via `getEffectiveLevel(snapshot.level, adjustment)`.
- The combatant's `attacks`/`abilities`/`spellcasting` arrays remain as copies of the *pre-adjustment* prose and structured data. The derive layer adjusts at read time; nothing mutates these in place.

### 5.5 Migration of `baseStats`

`CreatureBaseStats` is removed. Read sites move to:

- `getAdjustedView(combatant)` → returns `{ ac, hp, fortitude, reflex, will, perception, speed, skills, level }` after applying adjustment.
- `computeCombatantStats(combatant)` continues to exist and now composes: snapshot → adjustment → effect modifiers → `ComputedStats`.

## 6. Derivation Layer (Pure Domain)

New module `src/domain/creatures/adjusted-view.ts`:

```ts
export function getAdjustedView(combatant: CombatantState): AdjustedView;
export function getEffectiveLevel(baseLevel: number, adjustment: TemplateAdjustment): number;
export function adjustedAttack(attack: Attack, adjustment: TemplateAdjustment): Attack;
export function adjustedAbility(ability: Ability, adjustment: TemplateAdjustment): Ability;
export function adjustedSpellBlock(block: SpellcastingBlock, adjustment: TemplateAdjustment): SpellcastingBlock;
export function adjustedSpellEntry(
  entry: SpellListEntry,
  blockType: SpellcastingType,
  adjustment: TemplateAdjustment
): SpellListEntry;
export function adjustedDamage(
  components: DamageComponent[],
  adjustment: TemplateAdjustment,
  opts: { limitedUse: boolean; primaryIndex: number }
): DamageComponent[];
export function adjustedDC(dc: number, adjustment: TemplateAdjustment): number;
export function adjustedHp(baseHp: number, baseLevel: number, adjustment: TemplateAdjustment): number;
```

Rules:

- `adjustedDamage`: applies `±2` (or `±4` if `limitedUse`) to `components[primaryIndex].bonus`. If that component has no dice and no existing bonus, treat as `bonus = 0` first. If `primaryIndex` is out of range, fall back to `0`.
- `adjustedHp`: keeps the existing band table and HP-floor-of-1 logic. Pulled out so the new `SET_TEMPLATE_ADJUSTMENT` command can recompute max HP.
- `adjustedAttack`: returns a new `Attack` with `modifier ±= 2` and `damage` adjusted via `adjustedDamage` using `primaryDamageIndex ?? 0`. `traits` and `effects` pass through.
- `adjustedAbility`: if `save?.dc` present, ±2 it; if `damage` present, run through `adjustedDamage` with `limitedUse: ability.isLimitedUse ?? false`. `description` passes through verbatim.
- `adjustedSpellBlock`: ±2 to `dc` and `attackModifier`.
- `adjustedSpellEntry`: if `damage` present, run through `adjustedDamage` with `limitedUse` derived (`true` for `frequency.type === 'perDay'`, for any slotted spell in a `prepared`/`spontaneous` block, and `false` for cantrips/at-will/constant innate).
- `adjustedDC(dc)`: ±2.

All functions are pure, take/return JSON-serializable values, and have no Svelte/SvelteKit dependencies. Domain purity is preserved.

## 7. New Command and Event

```ts
// types.ts additions
| BaseCommand<'SET_TEMPLATE_ADJUSTMENT', {
    combatantId: CombatantId;
    adjustment: TemplateAdjustment;
  }>

// DomainEvent additions
| {
    type: 'template-adjustment-changed';
    combatantId: CombatantId;
    from: TemplateAdjustment;
    to: TemplateAdjustment;
    hpMaxFrom: number;
    hpMaxTo: number;
    currentHpFrom: number;
    currentHpTo: number;
  }
```

### Reducer behavior

```
SET_TEMPLATE_ADJUSTMENT { combatantId, adjustment }:
  - target = state.combatants[combatantId]
  - if target.sourceType !== 'creature': command-rejected
  - if target.templateAdjustment === adjustment: no-op (still emit a no-change event? no — silently succeed)
  - newMaxHp = adjustedHp(target.baseSnapshot.hp, target.baseSnapshot.level, adjustment)
  - newCurrentHp = min(target.currentHp, newMaxHp)        // clamp; never silently heal
  - update templateAdjustment, currentHp
  - emit template-adjustment-changed
```

**Clamp rule:** if a wounded elite combatant becomes weak, `currentHp` is clamped to the new (lower) max — the wound carries over. If a wounded weak becomes elite, `currentHp` is unchanged (max grows; HP "missing" stays missing). This matches typical VTT behavior and avoids surprise full-heals.

Party members and companions cannot be adjusted (the rules and command both reject — keep it simple).

## 8. `ComputedStats` Extensions

`ComputedStats` already gives `{ ac, fort, ref, will, perception, skills, attackRolls, damageRolls, allDCs, spellDcs, spellAttacks }` — those are *effect-modifier buckets*. The derivation layer feeds them adjusted *base* values, so:

```
final.ac     = adjustedBase.ac     + effectModifier.ac
final.fort   = adjustedBase.fort   + effectModifier.fort
final.skills = adjustedBase.skills + effectModifier.skills
…
```

A new convenience helper `getAdjustedCombatantView(combatant)` returns the *post-adjust, pre-effect-modifier* view, useful for UI tooltips that show base vs. effective contributions. UI surfaces wanting "what does an Elite combatant's base AC look like before any conditions" call this helper.

The `ComputedStats` shape itself doesn't change. UI sites stop reading `combatant.baseStats.*` and start reading `getAdjustedCombatantView(combatant).*`.

## 9. Foundry Mapper Updates

Foundry NPC JSON carries the data we need but our types ignore it:

- `FoundryActionSystem`: add `damageRolls`, `savingThrow: { type, dc }`, `frequency.max + per` (already present). Map these into `Ability.damage`, `Ability.save`, `Ability.isLimitedUse = !!frequency`.
- `FoundryMeleeSystem`: already supplies `damageRolls`. Add a pass to detect when the first damage line is a non-physical rider (heuristic: `damageType` ∈ `{slashing, piercing, bludgeoning}` is physical; the first physical entry's index becomes `primaryDamageIndex`).
- `FoundrySpellSystem`: add `damage` (map to `SpellListEntry.damage`), `defense: { save: { statistic, basic } }` (map to `SpellListEntry.save`).

Mapping is best-effort. Any field we can't read stays `undefined` and behaves like authored text only — same fallback as today.

The existing barbazu fixture exercises melee `damageRolls` and innate spells with `frequency.max`; we will add a new fixture (or extend an existing one) covering an action with both `damageRolls` and `savingThrow` to assert the new ability mapping. Tests follow the existing `mapper.test.ts` style.

## 10. YAML Schema Migration

Bump `schemaVersion: 1 → 2` for `kind: creature`. Validator accepts both:

- v1 documents load normally; structured fields are simply absent.
- v2 documents may include `attacks[].primaryDamageIndex`, `*Abilities[].save`, `*Abilities[].damage`, `*Abilities[].isLimitedUse`, `spellcasting[].entries[].save`, `spellcasting[].entries[].damage`.

`creature-validator.ts` (Zod or hand-rolled — follow existing pattern) gets the new optional shapes. An export of an in-memory creature uses the highest schema version that any field requires.

No automatic in-place migration of existing `creatures/*.yaml.local` files — they're personal scratch, and they already round-trip as v1.

## 11. UI Surface Changes

### 11.1 BestiarySection (existing)

No structural change. The picker continues to choose initial adjustment at add-time. `previewLevel` continues to use `adjustedLevel`.

### 11.2 CombatantDetailsPanel

- Replace direct reads of `combatant.baseStats.*` with `getAdjustedCombatantView(combatant).*` (passed in via `computed`).
- Add a small "Adjustment" toggle group (Normal / Weak / Elite) inline in the header next to the existing chip. Click dispatches `SET_TEMPLATE_ADJUSTMENT`. Disabled for non-creature sources.
- For each attack: damage display already uses `attack.damage`; switch to `adjustedAttack(attack, adjustment).damage` so the ±2 (or ±4) is visible.
- For each ability with structured `save.dc` and/or `damage`: render the adjusted DC and damage. If `description` text mentions a different DC, also show a small "(adj. DC: 24)" badge for GM clarity.
- For each spell entry: same as abilities.

### 11.3 CombatantCard

No changes beyond updating any `baseStats` reads to `getAdjustedCombatantView(combatant)`.

## 12. Backwards Compatibility & Risk

- **Existing tests:** `templates.test.ts` keeps working: `applyEliteWeak` is preserved as a public function that internally calls `adjustedCreatureView`. `clone.test.ts` is updated to assert the new combatant shape (baseSnapshot present, baseStats removed). XP tests reading `combatant.level` are updated to read effective level via the new helper.
- **`baseStats` consumers:** an internal grep finds the read sites; all are updated in the same change. There is no consumer outside the domain/orchestrator/components layers.
- **YAML v1 files:** load and run unchanged.
- **Foundry imports:** if mapper changes ship in the same slice, existing imports become richer; if not, no regression — fields are optional.
- **Persistence (M4):** the snapshot shape changes the on-disk structure for active encounters. Since IndexedDB persistence (#13) is not yet shipped, this is the right moment to settle the shape.
- **Performance:** derivation is O(attacks + abilities + spell entries) per render. The UI already recomputes effect modifiers per render; the additional work is small constant per slot.

## 13. Test Plan

Unit tests, colocated `*.test.ts`:

- `adjusted-view.test.ts`
  - `getEffectiveLevel`: covers ≤0, 1, 2, 5, 20 starting levels for both adjustments.
  - `adjustedHp`: same band coverage as today.
  - `adjustedDamage`: covers (a) primary at index 0, (b) primary at index 1, (c) limited-use ±4, (d) component with no `bonus` field, (e) empty `damage[]`.
  - `adjustedAttack`: full structure including `effects` and `traits`.
  - `adjustedAbility`: with/without `save`, with/without `damage`, with `isLimitedUse`.
  - `adjustedSpellEntry`: cantrip (no scaling), perDay (limited-use), prepared slot (limited-use), at-will innate (not limited).
- `reducer.test.ts` (extend)
  - `SET_TEMPLATE_ADJUSTMENT` normal→elite: max HP grows, current HP unchanged, event emitted.
  - normal→weak: max HP shrinks, current HP clamped, event emitted.
  - weak→elite: HP recomputed from base level twice (not compounded).
  - on party member: command-rejected.
  - same-value: no event, idempotent.
- `clone.test.ts` (rewrite)
  - Snapshot captured correctly.
  - `templateAdjustment` defaults to `'normal'`; explicit adjustment stored.
  - Existing display data still deep-cloned.
- `encounter-xp.test.ts` (update)
  - Uses `getEffectiveLevel` from snapshot + adjustment.
- `mapper.test.ts` (extend)
  - New fixture: action with `damageRolls` + `savingThrow` → `Ability.save` + `Ability.damage` + `isLimitedUse`.
  - Strike with non-physical first damage line → `primaryDamageIndex` set correctly.

## 14. Out of Scope / Follow-Ups

- Authoring UI for structured ability fields in YAML.
- Auto-parsing description prose into structured fields.
- Hazard/affliction integration (their specs cover their own adjustments).
- Spellcasting command wiring (M6).

## 15. Open Questions Resolved In This Spec

- *Where do adjustments live?* In the derive layer; combatants store snapshot + adjustment.
- *How is `templateAdjustment` toggled?* Via `SET_TEMPLATE_ADJUSTMENT` command.
- *HP semantics on toggle?* Clamp current to new max; never silently heal.
- *Limited-use detection?* Explicit `isLimitedUse` flag on abilities; derived for spell entries from frequency/block type.
- *YAML schema?* New optional fields under `schemaVersion: 2`; v1 still loads.
