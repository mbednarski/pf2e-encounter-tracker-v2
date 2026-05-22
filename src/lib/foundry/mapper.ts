import type {
  AbilityScores,
  Creature,
  CreatureSize,
  DamageComponent,
  Languages,
  Sense,
  SenseAcuity,
  SpellEntrySave,
  SpellListEntry,
  SpellTradition,
  SpellcastingBlock,
  SpellcastingType
} from '../../domain';
import { stripFoundryMarkup } from './text';
import {
  type MapResult,
  type Warn,
  mapAttacks,
  mapDamageTypeArray,
  mapImmunities,
  mapRarity,
  parseDamageString,
  partitionAbilities,
  requireNum,
  slugifyName
} from './shared';
import type {
  FoundryItem,
  FoundryNpc,
  FoundrySpellItem,
  FoundrySpellSystem,
  FoundrySpellcastingEntryItem,
  FoundrySpellcastingEntrySystem
} from './types';

export { slugifyName, parseDamageString } from './shared';
export type { MapResult } from './shared';

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

const TRADITIONS: ReadonlySet<SpellTradition> = new Set(['arcane', 'divine', 'occult', 'primal']);
const SPELLCASTING_TYPES: ReadonlySet<SpellcastingType> = new Set([
  'prepared',
  'spontaneous',
  'innate',
  'focus'
]);
const SENSE_ACUITIES: ReadonlySet<SenseAcuity> = new Set(['precise', 'imprecise', 'vague']);

function mapSize(raw: string | undefined): CreatureSize {
  if (!raw) return 'medium';
  return SIZE_MAP[raw.toLowerCase()] ?? 'medium';
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
    const usesMax = sys.location?.uses?.max;
    if (typeof usesMax === 'number' && Number.isFinite(usesMax) && usesMax > 0) {
      entry.frequency = { type: 'perDay', uses: usesMax };
    } else {
      entry.frequency = { type: 'atWill' };
    }
  }

  const damage: DamageComponent[] = [];
  for (const roll of Object.values(sys.damage ?? {})) {
    if (!roll) continue;
    const parsed = typeof roll.damage === 'string' ? parseDamageString(roll.damage) : null;
    if (!parsed) continue;
    parsed.type = typeof roll.damageType === 'string' && roll.damageType !== '' ? roll.damageType : 'untyped';
    damage.push(parsed);
  }
  if (damage.length > 0) entry.damage = damage;

  const saveStat = sys.defense?.save?.statistic;
  if (saveStat) {
    const save: SpellEntrySave = { defense: saveStat };
    if (sys.defense?.save?.basic === true) save.basic = true;
    entry.save = save;
  }

  return entry;
}

function mapSpellcasting(items: FoundryItem[], warn: Warn): SpellcastingBlock[] {
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
    const blockLabel = typeof entry.name === 'string' && entry.name ? entry.name : blockId;

    const tradRaw = typeof sys.tradition?.value === 'string' ? sys.tradition.value : '';
    let tradition: SpellTradition;
    if (TRADITIONS.has(tradRaw as SpellTradition)) {
      tradition = tradRaw as SpellTradition;
    } else {
      warn(`Spellcasting block "${blockLabel}": unknown tradition "${tradRaw}", defaulted to arcane`);
      tradition = 'arcane';
    }

    const typeRaw = typeof sys.prepared?.value === 'string' ? sys.prepared.value : '';
    let type: SpellcastingType;
    if (SPELLCASTING_TYPES.has(typeRaw as SpellcastingType)) {
      type = typeRaw as SpellcastingType;
    } else {
      warn(`Spellcasting block "${blockLabel}": unknown type "${typeRaw}", defaulted to innate`);
      type = 'innate';
    }

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

export function mapFoundryNpcToCreature(npc: unknown): MapResult<Creature> {
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

  const sys = doc.system ?? {};

  const level = requireNum(sys.details?.level?.value);
  const ac = requireNum(sys.attributes?.ac?.value);
  const fortitude = requireNum(sys.saves?.fortitude?.value);
  const reflex = requireNum(sys.saves?.reflex?.value);
  const will = requireNum(sys.saves?.will?.value);
  const perception = requireNum(sys.perception?.mod);
  const hp = requireNum(sys.attributes?.hp?.max) ?? requireNum(sys.attributes?.hp?.value);

  const missing: string[] = [];
  if (level === null) missing.push('system.details.level.value');
  if (ac === null) missing.push('system.attributes.ac.value');
  if (fortitude === null) missing.push('system.saves.fortitude.value');
  if (reflex === null) missing.push('system.saves.reflex.value');
  if (will === null) missing.push('system.saves.will.value');
  if (perception === null) missing.push('system.perception.mod');
  if (hp === null) missing.push('system.attributes.hp.max or .value');

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Foundry NPC "${doc.name}" is missing required fields: ${missing.join(', ')}`
    };
  }

  const warnings: string[] = [];
  const warn: Warn = (msg) => warnings.push(msg);
  const items = Array.isArray(doc.items) ? doc.items : [];

  const attacks = mapAttacks(items);
  const { passive, reactive, active } = partitionAbilities(items, warn);
  const spellcasting = mapSpellcasting(items, warn);

  const source = sys.details?.publication?.title;
  const notes = stripFoundryMarkup(sys.details?.publicNotes);

  const creature: Creature = {
    id: slugifyName(doc.name),
    name: doc.name,
    level: level!,
    traits: Array.isArray(sys.traits?.value)
      ? sys.traits.value.filter((t): t is string => typeof t === 'string')
      : [],
    size: mapSize(sys.traits?.size?.value),
    rarity: mapRarity(sys.traits?.rarity),
    ac: ac!,
    fortitude: fortitude!,
    reflex: reflex!,
    will: will!,
    perception: perception!,
    hp: hp!,
    immunities: mapImmunities(sys.attributes?.immunities),
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
