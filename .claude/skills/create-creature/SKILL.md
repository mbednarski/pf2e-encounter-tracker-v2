---
name: create-creature
description: Use when the user pastes a Pathfinder 2e creature statblock (content containing telltale markers like "AC <n>", "HP <n>", "Perception +<n>", "Fort +<n>, Ref +<n>, Will +<n>", and "Melee" or "Ranged" attack lines with "+<n>" modifiers) and wants it added to this repo's creature library. Produces a `kind: creature` YAML document conforming to pf2e-yaml-schema-spec.md and writes it to `creatures/<slug>.yaml.local`, then validates via `npm run yaml:check`.
---

# create-creature

Convert a pasted PF2e statblock into a validated creature YAML file in this repo's personal-library directory.

## When to invoke

The user pastes statblock-shaped content into the conversation, often without an explicit instruction. Triggering markers (most should be present):

- An `AC` line with a number
- An `HP` line with a number
- Saves (`Fort`, `Ref`, `Will`) with `+`/`-` modifiers
- One or more attack lines starting with `Melee` or `Ranged` and containing a `+<n>` to-hit modifier
- Often a leading line like `<Name> Creature <level>` and a traits row

If the content is ambiguous (e.g. it's a discussion *about* a creature rather than a statblock), confirm with the user before proceeding.

## Read these files first, every invocation

The schema lives in the repo specs, not in this file. Read these before producing YAML so the output matches the current schema:

1. `pf2e-yaml-schema-spec.md` — the document envelope (`kind: creature`, `schemaVersion: 1`, `data: ...`).
2. `pf2e-creature-types-spec.md` — the `Creature`, `Attack`, `DamageComponent`, `Ability`, `SpellcastingBlock` shapes; the trait-encoding convention (e.g. `deadly-d10`, `range-60`); the elite/weak rules (do *not* pre-apply).
3. `docs/sample-creatures.yaml` — three worked examples (Goblin Warrior, Skeleton Guard, Cave Wolf) that round-trip through the validator. Use them as the canonical formatting reference.
4. `docs/creature-schema-backlog.md` — running list of schema gaps the skill has surfaced. Read it so you know which gaps are already tracked and don't re-explain them in chat.

## Stage 1 — extract & preview (no file writes)

1. Parse the pasted statblock into a single `kind: creature` YAML document (multiple `---`-separated documents if the user pasted more than one statblock).
2. Render the draft YAML in the chat as a fenced code block.
3. Below the YAML, list **uncertainty notes**. For every field that required interpretation, prefix with `GUESSED:`. Examples:
   - `GUESSED: traits — source had no traits row; inferred [humanoid, goblin] from name.`
   - `GUESSED: size — not stated; assumed medium.`

   Rarity does *not* need a `GUESSED:` flag when the source has no marker — PF2e convention is that absence of `uncommon`/`rare`/`unique` means common, so the silent default is correct.
4. If the statblock contains data the schema cannot structurally represent — most commonly **senses** (darkvision, scent, low-light vision) and **ability score modifiers** (Str/Dex/Con/Int/Wis/Cha) — preserve it as free-form text in the top-level `notes` field. **Drop Recall Knowledge entirely** (do not put it in `notes`, do not log it). See *Schema gaps and the backlog file* below.
5. If the statblock contains inline afflictions (poisons, diseases, curses), fold them into the relevant ability's `description` text and **note explicitly** that the structured affliction data was dropped (`effect-definition` import isn't built yet — see `src/lib/yaml/README.md`).
6. If the statblock has spellcasting, emit `spellcasting` blocks with `spellSlug` references and **note** that the spell index is not populated by this skill — descriptions will be missing in-app until spell YAML is authored separately.
7. Stop. Wait for the user's review and either approval ("looks good", "ship it", "yes", etc.) or corrections.

## Stage 2 — write & validate (after user approval)

1. Apply any corrections the user supplied.
2. Compute the slug: `data.name` lowercased, non-alphanumeric runs replaced with single hyphens, leading/trailing hyphens trimmed. (`Cave Wolf` → `cave-wolf`; `Bug's Eye` → `bug-s-eye`.) The slug must equal `data.id`.
3. Check whether `creatures/<slug>.yaml.local` already exists. If so, pause and ask: overwrite, append `-2` (or next available numeric suffix), or rename.
4. Write the YAML to `creatures/<slug>.yaml.local`.
5. Append entries to `docs/creature-schema-backlog.md` for any unmodeled data preserved in `notes`. If the relevant section already exists, add this creature's slug to its **Triggered by** list (don't duplicate). If a new gap appeared (something not yet listed), add a section using the existing ones as a template. See *Schema gaps and the backlog file* below.
6. Run `npm run yaml:check -- creatures/<slug>.yaml.local` via Bash.
7. Report to the user:
   - On success (exit 0): file path, accepted-creature count, "ready to import via Setup panel".
   - On failure: surface the issues from the harness output and ask whether to regenerate or edit specific fields.

## Schema gaps and the backlog file

Some statblock data has no home in the current schema. Rather than dropping it silently, the skill preserves it in two places:

- The creature's `notes` field — keeps the data attached to the source creature.
- `docs/creature-schema-backlog.md` — central log of which gaps exist and which creatures triggered them.

Currently tracked gaps (see the backlog file for the live list):

- **Senses** — `darkvision`, `low-light vision`, `scent`, `tremorsense`, etc.
- **Ability score modifiers** — Str/Dex/Con/Int/Wis/Cha.
- **Immunity classification** — current `immunities: string[]` collapses condition vs trait vs damage-type immunities into one list.

Because the backlog already explains these, the skill should not re-explain them in chat each time it parks something in `notes`. A short line like `notes: darkvision (gap tracked in docs/creature-schema-backlog.md#senses)` is sufficient.

**Recall Knowledge data is excluded** from this flow — it isn't preserved in `notes` and isn't tracked in the backlog. The runtime has no use for it.

## Do NOT do these things

- **Do not pre-apply elite or weak adjustments.** Per `pf2e-creature-types-spec.md` §6.3, weak/elite is applied at combatant creation by the GM. Always emit the *base* creature.
- **Do not add fields outside the `Creature` interface.** No encounter state, no combatant fields (`pendingPrompts`, `effects`, `currentHp`, etc.).
- **Do not write `effect-definition` or `spell` YAML files.** Out of scope for V1; the import path doesn't read them.
- **Do not commit, stage, or push.** Files in `creatures/` are gitignored. Reporting "written and validated" is the end.

## Failure modes

- **False-positive trigger:** if the pasted text doesn't actually look like a statblock once you read it carefully, ask the user to confirm before doing anything.
- **Slug collision:** see Stage 2 step 3.
- **Validator issues:** show the issues; let the user direct the next step.
- **Required field missing in source:** flag in Stage 1 notes with `GUESSED:` so the user can correct during review.
- **Multiple creatures pasted:** one YAML doc per creature, separated by `---`; one slug-named file per creature. (Optionally a single multi-doc file if the user requests it.)

## Example trigger paste

```
Goblin Warrior Creature 1
Small Humanoid Goblin
Perception +5
Languages Goblin
Skills Athletics +5, Stealth +6
Str +1, Dex +3, Con +1, Int -1, Wis +0, Cha +1
AC 16; Fort +5, Ref +9, Will +3
HP 18
Speed 25 feet
Melee dogslicer +8 (agile, finesse), Damage 1d6+2 slashing
Goblin Scuttle [reaction] ...
```

This skill should auto-trigger on a paste like the above and begin Stage 1.
