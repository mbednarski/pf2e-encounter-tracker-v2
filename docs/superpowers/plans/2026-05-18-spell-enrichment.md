# Spell Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand each spell row in `SpellcastingBlockView` to show heightened mechanics + traits + one-line effect + an Archives of Nethys link, sourced from a static spell index bundled from the Foundry pf2e system module.

**Architecture:** A new `src/lib/spell-index/` module owns a one-time fetch of `static/spell-index.json` (in-memory cache), a pure `resolveAtLevel` heightening resolver, and a typed `SpellIndexEntry` shape. A maintainer script `scripts/import-spells.ts` produces the JSON from Foundry's spell pack. A new presentational `SpellRow.svelte` replaces the inline `<li>` rendering and owns its own expand state. Domain layer untouched.

**Tech Stack:** Svelte 4 + SvelteKit static adapter · TypeScript · Vitest + @testing-library/svelte · `tsx` for the maintainer script · Foundry pf2e spell pack (ORC-licensed) as data source.

**Reference spec:** `docs/superpowers/specs/2026-05-18-spell-enrichment-design.md`

---

## Pre-flight

- [ ] **Confirm working branch** — should be `feat/spell-enrichment-spec` (or similar) created off `master`. Never commit to `master`.
- [ ] **Confirm pre-PR gate passes on a clean tree** — run `npm run check && npm run test:run` once before starting so any later failure is clearly attributable to this work.

---

## Task 1: Spell index types

**Files:**
- Create: `src/lib/spell-index/types.ts`

- [ ] **Step 1: Create the types module**

```ts
// src/lib/spell-index/types.ts

export type SpellActionCost = 'reaction' | 'free' | 1 | 2 | 3 | 'varies';

export type SpellTradition = 'arcane' | 'divine' | 'occult' | 'primal';

export interface SpellDefense {
  kind: 'save' | 'attack';
  save?: 'fortitude' | 'reflex' | 'will';
  basic?: boolean;
}

export interface SpellLevelData {
  damage?: string;
}

export type SpellHeightening =
  | { mode: 'fixed'; levels: Record<number, Partial<SpellLevelData>> }
  | { mode: 'interval'; per: number; delta: Partial<SpellLevelData> };

export interface SpellIndexEntry {
  slug: string;
  name: string;
  baseLevel: number;
  isCantrip: boolean;
  isFocus: boolean;
  actionCost: SpellActionCost;
  traits: string[];
  traditions: SpellTradition[];
  range?: string;
  area?: string;
  targets?: string;
  duration?: string;
  defense?: SpellDefense;
  effectSummary: string;
  base: SpellLevelData;
  heightening?: SpellHeightening;
  aonUrl: string;
}

export interface SpellIndexFile {
  version: number;
  generatedAt: string;
  source: { repo: string; tag: string };
  spells: SpellIndexEntry[];
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS (no new errors introduced)

- [ ] **Step 3: Commit**

```bash
git add src/lib/spell-index/types.ts
git commit -m "feat(spell-index): add SpellIndexEntry types"
```

---

## Task 2: `resolveAtLevel` heightening resolver

**Files:**
- Create: `src/lib/spell-index/resolve.ts`
- Test: `src/lib/spell-index/resolve.test.ts`

### Step 2.1: Test — no heightening returns base

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/spell-index/resolve.test.ts
import { describe, expect, test } from 'vitest';
import { resolveAtLevel } from './resolve';
import type { SpellIndexEntry } from './types';

function spell(over: Partial<SpellIndexEntry> = {}): SpellIndexEntry {
  return {
    slug: 'magic-missile',
    name: 'Magic Missile',
    baseLevel: 1,
    isCantrip: false,
    isFocus: false,
    actionCost: 1,
    traits: ['force'],
    traditions: ['arcane', 'occult'],
    effectSummary: '',
    base: { damage: '1d4+1 force' },
    aonUrl: '',
    ...over
  };
}

describe('resolveAtLevel', () => {
  test('returns base when no heightening defined', () => {
    const entry = spell();
    expect(resolveAtLevel(entry, 1)).toEqual({ damage: '1d4+1 force' });
    expect(resolveAtLevel(entry, 5)).toEqual({ damage: '1d4+1 force' });
  });
});
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run src/lib/spell-index/resolve.test.ts`
Expected: FAIL — `resolve` module does not exist.

- [ ] **Step 3: Implement minimal**

```ts
// src/lib/spell-index/resolve.ts
import type { SpellIndexEntry, SpellLevelData } from './types';

export function resolveAtLevel(
  entry: SpellIndexEntry,
  castLevel: number
): SpellLevelData {
  return { ...entry.base };
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/resolve.test.ts`
Expected: PASS

### Step 2.2: Test — fixed-mode heightening

- [ ] **Step 1: Add failing test**

Append to `src/lib/spell-index/resolve.test.ts`:

```ts
  test('fixed mode picks highest defined level ≤ castLevel', () => {
    const entry = spell({
      baseLevel: 1,
      base: { damage: '2d6 force' },
      heightening: {
        mode: 'fixed',
        levels: {
          3: { damage: '4d6 force' },
          5: { damage: '6d6 force' }
        }
      }
    });
    expect(resolveAtLevel(entry, 1)).toEqual({ damage: '2d6 force' });
    expect(resolveAtLevel(entry, 2)).toEqual({ damage: '2d6 force' });
    expect(resolveAtLevel(entry, 3)).toEqual({ damage: '4d6 force' });
    expect(resolveAtLevel(entry, 4)).toEqual({ damage: '4d6 force' });
    expect(resolveAtLevel(entry, 5)).toEqual({ damage: '6d6 force' });
    expect(resolveAtLevel(entry, 9)).toEqual({ damage: '6d6 force' });
  });
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run src/lib/spell-index/resolve.test.ts -t "fixed mode"`
Expected: FAIL

- [ ] **Step 3: Extend implementation**

```ts
// src/lib/spell-index/resolve.ts
import type { SpellIndexEntry, SpellLevelData } from './types';

export function resolveAtLevel(
  entry: SpellIndexEntry,
  castLevel: number
): SpellLevelData {
  if (!entry.heightening) return { ...entry.base };

  if (entry.heightening.mode === 'fixed') {
    const defined = Object.keys(entry.heightening.levels)
      .map((k) => Number(k))
      .filter((lvl) => lvl <= castLevel)
      .sort((a, b) => b - a);
    if (defined.length === 0) return { ...entry.base };
    return { ...entry.base, ...entry.heightening.levels[defined[0]] };
  }

  return { ...entry.base };
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/resolve.test.ts`
Expected: PASS (both tests).

### Step 2.3: Test — interval-mode heightening (damage)

- [ ] **Step 1: Add failing test**

Append to test file:

```ts
  test('interval mode adds delta per step', () => {
    const fireball = spell({
      slug: 'fireball',
      name: 'Fireball',
      baseLevel: 3,
      base: { damage: '6d6 fire' },
      heightening: {
        mode: 'interval',
        per: 1,
        delta: { damage: '+2d6 fire' }
      }
    });
    expect(resolveAtLevel(fireball, 3)).toEqual({ damage: '6d6 fire' });
    expect(resolveAtLevel(fireball, 4)).toEqual({ damage: '6d6 fire +2d6 fire' });
    expect(resolveAtLevel(fireball, 5)).toEqual({ damage: '6d6 fire +2d6 fire +2d6 fire' });
    expect(resolveAtLevel(fireball, 2)).toEqual({ damage: '6d6 fire' });
  });
```

(Note: the simplest implementation appends the delta `steps` times. A real dice-merger is out of scope; the UI consumes the resulting string verbatim. If string-concat reads ugly in the UI later, replace with a small `mergeDamage` utility — but not in v1.)

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run src/lib/spell-index/resolve.test.ts -t "interval mode"`
Expected: FAIL.

- [ ] **Step 3: Extend implementation**

```ts
// src/lib/spell-index/resolve.ts
import type { SpellIndexEntry, SpellLevelData } from './types';

export function resolveAtLevel(
  entry: SpellIndexEntry,
  castLevel: number
): SpellLevelData {
  if (!entry.heightening) return { ...entry.base };

  if (entry.heightening.mode === 'fixed') {
    const defined = Object.keys(entry.heightening.levels)
      .map((k) => Number(k))
      .filter((lvl) => lvl <= castLevel)
      .sort((a, b) => b - a);
    if (defined.length === 0) return { ...entry.base };
    return { ...entry.base, ...entry.heightening.levels[defined[0]] };
  }

  // interval mode
  const steps = Math.max(0, Math.floor((castLevel - entry.baseLevel) / entry.heightening.per));
  if (steps === 0) return { ...entry.base };
  const result: SpellLevelData = { ...entry.base };
  const deltaDamage = entry.heightening.delta.damage;
  if (deltaDamage && entry.base.damage) {
    result.damage = `${entry.base.damage}${` ${deltaDamage}`.repeat(steps)}`;
  } else if (deltaDamage) {
    result.damage = Array(steps).fill(deltaDamage.replace(/^\+/, '')).join(' +');
  }
  return result;
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/resolve.test.ts`
Expected: PASS (all three tests).

### Step 2.4: Test — cantrip heightening

- [ ] **Step 1: Add failing test**

```ts
  test('cantrips apply interval heightening based on entry.level', () => {
    const electricArc = spell({
      slug: 'electric-arc',
      name: 'Electric Arc',
      isCantrip: true,
      baseLevel: 1,
      base: { damage: '1d4 electricity' },
      heightening: {
        mode: 'interval',
        per: 2,
        delta: { damage: '+1d4 electricity' }
      }
    });
    expect(resolveAtLevel(electricArc, 1)).toEqual({ damage: '1d4 electricity' });
    expect(resolveAtLevel(electricArc, 3)).toEqual({ damage: '1d4 electricity +1d4 electricity' });
    expect(resolveAtLevel(electricArc, 5)).toEqual({ damage: '1d4 electricity +1d4 electricity +1d4 electricity' });
  });
```

- [ ] **Step 2: Run and verify PASS** (implementation already handles this)

Run: `npx vitest run src/lib/spell-index/resolve.test.ts`
Expected: PASS — no implementation change needed; the cantrip case is just interval mode at a different `per`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spell-index/resolve.ts src/lib/spell-index/resolve.test.ts
git commit -m "feat(spell-index): add resolveAtLevel heightening resolver"
```

---

## Task 3: `ensureSpellIndex` loader

**Files:**
- Create: `src/lib/spell-index/index.ts`
- Test: `src/lib/spell-index/index.test.ts`

### Step 3.1: Test — success path

- [ ] **Step 1: Write failing test**

```ts
// src/lib/spell-index/index.test.ts
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SpellIndexFile } from './types';
import { __resetForTests, ensureSpellIndex } from './index';

function file(): SpellIndexFile {
  return {
    version: 1,
    generatedAt: '2026-05-18T00:00:00Z',
    source: { repo: 'foundryvtt/pf2e', tag: 'test' },
    spells: [
      {
        slug: 'fireball',
        name: 'Fireball',
        baseLevel: 3,
        isCantrip: false,
        isFocus: false,
        actionCost: 2,
        traits: ['fire', 'evocation'],
        traditions: ['arcane', 'primal'],
        effectSummary: 'Burst of fire damage.',
        base: { damage: '6d6 fire' },
        aonUrl: 'https://2e.aonprd.com/Spells.aspx?ID=fireball'
      }
    ]
  };
}

afterEach(() => {
  __resetForTests();
  vi.unstubAllGlobals();
});

describe('ensureSpellIndex', () => {
  test('fetches index and exposes a slug lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(file()), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await ensureSpellIndex();

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.lookup('fireball')?.name).toBe('Fireball');
      expect(state.lookup('unknown-slug')).toBeUndefined();
    }
    expect(fetchMock).toHaveBeenCalledWith('/spell-index.json');
  });
});
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run src/lib/spell-index/index.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/spell-index/index.ts
import type { SpellIndexEntry, SpellIndexFile } from './types';

export type SpellIndexState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; lookup: (slug: string) => SpellIndexEntry | undefined }
  | { status: 'unavailable' };

let inflight: Promise<SpellIndexState> | null = null;
let cached: SpellIndexState = { status: 'idle' };

export async function ensureSpellIndex(): Promise<SpellIndexState> {
  if (cached.status === 'ready' || cached.status === 'unavailable') {
    return cached;
  }
  if (inflight) return inflight;

  inflight = (async (): Promise<SpellIndexState> => {
    try {
      const res = await fetch('/spell-index.json');
      if (!res.ok) {
        cached = { status: 'unavailable' };
        return cached;
      }
      const payload = (await res.json()) as SpellIndexFile;
      const bySlug = new Map(payload.spells.map((s) => [s.slug, s]));
      cached = {
        status: 'ready',
        lookup: (slug: string) => bySlug.get(slug)
      };
      return cached;
    } catch (err) {
      console.warn('spell-index: failed to load', err);
      cached = { status: 'unavailable' };
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function __resetForTests(): void {
  cached = { status: 'idle' };
  inflight = null;
}

export { resolveAtLevel } from './resolve';
export type {
  SpellActionCost,
  SpellDefense,
  SpellHeightening,
  SpellIndexEntry,
  SpellIndexFile,
  SpellLevelData,
  SpellTradition
} from './types';
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/index.test.ts`
Expected: PASS.

### Step 3.2: Test — 404 response → unavailable

- [ ] **Step 1: Add test**

```ts
  test('404 response leaves index unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    );
    const state = await ensureSpellIndex();
    expect(state.status).toBe('unavailable');
  });
```

- [ ] **Step 2: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/index.test.ts`
Expected: PASS (implementation already handles 404).

### Step 3.3: Test — malformed JSON → unavailable

- [ ] **Step 1: Add test**

```ts
  test('malformed JSON leaves index unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{not valid', { status: 200 }))
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = await ensureSpellIndex();
    expect(state.status).toBe('unavailable');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
```

- [ ] **Step 2: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/index.test.ts`
Expected: PASS.

### Step 3.4: Test — concurrent calls dedupe to one fetch

- [ ] **Step 1: Add test**

```ts
  test('concurrent calls share one fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(file()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b, c] = await Promise.all([
      ensureSpellIndex(),
      ensureSpellIndex(),
      ensureSpellIndex()
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.status).toBe('ready');
    expect(b.status).toBe('ready');
    expect(c.status).toBe('ready');
  });
```

- [ ] **Step 2: Run and verify PASS**

Run: `npx vitest run src/lib/spell-index/index.test.ts`
Expected: PASS — the `inflight` guard already handles dedupe.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spell-index/index.ts src/lib/spell-index/index.test.ts
git commit -m "feat(spell-index): add ensureSpellIndex loader with in-memory cache"
```

---

## Task 4: Foundry transform — pure function with fixtures

**Files:**
- Create: `scripts/spell-index/transform.ts`
- Create: `scripts/spell-index/transform.test.ts`
- Create: `scripts/spell-index/fixtures/fireball.json` (real Foundry spell, copy from foundryvtt/pf2e repo at the pinned tag)
- Create: `scripts/spell-index/fixtures/electric-arc.json` (cantrip example, also copied)
- Create: `scripts/spell-index/fixtures/blindness.json` (fixed-mode heightening example)

> **Discovery note for the engineer:** Foundry's spell pack lives at `https://github.com/foundryvtt/pf2e/tree/master/packs/spells`. Pick a recent stable release tag — at the time of writing, choose the most recent release available (e.g. `release-6.x.x`); record the exact tag in `scripts/spell-index/transform.ts` as a `SOURCE_TAG` constant. Each spell is a single JSON file named `<slug>.json`. Download the three fixtures from that tag's `packs/spells/` directory. Do NOT hand-author them — the test value comes from matching real upstream shapes.

### Step 4.1: Add fixtures

- [ ] **Step 1: Identify pinned source tag**

Visit `https://github.com/foundryvtt/pf2e/releases`. Pick the most recent stable release (avoid pre-release tags). Record the tag string.

- [ ] **Step 2: Download three fixture spells**

Save the raw JSON files (unmodified) to:
- `scripts/spell-index/fixtures/fireball.json`
- `scripts/spell-index/fixtures/electric-arc.json`
- `scripts/spell-index/fixtures/blindness.json`

These exercise: interval damage heightening (fireball), cantrip interval heightening (electric-arc), and a status-effect spell with fixed heightening or no damage heightening (blindness).

> **Note for the engineer:** if Foundry's master moved field names between when this plan was written (2026-05-18) and now, the test assertions below may need adjustment — but the structure (slug, name, level, traits, traditions, heightening) is stable across recent releases.

### Step 4.2: Test — transformSpell extracts core fields

- [ ] **Step 1: Write failing test**

```ts
// scripts/spell-index/transform.test.ts
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSpell } from './transform';

function fixture(name: string): unknown {
  const raw = readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

describe('transformSpell', () => {
  test('fireball: interval heightening, save defense, traits', () => {
    const result = transformSpell(fixture('fireball'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const spell = result.value;
    expect(spell.slug).toBe('fireball');
    expect(spell.name).toBe('Fireball');
    expect(spell.baseLevel).toBe(3);
    expect(spell.isCantrip).toBe(false);
    expect(spell.traits).toContain('fire');
    expect(spell.traditions).toContain('arcane');
    expect(spell.defense?.kind).toBe('save');
    expect(spell.defense?.save).toBe('reflex');
    expect(spell.defense?.basic).toBe(true);
    expect(spell.heightening?.mode).toBe('interval');
    expect(spell.effectSummary.length).toBeGreaterThan(0);
    expect(spell.effectSummary.length).toBeLessThanOrEqual(200);
  });

  test('electric-arc: cantrip flag', () => {
    const result = transformSpell(fixture('electric-arc'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isCantrip).toBe(true);
  });

  test('blindness: no damage in base or heightening', () => {
    const result = transformSpell(fixture('blindness'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.base.damage).toBeUndefined();
  });

  test('rejects non-spell input', () => {
    const result = transformSpell({ type: 'feat', name: 'Power Attack' });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run scripts/spell-index/transform.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement transform**

```ts
// scripts/spell-index/transform.ts
import type {
  SpellActionCost,
  SpellDefense,
  SpellHeightening,
  SpellIndexEntry,
  SpellLevelData,
  SpellTradition
} from '../../src/lib/spell-index/types';
import { stripFoundryMarkup } from '../../src/lib/foundry/text';

export type TransformResult =
  | { ok: true; value: SpellIndexEntry }
  | { ok: false; reason: string };

interface FoundrySpell {
  name?: string;
  type?: string;
  system?: {
    level?: { value?: number };
    traits?: {
      value?: string[];
      traditions?: string[];
    };
    time?: { value?: string };
    range?: { value?: string };
    area?: { value?: number | string; type?: string };
    target?: { value?: string };
    duration?: { value?: string };
    cantrip?: boolean;
    category?: string;
    defense?: {
      save?: { basic?: boolean; statistic?: string };
      passive?: { statistic?: string };
    };
    damage?: Record<string, { formula?: string; type?: string }>;
    heightening?: {
      type?: 'fixed' | 'interval';
      interval?: number;
      damage?: Record<string, { formula?: string; type?: string }>;
      levels?: Record<string, { damage?: Record<string, { formula?: string; type?: string }> }>;
    };
    description?: { value?: string };
    publication?: { title?: string };
  };
  _id?: string;
}

const TRADITION_SET: ReadonlySet<string> = new Set(['arcane', 'divine', 'occult', 'primal']);

export function transformSpell(input: unknown): TransformResult {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'not an object' };
  const spell = input as FoundrySpell;
  if (spell.type !== 'spell') return { ok: false, reason: `type is ${spell.type}` };

  const name = spell.name?.trim();
  if (!name) return { ok: false, reason: 'missing name' };

  const slug = slugify(name);
  const level = spell.system?.level?.value;
  if (typeof level !== 'number') return { ok: false, reason: 'missing level' };

  const isCantrip = spell.system?.cantrip === true || spell.system?.traits?.value?.includes('cantrip') === true;
  const isFocus = spell.system?.category === 'focus';

  const traditions = (spell.system?.traits?.traditions ?? []).filter((t): t is SpellTradition =>
    TRADITION_SET.has(t)
  );
  const traits = (spell.system?.traits?.value ?? []).filter((t): t is string => typeof t === 'string');

  return {
    ok: true,
    value: {
      slug,
      name,
      baseLevel: level,
      isCantrip,
      isFocus,
      actionCost: parseActionCost(spell.system?.time?.value),
      traits,
      traditions,
      range: spell.system?.range?.value || undefined,
      area: formatArea(spell.system?.area),
      targets: spell.system?.target?.value || undefined,
      duration: spell.system?.duration?.value || undefined,
      defense: parseDefense(spell.system?.defense),
      effectSummary: extractSummary(spell.system?.description?.value),
      base: parseBaseDamage(spell.system?.damage),
      heightening: parseHeightening(spell.system?.heightening),
      aonUrl: aonSearchUrl(name)
    }
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseActionCost(time: string | undefined): SpellActionCost {
  if (!time) return 'varies';
  if (time === '1' || time === '2' || time === '3') return Number(time) as 1 | 2 | 3;
  if (time === 'reaction') return 'reaction';
  if (time === 'free') return 'free';
  return 'varies';
}

function formatArea(area: { value?: number | string; type?: string } | undefined): string | undefined {
  if (!area || area.value === undefined || area.value === '') return undefined;
  if (typeof area.value === 'number' && area.type) return `${area.value}-foot ${area.type}`;
  return String(area.value);
}

function parseDefense(
  def: NonNullable<FoundrySpell['system']>['defense']
): SpellDefense | undefined {
  if (def?.save?.statistic) {
    const stat = def.save.statistic;
    if (stat === 'fortitude' || stat === 'reflex' || stat === 'will') {
      return { kind: 'save', save: stat, basic: def.save.basic === true };
    }
  }
  if (def?.passive) {
    return { kind: 'attack' };
  }
  return undefined;
}

function parseBaseDamage(
  damage: Record<string, { formula?: string; type?: string }> | undefined
): SpellLevelData {
  if (!damage) return {};
  const parts: string[] = [];
  for (const entry of Object.values(damage)) {
    if (entry.formula) parts.push(`${entry.formula}${entry.type ? ` ${entry.type}` : ''}`);
  }
  return parts.length > 0 ? { damage: parts.join(' + ') } : {};
}

function parseHeightening(
  h: NonNullable<FoundrySpell['system']>['heightening']
): SpellHeightening | undefined {
  if (!h) return undefined;
  if (h.type === 'interval' && typeof h.interval === 'number' && h.damage) {
    const damage = parseBaseDamage(h.damage);
    if (!damage.damage) return undefined;
    return {
      mode: 'interval',
      per: h.interval,
      delta: { damage: damage.damage.startsWith('+') ? damage.damage : `+${damage.damage}` }
    };
  }
  if (h.type === 'fixed' && h.levels) {
    const levels: Record<number, Partial<SpellLevelData>> = {};
    for (const [key, val] of Object.entries(h.levels)) {
      const lvl = Number(key);
      if (!Number.isFinite(lvl)) continue;
      const dmg = parseBaseDamage(val.damage);
      if (dmg.damage) levels[lvl] = { damage: dmg.damage };
    }
    if (Object.keys(levels).length === 0) return undefined;
    return { mode: 'fixed', levels };
  }
  return undefined;
}

function extractSummary(html: string | undefined): string {
  if (!html) return '';
  const stripped = stripFoundryMarkup(html).trim();
  if (!stripped) return '';
  const firstSentenceMatch = stripped.match(/^.+?[.!?](?=\s|$)/);
  const summary = (firstSentenceMatch?.[0] ?? stripped.split('\n')[0]).trim();
  return summary.length > 200 ? summary.slice(0, 197) + '...' : summary;
}

function aonSearchUrl(name: string): string {
  return `https://2e.aonprd.com/Search.aspx?Query=${encodeURIComponent(name)}&type=spell`;
}
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run scripts/spell-index/transform.test.ts`
Expected: PASS.

> **If tests fail because Foundry's field names differ from what's coded above:** the engineer should open one fixture file, locate the actual field path (e.g., `system.defense.save.statistic` may be `system.save.value`), and adjust both the `FoundrySpell` interface and the field accessor. Do NOT mutate the fixture — the fixture is ground truth.

- [ ] **Step 5: Commit**

```bash
git add scripts/spell-index/
git commit -m "feat(spell-index): add Foundry transform and fixtures"
```

---

## Task 5: Import script — glue and run

**Files:**
- Create: `scripts/import-spells.ts`
- Create: `static/spell-index.json` (generated, committed)
- Modify: `package.json` — add `"spells:import": "tsx scripts/import-spells.ts"`

### Step 5.1: Write the import script

- [ ] **Step 1: Implement**

```ts
// scripts/import-spells.ts
/**
 * Maintainer-only: refresh static/spell-index.json from Foundry pf2e spell pack.
 *
 * Usage:
 *   npm run spells:import
 *
 * Requires `FOUNDRY_PF2E_DIR` env var pointing at a local clone of
 * github.com/foundryvtt/pf2e checked out at the desired release tag.
 *
 * Why a local clone vs. fetching from GitHub at runtime: the script stays
 * deterministic and offline-capable, and the operator can preview the source
 * data before regenerating.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { transformSpell } from './spell-index/transform';
import type { SpellIndexEntry, SpellIndexFile } from '../src/lib/spell-index/types';

const SRC = process.env.FOUNDRY_PF2E_DIR;
if (!SRC) {
  console.error('Set FOUNDRY_PF2E_DIR to a local clone of foundryvtt/pf2e checked out at the desired tag.');
  process.exit(1);
}

function detectSourceTag(repoDir: string): string {
  try {
    return execSync('git describe --tags --always', { cwd: repoDir }).toString().trim();
  } catch {
    return 'unknown';
  }
}
const SOURCE_TAG = detectSourceTag(SRC);

const SPELLS_DIR = join(SRC, 'packs', 'spells');
if (!existsSync(SPELLS_DIR)) {
  console.error(`Spells dir not found: ${SPELLS_DIR}`);
  process.exit(1);
}

const files = readdirSync(SPELLS_DIR).filter((f) => f.endsWith('.json'));
const spells: SpellIndexEntry[] = [];
const issues: { file: string; reason: string }[] = [];

for (const f of files) {
  const text = readFileSync(join(SPELLS_DIR, f), 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    issues.push({ file: f, reason: `JSON parse error: ${(err as Error).message}` });
    continue;
  }
  const result = transformSpell(parsed);
  if (result.ok) {
    spells.push(result.value);
  } else {
    issues.push({ file: f, reason: result.reason });
  }
}

spells.sort((a, b) => a.slug.localeCompare(b.slug));

const output: SpellIndexFile = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: { repo: 'foundryvtt/pf2e', tag: SOURCE_TAG },
  spells
};

writeFileSync(join(process.cwd(), 'static', 'spell-index.json'), JSON.stringify(output));

console.log(`Imported ${spells.length} spells from ${files.length} files.`);
console.log(`  cantrips: ${spells.filter((s) => s.isCantrip).length}`);
console.log(`  with heightening: ${spells.filter((s) => s.heightening).length}`);
console.log(`  with damage: ${spells.filter((s) => s.base.damage).length}`);
if (issues.length > 0) {
  console.warn(`\nSkipped ${issues.length} files:`);
  for (const i of issues.slice(0, 20)) console.warn(`  ${i.file}: ${i.reason}`);
  if (issues.length > 20) console.warn(`  ... and ${issues.length - 20} more.`);
}
```

- [ ] **Step 2: Add npm script**

Edit `package.json`'s `"scripts"` block — add:

```json
"spells:import": "tsx scripts/import-spells.ts"
```

### Step 5.2: Run the import to produce the static asset

- [ ] **Step 1: Clone Foundry pf2e at the pinned tag**

Outside this repo (e.g., in a sibling directory):

1. Visit `https://github.com/foundryvtt/pf2e/releases` and pick the most recent stable release tag (avoid pre-release tags).
2. Clone at that tag:

```bash
git clone --depth=1 --branch <PINNED_TAG> https://github.com/foundryvtt/pf2e.git ../foundryvtt-pf2e
```

The import script auto-detects the tag via `git describe`, so the choice is recorded automatically in `static/spell-index.json`'s `source.tag` field.

- [ ] **Step 2: Run the import**

```powershell
$env:FOUNDRY_PF2E_DIR = "..\foundryvtt-pf2e"; npm run spells:import
```

(bash equivalent: `FOUNDRY_PF2E_DIR=../foundryvtt-pf2e npm run spells:import`)

Expected: console output reports ~1500–2500 spells imported, with cantrip/heightening/damage stats. `static/spell-index.json` now exists.

- [ ] **Step 3: Sanity-check the output**

```powershell
$json = Get-Content static/spell-index.json -Raw | ConvertFrom-Json
$json.spells.Count
$json.spells | Where-Object { $_.slug -eq "fireball" } | Format-List slug, baseLevel, base, heightening
```

Expected: a non-empty list; the fireball record has `baseLevel: 3`, base damage `6d6 fire`, interval heightening with `+2d6 fire`.

- [ ] **Step 4: Commit the static asset and the package.json change**

```bash
git add static/spell-index.json scripts/import-spells.ts package.json
git commit -m "feat(spell-index): generate static/spell-index.json from Foundry pf2e"
```

---

## Task 6: `SpellRow` component (new)

**Files:**
- Create: `src/components/details/SpellRow.svelte`
- Test: `src/components/details/SpellRow.test.ts`

The row encapsulates one spell entry's render + expand state. Used by `SpellcastingBlockView` in all four type branches.

### Step 6.1: Test — collapsed state renders name + count

- [ ] **Step 1: Write failing test**

```ts
// src/components/details/SpellRow.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SpellRow from './SpellRow.svelte';
import { __resetForTests } from '$lib/spell-index';
import type { SpellListEntry } from '../../domain';

function entry(over: Partial<SpellListEntry> = {}): SpellListEntry {
  return {
    spellSlug: over.spellSlug ?? 'fireball',
    name: over.name ?? 'Fireball',
    level: over.level ?? 3,
    ...over
  };
}

beforeEach(() => {
  __resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SpellRow', () => {
  test('renders the spell name and count in collapsed state', () => {
    render(SpellRow, {
      entry: entry({ count: 2 }),
      dc: 22,
      attackModifier: 12
    });
    expect(screen.getByText(/Fireball/)).toBeTruthy();
    expect(screen.getByText(/×2/)).toBeTruthy();
    // No expanded panel
    expect(screen.queryByText(/Archives of Nethys/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run src/components/details/SpellRow.test.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement collapsed-only version**

```svelte
<!-- src/components/details/SpellRow.svelte -->
<script lang="ts">
  import type { SpellListEntry } from '../../domain';
  export let entry: SpellListEntry;
  export let dc: number;
  export let attackModifier: number | undefined = undefined;

  // attached for future use; silences "unused export" lint until expansion lands
  $: void dc;
  $: void attackModifier;

  $: countSuffix = entry.count && entry.count > 1 ? ` (×${entry.count})` : '';
</script>

<li class="spell-row">
  <span class="spell-row__name">{entry.name}{countSuffix}</span>
</li>

<style>
  .spell-row {
    display: flex;
    flex-direction: column;
  }
  .spell-row__name {
    /* inherit existing list styles */
  }
</style>
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run src/components/details/SpellRow.test.ts`
Expected: PASS.

### Step 6.2: Test — click expands and reveals mechanics

- [ ] **Step 1: Stub the spell index and add expand test**

Add at the top of `SpellRow.test.ts` (replace the `beforeEach`):

```ts
import type { SpellIndexFile } from '$lib/spell-index';

function stubIndex(spells: SpellIndexFile['spells']): void {
  const file: SpellIndexFile = {
    version: 1,
    generatedAt: '2026-05-18T00:00:00Z',
    source: { repo: 'foundryvtt/pf2e', tag: 'test' },
    spells
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 200 }))
  );
}

beforeEach(() => {
  __resetForTests();
});
```

Then add:

```ts
  test('clicking the row expands and shows mechanics from the spell index', async () => {
    stubIndex([
      {
        slug: 'fireball',
        name: 'Fireball',
        baseLevel: 3,
        isCantrip: false,
        isFocus: false,
        actionCost: 2,
        traits: ['fire', 'evocation'],
        traditions: ['arcane', 'primal'],
        range: '500 feet',
        area: '20-foot burst',
        defense: { kind: 'save', save: 'reflex', basic: true },
        effectSummary: 'A roaring blast of fire deals damage to creatures in a burst.',
        base: { damage: '6d6 fire' },
        heightening: { mode: 'interval', per: 1, delta: { damage: '+2d6 fire' } },
        aonUrl: 'https://2e.aonprd.com/Search.aspx?Query=Fireball&type=spell'
      }
    ]);

    render(SpellRow, {
      entry: entry({ level: 5 }),
      dc: 22,
      attackModifier: 12
    });

    await fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));

    // For fireball cast at rank 5 with base 6d6 fire and interval delta "+2d6 fire" per rank,
    // resolveAtLevel produces "6d6 fire +2d6 fire +2d6 fire" (2 heightening steps).
    expect(await screen.findByText(/Reflex DC 22 \(basic\)/)).toBeTruthy();
    expect(screen.getByText(/6d6 fire \+2d6 fire \+2d6 fire/)).toBeTruthy();
    expect(screen.getByText(/heightened from rank 3/)).toBeTruthy();
    expect(screen.getByText(/Archives of Nethys/)).toBeTruthy();
  });
```

- [ ] **Step 2: Run and verify FAIL**

Run: `npx vitest run src/components/details/SpellRow.test.ts -t "expands"`
Expected: FAIL — no expand behavior yet.

- [ ] **Step 3: Implement expand behavior**

Replace `SpellRow.svelte` with:

```svelte
<!-- src/components/details/SpellRow.svelte -->
<script lang="ts">
  import type { SpellListEntry } from '../../domain';
  import { ensureSpellIndex, resolveAtLevel } from '$lib/spell-index';
  import type { SpellIndexEntry, SpellIndexState } from '$lib/spell-index';

  export let entry: SpellListEntry;
  export let dc: number;
  export let attackModifier: number | undefined = undefined;

  let expanded = false;
  let indexState: SpellIndexState = { status: 'idle' };

  $: countSuffix = entry.count && entry.count > 1 ? ` (×${entry.count})` : '';

  async function toggleExpand() {
    if (!expanded && indexState.status === 'idle') {
      indexState = { status: 'loading' };
      indexState = await ensureSpellIndex();
    }
    expanded = !expanded;
  }

  function resolvedEntry(state: SpellIndexState): SpellIndexEntry | undefined {
    if (state.status !== 'ready') return undefined;
    return state.lookup(entry.spellSlug);
  }

  function defenseLine(spell: SpellIndexEntry): string {
    if (!spell.defense) return '';
    if (spell.defense.kind === 'attack') {
      const sign = (attackModifier ?? 0) >= 0 ? '+' : '';
      return `Spell attack ${sign}${attackModifier ?? 0}`;
    }
    const save = spell.defense.save ? capitalize(spell.defense.save) : 'Save';
    const basic = spell.defense.basic ? ' (basic)' : '';
    return `${save} DC ${dc}${basic}`;
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatActionCost(cost: SpellIndexEntry['actionCost']): string {
    if (cost === 1) return '◆';
    if (cost === 2) return '◆◆';
    if (cost === 3) return '◆◆◆';
    if (cost === 'reaction') return '↺';
    if (cost === 'free') return '◇';
    return '—';
  }
</script>

<li class="spell-row" class:expanded>
  <button
    type="button"
    class="spell-row__toggle"
    aria-expanded={expanded}
    onclick={toggleExpand}
  >
    <span class="spell-row__caret">{expanded ? '▾' : '▸'}</span>
    <span class="spell-row__name">{entry.name}{countSuffix}</span>
  </button>

  {#if expanded}
    {#if indexState.status === 'loading'}
      <div class="spell-row__panel">Loading…</div>
    {:else if indexState.status === 'ready'}
      {@const spell = resolvedEntry(indexState)}
      {#if spell}
        {@const resolved = resolveAtLevel(spell, entry.level)}
        <div class="spell-row__panel">
          <div class="spell-row__line">
            <span>{formatActionCost(spell.actionCost)}</span>
            {#if spell.range}<span>· Range {spell.range}</span>{/if}
            {#if spell.area}<span>· Area {spell.area}</span>{/if}
            {#if spell.targets}<span>· Targets {spell.targets}</span>{/if}
          </div>
          {#if spell.defense}
            <div class="spell-row__line">{defenseLine(spell)}</div>
          {/if}
          {#if resolved.damage}
            <div class="spell-row__line">
              <strong>{resolved.damage}</strong>
              {#if entry.level > spell.baseLevel}
                <span class="spell-row__heightened">heightened from rank {spell.baseLevel}</span>
              {/if}
            </div>
          {/if}
          {#if spell.traits.length > 0}
            <div class="spell-row__traits">
              {#each spell.traits.slice(0, 6) as t (t)}
                <span class="spell-row__trait">{t}</span>
              {/each}
            </div>
          {/if}
          {#if spell.effectSummary}
            <div class="spell-row__summary">{spell.effectSummary}</div>
          {/if}
          <a class="spell-row__aon" href={spell.aonUrl} target="_blank" rel="noopener">
            View on Archives of Nethys ↗
          </a>
        </div>
      {:else}
        <div class="spell-row__panel">
          <a
            class="spell-row__aon"
            href={`https://2e.aonprd.com/Search.aspx?Query=${encodeURIComponent(entry.name)}&type=spell`}
            target="_blank"
            rel="noopener"
          >
            Search Archives of Nethys ↗
          </a>
        </div>
      {/if}
    {:else}
      <div class="spell-row__panel">
        <a
          class="spell-row__aon"
          href={`https://2e.aonprd.com/Search.aspx?Query=${encodeURIComponent(entry.name)}&type=spell`}
          target="_blank"
          rel="noopener"
        >
          Search Archives of Nethys ↗
        </a>
      </div>
    {/if}
  {/if}
</li>

<style>
  .spell-row {
    display: flex;
    flex-direction: column;
  }
  .spell-row__toggle {
    display: flex;
    gap: 0.25rem;
    align-items: baseline;
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .spell-row__caret {
    display: inline-block;
    width: 0.75rem;
    opacity: 0.7;
  }
  .spell-row__panel {
    padding: 0.25rem 0 0.5rem 1rem;
    font-size: 0.9em;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .spell-row__line {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .spell-row__heightened {
    opacity: 0.7;
    font-size: 0.85em;
    font-style: italic;
  }
  .spell-row__traits {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .spell-row__trait {
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0 0.3em;
    font-size: 0.8em;
    opacity: 0.8;
  }
  .spell-row__summary {
    opacity: 0.9;
  }
  .spell-row__aon {
    margin-top: 0.25rem;
  }
</style>
```

- [ ] **Step 4: Run and verify PASS**

Run: `npx vitest run src/components/details/SpellRow.test.ts`
Expected: PASS (both tests). If the heightened damage string assertion fails, replace the regex with the literal output of `resolveAtLevel` (see note in Step 6.2.1).

### Step 6.3: Test — fallback when slug missing

- [ ] **Step 1: Add test**

```ts
  test('shows AoN search fallback when slug not in index', async () => {
    stubIndex([]); // empty index

    render(SpellRow, {
      entry: entry({ spellSlug: 'unknown-spell', name: 'Mystery Hex', level: 4 }),
      dc: 22
    });

    await fireEvent.click(screen.getByRole('button', { name: /Mystery Hex/ }));
    expect(await screen.findByText(/Search Archives of Nethys/)).toBeTruthy();
  });
```

- [ ] **Step 2: Run and verify PASS**

Run: `npx vitest run src/components/details/SpellRow.test.ts`
Expected: PASS — implementation already handles fallback.

### Step 6.4: Test — heightened caption only appears when cast level > base

- [ ] **Step 1: Add test**

```ts
  test('omits heightened caption when cast level matches base', async () => {
    stubIndex([
      {
        slug: 'fireball',
        name: 'Fireball',
        baseLevel: 3,
        isCantrip: false,
        isFocus: false,
        actionCost: 2,
        traits: ['fire'],
        traditions: ['arcane'],
        defense: { kind: 'save', save: 'reflex', basic: true },
        effectSummary: 'Fire damage.',
        base: { damage: '6d6 fire' },
        heightening: { mode: 'interval', per: 1, delta: { damage: '+2d6 fire' } },
        aonUrl: 'https://example.invalid'
      }
    ]);

    render(SpellRow, { entry: entry({ level: 3 }), dc: 22 });
    await fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));
    await screen.findByText(/6d6 fire/);
    expect(screen.queryByText(/heightened from/)).toBeNull();
  });
```

- [ ] **Step 2: Run and verify PASS**

Run: `npx vitest run src/components/details/SpellRow.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/details/SpellRow.svelte src/components/details/SpellRow.test.ts
git commit -m "feat(spells): add SpellRow component with expand-on-click panel"
```

---

## Task 7: Wire `SpellRow` into `SpellcastingBlockView`

**Files:**
- Modify: `src/components/details/SpellcastingBlockView.svelte`
- Modify: `src/components/details/SpellcastingBlockView.test.ts`

### Step 7.1: Replace inline list rendering with `<SpellRow>`

- [ ] **Step 1: Import the new component**

In `SpellcastingBlockView.svelte`, add to the `<script>` block:

```ts
  import SpellRow from './SpellRow.svelte';
```

- [ ] **Step 2: Replace each occurrence of the inline `<li>` rendering**

Find every block that currently looks like:

```svelte
{#each rank.entries as entry, i (i)}
  <li>{entry.name}{entry.count > 1 ? ` (×${entry.count})` : ''}</li>
{/each}
```

Replace with:

```svelte
{#each rank.entries as entry, i (i)}
  <SpellRow
    entry={entry}
    dc={view.header.dc + dcBonus}
    attackModifier={view.header.attackModifier !== undefined
      ? view.header.attackModifier + attackBonus
      : undefined}
  />
{/each}
```

Do this for the prepared, spontaneous, focus, and innate branches. Search for `entry.name}{entry.count` in the file to find all four call sites.

> **Important:** the innate branch may render its entries with frequency markers (e.g., "at will", "3/day") attached to the entry. Make sure SpellRow renders the entry's name without losing whatever frequency display was inline. If the frequency display was a sibling of the `<li>` (separate column/span), leave that sibling untouched; only replace the spell-name `<li>` content. If the frequency was inside the same `<li>`, restructure so the frequency renders as a sibling of `<SpellRow>` inside the parent container.

- [ ] **Step 3: Run the existing component test**

Run: `npx vitest run src/components/details/SpellcastingBlockView.test.ts`
Expected: existing tests still pass. If any assert against the `<li>` structure directly, update them to expect the SpellRow rendering. The toggle button now wraps the name, but the spell name text itself remains in the DOM.

### Step 7.2: Add an integration test — block view expands a row

- [ ] **Step 1: Add test to `SpellcastingBlockView.test.ts`**

```ts
test('expands a spell row to show mechanics from the spell index', async () => {
  const file = {
    version: 1,
    generatedAt: '2026-05-18T00:00:00Z',
    source: { repo: 'foundryvtt/pf2e', tag: 'test' },
    spells: [
      {
        slug: 'magic-missile',
        name: 'Magic Missile',
        baseLevel: 1,
        isCantrip: false,
        isFocus: false,
        actionCost: 'varies',
        traits: ['force'],
        traditions: ['arcane', 'occult'],
        defense: undefined,
        effectSummary: 'Force projectile hits without a roll.',
        base: { damage: '1d4+1 force' },
        aonUrl: 'https://example.invalid'
      }
    ]
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 200 }))
  );
  const { __resetForTests } = await import('$lib/spell-index');
  __resetForTests();

  render(SpellcastingBlockView, {
    block: preparedBlock(),
    onUseSlot: vi.fn(),
    onRestoreSlot: vi.fn(),
    onUseFocus: vi.fn(),
    onRestoreFocus: vi.fn(),
    onUseInnate: vi.fn(),
    onRestoreInnate: vi.fn()
  });

  await fireEvent.click(screen.getByRole('button', { name: /Magic Missile/ }));
  expect(await screen.findByText(/1d4\+1 force/)).toBeTruthy();
  expect(screen.getByText(/Archives of Nethys/)).toBeTruthy();
});
```

- [ ] **Step 2: Run and verify PASS**

Run: `npx vitest run src/components/details/SpellcastingBlockView.test.ts`
Expected: PASS.

### Step 7.3: Verify pre-PR gate

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: PASS, no new errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/details/SpellcastingBlockView.svelte src/components/details/SpellcastingBlockView.test.ts
git commit -m "feat(spells): render SpellRow inside SpellcastingBlockView"
```

---

## Task 8: ORC attribution surface

**Files:**
- Modify: `src/routes/+layout.svelte` (or whichever existing file holds the page footer / about link — discover during this task)

### Step 8.1: Find the right surface

- [ ] **Step 1: Locate the existing footer or about/settings link**

Run: `Get-ChildItem src/routes -Recurse -Filter "+layout.svelte"` — read `src/routes/+layout.svelte`. If a footer exists, append the attribution there. If no footer exists, add a small footer inside the layout's outer wrapper.

### Step 8.2: Add the attribution

- [ ] **Step 1: Insert the attribution block**

Add to the chosen surface (this is the minimum content required by ORC):

```svelte
<footer class="orc-attribution">
  Spell data adapted from the
  <a href="https://github.com/foundryvtt/pf2e" target="_blank" rel="noopener">Foundry VTT pf2e system</a>,
  derived from Pathfinder content published under the
  <a href="https://paizo.com/orc" target="_blank" rel="noopener">ORC License</a>.
  Pathfinder is © Paizo Inc.
</footer>
```

> **Note:** if a more comprehensive about/credits page exists in the app, move this block there and replace this with a link.

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Open `http://localhost:5173/`. The attribution renders somewhere visible (footer is fine). Close the dev server.

- [ ] **Step 3: Run the gate**

Run: `npm run check && npm run test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/
git commit -m "feat(spells): add ORC attribution for Foundry pf2e data"
```

---

## Task 9: Final pre-PR gate + manual smoke

### Step 9.1: Full pre-PR gate

- [ ] **Step 1: Run the documented gate**

Run: `npm run check && npm run test:run && npm run audit && npm run build`
Expected: all four green. Investigate and fix any new failure.

### Step 9.2: Manual smoke at `npm run dev`

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the happy path**

In a browser at the dev URL:
1. Open an encounter that includes a known spellcasting creature (e.g., Yaashka — has Blindness rank 3, Harm rank 3, Heal rank 3).
2. Open the combatant card and scroll to the spellcasting block.
3. Click "Blindness" → row expands. Verify save line, AoN link, traits.
4. Click "Harm" cast at rank 3 → verify the heightened damage equals base (no "heightened from" caption).
5. (If a higher-rank cast exists in the dataset) click a heightened spell → verify the "heightened from rank N" caption appears and the damage reflects the cast level.
6. Click a USE pip in the slot row → slot decrements, the expanded panel does NOT collapse, the expanded panel for an unrelated row does not toggle.
7. Click the AoN link → opens a working page (or the search results, if fallback).
8. Falsify a slug in a local creature YAML to one that's definitely not in the index → row renders name only with no expand affordance error; clicking shows the "Search Archives of Nethys" fallback.

- [ ] **Step 3: Stop the dev server**

Press Ctrl+C in the dev terminal.

### Step 9.3: Open the PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/spell-enrichment-spec
```

(Or your actual branch name if different — verify with `git branch --show-current`.)

- [ ] **Step 2: Open the PR**

Use the commit log to generate the body. PR title: `feat(spells): enrich spellcasting block with heightened mechanics + AoN links`. Body includes a Summary and a Test plan referencing the manual smoke checklist above.

---

## Spec coverage check (self-review record)

| Spec section | Covered by |
|---|---|
| Foundry-pf2e bundled dataset | Tasks 4, 5 |
| `SpellIndexEntry` shape | Task 1 |
| In-memory cache (no IndexedDB) | Task 3 |
| `resolveAtLevel` for fixed + interval | Task 2 |
| Cantrip handling | Task 2.4 |
| Expand-on-click row | Task 6 |
| Mechanics line + heightened caption | Task 6.2 + Task 6.4 |
| AoN link in expansion | Task 6.2 |
| Fallback for missing slug | Task 6.3 |
| Fallback for failed index fetch | Task 3.2 + Task 6 (state branch) |
| USE/RESTORE buttons untouched | Task 7.1 (existing tests stay green) |
| ORC attribution | Task 8 |
| Maintainer-only import script | Task 5 |
| Domain purity preserved | enforced by `npm run check`, verified Task 9.1 |
