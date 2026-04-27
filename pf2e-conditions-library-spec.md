# PF2e Encounter Tracker v2 — Conditions Library Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-21
**Status:** Ready for review

---

## 1. Amendments to Architecture Spec

### 1.1 Add `turnStartSuggestion` to EffectDefinition

The architecture spec (§8.5) defines only `turnEndSuggestion`. Several conditions require start-of-turn prompts (Dying → recovery check, Persistent Damage → take damage + flat check, Slowed → action loss reminder). Add a parallel field:

```typescript
interface EffectDefinition {
  // ... existing fields from arch spec §8.2 ...
  turnStartSuggestion?: TurnBoundarySuggestion   // NEW
  turnEndSuggestion?: TurnBoundarySuggestion      // renamed from TurnEndSuggestion
}
```

The type is unified — both fields use the same `TurnBoundarySuggestion` type (renamed from `TurnEndSuggestion`):

```typescript
type TurnBoundarySuggestion =
  | { type: "suggestDecrement"; amount: number }
  | { type: "suggestRemove"; description: string }
  | { type: "confirmSustained" }
  | { type: "promptResolution"; description: string }
  | { type: "reminder"; description: string }
  | { type: "reminder"; description: string }          // NEW — no action needed, just display
```

The new `"reminder"` variant is for non-actionable prompts (e.g., Slowed: "loses 2 actions this turn"). The GM sees the reminder and dismisses it. No accept/modify needed.

The turn-start flow (arch spec §8.6) already supports generating prompts at `START_TURN` — this amendment provides the data source for those prompts.

### 1.2 Ability-Score-Gated Conditions — Meta-Targets

Conditions gated on ability scores (Clumsy → Dex, Enfeebled → Str, Stupefied → mental, Drained → Con) target skills deterministically. The PF2e skill-to-ability mapping is fixed:

| Meta-Target | Expands To |
|---|---|
| `strSkills` | Athletics |
| `dexSkills` | Acrobatics, Stealth, Thievery |
| `intSkills` | Arcana, Crafting, Society |
| `wisSkills` | Medicine, Nature, Religion, Survival |
| `chaSkills` | Deception, Diplomacy, Intimidation, Performance |
| `mentalSkills` | All of intSkills + wisSkills + chaSkills |

Lore skills are excluded — they have no combat relevance. They are stored and displayed but never targeted by ability-gated modifiers.

These are added to the `StatTarget` type:

```typescript
type StatTarget =
  | "ac" | "fortitude" | "reflex" | "will" | "perception"
  | "attackRolls" | "allDCs" | "allSaves" | "allSkills"
  | "strSkills" | "dexSkills" | "intSkills" | "wisSkills" | "chaSkills"
  | "mentalSkills"
  | string            // specific skill: "athletics", "stealth", etc.
```

`deriveStats()` expands meta-targets against the creature's actual skill list, same mechanism as `allSkills` and `allSaves`. Only skills the creature possesses are affected.

**Remaining gap:** Ability-gated attack roll penalties (Clumsy → Dex-based attacks, Enfeebled → Str-based attacks) cannot be automated because creature attack entries don't tag their governing ability. These stay in `description` for GM reference.

### 1.3 Death Tracking Subsystem

A specialized handler in `domain/effects/` invoked by the reducer for commands affecting `dying`, `wounded`, or `doomed`. This is fully automatic — no prompts. The interactions are mechanical and unambiguous (same justification as stacking rules and hard clock expiry).

See §3 of this document for full specification.

---

## 2. Conditions Library — Complete Definitions

### 2.1 Legend

Each condition entry specifies:

- **category**: `"condition"` for all built-in PF2e conditions
- **hasValue / maxValue**: whether the condition has a numeric level
- **modifiers**: stat changes the system automates via `deriveStats()`
- **impliedEffects**: conditions auto-applied when this condition is applied (removed when parent is removed)
- **turnStartSuggestion / turnEndSuggestion**: prompt generation hints
- **description**: rules text for GM reference — especially important when modifiers can't capture the full effect

Modifier `value` field uses:
- `"-effectValue"` → resolves to negative of the condition's current value (penalty)
- `"effectValue"` → resolves to the condition's current value (bonus)
- A literal number for fixed modifiers (e.g., Off-Guard is always -2)

---

### 2.2 Value Conditions with Modifiers

#### Frightened (1–4)

Status penalty equal to value on **all** checks and DCs.

```typescript
{
  id: "frightened",
  name: "Frightened",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  modifiers: [
    { stat: "ac",           bonusType: "status", value: "-effectValue" },
    { stat: "allSaves",     bonusType: "status", value: "-effectValue" },
    { stat: "perception",   bonusType: "status", value: "-effectValue" },
    { stat: "attackRolls",  bonusType: "status", value: "-effectValue" },
    { stat: "allSkills",    bonusType: "status", value: "-effectValue" },
    { stat: "allDCs",       bonusType: "status", value: "-effectValue" },
  ],
  turnEndSuggestion: { type: "suggestDecrement", amount: 1 },
  description: "Decreases by 1 at end of your turn.",
}
```

#### Sickened (1–4)

Status penalty equal to value on **all** checks and DCs. Persists until removed. Can spend an action to retch (Fortitude save to reduce).

```typescript
{
  id: "sickened",
  name: "Sickened",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  modifiers: [
    { stat: "ac",           bonusType: "status", value: "-effectValue" },
    { stat: "allSaves",     bonusType: "status", value: "-effectValue" },
    { stat: "perception",   bonusType: "status", value: "-effectValue" },
    { stat: "attackRolls",  bonusType: "status", value: "-effectValue" },
    { stat: "allSkills",    bonusType: "status", value: "-effectValue" },
    { stat: "allDCs",       bonusType: "status", value: "-effectValue" },
  ],
  description: "Can spend an action to retch (Fortitude save vs source DC to reduce by 1, or 0 on critical success). Can't willingly ingest anything.",
}
```

No turn-end suggestion — retching is an in-turn action, not a turn-boundary event.

#### Clumsy (1–4)

Status penalty equal to value on Dexterity-based checks and DCs.

```typescript
{
  id: "clumsy",
  name: "Clumsy",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  modifiers: [
    { stat: "ac",        bonusType: "status", value: "-effectValue" },
    { stat: "reflex",    bonusType: "status", value: "-effectValue" },
    { stat: "dexSkills", bonusType: "status", value: "-effectValue" },
  ],
  description: "Also applies to Dex-based attack rolls (not automated — creature attacks don't tag their ability).",
}
```

#### Enfeebled (1–4)

Status penalty equal to value on Strength-based checks and DCs, including melee attack rolls and damage.

```typescript
{
  id: "enfeebled",
  name: "Enfeebled",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  modifiers: [
    { stat: "strSkills", bonusType: "status", value: "-effectValue" },
  ],
  description: "Also applies to Str-based melee attack rolls and damage rolls (not automated — creature attacks don't tag their ability).",
}
```

No automated modifiers — can't distinguish Str-based vs Dex-based attacks from statblock data.

#### Stupefied (1–4)

Status penalty equal to value on mental checks, spell attack rolls, and spell DCs. Risk of losing spells.

```typescript
{
  id: "stupefied",
  name: "Stupefied",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  modifiers: [
    { stat: "mentalSkills", bonusType: "status", value: "-effectValue" },
    { stat: "will",         bonusType: "status", value: "-effectValue" },
  ],
  description: "Also applies to spell attack rolls and spell DCs (not in stat model). When casting a spell, DC 5 + value flat check or spell is lost.",
}
```

No automated modifiers — can't identify mental skills or spell stats from creature data.

#### Drained (1–4)

Status penalty equal to value on Constitution-based checks. Reduces max HP.

```typescript
{
  id: "drained",
  name: "Drained",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  modifiers: [
    { stat: "fortitude", bonusType: "status", value: "-effectValue" },
  ],
  description: "Reduces max HP by level × value (reduce current HP to new max if needed). Also applies to Con-based checks beyond Fortitude. Decreases by 1 after full night's rest.",
}
```

Note: max HP reduction is not modeled in stat derivation. The GM adjusts HP manually. A future enhancement could track this, but V2 uses description.

#### Doomed (1–3)

Lowers the dying threshold. No stat modifiers.

```typescript
{
  id: "doomed",
  name: "Doomed",
  category: "condition",
  hasValue: true,
  maxValue: 3,
  modifiers: [],
  description: "Death threshold becomes 4 − Doomed value. Removed when Dying is removed (unless source specifies otherwise). Decreases by 1 after full night's rest.",
}
```

Handled by death tracking subsystem (§3).

#### Wounded (1–3)

Increases Dying value when Dying is gained.

```typescript
{
  id: "wounded",
  name: "Wounded",
  category: "condition",
  hasValue: true,
  maxValue: 3,
  modifiers: [],
  description: "When you gain Dying, add Wounded value to the Dying value. Removed when restored to full HP. Increases by 1 each time you recover from Dying.",
}
```

Handled by death tracking subsystem (§3).

#### Dying (1–4)

At death's door. Threshold modified by Doomed.

```typescript
{
  id: "dying",
  name: "Dying",
  category: "condition",
  hasValue: true,
  maxValue: 4,
  impliedEffects: ["unconscious"],
  modifiers: [],
  turnStartSuggestion: {
    type: "promptResolution",
    description: "Recovery check: DC 10 + Dying value (+ Wounded if applicable). Crit Success → Dying reduced by 2. Success → Dying reduced by 1. Failure → Dying increases by 1. Crit Failure → Dying increases by 2."
  },
  description: "You are unconscious. Death occurs at Dying 4 (or 4 − Doomed). Recovery check at start of each turn.",
}
```

Handled by death tracking subsystem (§3).

#### Slowed (1–3)

Lose actions at start of turn. No stat modifiers.

```typescript
{
  id: "slowed",
  name: "Slowed",
  category: "condition",
  hasValue: true,
  maxValue: 3,
  modifiers: [],
  turnStartSuggestion: {
    type: "reminder",
    description: "Loses {value} action(s) this turn."
  },
  description: "You have fewer actions. At start of turn, lose a number of actions equal to value. Slowed does not affect reactions or free actions.",
}
```

#### Stunned (value)

Lose actions like Slowed, but the value decreases as actions are lost.

```typescript
{
  id: "stunned",
  name: "Stunned",
  category: "condition",
  hasValue: true,
  maxValue: 10,
  modifiers: [],
  turnStartSuggestion: {
    type: "reminder",
    description: "Lose up to {value} action(s). Reduce Stunned value by the number lost. If also Slowed, Stunned actions are lost first."
  },
  description: "You lose actions equal to Stunned value (total, not per turn). Reduce Stunned by actions lost each turn. Overrides Slowed while active (lose Stunned actions first, then Slowed if any remain).",
}
```

---

### 2.3 Binary Conditions with Modifiers

#### Off-Guard

-2 circumstance penalty to AC.

```typescript
{
  id: "off-guard",
  name: "Off-Guard",
  category: "condition",
  hasValue: false,
  modifiers: [
    { stat: "ac", bonusType: "circumstance", value: -2 },
  ],
  description: "You are flat-footed. −2 circumstance penalty to AC.",
}
```

#### Blinded

Can't see. Off-Guard and significant perception penalty.

```typescript
{
  id: "blinded",
  name: "Blinded",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard"],
  modifiers: [
    { stat: "perception", bonusType: "status", value: -4 },
  ],
  description: "Can't see. All terrain is difficult terrain. Auto-crit-fail Perception checks requiring sight. −4 status penalty to Perception if vision is your only precise sense (almost always).",
}
```

#### Dazzled

Impaired vision. Everything is concealed.

```typescript
{
  id: "dazzled",
  name: "Dazzled",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Everything is concealed to you (DC 5 flat check to target). If you have a non-visual precise sense, concealment only applies vs. creatures you'd need sight to perceive.",
}
```

No automated modifiers — concealment is a targeting mechanic, not a stat modifier.

#### Encumbered

Carrying too much. Implies Clumsy 1 and reduces speed.

```typescript
{
  id: "encumbered",
  name: "Encumbered",
  category: "condition",
  hasValue: false,
  impliedEffects: ["clumsy"],
  modifiers: [],
  description: "All Speeds reduced by 10 feet (min 5 feet). Implies Clumsy 1.",
}
```

Note: when Encumbered implies Clumsy, the implied Clumsy instance is created with value 1. Speed reduction is not modeled in stat derivation.

**Design note — implied effects with values:** The `impliedEffects` array references effect IDs. When the implied effect `hasValue: true`, the system creates it with value 1 by default. This covers Encumbered → Clumsy 1. If a future condition needs to imply a higher value, extend the type to `impliedEffects: Array<string | { id: string; value: number }>`. Not needed for V2 — all implied value effects are value 1.

#### Prone

Lying on the ground. Penalty to attacks, bonus vs ranged.

```typescript
{
  id: "prone",
  name: "Prone",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard"],
  modifiers: [
    { stat: "attackRolls", bonusType: "circumstance", value: -2 },
  ],
  description: "Off-Guard. −2 circumstance to attack rolls. +1 circumstance bonus to AC vs ranged attacks (not automated — GM applies mentally). Must Crawl to move or spend an action to Stand.",
}
```

The +1 circumstance bonus vs ranged can't be automated (system doesn't track attack type). Goes in description.

#### Fascinated

Captivated by something. Penalty to Perception and skills.

```typescript
{
  id: "fascinated",
  name: "Fascinated",
  category: "condition",
  hasValue: false,
  modifiers: [
    { stat: "perception", bonusType: "status", value: -2 },
    { stat: "allSkills",  bonusType: "status", value: -2 },
  ],
  description: "Can't use concentrate actions that don't relate to the source of fascination. Ends if a hostile action is taken against you or your allies.",
}
```

---

### 2.4 Composite Conditions (Implied Effects)

#### Grabbed

Held by another creature. Implies Off-Guard and Immobilized.

```typescript
{
  id: "grabbed",
  name: "Grabbed",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard", "immobilized"],
  modifiers: [],
  description: "Off-Guard and Immobilized. Can attempt to Escape (Athletics or Acrobatics vs. grabber's Athletics DC). Ends if grabber moves away or releases.",
}
```

#### Restrained

More restricted than Grabbed. Implies Off-Guard and Immobilized.

```typescript
{
  id: "restrained",
  name: "Restrained",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard", "immobilized"],
  modifiers: [],
  description: "Off-Guard and Immobilized. Can't use actions with the manipulate or move trait except Escape and Force Open. Can attempt to Escape.",
}
```

#### Paralyzed

Body is rigid. Implies Off-Guard.

```typescript
{
  id: "paralyzed",
  name: "Paralyzed",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard"],
  modifiers: [],
  description: "Off-Guard. Can't act. Can't move. Body is rigid. Fall prone if standing.",
}
```

#### Petrified

Turned to stone. Implies Off-Guard.

```typescript
{
  id: "petrified",
  name: "Petrified",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard"],
  modifiers: [],
  description: "Off-Guard. Can't act. Can't perceive. Turned to stone. Immune to most effects while petrified. Often a permanent condition requiring magic to reverse.",
}
```

#### Unconscious

Knocked out or asleep. Major defensive penalties.

```typescript
{
  id: "unconscious",
  name: "Unconscious",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard"],
  modifiers: [
    { stat: "ac",         bonusType: "status", value: -4 },
    { stat: "perception", bonusType: "status", value: -4 },
    { stat: "reflex",     bonusType: "status", value: -4 },
  ],
  description: "Off-Guard. Can't act. Fall prone and drop held items. You don't perceive (blinded + deafened equivalent). A creature can Interact to wake you, or you wake from damage (unless magical sleep).",
}
```

Note: Unconscious does not imply Prone as a tracked effect. The description notes you fall prone, and the GM can apply Prone separately if relevant (unlikely for an unconscious creature — the penalties are already covered).

---

### 2.5 Reminder-Only Conditions (No Stat Modifiers)

These conditions affect targeting, behavior, or action economy in ways the tracker doesn't model mechanically. They appear as visual indicators on the combatant with their description available for GM reference.

#### Immobilized

```typescript
{
  id: "immobilized",
  name: "Immobilized",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Can't use actions with the move trait. Can be dragged or teleported.",
}
```

#### Concealed

```typescript
{
  id: "concealed",
  name: "Concealed",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "DC 5 flat check for attacks targeting this creature (on failure, attack misses). Doesn't change what senses can detect you.",
}
```

#### Hidden

```typescript
{
  id: "hidden",
  name: "Hidden",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Creatures know your space but can't see you. DC 11 flat check to target (on failure, attack misses). Must Seek to find with Perception.",
}
```

#### Undetected

```typescript
{
  id: "undetected",
  name: "Undetected",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Creatures don't know your location. Must guess the space to target (DC 11 flat check if correct space). Must Seek to become Hidden first.",
}
```

#### Unnoticed

```typescript
{
  id: "unnoticed",
  name: "Unnoticed",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Creatures don't know you're present at all. Can't be targeted or affected. More restrictive than Undetected.",
}
```

#### Invisible

```typescript
{
  id: "invisible",
  name: "Invisible",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Can't be seen. You are Hidden or Undetected to creatures relying on sight (depending on whether they can identify your space). Non-visual senses may still detect you.",
}
```

#### Fleeing

```typescript
{
  id: "fleeing",
  name: "Fleeing",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Must spend each action to move away from the source of fear using the most efficient route. Can't Delay or Ready. If cornered, uses other actions as GM sees fit.",
}
```

#### Controlled

```typescript
{
  id: "controlled",
  name: "Controlled",
  category: "condition",
  hasValue: false,
  modifiers: [],
  description: "Another creature determines your actions. The controller spends your actions. You're typically Off-Guard (apply separately if needed).",
}
```

#### Confused

```typescript
{
  id: "confused",
  name: "Confused",
  category: "condition",
  hasValue: false,
  impliedEffects: ["off-guard"],
  modifiers: [],
  description: "Off-Guard. Can't Delay, Ready, or use reactions. Treats all creatures as enemies. Each turn: 1) Use single action to Strike random adjacent creature (if any); 2) If none adjacent, move toward nearest creature. 3) Use remaining actions on move toward nearest. If no valid targets, waste actions.",
}
```

Confused implies Off-Guard per PF2e rules.

#### Quickened

```typescript
{
  id: "quickened",
  name: "Quickened",
  category: "condition",
  hasValue: false,
  modifiers: [],
  turnStartSuggestion: {
    type: "reminder",
    description: "Gains 1 extra action this turn (constrained to specified use, if any)."
  },
  description: "Gain 1 extra action at start of each turn. The extra action is often limited to specific uses by the granting effect (noted in AppliedEffect.note).",
}
```

---

### 2.6 Persistent Damage

Persistent damage is modeled as a family of effect definitions, one per damage type. All share the same structure — only `id` and `name` differ.

`hasValue` is **false**. The damage expression (e.g., "2d6", "5") is stored in the `AppliedEffect.note` field, not in the condition value. This is because persistent damage uses dice expressions, not simple integers.

```typescript
// Template — one definition per damage type
{
  id: "persistent-fire",        // persistent-{type}
  name: "Persistent Fire",      // Persistent {Type}
  category: "persistent-damage",
  hasValue: false,
  modifiers: [],
  turnStartSuggestion: {
    type: "promptResolution",
    description: "Take {note} fire damage, then flat check DC 15 to remove."
  },
  description: "At start of turn: take damage, then DC 15 flat check to end. Assisted recovery (Interact) lowers DC to 10. Multiple sources: take only the highest.",
}
```

**Defined persistent damage types:**

| id | name |
|---|---|
| `persistent-fire` | Persistent Fire |
| `persistent-cold` | Persistent Cold |
| `persistent-acid` | Persistent Acid |
| `persistent-electricity` | Persistent Electricity |
| `persistent-sonic` | Persistent Sonic |
| `persistent-bleed` | Persistent Bleed |
| `persistent-poison` | Persistent Poison |
| `persistent-mental` | Persistent Mental |
| `persistent-bludgeoning` | Persistent Bludgeoning |
| `persistent-piercing` | Persistent Piercing |
| `persistent-slashing` | Persistent Slashing |

**Usage example:** GM applies "Persistent Fire" to Goblin 2, enters "2d6" in the note field. At Goblin 2's turn start, the system prompts: "Persistent Fire 2d6 — take damage, then flat check DC 15? [Passed → Remove] [Failed → Keep]"

---

## 3. Death Tracking Subsystem

### 3.1 Location

`domain/effects/death.ts` — a pure function invoked by the reducer when processing commands that affect `dying`, `wounded`, or `doomed` effects.

### 3.2 Applying Dying

When `APPLY_EFFECT { effectId: "dying", value: N }` is dispatched:

```
1. Look up existing Wounded value on combatant (0 if absent)
2. effectiveDyingValue = N + woundedValue
3. Look up existing Doomed value on combatant (0 if absent)
4. deathThreshold = 4 - doomedValue
5. If effectiveDyingValue >= deathThreshold:
     → Set Dying to deathThreshold (cap it)
     → Mark combatant dead (isAlive = false)
     → Emit: effect-applied (dying), combatant-died
6. Else:
     → Apply Dying at effectiveDyingValue
     → Apply implied Unconscious (if not already present)
     → Emit: effect-applied (dying), effect-applied (unconscious if new)
     → If Wounded contributed: emit domain event noting the interaction
       e.g. "Goblin 1 gained Dying 1 + Wounded 2 → Dying 3"
```

### 3.3 Increasing Dying (Already Has Dying)

When `MODIFY_EFFECT_VALUE { effectId: "dying", delta: +N }` or `SET_EFFECT_VALUE` increases Dying:

```
1. newDyingValue = currentDying + N
2. deathThreshold = 4 - doomedValue
3. If newDyingValue >= deathThreshold:
     → Mark dead, emit events
4. Else:
     → Set Dying to newDyingValue
```

Wounded is **not** added again when Dying increases — Wounded only applies when *gaining* Dying, not when it increases.

### 3.4 Removing Dying (Recovery)

When `REMOVE_EFFECT { effectId: "dying" }` is dispatched (creature recovered, not died):

```
1. Remove Dying and its implied Unconscious
2. If combatant has Wounded:
     → Increment Wounded by 1
     → Emit: effect-value-changed (wounded)
3. If combatant does not have Wounded:
     → Apply Wounded 1
     → Emit: effect-applied (wounded)
```

### 3.5 Doomed Changes

When `doomed` value changes on a combatant who already has `dying`:

```
1. newThreshold = 4 - newDoomedValue
2. If currentDying >= newThreshold:
     → Mark dead, emit events
```

When `doomed` is removed entirely while Dying is absent: no interaction.

### 3.6 Recovery Check (Turn-Start Prompt)

At start of a Dying creature's turn, the system generates a prompt via `turnStartSuggestion`. The GM resolves it:

- **Critical Success:** Reduce Dying by 2 (if reaches 0 → remove Dying, trigger §3.4 Wounded logic)
- **Success:** Reduce Dying by 1 (if reaches 0 → remove Dying, trigger §3.4 Wounded logic)
- **Failure:** Increase Dying by 1 (trigger §3.3 threshold check)
- **Critical Failure:** Increase Dying by 2 (trigger §3.3 threshold check)

The prompt presents these four outcomes. The GM picks the one matching their roll. The system applies the downstream effects automatically.

### 3.7 Events

The death subsystem emits standard `DomainEvent` types. No new event types needed — all interactions are expressible as `effect-applied`, `effect-removed`, `effect-value-changed`, and `combatant-died`.

The orchestrator's combat log formatter should produce human-readable entries that surface the interactions:

- "Goblin 1 gained Dying 1 (+ Wounded 1 → Dying 2). Death threshold: 4."
- "Goblin 1 Dying increased to 3. Death threshold: 3 (Doomed 1). Goblin 1 died."
- "Goblin 1 recovered from Dying. Wounded increased to 2."

---

## 4. Summary Tables

### 4.1 Automated Modifiers — Quick Reference

| Condition | Stat | Type | Value |
|---|---|---|---|
| Frightened | ac, allSaves, perception, attackRolls, allSkills, allDCs | status | -effectValue |
| Sickened | ac, allSaves, perception, attackRolls, allSkills, allDCs | status | -effectValue |
| Clumsy | ac, reflex, dexSkills | status | -effectValue |
| Drained | fortitude | status | -effectValue |
| Enfeebled | strSkills | status | -effectValue |
| Stupefied | mentalSkills, will | status | -effectValue |
| Off-Guard | ac | circumstance | -2 |
| Blinded | perception | status | -4 |
| Prone | attackRolls | circumstance | -2 |
| Fascinated | perception, allSkills | status | -2 |
| Unconscious | ac, perception, reflex | status | -4 |

### 4.2 Implied Effects — Quick Reference

| Parent | Implies |
|---|---|
| Dying | Unconscious |
| Blinded | Off-Guard |
| Encumbered | Clumsy (value 1) |
| Prone | Off-Guard |
| Grabbed | Off-Guard, Immobilized |
| Restrained | Off-Guard, Immobilized |
| Paralyzed | Off-Guard |
| Petrified | Off-Guard |
| Unconscious | Off-Guard |
| Confused | Off-Guard |

### 4.3 Turn Boundary Suggestions — Quick Reference

| Condition | Boundary | Type | Description |
|---|---|---|---|
| Frightened | end | suggestDecrement | Decrease by 1 |
| Dying | start | promptResolution | Recovery check |
| Slowed | start | reminder | Loses N actions |
| Stunned | start | reminder | Loses up to N actions |
| Quickened | start | reminder | Gains 1 extra action |
| Persistent * | start | promptResolution | Take damage, flat check DC 15 |

### 4.4 Death Subsystem Interactions

| Trigger | Automated Behavior |
|---|---|
| Gain Dying N | Add Wounded value → effective Dying. Check vs threshold (4 − Doomed). Imply Unconscious. |
| Dying increases | Check vs threshold. |
| Remove Dying (recovery) | Remove implied Unconscious. Increment Wounded (or apply Wounded 1). |
| Doomed changes | Recheck threshold if currently Dying. |

---

## 5. Implementation Notes

### 5.1 Effect Library Structure

The built-in conditions library is a `Record<string, EffectDefinition>` exported as a constant from `domain/effects/library.ts`. Approximately 35 entries (conditions + persistent damage types).

### 5.2 Implied Effect Value Convention

When `impliedEffects` references a condition with `hasValue: true`, the implied instance is created with value 1. Only case in V2: Encumbered → Clumsy 1. If future conditions need higher implied values, extend `impliedEffects` to support `{ id: string; value: number }` objects.

### 5.3 Persistent Damage — Note Field Convention

The `note` field on `AppliedEffect` is used to store the damage expression for persistent damage ("2d6", "3d4+2", "5"). The `turnStartSuggestion` references `{note}` as a placeholder the prompt generator substitutes.

This introduces a convention: `{note}` and `{value}` are template variables in suggestion `description` strings. The prompt generator resolves them from the `AppliedEffect` instance.

### 5.4 Test Priority

1. **Death subsystem** — combinatorial tests for all Dying/Wounded/Doomed interactions, threshold edge cases, recovery flows.
2. **Implied effects** — creation chains, removal cascades, duplicate detection (Off-Guard from both Prone and Grabbed simultaneously).
3. **Stacking interactions** — Frightened + Sickened on same creature (both status penalties to same stats — only worst kept). Frightened + Off-Guard (different bonus types — both apply).
4. **Turn boundary prompt generation** — correct prompts emitted for each condition at the right boundary.
