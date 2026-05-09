# Creature schema — backlog of needed extensions

Surfaced by the `create-creature` skill as it imports statblocks. Each section
describes a piece of source data the current YAML schema can't represent
structurally, lists the creatures that triggered the gap, and sketches a
suggested encoding.

Closing a section means: add the field to the schema spec and validator,
update the `Creature` type and sample creatures, then migrate affected files
out of `notes` into the new structured field.

## Senses

PF2e creatures often have senses like `darkvision`, `low-light vision`,
`scent (imprecise) 30 feet`, `tremorsense (precise) 60 feet`. Currently dumped
into `notes:`.

Suggested encoding: top-level `senses: string[]` for the simple case, or
`senses: { name: string; range?: number; precision?: 'precise' | 'imprecise' }[]`
if range and precision matter for the runtime (e.g. for concealment / hidden
checks).

Triggered by:
- basilisk

## Ability score modifiers

Statblocks list `Str +X, Dex +Y, Con +Z, Int +W, Wis +V, Cha +U`. Currently
dumped into `notes:`. Useful for skill-check resolution and any ability-score-
based DC the runtime might compute.

Suggested encoding: top-level `abilityModifiers: { str, dex, con, int, wis, cha: number }`.

Triggered by:
- basilisk

## Immunity classification

Current `immunities: string[]` collapses three semantically distinct
categories:

- **Condition immunities** (e.g. `petrified`, `paralyzed`, `unconscious`) —
  applying the condition should fail.
- **Trait immunities** (e.g. `death`, `mental`, `disease`) — effects with
  that trait should fail against the creature.
- **Damage-type immunities** (e.g. `fire`, `acid`) — damage of that type is
  reduced to zero.

The runtime will need to tell these apart once it starts enforcing immunity
checks (today the field is informational only).

Suggested encoding: either three arrays
(`conditionImmunities`, `traitImmunities`, `damageImmunities`) or tagged
objects
(`immunities: { kind: 'condition' | 'trait' | 'damage'; name: string }[]`).
The three-array form is friendlier for hand-editing.

Triggered by:
- basilisk
