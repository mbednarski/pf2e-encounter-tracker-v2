import type {
  Ability,
  AbilityScores,
  ActionCost,
  Attack,
  Creature,
  CreatureImmunity,
  CreatureRarity,
  CreatureSize,
  DamageComponent,
  Languages,
  Sense,
  SenseAcuity,
  SpellListEntry,
  SpellTradition,
  SpellcastingBlock,
  SpellcastingType
} from '../../domain';
import { stripFoundryMarkup } from './text';
import type {
  FoundryActionItem,
  FoundryActionSystem,
  FoundryItem,
  FoundryMeleeItem,
  FoundryMeleeSystem,
  FoundryNpc,
  FoundrySpellItem,
  FoundrySpellSystem,
  FoundrySpellcastingEntryItem,
  FoundrySpellcastingEntrySystem
} from './types';

export type MapResult =
  | { ok: true; value: Creature; warnings: string[] }
  | { ok: false; error: string };

const SIZE_MAP: Record<string, CreatureSize> = {
  tiny: 'tiny',
  sm: 'small',
  small: 'small',
  med: 'medium',
  medium: 'medium',
  lg: 'large',
  large: 'large',
  huge: 'huge',
  grg: 'gargantuan',
  gargantuan: 'gargantuan'
};

const RARITIES: ReadonlySet<CreatureRarity> = new Set(['common', 'uncommon', 'rare', 'unique']);
const TRADITIONS: ReadonlySet<SpellTradition> = new Set(['arcane', 'divine', 'occult', 'primal']);
const SPELLCASTING_TYPES: ReadonlySet<SpellcastingType> = new Set([
  'prepared',
  'spontaneous',
  'innate',
  'focus'
]);
const SENSE_ACUITIES: ReadonlySet<SenseAcuity> = new Set(['precise', 'imprecise', 'vague']);

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseDamageString(raw: string): DamageComponent | null {
  // Examples: "1d6+1", "2d8", "1d4-1", "5"
  const m = /^\s*(?:(\d+)d(\d+))?\s*(?:([+\-])\s*(\d+))?\s*$/.exec(raw);
  if (!m) return null;
  const dice = m[1] ? Number(m[1]) : undefined;
  const dieSize = m[2] ? Number(m[2]) : undefined;
  const sign = m[3] === '-' ? -1 : 1;
  const bonusAbs = m[4] !== undefined ? Number(m[4]) : undefined;
  if (dice === undefined && bonusAbs === undefined) return null;
  const out: { dice?: number; dieSize?: number; bonus?: number } = {};
  if (dice !== undefined) out.dice = dice;
  if (dieSize !== undefined) out.dieSize = dieSize;
  if (bonusAbs !== undefined) out.bonus = sign * bonusAbs;
  return { ...out, type: 'untyped' };
}

function mapSize(raw: string | undefined): CreatureSize {
  if (!raw) return 'medium';
  return SIZE_MAP[raw.toLowerCase()] ?? 'medium';
}

function mapRarity(raw: string | undefined): CreatureRarity {
  if (raw && RARITIES.has(raw as CreatureRarity)) return raw as CreatureRarity;
  return 'common';
}

function mapSpeed(npc: FoundryNpc): Record<string, number> {
  const out: Record<string, number> = {};
  const speed = npc.system?.attributes?.speed;
  if (typeof speed?.value === 'number') out.land = speed.value;
  for (const other of speed?.otherSpeeds ?? []) {
    if (typeof other?.value === 'number' && typeof other?.type === 'string') {
      out[other.type] = other.value;
    }
  }
  return out;
}

function mapImmunities(npc: FoundryNpc): CreatureImmunity[] {
  const out: CreatureImmunity[] = [];
  for (const im of npc.system?.attributes?.immunities ?? []) {
    if (typeof im?.type !== 'string') continue;
    const entry: CreatureImmunity = { type: im.type };
    if (Array.isArray(im.exceptions) && im.exceptions.length > 0) {
      entry.exceptions = im.exceptions.filter((e): e is string => typeof e === 'string');
    }
    out.push(entry);
  }
  return out;
}

function mapDamageTypeArray(
  raw: { type?: string; value?: number; exceptions?: string[] }[] | undefined
): { type: string; value: number }[] {
  const out: { type: string; value: number }[] = [];
  for (const r of raw ?? []) {
    if (typeof r?.type !== 'string' || typeof r?.value !== 'number') continue;
    out.push({ type: r.type, value: r.value });
  }
  return out;
}

function mapSenses(npc: FoundryNpc): Sense[] | undefined {
  const raw = npc.system?.perception?.senses;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: Sense[] = [];
  for (const s of raw) {
    if (typeof s?.type !== 'string') continue;
    const entry: Sense = { type: s.type };
    if (typeof s.acuity === 'string' && SENSE_ACUITIES.has(s.acuity as SenseAcuity)) {
      entry.acuity = s.acuity as SenseAcuity;
    }
    if (typeof s.range === 'number') entry.range = s.range;
    out.push(entry);
  }
  return out.length > 0 ? out : undefined;
}

function mapAbilityScores(npc: FoundryNpc): AbilityScores | undefined {
  const a = npc.system?.abilities;
  if (!a) return undefined;
  const get = (k: keyof typeof a): number | undefined => {
    const mod = a[k]?.mod;
    return typeof mod === 'number' ? mod : undefined;
  };
  const str = get('str');
  const dex = get('dex');
  const con = get('con');
  const int = get('int');
  const wis = get('wis');
  const cha = get('cha');
  if ([str, dex, con, int, wis, cha].some((v) => v === undefined)) return undefined;
  return { str: str!, dex: dex!, con: con!, int: int!, wis: wis!, cha: cha! };
}

function mapLanguages(npc: FoundryNpc): Languages | undefined {
  const l = npc.system?.details?.languages;
  if (!l) return undefined;
  const value = Array.isArray(l.value) ? l.value.filter((s): s is string => typeof s === 'string') : [];
  const details = typeof l.details === 'string' && l.details.trim() !== '' ? l.details.trim() : undefined;
  if (value.length === 0 && !details) return undefined;
  const out: Languages = { value };
  if (details !== undefined) out.details = details;
  return out;
}

function mapSkills(npc: FoundryNpc): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(npc.system?.skills ?? {})) {
    if (val && typeof val.base === 'number') out[key] = val.base;
  }
  return out;
}

function isRangedAttack(range: FoundryMeleeSystem['range']): boolean {
  if (range == null) return false;
  if (typeof range === 'string') return range.trim() !== '';
  return typeof range.increment === 'number' && range.increment > 0;
}

function mapAttack(item: FoundryMeleeItem): Attack | null {
  if (typeof item.name !== 'string') return null;
  const sys: FoundryMeleeSystem = item.system ?? {};
  const modifier = typeof sys.bonus?.value === 'number' ? sys.bonus.value : 0;
  const type = isRangedAttack(sys.range) ? 'ranged' : 'melee';
  const traits = Array.isArray(sys.traits?.value)
    ? sys.traits.value.filter((t): t is string => typeof t === 'string')
    : [];

  const damage: DamageComponent[] = [];
  for (const roll of Object.values(sys.damageRolls ?? {})) {
    if (!roll) continue;
    const parsed = typeof roll.damage === 'string' ? parseDamageString(roll.damage) : null;
    if (!parsed) continue;
    parsed.type = typeof roll.damageType === 'string' && roll.damageType !== '' ? roll.damageType : 'untyped';
    if (roll.category === 'persistent') parsed.persistent = true;
    damage.push(parsed);
  }

  const effects = Array.isArray(sys.attackEffects?.value)
    ? sys.attackEffects.value.filter((e): e is string => typeof e === 'string')
    : [];

  const out: Attack = {
    name: item.name,
    type,
    modifier,
    traits,
    damage
  };
  if (effects.length > 0) out.effects = effects;
  return out;
}

function mapAbility(item: FoundryActionItem): Ability | null {
  if (typeof item.name !== 'string') return null;
  const sys: FoundryActionSystem = item.system ?? {};
  const description = stripFoundryMarkup(sys.description?.value);
  const traits = Array.isArray(sys.traits?.value)
    ? sys.traits.value.filter((t): t is string => typeof t === 'string')
    : undefined;

  let actions: ActionCost | undefined;
  const actionType = sys.actionType?.value;
  if (actionType === 'reaction') actions = 'reaction';
  else if (actionType === 'free') actions = 'free';
  else if (actionType === 'action') {
    const n = sys.actions?.value;
    if (n === 1 || n === 2 || n === 3) actions = n;
  }

  let frequency: string | undefined;
  if (sys.frequency && typeof sys.frequency.max === 'number' && typeof sys.frequency.per === 'string') {
    frequency = `${sys.frequency.max} per ${sys.frequency.per}`;
  }

  const ability: Ability = { name: item.name, description };
  if (actions !== undefined) ability.actions = actions;
  if (traits !== undefined && traits.length > 0) ability.traits = traits;
  if (frequency !== undefined) ability.frequency = frequency;
  return ability;
}

function partitionAbilities(actions: FoundryItem[]): {
  passive: Ability[];
  reactive: Ability[];
  active: Ability[];
} {
  const passive: Ability[] = [];
  const reactive: Ability[] = [];
  const active: Ability[] = [];
  for (const item of actions) {
    if (item.type !== 'action') continue;
    const actionItem = item as FoundryActionItem;
    const sys = actionItem.system;
    const ability = mapAbility(actionItem);
    if (!ability) continue;
    const kind = sys?.actionType?.value ?? 'passive';
    if (kind === 'passive') passive.push(ability);
    else if (kind === 'reaction' || kind === 'free') reactive.push(ability);
    else active.push(ability);
  }
  return { passive, reactive, active };
}

function mapSpellListEntry(
  item: FoundrySpellItem,
  blockType: SpellcastingType
): SpellListEntry | null {
  if (typeof item.name !== 'string') return null;
  const sys: FoundrySpellSystem = item.system ?? {};
  const level = typeof sys.level?.value === 'number' ? sys.level.value : 0;
  const traits = Array.isArray(sys.traits?.value) ? sys.traits.value : [];
  const isCantrip = traits.includes('cantrip') || level === 0;
  const slug = slugifyName(item.name);
  const entry: SpellListEntry = { spellSlug: slug, name: item.name, level };
  if (isCantrip) {
    entry.isCantrip = true;
    entry.frequency = { type: 'atWill' };
  } else if (blockType === 'innate') {
    entry.frequency = { type: 'atWill' };
  }
  return entry;
}

function mapSpellcasting(items: FoundryItem[]): SpellcastingBlock[] {
  const entries: FoundrySpellcastingEntryItem[] = items
    .filter((i) => i.type === 'spellcastingEntry')
    .map((i) => i as FoundrySpellcastingEntryItem);
  if (entries.length === 0) return [];

  const spellsByLocation = new Map<string, FoundrySpellItem[]>();
  for (const item of items) {
    if (item.type !== 'spell') continue;
    const spellItem = item as FoundrySpellItem;
    const loc = spellItem.system?.location?.value;
    if (typeof loc !== 'string') continue;
    const arr = spellsByLocation.get(loc) ?? [];
    arr.push(spellItem);
    spellsByLocation.set(loc, arr);
  }

  const out: SpellcastingBlock[] = [];
  for (const entry of entries) {
    const sys: FoundrySpellcastingEntrySystem = entry.system ?? {};
    const blockId = typeof entry._id === 'string' && entry._id ? entry._id : (entry.name ?? 'spellcasting');

    const tradRaw = typeof sys.tradition?.value === 'string' ? sys.tradition.value : '';
    const tradition: SpellTradition = TRADITIONS.has(tradRaw as SpellTradition)
      ? (tradRaw as SpellTradition)
      : 'arcane';

    const typeRaw = typeof sys.prepared?.value === 'string' ? sys.prepared.value : '';
    const type: SpellcastingType = SPELLCASTING_TYPES.has(typeRaw as SpellcastingType)
      ? (typeRaw as SpellcastingType)
      : 'innate';

    const dc = typeof sys.spelldc?.dc === 'number' ? sys.spelldc.dc : 0;
    const attackModifier = typeof sys.spelldc?.value === 'number' ? sys.spelldc.value : undefined;

    const slots: Record<number, number> = {};
    for (const [k, v] of Object.entries(sys.slots ?? {})) {
      const m = /^slot(\d+)$/.exec(k);
      if (!m) continue;
      const rank = Number(m[1]);
      if (v && typeof v.max === 'number' && v.max > 0) slots[rank] = v.max;
    }

    const spellList = spellsByLocation.get(entry._id ?? '') ?? [];
    const spellEntries: SpellListEntry[] = [];
    for (const spell of spellList) {
      const e = mapSpellListEntry(spell, type);
      if (e) spellEntries.push(e);
    }

    const block: SpellcastingBlock = {
      blockId,
      name: typeof entry.name === 'string' ? entry.name : 'Spellcasting',
      tradition,
      type,
      dc,
      entries: spellEntries
    };
    if (attackModifier !== undefined) block.attackModifier = attackModifier;
    if (Object.keys(slots).length > 0) block.slots = slots;
    out.push(block);
  }
  return out;
}

export function mapFoundryNpcToCreature(npc: unknown): MapResult {
  if (typeof npc !== 'object' || npc === null || Array.isArray(npc)) {
    return { ok: false, error: 'Foundry document must be a JSON object' };
  }
  const doc = npc as FoundryNpc;
  if (doc.type !== 'npc') {
    return { ok: false, error: `Expected document type "npc", got ${JSON.stringify(doc.type)}` };
  }
  if (typeof doc.name !== 'string' || doc.name.trim() === '') {
    return { ok: false, error: 'Foundry NPC is missing a name' };
  }

  const warnings: string[] = [];
  const items = Array.isArray(doc.items) ? doc.items : [];

  const attacks: Attack[] = [];
  for (const item of items) {
    if (item.type !== 'melee') continue;
    const a = mapAttack(item as FoundryMeleeItem);
    if (a) attacks.push(a);
  }

  const { passive, reactive, active } = partitionAbilities(items);
  const spellcasting = mapSpellcasting(items);

  const sys = doc.system ?? {};
  const source = sys.details?.publication?.title;
  const notes = stripFoundryMarkup(sys.details?.publicNotes);

  const creature: Creature = {
    id: slugifyName(doc.name),
    name: doc.name,
    level: typeof sys.details?.level?.value === 'number' ? sys.details.level.value : 0,
    traits: Array.isArray(sys.traits?.value)
      ? sys.traits.value.filter((t): t is string => typeof t === 'string')
      : [],
    size: mapSize(sys.traits?.size?.value),
    rarity: mapRarity(sys.traits?.rarity),
    ac: typeof sys.attributes?.ac?.value === 'number' ? sys.attributes.ac.value : 0,
    fortitude: typeof sys.saves?.fortitude?.value === 'number' ? sys.saves.fortitude.value : 0,
    reflex: typeof sys.saves?.reflex?.value === 'number' ? sys.saves.reflex.value : 0,
    will: typeof sys.saves?.will?.value === 'number' ? sys.saves.will.value : 0,
    perception: typeof sys.perception?.mod === 'number' ? sys.perception.mod : 0,
    hp: typeof sys.attributes?.hp?.max === 'number'
      ? sys.attributes.hp.max
      : typeof sys.attributes?.hp?.value === 'number'
        ? sys.attributes.hp.value
        : 0,
    immunities: mapImmunities(doc),
    resistances: mapDamageTypeArray(sys.attributes?.resistances),
    weaknesses: mapDamageTypeArray(sys.attributes?.weaknesses),
    speed: mapSpeed(doc),
    attacks,
    passiveAbilities: passive,
    reactiveAbilities: reactive,
    activeAbilities: active,
    skills: mapSkills(doc),
    tags: []
  };

  const alignment = sys.details?.alignment?.value;
  if (typeof alignment === 'string' && alignment.trim() !== '') creature.alignment = alignment;
  if (typeof source === 'string' && source.trim() !== '') creature.source = source;
  if (notes !== '') creature.notes = notes;

  const senses = mapSenses(doc);
  if (senses) creature.senses = senses;

  const abilities = mapAbilityScores(doc);
  if (abilities) creature.abilities = abilities;

  const languages = mapLanguages(doc);
  if (languages) creature.languages = languages;

  if (spellcasting.length > 0) creature.spellcasting = spellcasting;

  return { ok: true, value: creature, warnings };
}
