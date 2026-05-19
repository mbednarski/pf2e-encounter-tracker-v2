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
    area?: { value?: number | string; type?: string } | null;
    target?: { value?: string };
    duration?: { value?: string };
    cantrip?: boolean;
    category?: string;
    defense?: {
      save?: { basic?: boolean; statistic?: string };
      passive?: { statistic?: string };
    };
    // Each entry value is { formula, type, ... } OR a plain string (heightening.damage entries)
    damage?: Record<string, { formula?: string; type?: string }>;
    heightening?: {
      type?: 'fixed' | 'interval';
      interval?: number;
      // In real Foundry data, heightening.damage values are plain strings (e.g. "2d6"),
      // not objects. We model as unknown and handle both shapes.
      damage?: Record<string, unknown>;
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

  const isCantrip =
    spell.system?.cantrip === true ||
    spell.system?.traits?.value?.includes('cantrip') === true;
  const isFocus = spell.system?.category === 'focus';

  const traditions = (spell.system?.traits?.traditions ?? []).filter((t): t is SpellTradition =>
    TRADITION_SET.has(t)
  );
  const traits = (spell.system?.traits?.value ?? []).filter(
    (t): t is string => typeof t === 'string'
  );

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

function formatArea(
  area: { value?: number | string; type?: string } | null | undefined
): string | undefined {
  if (!area || area.value === undefined || area.value === '' || area.value === null)
    return undefined;
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

/**
 * Parse a heightening.damage entry.
 *
 * In real Foundry data (pf2e system), interval heightening damage values are
 * plain strings like "2d6" rather than objects. Fixed heightening levels do
 * use the { formula, type } object shape inside their .damage records. We
 * handle both.
 */
function parseHeighteningDamage(raw: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  for (const val of Object.values(raw)) {
    if (typeof val === 'string' && val) {
      // plain string formula, no type suffix available
      parts.push(val);
    } else if (val && typeof val === 'object') {
      const entry = val as { formula?: string; type?: string };
      if (entry.formula)
        parts.push(`${entry.formula}${entry.type ? ` ${entry.type}` : ''}`);
    }
  }
  return parts.length > 0 ? parts.join(' + ') : undefined;
}

function parseHeightening(
  h: NonNullable<FoundrySpell['system']>['heightening']
): SpellHeightening | undefined {
  if (!h) return undefined;

  if (h.type === 'interval' && typeof h.interval === 'number' && h.damage) {
    const dmgStr = parseHeighteningDamage(h.damage);
    if (!dmgStr) return undefined;
    return {
      mode: 'interval',
      per: h.interval,
      delta: { damage: dmgStr.startsWith('+') ? dmgStr : `+${dmgStr}` }
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
