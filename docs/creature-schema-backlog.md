# Creature schema — backlog of needed extensions

Surfaced by the `create-creature` skill as it imports statblocks. Each section
describes a piece of source data the current YAML schema can't represent
structurally, lists the creatures that triggered the gap, and sketches a
suggested encoding.

Closing a section means: add the field to the schema spec and validator,
update the `Creature` type and sample creatures, then migrate affected files
out of `notes` into the new structured field.

## Senses — closed

Added in the Foundry JSON importer pass. The `Creature.senses?: Sense[]` field
is now structured as `{ type: string; acuity?: 'precise' | 'imprecise' | 'vague'; range?: number }`,
matching the Foundry pf2e source schema. Mapper populates it from
`system.perception.senses[]`.

## Ability score modifiers — closed

Added in the Foundry JSON importer pass. The `Creature.abilities?: AbilityScores`
field is now structured as `{ str, dex, con, int, wis, cha: number }`. Mapper
populates it from `system.abilities.<key>.mod`.

## Immunity classification

Note: the Foundry JSON importer pass migrated the wire shape to
`immunities: { type: string; exceptions?: string[] }[]` — symmetric with
`resistances` and `weaknesses`. The semantic classification below is still
open: a single `type` string still collapses three distinct categories.

Current `immunities: CreatureImmunity[]` collapses three semantically distinct
categories:

- **Condition immunities** (e.g. `petrified`, `paralyzed`, `unconscious`) —
  applying the condition should fail.
- **Trait immunities** (e.g. `death`, `mental`, `disease`) — effects with
  that trait should fail against the creature.
- **Damage-type immunities** (e.g. `fire`, `acid`) — damage of that type is
  reduced to zero.

The runtime will need to tell these apart once it starts enforcing immunity
checks (today the field is informational only).

Suggested encoding: add a `kind: 'condition' | 'trait' | 'damage'` field to
`CreatureImmunity`, or derive it from a curated list at validation time
since Foundry already publishes well-formed type strings.

Triggered by:
- basilisk

## Languages — closed

Added in the Foundry JSON importer pass. The `Creature.languages?: Languages`
field is now structured as `{ value: string[]; details?: string }`, matching
the Foundry pf2e source schema. The `details` string carries special
communication notes like `telepathy 100 feet`.

## Items

Statblocks list an `Items` line (e.g. `religious symbol of Zevgavizeb,
+1 striking spiked gauntlet`, `breastplate, longsword, key`). Currently
dumped into `notes:`. Mostly flavor and loot tracking; mechanical effects
(weapon enhancement, armor) are already baked into the published AC,
attack modifiers, and damage, so this is primarily display data.

Suggested encoding: top-level `items: string[]` (free-form names) for V1.
A future enhancement could model linkage to a treasure/item index, but
that is well beyond the encounter-tracker scope.

Triggered by:
- yaashka
- xulgath-leader
- xulgath-spinesnapper
- gluttondark-babau
