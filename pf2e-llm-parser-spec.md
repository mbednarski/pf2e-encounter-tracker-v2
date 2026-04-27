# PF2e Encounter Tracker v2 — LLM Parser Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-22
**Status:** Ready for review

---

## 1. Overview

The LLM parser transforms raw statblock text into structured YAML matching the tracker's data types. Three distinct parsing pipelines exist:

1. **Creature parsing** — raw statblock text → `Creature` YAML + any `EffectDefinition` YAMLs for afflictions
2. **Spell enrichment** — list of spell slugs → `Spell[]` YAML
3. **Batch creature parsing** — multiple statblocks in one input → multiple creature outputs

All calls are made directly from the browser using the user's API key. No server involvement.

---

## 2. API Configuration

### 2.1 Provider and Model

Target provider: **Anthropic** (Claude API). The user provides their own API key.

Model selection: configurable in settings, default to the best available model at implementation time. The prompt design should work across Claude model generations — it relies on structured output formatting, not model-specific behaviors.

### 2.2 Key Storage

API key stored in IndexedDB `settings` store under key `llmApiKey`. Never included in any URL, never sent to any server other than `api.anthropic.com`. Cleared when the user clears settings.

### 2.3 Call Mechanics

```typescript
interface ParserConfig {
  apiKey: string
  model: string                    // "claude-sonnet-4-20250514" or user-selected
  maxTokens: number               // default 8192 for creature, 4096 for spell
}
```

The importer module (`importer/llm-parser.ts`) constructs the API call, handles the response, and extracts YAML blocks from the assistant's response. It is a pure async function — no UI concerns, no persistence writes.

```typescript
async function parseCreature(
  rawText: string,
  config: ParserConfig
): Promise<ParseResult>

interface ParseResult {
  creature?: string               // YAML string for Creature
  afflictions: string[]           // YAML strings for any EffectDefinitions
  spellSlugs: string[]            // extracted spell slugs needing enrichment
  warnings: string[]              // parser notes about uncertain extractions
  rawResponse: string             // full LLM response for debugging
}
```

---

## 3. Creature Parsing Prompt

### 3.1 Strategy

The prompt has three parts:

1. **System prompt** — schema definitions, formatting rules, examples. This is constant across calls.
2. **User message** — the raw statblock text. Variable per call.
3. **Prefill** — start the assistant response with `\`\`\`yaml\n` to force YAML output.

The system prompt includes the complete output schema as YAML-commented type definitions. Using YAML comments rather than TypeScript interfaces in the prompt produces better YAML output — the model stays in "YAML mode."

### 3.2 System Prompt

```
You are a Pathfinder 2e statblock parser. You convert raw creature statblock text into structured YAML.

Output EXACTLY one YAML document for the creature. If the statblock contains inline afflictions (poisons, diseases, venoms, curses), output additional YAML documents separated by `---`.

## Output Schema — Creature

# Required fields
id: string           # lowercase-hyphenated creature name: "goblin-warrior", "ancient-red-dragon"
name: string         # display name: "Goblin Warrior", "Ancient Red Dragon"
level: integer       # creature level from the statblock header
traits: [string]     # trait tags: [humanoid, goblin] — lowercase
size: string         # tiny | small | medium | large | huge | gargantuan — lowercase
rarity: string       # common | uncommon | rare | unique — default "common" if not listed
ac: integer
fortitude: integer   # Fortitude save modifier
reflex: integer      # Reflex save modifier
will: integer        # Will save modifier
perception: integer  # Perception modifier
hp: integer
speed:               # movement speeds in feet as integers
  land: integer      # always present
  fly: integer       # only if creature has this speed
  swim: integer      # only if creature has this speed
  climb: integer     # only if creature has this speed
  burrow: integer    # only if creature has this speed
skills:              # skill name → modifier. Lowercase skill names.
  athletics: integer
  stealth: integer
attacks: [Attack]    # see Attack schema below
passiveAbilities: [Ability]
reactiveAbilities: [Ability]
activeAbilities: [Ability]
tags: []             # empty array — user adds tags later
immunities: [string]            # lowercase: ["fire", "poison", "paralyzed"]
resistances: [{type: string, value: integer}]
weaknesses: [{type: string, value: integer}]

# Optional fields
alignment: string    # only for pre-remaster creatures
spellcasting: [SpellcastingBlock]  # only if creature has spellcasting
hardness: integer    # only for constructs/objects
source: string       # book/AP name if identifiable
notes: string        # anything that doesn't fit the schema

## Attack Schema

name: string         # "jaws", "longsword" — lowercase
type: string         # "melee" or "ranged"
modifier: integer    # attack roll modifier (+14 → 14)
traits: [string]     # trait slugs: ["agile", "finesse", "deadly-d10", "range-60", "reach-10"]
damage:              # array of damage components
  - dice: integer    # number of dice (omit for flat damage)
    dieSize: integer # die faces (omit for flat damage)
    bonus: integer   # flat bonus (omit if none)
    type: string     # "piercing", "fire", "poison", etc.
    persistent: true # only if persistent damage
effects: [string]    # on-hit effect slugs: ["grab", "knockdown", "giant-centipede-venom"]

## Trait Encoding Rules
- Parameterized traits use hyphenated format: deadly-d10, fatal-d12, range-60, reach-10, thrown-20
- Simple traits are plain lowercase: agile, finesse, forceful, sweep, backstabber
- Range values are in feet as integers

## Ability Schema

name: string             # "Attack of Opportunity", "Breath Weapon"
actions: 1 | 2 | 3 | "free" | "reaction"  # omit for passives
traits: [string]         # omit if none
trigger: string          # only for reactions/triggered free actions
frequency: string        # "once per round", "1/day" etc. — only if stated
requirements: string     # only if stated
description: string      # FULL rules text — do not summarize or truncate

## Ability Categorization
- passiveAbilities: no action cost AND no trigger. Always-on effects, auras, senses beyond the standard (darkvision goes in notes, not here).
- reactiveAbilities: has trigger — reactions or triggered free actions.
- activeAbilities: has action cost (1, 2, 3, or free without trigger).

## SpellcastingBlock Schema

name: string             # "Arcane Prepared Spells", "Divine Innate Spells"
tradition: string        # arcane | divine | occult | primal
type: string             # prepared | spontaneous | innate | focus
dc: integer
attackModifier: integer  # omit if not listed
focusPoints: integer     # only for focus spellcasting
slots:                   # only for prepared/spontaneous — rank → count
  1: integer
  3: integer
entries:                 # all spells in this block
  - spellSlug: string    # lowercase-hyphenated: "fireball", "wall-of-fire"
    name: string         # display name: "Fireball", "Wall of Fire"
    level: integer       # rank this creature casts it at (may be heightened)
    isCantrip: true      # only for cantrips
    frequency:           # only for innate spells
      type: string       # atWill | constant | perDay
      uses: integer      # only for perDay
    count: integer       # only for prepared duplicates: "magic missile (×2)" → count: 2

## Affliction Schema (separate YAML document)

id: string               # lowercase-hyphenated: "giant-centipede-venom"
name: string             # "Giant Centipede Venom"
category: affliction
hasValue: true
maxValue: integer        # number of stages
modifiers: []
persistAfterEncounter: true
afflictionData:
  saveType: string       # fortitude | reflex | will
  saveDC: integer
  onset: string          # "1 round", "1d4 hours" — omit if immediate
  interval: string       # "1 round", "1 day"
  maxDuration: string    # "6 rounds" — omit if unlimited
  stages:
    - stage: integer
      description: string  # full stage effect text
turnEndSuggestion:       # only for interval "1 round" (combat poisons)
  type: promptResolution
  description: >-
    Fortitude save DC {saveDC}. Crit Success → reduce by 2. 
    Success → reduce by 1. Failure → increase by 1. 
    Crit Failure → increase by 2.

## Critical Rules
1. Output ONLY valid YAML. No prose before or after the YAML blocks.
2. Preserve ALL ability text verbatim. Do not summarize descriptions.
3. Damage components are structured — parse "2d8+5 piercing plus 1d6 fire" into two DamageComponent entries.
4. "plus Grab" or "plus Knockdown" in damage lines are effects, not damage components. Put them in the attack's effects array as slugs.
5. If an attack references a poison/venom/disease, create a slug for it in the attack's effects array AND output a separate affliction YAML document.
6. Spell entries need spellSlug (lowercase-hyphenated) AND name (display case). Derive spellSlug from the name.
7. For prepared/spontaneous casters, count the entries per rank to determine slot counts.
8. If something is ambiguous, make your best judgment and add a YAML comment explaining the ambiguity.
9. Speed: if only one speed is listed with no label, it's "land".
10. Senses (darkvision, scent, etc.) go in the creature's notes field, not as abilities.
```

### 3.3 User Message

```
Parse this PF2e statblock into YAML:

{rawText}
```

### 3.4 Prefill

Start the assistant turn with ` ```yaml\n` to constrain output to YAML.

### 3.5 Response Extraction

The parser extracts YAML documents from the response:

1. Find content between ` ```yaml` and ` ``` ` fences
2. Split on `---` document separators
3. First document → creature YAML
4. Subsequent documents → affliction YAMLs
5. Extract all `spellSlug` values from the creature for the `spellSlugs` return field
6. Any YAML comments starting with `# AMBIGUOUS:` or `# WARNING:` → collected into `warnings`

---

## 4. Spell Enrichment Prompt

### 4.1 Strategy

Separate pipeline from creature parsing. Input: a list of spell slugs (extracted from creature parsing or manually entered). Output: `Spell[]` YAML entries.

The LLM generates spell descriptions from its training data. This is inherently approximate — PF2e remaster changed many spells, and the model's training data may have pre-remaster versions. The user reviews and corrects.

Alternatively, the user can paste AoN page text or book text alongside the slug list for extraction rather than generation. The prompt handles both cases.

### 4.2 System Prompt

```
You are a Pathfinder 2e spell database builder. Given a list of spell names, output YAML entries for each spell.

Use PF2e REMASTER rules (Player Core, GM Core 2023+). If you are uncertain whether a spell was changed in the remaster, note this with a YAML comment.

## Output Schema — Spell

slug: string             # lowercase-hyphenated: "fireball"
name: string             # display name: "Fireball"
level: integer           # base spell rank (3 for Fireball)
traits: [string]         # lowercase: [evocation, fire]
traditions: [string]     # which traditions: [arcane, primal]
cast:
  actions: 1 | 2 | 3 | "free" | "reaction"   # omit if cast time is not actions
  time: string           # "10 minutes", "1 hour" — only for non-action casts
  components: [string]   # [somatic, verbal, material]
description: string      # full rules text including save, duration, area, damage, heightened effects
heightened:              # only if the spell has heightened entries
  - level: string        # "+1", "+2", "5th", "8th"
    description: string  # what changes at this heightened level

## Rules
1. Output ONLY valid YAML. Multiple spells separated by `---`.
2. Include the FULL description with all mechanical details — saves, areas, damage, durations, special outcomes.
3. For heightened entries, use "+N" for per-rank scaling and "Nth" for specific-rank heightening.
4. If uncertain about remaster changes, add a comment: # WARNING: may differ in remaster
```

### 4.3 User Message — Generation Mode

```
Generate PF2e spell entries for these spells:

{slugList joined by newlines}
```

### 4.4 User Message — Extraction Mode

When the user provides source text:

```
Extract PF2e spell entries from this text. Only extract spells from this list:

{slugList joined by newlines}

Source text:
{sourceText}
```

---

## 5. Batch Creature Parsing

For sessions with multiple creatures, the GM may want to parse several statblocks at once.

### 5.1 Strategy

Same system prompt as single creature parsing. The user message contains multiple statblocks separated by a delimiter.

### 5.2 User Message

```
Parse these PF2e statblocks into YAML. Output each creature as a separate YAML document separated by `---`. Affliction definitions go after all creature documents, also separated by `---`.

===STATBLOCK===
{statblock1}
===STATBLOCK===
{statblock2}
===STATBLOCK===
{statblock3}
```

### 5.3 Response Extraction

1. Split on `---` document separators
2. Parse each YAML document
3. Documents with `attacks` field → creature
4. Documents with `afflictionData` field → affliction
5. Pair afflictions with creatures by matching effect slugs in attack `effects` arrays

### 5.4 Token Budget

Batch parsing needs a higher `maxTokens`. Estimate ~1500 tokens per creature + ~500 per affliction. For 5 creatures with 2 afflictions: ~8500 tokens. Set `maxTokens` to `Math.min(creatures * 2000, 16384)`.

If the response is truncated (finish reason is `max_tokens`), the parser warns the user and suggests reducing batch size.

---

## 6. Validation Pipeline

### 6.1 Flow

```
LLM response
  → YAML extraction (§3.5)
    → YAML parse (yaml.parse per document)
      → Schema validation (§6.2)
        → ParseResult with creature/afflictions/warnings
          → User review screen
            → User edits YAML if needed
              → Re-validate
                → Import to IndexedDB
```

### 6.2 Schema Validation

The validator (`importer/validator.ts`) checks the parsed YAML against the TypeScript interfaces. It produces a list of issues, each classified as `error` (blocks import) or `warning` (import proceeds, user informed).

```typescript
interface ValidationResult {
  valid: boolean                   // true if no errors (warnings are OK)
  issues: ValidationIssue[]
}

interface ValidationIssue {
  severity: "error" | "warning"
  path: string                     // dot-notation field path: "attacks[0].damage[1].type"
  message: string                  // human-readable: "Missing required field 'type'"
}
```

**Error conditions** (block import):

| Field | Rule |
|---|---|
| `id` | Required, non-empty, lowercase-hyphenated (matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`) |
| `name` | Required, non-empty |
| `level` | Required, integer |
| `ac` | Required, integer, >= 0 |
| `fortitude`, `reflex`, `will` | Required, integer |
| `perception` | Required, integer |
| `hp` | Required, integer, >= 1 |
| `size` | Required, must be valid CreatureSize |
| `attacks[].modifier` | Required, integer |
| `attacks[].type` | Required, "melee" or "ranged" |
| `attacks[].damage` | Required, non-empty array |
| `attacks[].damage[].type` | Required, non-empty string |
| `spellcasting[].tradition` | Must be valid SpellTradition |
| `spellcasting[].type` | Must be valid SpellcastingType |
| `spellcasting[].dc` | Required, integer |
| Affliction `afflictionData.stages` | Non-empty array if afflictionData present |
| Affliction `afflictionData.saveDC` | Required integer if afflictionData present |
| Affliction `afflictionData.saveType` | Must be "fortitude", "reflex", or "will" |

**Warning conditions** (import proceeds):

| Field | Rule |
|---|---|
| `traits` | Empty array — most creatures have at least one trait |
| `skills` | Empty record — unusual for leveled creatures |
| `attacks` | Empty array — unusual but valid (some creatures only cast spells) |
| `speed` | Missing `land` key — almost all creatures have land speed |
| `immunities`, `resistances`, `weaknesses` | Present but empty — omit instead |
| `rarity` | Missing — defaults to "common" |
| `attacks[].effects` | Slug doesn't resolve in effect library — not an error, just unlinked |
| `spellcasting[].entries[].spellSlug` | Slug doesn't resolve in spell index — not an error, just unenriched |
| All `Ability.description` | Empty or very short (<20 chars) — likely truncated |

### 6.3 Auto-Corrections

The validator can fix minor issues automatically (applied before validation, reported as warnings):

| Issue | Auto-correction |
|---|---|
| `id` has spaces | Replace with hyphens, lowercase |
| `id` has uppercase | Lowercase |
| `size` has wrong case | Lowercase |
| `rarity` missing | Default to "common" |
| `traits` missing | Default to empty array |
| `tags` missing | Default to empty array |
| `immunities` missing | Default to empty array |
| `resistances` missing | Default to empty array |
| `weaknesses` missing | Default to empty array |
| `passiveAbilities` missing | Default to empty array |
| `reactiveAbilities` missing | Default to empty array |
| `activeAbilities` missing | Default to empty array |
| Speed as single number | Convert to `{ land: N }` |
| Attack modifier with `+` prefix | Strip to integer |

---

## 7. Re-Prompting

### 7.1 When to Re-Prompt

Re-prompting is **not automatic**. The user sees the YAML output, reviews it, and can either:

1. Edit the YAML manually (primary correction path)
2. Click "Re-parse" to send the same input again (sometimes the LLM produces different output)
3. Click "Re-parse with corrections" to send the input plus correction hints

### 7.2 Correction Hints

If the user identifies specific errors, the orchestrator can construct a follow-up prompt:

```
The previous parse of this statblock had errors. Please fix:

{correctionList}

Original statblock:
{rawText}

Previous (incorrect) output:
{previousYaml}
```

This is a new API call, not a conversation continuation. Stateless — includes all context in one message.

---

## 8. Error Handling

### 8.1 API Errors

| Error | Handling |
|---|---|
| 401 Unauthorized | "Invalid API key. Check Settings → API Key." |
| 429 Rate Limited | "Rate limited. Wait and try again." Show retry-after if available. |
| 500+ Server Error | "API error. Try again." |
| Network failure | "Network error. Check your connection." |
| Timeout (>60s) | "Request timed out. Try a shorter statblock or reduce batch size." |

All errors are surfaced in the UI. No automatic retries — the user decides.

### 8.2 Parse Failures

| Failure | Handling |
|---|---|
| Response has no YAML block | Show raw response with error: "No YAML found in response. Try again." |
| YAML is malformed (parse error) | Show raw YAML with syntax error highlighted. User can fix manually. |
| YAML parses but fails validation | Show parsed YAML with validation issues listed. User fixes and re-validates. |
| Response truncated (max_tokens) | Warning: "Response was truncated. Try a shorter statblock or increase token limit." Show partial result. |

### 8.3 Cost Estimation

Display estimated token usage before the call:

- Input: count tokens in system prompt + raw text (~2000 base + ~500 per statblock)
- Output: estimate ~1500 per creature + ~500 per affliction
- Cost: `(inputTokens * inputPrice + outputTokens * outputPrice)` using the model's pricing

This is advisory — helps the user understand API costs before parsing a large batch.

---

## 9. File Structure

```
importer/
  llm-parser.ts           # parseCreature(), parseSpells(), parseBatch()
  prompts/
    creature-system.ts     # system prompt constant for creature parsing
    spell-system.ts        # system prompt constant for spell enrichment
  yaml-extractor.ts        # extract YAML blocks from LLM response
  validator.ts             # schema validation + auto-corrections
  api-client.ts            # Anthropic API call wrapper (fetch-based)
```

### 9.1 Prompt as Code

System prompts are TypeScript string constants, not external files. They are part of the codebase — version-controlled, reviewed, tested. The prompt IS the parser logic.

If a schema change happens (new field on Creature, modified Attack type), the system prompt must be updated in the same PR. This is enforced by convention, not tooling.

---

## 10. Test Strategy

### 10.1 Validator Tests (Unit — Vitest)

The validator is a pure function. Test with:

- Valid creature YAML → no issues
- Each error condition → produces correct error at correct path
- Each warning condition → produces warning, not error
- Auto-corrections → applied correctly, reported as warnings
- Edge cases: empty attacks array, creature with no skills, creature with only spellcasting

### 10.2 YAML Extractor Tests (Unit — Vitest)

- Single creature, no afflictions
- Creature + 1 affliction
- Creature + 2 afflictions
- Batch of 3 creatures + mixed afflictions
- No YAML fences in response → error
- Truncated YAML → partial extraction + warning
- YAML comments extraction for warnings

### 10.3 Parser Integration Tests (Manual)

Parsing accuracy depends on the LLM. Automated testing of LLM output is flaky by nature. Instead:

- Maintain a folder of **reference statblocks** (10-15 creatures of varying complexity)
- Each has a hand-verified expected YAML output
- Run the parser against these periodically (not in CI — costs money, nondeterministic)
- Compare output to expected, note regressions
- Use this to tune the system prompt

Reference creatures should cover:

| Complexity | Example |
|---|---|
| Simple melee creature | Goblin Warrior (level 1) |
| Creature with ranged + melee | Skeleton Archer (level 1) |
| Creature with poison | Giant Centipede (level 1) — tests affliction extraction |
| Spellcaster (prepared) | Drow Priestess or similar |
| Spellcaster (innate) | Dryad or similar |
| Complex multi-ability | Adult Red Dragon or similar |
| Creature with aura | Shadow or similar |
| Creature with hardness | Animated Armor (level 2) |
| Hazard-adjacent creature | Golem (has hardness + special rules) |
| Creature with unusual speeds | Merfolk (swim), Dragon (fly) |

---

## 11. Amendments to Existing Specs

### 11.1 Architecture Spec §14.2

Replace the existing three-bullet description with reference to this spec. The LLM parser is now fully specified.

### 11.2 Creature Types Spec §8.2

Replace the parser implications section with reference to this spec for prompt details.

---

## 12. Summary

| Item | Detail |
|---|---|
| Parsing pipelines | 3: creature, spell enrichment, batch creature |
| API provider | Anthropic Claude API, user-provided key |
| Output format | YAML with `---` document separators |
| Validation | Schema validator with errors (block) and warnings (proceed) |
| Auto-corrections | 13 minor fixups applied before validation |
| Re-prompting | Manual, not automatic. User edits or re-parses. |
| File structure | `importer/` with 5 modules |
| Test strategy | Unit tests for validator + extractor. Manual regression suite for LLM output. |