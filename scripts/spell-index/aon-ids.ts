// scripts/spell-index/aon-ids.ts
//
// Resolve direct Archives of Nethys URLs for spells/rituals by name.
//
// The Foundry pf2e source data does NOT carry AoN identifiers, so we resolve
// them at build time against AoN's public Elasticsearch index and bake the
// resulting `Spells.aspx?ID=…` / `Rituals.aspx?ID=…` links straight into
// static/spell-index.json. The runtime stays a static JSON read — no external
// calls, no IDs to look up in the browser.
//
// Matching is by normalized name (+ level as a tiebreak). Because our source is
// the remastered Foundry data, name matching naturally lands on the remastered
// AoN entry for renamed spells (e.g. "Force Barrage", not "Magic Missile").

const ES_URL = 'https://elasticsearch.aonprd.com/aon/_search';
const AON_BASE = 'https://2e.aonprd.com';

/** Minimal shape of an AoN Elasticsearch `_source` document we rely on. */
export interface AonDoc {
  /** e.g. "spell-119" or "ritual-6". */
  id: string;
  name: string;
  level?: number;
  /** Present on a legacy entry that has been superseded by a remastered one. */
  remaster_id?: string[];
}

interface AonRef {
  kind: 'spell' | 'ritual';
  num: number;
  level?: number;
  /** True for a legacy entry replaced by a remastered version. */
  superseded: boolean;
}

export type AonIndex = Map<string, AonRef[]>;

/**
 * Normalize a spell name into a stable match key. Mirrors the index slugify
 * rules (drop apostrophes, fold every other non-alphanumeric run to a single
 * separator) so both sides key identically.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseId(id: string): { kind: 'spell' | 'ritual'; num: number } | undefined {
  const dash = id.indexOf('-');
  if (dash < 0) return undefined;
  const kind = id.slice(0, dash);
  const rest = id.slice(dash + 1);
  if (!/^\d+$/.test(rest)) return undefined;
  if (kind !== 'spell' && kind !== 'ritual') return undefined;
  return { kind, num: Number(rest) };
}

export function buildAonIndex(docs: AonDoc[]): AonIndex {
  const index: AonIndex = new Map();
  for (const doc of docs) {
    const parsed = parseId(doc.id);
    if (!parsed || !doc.name) continue;
    const key = normalizeName(doc.name);
    const ref: AonRef = {
      kind: parsed.kind,
      num: parsed.num,
      level: doc.level,
      superseded: Array.isArray(doc.remaster_id) && doc.remaster_id.length > 0
    };
    const bucket = index.get(key);
    if (bucket) bucket.push(ref);
    else index.set(key, [ref]);
  }
  return index;
}

/**
 * Resolve a direct AoN page URL for a spell, or `undefined` if no confident
 * match exists (caller falls back to the search URL).
 *
 * Selection: prefer non-superseded entries, then entries matching `level`,
 * then the highest id (the most recently published / remastered version).
 */
export function resolveAonUrl(
  index: AonIndex,
  name: string,
  level: number
): string | undefined {
  const candidates = index.get(normalizeName(name));
  if (!candidates || candidates.length === 0) return undefined;

  let pool = candidates.filter((c) => !c.superseded);
  if (pool.length === 0) pool = candidates;

  const sameLevel = pool.filter((c) => c.level === level);
  if (sameLevel.length > 0) pool = sameLevel;

  const best = pool.reduce((a, b) => (b.num > a.num ? b : a));
  const page = best.kind === 'ritual' ? 'Rituals' : 'Spells';
  return `${AON_BASE}/${page}.aspx?ID=${best.num}`;
}

/** Working AoN search URL — the legacy `Query=…&type=…` form is ignored by the
 * current Elasticsearch-backed search, so we use the `q=` parameter. */
export function aonSearchUrl(name: string): string {
  return `${AON_BASE}/Search.aspx?q=${encodeURIComponent(name)}`;
}

async function fetchCategory(category: 'spell' | 'ritual'): Promise<AonDoc[]> {
  const res = await fetch(ES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: 3000,
      _source: ['id', 'name', 'level', 'remaster_id'],
      query: { term: { category } }
    })
  });
  if (!res.ok) throw new Error(`AoN ES query for ${category} failed: ${res.status}`);
  const json = (await res.json()) as { hits?: { hits?: { _source?: AonDoc }[] } };
  const hits = json.hits?.hits ?? [];
  return hits.map((h) => h._source).filter((s): s is AonDoc => !!s && typeof s.id === 'string');
}

/** Fetch the live AoN spell + ritual catalogue and build a match index. */
export async function fetchAonIndex(): Promise<AonIndex> {
  const [spells, rituals] = await Promise.all([
    fetchCategory('spell'),
    fetchCategory('ritual')
  ]);
  return buildAonIndex([...spells, ...rituals]);
}
