# Spell Enrichment: Inline Mechanics + AoN Deep-Link

**Status:** Design — not yet implemented
**Owner:** mateusz@artofai.dev
**Date:** 2026-05-18

## Context

Today, creatures with spellcasting render their spell lists as bare names plus rank/frequency markers (see `src/components/details/SpellcastingBlockView.svelte`). The GM sees "Blindness, level 3" with no action cost, save, damage, range, or description. To resolve a cast at the table they must alt-tab to Archives of Nethys, search by name, find the right entry, and remember the heightened values for the cast level — a flow-breaking detour during initiative.

This change enriches each spell entry with at-a-glance mechanics computed at the cast level, plus a direct link to the spell's AoN page. The source dataset is the Foundry pf2e system module (ORC-licensed), already used in `src/lib/foundry/` for creature import.

**Outcome:** clicking a spell row expands a compact details panel beneath it, showing action cost, range/area/targets, defense (save or attack), damage at the cast level (heightening applied), traits, a one-line effect summary, and an AoN link. No domain changes; no network calls at runtime beyond a single static-asset fetch.

## Non-goals

- Full spell description text embedded in the app (deferred to the AoN link).
- Homebrew spell authoring (current `SpellListEntry` slugs that miss the index fall back to a name-only row plus an AoN search link).
- IndexedDB persistence of the spell index (the architecture spec mentioned this; a read-only in-memory cache after one fetch is sufficient).
- Wiring the unwired slot commands from M6 — that is separate scope.
- Casting-time selection of heightened rank (the entry's `level` already encodes the prepared/known cast level).

## Architecture

Strict unidirectional layering preserved:

```
src/routes/  →  src/components/  →  src/lib/spell-index/  →  static asset
                                  ↘                       ↗
                                    in-memory cache
```

- **`src/domain/`** — unchanged. `SpellListEntry` keeps its current shape (slug + name + level + frequency + cantrip flag + count). The reducer remains description-agnostic.
- **`src/lib/spell-index/`** — new module. Owns loading, caching, slug lookup, and heightening resolution. Pure TS, no Svelte. Mirrors the layout pattern of `src/lib/foundry/` and `src/lib/spellcasting/`.
- **`src/components/details/SpellcastingBlockView.svelte`** — gains expand-on-click affordance per spell row; presents resolved mechanics. Stays presentational: receives an async lookup function via props, never owns encounter state.
- **`static/spell-index.json`** — generated artifact, committed to the repo. Single file, fetched once per session on first row expand. Estimated ~300–500 KB gzipped.
- **`scripts/import-spells.mjs`** — new offline maintainer script. Pulls Foundry pf2e at a pinned git tag, transforms its `packs/spells/*.json` files, writes `static/spell-index.json`. Not part of the user-facing build.

## Data model

Lives in `src/lib/spell-index/types.ts` (NOT in `src/domain/`):

```ts
export interface SpellIndexEntry {
  slug: string;              // matches SpellListEntry.spellSlug
  name: string;
  baseLevel: number;         // 1–10; 0 for cantrips by convention
  isCantrip: boolean;
  isFocus: boolean;
  actionCost: 'reaction' | 'free' | 1 | 2 | 3 | 'varies';
  traits: string[];          // e.g., ["arcane","concentrate","manipulate","mental"]
  traditions: string[];      // subset of ["arcane","divine","occult","primal"]
  range?: string;            // "60 feet", "touch"
  area?: string;             // "20-foot burst"
  targets?: string;          // "1 creature"
  duration?: string;         // "1 minute", "sustained up to 1 minute"
  defense?: SpellDefense;
  effectSummary: string;     // one-line, auto-extracted from Foundry description
  base: SpellLevelData;      // mechanics at baseLevel
  heightening?: SpellHeightening;
  aonUrl: string;            // direct link to the AoN spell page
}

export interface SpellDefense {
  kind: 'save' | 'attack';
  save?: 'fortitude' | 'reflex' | 'will';
  basic?: boolean;           // basic save flag
}

export interface SpellLevelData {
  damage?: string;           // "6d6 fire" — single rolled line, joined if multiple damage types
}

export type SpellHeightening =
  | { mode: 'fixed'; levels: Record<number, Partial<SpellLevelData>> }
  | { mode: 'interval'; per: number; delta: Partial<SpellLevelData> };
```

**Naming.** The domain stores rank as the field `level: number` on `SpellListEntry`; PF2e Remastered terminology and the existing UI both say "rank". Internal symbols use `level`/`castLevel`/`baseLevel` to match the existing schema; user-facing copy says "rank". Don't rename the domain field — out of scope.

### Heightening resolver (pure)

```ts
export function resolveAtLevel(
  entry: SpellIndexEntry,
  castLevel: number
): SpellLevelData
```

- `fixed` mode: pick the highest defined level ≤ `castLevel`, merge over `base`.
- `interval` mode: compute `steps = Math.max(0, Math.floor((castLevel - baseLevel) / per))`, apply `delta × steps` to `base`. For damage, "+2d6 fire" with 3 steps means `+6d6 fire` added to the base dice expression.
- Cantrips are stored with `baseLevel` equal to the rank at which they first appear (typically 1). The `SpellListEntry.level` for a cantrip already reflects the caster's effective cantrip rank, so the resolver applies normally.

### Index module surface

`src/lib/spell-index/index.ts` exposes:

```ts
export type SpellIndexState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; lookup: (slug: string) => SpellIndexEntry | undefined }
  | { status: 'unavailable' };  // fetch failed

export function ensureSpellIndex(): Promise<SpellIndexState>;
export function resolveAtLevel(entry: SpellIndexEntry, castLevel: number): SpellLevelData;
```

Single in-module promise dedupes concurrent calls. Cache lives for the page lifetime.

## UI

`SpellcastingBlockView.svelte`:

- Spell row becomes click-to-toggle. USE/RESTORE buttons keep their click semantics via `stopPropagation` and remain reachable while collapsed and expanded.
- A small caret indicates expand state. Touch-friendly (no hover dependence).
- Expanded panel renders **below** the existing row, indented under the spell name:

  ```
  ◆◆  Range 60 ft.  ·  Area 20-ft burst  ·  Targets each creature in area
  Reflex DC 24 (basic)
  8d6 fire   heightened from rank 3
  [fire] [evocation] [arcane]
  Each creature in the area takes fire damage.
  View on Archives of Nethys ↗
  ```

- Heightened caption only shown when `castLevel > baseLevel`. Cantrips show "cantrip rank N" instead.
- Defense line variants:
  - Save: `"Reflex DC 24 (basic)"` or `"Will DC 22"` (DC pulled from the spellcasting block's `dc`).
  - Attack: `"Spell attack +18"` (modifier pulled from the spellcasting block's attack mod).
- Traits as small inline pills, capped at 6 visible to avoid overflow.
- AoN link opens in a new tab (`target="_blank" rel="noopener"`).

Expand state is component-local (`$state` rune). Collapsing on tab close or remount is acceptable — this is presentation, not encounter state.

### Fallback (slug missing or index unavailable)

- Slug not in index: render today's row + small `↗` to `https://2e.aonprd.com/Search.aspx?Query=<encoded-name>`. No expand affordance.
- Index fetch failed (network, 404, malformed JSON): same fallback. One `console.warn` at module level. No retry storm; user can reload.

### ORC attribution

Foundry's pf2e system ships under the ORC license. Add a short attribution block to the existing settings or about surface (Settings drawer is the natural home; if none exists yet, add a one-line link from the encounter page footer). Block cites Paizo PF2e SRD + Foundry pf2e system + the pinned dataset version.

## Build workflow

New maintainer script: `npm run spells:import` → `scripts/import-spells.mjs`.

Behavior:
1. Clones / fetches `github.com/foundryvtt/pf2e` at a pinned tag (recorded in the script alongside the date).
2. Reads `packs/spells/*.json`.
3. Transforms each into `SpellIndexEntry`:
   - `slug` ← Foundry filename minus `.json` (matches the existing creature-import slug convention).
   - `effectSummary` ← first sentence of `stripFoundryMarkup(system.description.value)`, trimmed and length-capped.
   - `actionCost` ← Foundry `system.time.value` mapped through the existing action glyph rules.
   - `aonUrl` ← extracted from Foundry's spell document where present (their data exposes AoN URLs for SRD-published spells via `system.publication` / pack-level metadata). For entries that lack a direct AoN URL, fall back to `https://2e.aonprd.com/Search.aspx?Query=<encoded-name>` and record a warning in the coverage stats. The exact extraction path is confirmed during the import-script implementation, not in this spec.
   - `heightening` ← reads `system.heightening` (`fixed` vs `interval`) and trims to damage-only deltas for v1.
4. Writes `static/spell-index.json` (UTF-8, no BOM).
5. Logs coverage stats: total imported, AoN-URL coverage rate, heightening-mode distribution, count of spells with missing `effectSummary` (warning, not failure).

The generated JSON is **committed to the repo**, so builds remain deterministic and offline-capable. Refresh is an explicit maintainer action when bumping the source data tag.

## Testing

- **`src/lib/spell-index/resolve.test.ts`** — Vitest. Pure-function coverage of `resolveAtLevel`:
  - `fixed` mode: cast at base, between defined steps, above all defined steps.
  - `interval` mode: cast at base (zero steps), one step, multi-step.
  - Cantrip cast at various heightening levels.
  - No-heightening base entry returns `base` unchanged at every cast level.
- **`src/lib/spell-index/index.test.ts`** — loader with mocked `fetch`: success, 404, malformed JSON, concurrent calls dedupe to one fetch.
- **`src/components/details/SpellcastingBlockView.test.ts`** (existing file, extend) — collapsed → expanded toggle, click on USE button does not toggle expand, fallback rendering when slug not in index, heightened caption only when cast level > base.
- **Domain purity** — unchanged. `tsc -p tsconfig.domain.json --noEmit` continues to enforce that the new lib module does not leak into `src/domain/`.

## Critical files

To modify:
- `src/components/details/SpellcastingBlockView.svelte` — expand affordance + expanded panel.
- `src/components/details/SpellcastingBlockView.test.ts` — extend tests.

To create:
- `src/lib/spell-index/types.ts`
- `src/lib/spell-index/index.ts`
- `src/lib/spell-index/resolve.ts`
- `src/lib/spell-index/resolve.test.ts`
- `src/lib/spell-index/index.test.ts`
- `scripts/import-spells.mjs`
- `static/spell-index.json` (generated)

To reuse:
- `src/lib/foundry/text.ts` — `stripFoundryMarkup` for description-to-summary extraction.
- `src/lib/foundry/mapper.ts` — slug conventions (`slugifyName`).
- `src/components/details/ActionGlyph.svelte` — action-cost glyph rendering already used elsewhere.

## Verification

1. `npm run check` — type checking including domain purity.
2. `npm run test:run` — full Vitest suite, including new resolve + loader + component tests.
3. `npm run audit` — no new moderate+ vulnerabilities (the import script is a maintainer tool; runtime deps unchanged).
4. `npm run build` — static build still produces a working `./build` artifact, including `static/spell-index.json` copied into the output.
5. **Manual smoke at `npm run dev`:**
   - Open an encounter with a spellcasting creature (e.g., Yaashka — has Blindness rank 3, Harm rank 3).
   - Open the combatant card, scroll to the spellcasting block.
   - Click a spell row → details expand with action cost, save, damage, traits, summary, AoN link.
   - Verify the damage line reflects the cast level (heightened from base where applicable).
   - Click the AoN link → opens the correct spell page in a new tab.
   - USE / RESTORE buttons still work without collapsing the expand.
   - Falsify a slug in a local creature YAML → row renders name-only with "Search AoN" affordance, no expand.

## Open implementation details (deferred to plan/implementation, not blocking)

- Exact mapping of Foundry's action-cost encoding to our action-cost type (Foundry uses `'1'`, `'2'`, `'3'`, `'reaction'`, `'free'`, plus occasional free-text). The import script handles this; if a value is unrecognized, fall through to `'varies'`.
- Exact extraction path for the AoN URL inside Foundry's spell JSON (see Build workflow above). Fall back to AoN search URL when absent.
- Whether the ORC attribution lives in a Settings/About surface or as a small footer link — small UX call, decide during implementation. The attribution itself is required, the surface is not yet chosen.
- Curated `spell-summaries.json` overlay for spells whose auto-extracted summary reads poorly — deferred; not v1.
