import type {
  Ability,
  ActionCost,
  Attack,
  AttackType,
  Creature,
  CreatureRarity,
  CreatureSize,
  DamageComponent,
  SpellcastingBlock,
  SpellcastingType,
  SpellFrequency,
  SpellListEntry,
  SpellTradition
} from '../../domain';
import type { ValidationIssue } from './envelope';

const SIZES: ReadonlySet<CreatureSize> = new Set(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
const RARITIES: ReadonlySet<CreatureRarity> = new Set(['common', 'uncommon', 'rare', 'unique']);
const ATTACK_TYPES: ReadonlySet<AttackType> = new Set(['melee', 'ranged']);
const ACTION_COSTS = new Set<ActionCost>([1, 2, 3, 'free', 'reaction']);
const TRADITIONS: ReadonlySet<SpellTradition> = new Set(['arcane', 'divine', 'occult', 'primal']);
const SPELLCASTING_TYPES: ReadonlySet<SpellcastingType> = new Set(['prepared', 'spontaneous', 'innate', 'focus']);

class IssueBag {
  readonly issues: ValidationIssue[] = [];
  constructor(private readonly documentIndex: number) {}

  add(path: string, message: string): void {
    this.issues.push({ documentIndex: this.documentIndex, path, message });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function requireNumber(bag: IssueBag, path: string, value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    bag.add(path, `\`${path}\` must be a finite number`);
    return null;
  }
  return value;
}

function requireString(bag: IssueBag, path: string, value: unknown): string | null {
  if (typeof value !== 'string') {
    bag.add(path, `\`${path}\` must be a string`);
    return null;
  }
  return value;
}

function requireStringArray(bag: IssueBag, path: string, value: unknown): string[] | null {
  if (!isStringArray(value)) {
    bag.add(path, `\`${path}\` must be an array of strings`);
    return null;
  }
  return value;
}

function requireArray(bag: IssueBag, path: string, value: unknown): unknown[] | null {
  if (!Array.isArray(value)) {
    bag.add(path, `\`${path}\` must be an array`);
    return null;
  }
  return value;
}

function requireObject(bag: IssueBag, path: string, value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    bag.add(path, `\`${path}\` must be a mapping (object)`);
    return null;
  }
  return value;
}

function validateRecordOfNumbers(
  bag: IssueBag,
  path: string,
  value: unknown
): Record<string, number> | null {
  const obj = requireObject(bag, path, value);
  if (!obj) return null;
  const out: Record<string, number> = {};
  let ok = true;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      bag.add(`${path}.${k}`, `\`${path}.${k}\` must be a finite number`);
      ok = false;
    } else {
      out[k] = v;
    }
  }
  return ok ? out : null;
}

function validateDamageType(bag: IssueBag, path: string, raw: unknown): { type: string; value: number } | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const type = requireString(bag, `${path}.type`, obj.type);
  if (type === null) ok = false;
  const value = requireNumber(bag, `${path}.value`, obj.value);
  if (value === null) ok = false;
  return ok ? { type: type as string, value: value as number } : null;
}

function validateDamageComponent(bag: IssueBag, path: string, raw: unknown): DamageComponent | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const type = requireString(bag, `${path}.type`, obj.type);
  if (type === null) ok = false;

  const out: DamageComponent = { type: type ?? '' };
  if (obj.dice !== undefined) {
    const n = requireNumber(bag, `${path}.dice`, obj.dice);
    if (n === null) ok = false;
    else out.dice = n;
  }
  if (obj.dieSize !== undefined) {
    const n = requireNumber(bag, `${path}.dieSize`, obj.dieSize);
    if (n === null) ok = false;
    else out.dieSize = n;
  }
  if (obj.bonus !== undefined) {
    const n = requireNumber(bag, `${path}.bonus`, obj.bonus);
    if (n === null) ok = false;
    else out.bonus = n;
  }
  if (obj.persistent !== undefined) {
    if (typeof obj.persistent !== 'boolean') {
      bag.add(`${path}.persistent`, `\`${path}.persistent\` must be a boolean`);
      ok = false;
    } else {
      out.persistent = obj.persistent;
    }
  }
  if (obj.conditional !== undefined) {
    const s = requireString(bag, `${path}.conditional`, obj.conditional);
    if (s === null) ok = false;
    else out.conditional = s;
  }
  return ok ? out : null;
}

function validateAttack(bag: IssueBag, path: string, raw: unknown): Attack | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const name = requireString(bag, `${path}.name`, obj.name);
  if (name === null) ok = false;

  let type: AttackType | null = null;
  if (typeof obj.type !== 'string' || !ATTACK_TYPES.has(obj.type as AttackType)) {
    bag.add(`${path}.type`, `\`${path}.type\` must be one of: melee, ranged`);
    ok = false;
  } else {
    type = obj.type as AttackType;
  }

  const modifier = requireNumber(bag, `${path}.modifier`, obj.modifier);
  if (modifier === null) ok = false;

  const traits = requireStringArray(bag, `${path}.traits`, obj.traits);
  if (traits === null) ok = false;

  const damageRaw = requireArray(bag, `${path}.damage`, obj.damage);
  const damage: DamageComponent[] = [];
  if (damageRaw === null) {
    ok = false;
  } else {
    for (let i = 0; i < damageRaw.length; i++) {
      const d = validateDamageComponent(bag, `${path}.damage[${i}]`, damageRaw[i]);
      if (d === null) ok = false;
      else damage.push(d);
    }
  }

  let effects: string[] | undefined;
  if (obj.effects !== undefined) {
    const e = requireStringArray(bag, `${path}.effects`, obj.effects);
    if (e === null) ok = false;
    else effects = e;
  }

  return ok && type !== null
    ? {
        name: name as string,
        type,
        modifier: modifier as number,
        traits: traits as string[],
        damage,
        ...(effects !== undefined ? { effects } : {})
      }
    : null;
}

function validateAbility(bag: IssueBag, path: string, raw: unknown): Ability | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const name = requireString(bag, `${path}.name`, obj.name);
  if (name === null) ok = false;
  const description = requireString(bag, `${path}.description`, obj.description);
  if (description === null) ok = false;

  const out: Ability = {
    name: name ?? '',
    description: description ?? ''
  };

  if (obj.actions !== undefined) {
    if (!ACTION_COSTS.has(obj.actions as ActionCost)) {
      bag.add(`${path}.actions`, `\`${path}.actions\` must be 1, 2, 3, "free", or "reaction"`);
      ok = false;
    } else {
      out.actions = obj.actions as ActionCost;
    }
  }
  if (obj.traits !== undefined) {
    const t = requireStringArray(bag, `${path}.traits`, obj.traits);
    if (t === null) ok = false;
    else out.traits = t;
  }
  for (const optional of ['trigger', 'frequency', 'requirements'] as const) {
    if (obj[optional] !== undefined) {
      const s = requireString(bag, `${path}.${optional}`, obj[optional]);
      if (s === null) ok = false;
      else out[optional] = s;
    }
  }

  return ok ? out : null;
}

function validateSpellFrequency(bag: IssueBag, path: string, raw: unknown): SpellFrequency | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  if (obj.type === 'atWill') return { type: 'atWill' };
  if (obj.type === 'constant') return { type: 'constant' };
  if (obj.type === 'perDay') {
    const uses = requireNumber(bag, `${path}.uses`, obj.uses);
    if (uses === null) return null;
    return { type: 'perDay', uses };
  }
  bag.add(`${path}.type`, `\`${path}.type\` must be "atWill", "constant", or "perDay"`);
  return null;
}

function validateSpellListEntry(bag: IssueBag, path: string, raw: unknown): SpellListEntry | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const spellSlug = requireString(bag, `${path}.spellSlug`, obj.spellSlug);
  if (spellSlug === null) ok = false;
  const name = requireString(bag, `${path}.name`, obj.name);
  if (name === null) ok = false;
  const level = requireNumber(bag, `${path}.level`, obj.level);
  if (level === null) ok = false;

  const out: SpellListEntry = {
    spellSlug: spellSlug ?? '',
    name: name ?? '',
    level: level ?? 0
  };
  if (obj.isCantrip !== undefined) {
    if (typeof obj.isCantrip !== 'boolean') {
      bag.add(`${path}.isCantrip`, `\`${path}.isCantrip\` must be a boolean`);
      ok = false;
    } else out.isCantrip = obj.isCantrip;
  }
  if (obj.frequency !== undefined) {
    const f = validateSpellFrequency(bag, `${path}.frequency`, obj.frequency);
    if (f === null) ok = false;
    else out.frequency = f;
  }
  if (obj.count !== undefined) {
    const n = requireNumber(bag, `${path}.count`, obj.count);
    if (n === null) ok = false;
    else out.count = n;
  }
  return ok ? out : null;
}

function validateSpellcastingBlock(bag: IssueBag, path: string, raw: unknown): SpellcastingBlock | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const blockId = requireString(bag, `${path}.blockId`, obj.blockId);
  if (blockId === null) ok = false;
  const name = requireString(bag, `${path}.name`, obj.name);
  if (name === null) ok = false;

  let tradition: SpellTradition | null = null;
  if (typeof obj.tradition !== 'string' || !TRADITIONS.has(obj.tradition as SpellTradition)) {
    bag.add(`${path}.tradition`, `\`${path}.tradition\` must be one of: arcane, divine, occult, primal`);
    ok = false;
  } else tradition = obj.tradition as SpellTradition;

  let type: SpellcastingType | null = null;
  if (typeof obj.type !== 'string' || !SPELLCASTING_TYPES.has(obj.type as SpellcastingType)) {
    bag.add(`${path}.type`, `\`${path}.type\` must be one of: prepared, spontaneous, innate, focus`);
    ok = false;
  } else type = obj.type as SpellcastingType;

  const dc = requireNumber(bag, `${path}.dc`, obj.dc);
  if (dc === null) ok = false;

  const entriesRaw = requireArray(bag, `${path}.entries`, obj.entries);
  const entries: SpellListEntry[] = [];
  if (entriesRaw === null) ok = false;
  else {
    for (let i = 0; i < entriesRaw.length; i++) {
      const e = validateSpellListEntry(bag, `${path}.entries[${i}]`, entriesRaw[i]);
      if (e === null) ok = false;
      else entries.push(e);
    }
  }

  if (!ok || tradition === null || type === null) return null;

  const block: SpellcastingBlock = {
    blockId: blockId as string,
    name: name as string,
    tradition,
    type,
    dc: dc as number,
    entries
  };
  if (obj.attackModifier !== undefined) {
    const n = requireNumber(bag, `${path}.attackModifier`, obj.attackModifier);
    if (n === null) return null;
    block.attackModifier = n;
  }
  if (obj.focusPoints !== undefined) {
    const n = requireNumber(bag, `${path}.focusPoints`, obj.focusPoints);
    if (n === null) return null;
    block.focusPoints = n;
  }
  if (obj.slots !== undefined) {
    const slotsObj = requireObject(bag, `${path}.slots`, obj.slots);
    if (slotsObj === null) return null;
    const slots: Record<number, number> = {};
    for (const [k, v] of Object.entries(slotsObj)) {
      const lvl = Number(k);
      if (!Number.isInteger(lvl)) {
        bag.add(`${path}.slots.${k}`, `\`${path}.slots\` keys must be integer spell levels`);
        return null;
      }
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        bag.add(`${path}.slots.${k}`, `\`${path}.slots.${k}\` must be a finite number`);
        return null;
      }
      slots[lvl] = v;
    }
    block.slots = slots;
  }
  return block;
}

export interface CreatureValidationResult {
  creature: Creature | null;
  issues: ValidationIssue[];
}

export function validateCreature(raw: unknown, documentIndex: number): CreatureValidationResult {
  const bag = new IssueBag(documentIndex);

  const obj = requireObject(bag, '', raw);
  if (!obj) return { creature: null, issues: bag.issues };

  let ok = true;

  const id = requireString(bag, 'id', obj.id);
  if (id === null) ok = false;
  const name = requireString(bag, 'name', obj.name);
  if (name === null) ok = false;
  const level = requireNumber(bag, 'level', obj.level);
  if (level === null) ok = false;
  const traits = requireStringArray(bag, 'traits', obj.traits);
  if (traits === null) ok = false;

  let size: CreatureSize | null = null;
  if (typeof obj.size !== 'string' || !SIZES.has(obj.size as CreatureSize)) {
    bag.add('size', '`size` must be one of: tiny, small, medium, large, huge, gargantuan');
    ok = false;
  } else size = obj.size as CreatureSize;

  let rarity: CreatureRarity | null = null;
  if (typeof obj.rarity !== 'string' || !RARITIES.has(obj.rarity as CreatureRarity)) {
    bag.add('rarity', '`rarity` must be one of: common, uncommon, rare, unique');
    ok = false;
  } else rarity = obj.rarity as CreatureRarity;

  const ac = requireNumber(bag, 'ac', obj.ac);
  if (ac === null) ok = false;
  const fortitude = requireNumber(bag, 'fortitude', obj.fortitude);
  if (fortitude === null) ok = false;
  const reflex = requireNumber(bag, 'reflex', obj.reflex);
  if (reflex === null) ok = false;
  const will = requireNumber(bag, 'will', obj.will);
  if (will === null) ok = false;
  const perception = requireNumber(bag, 'perception', obj.perception);
  if (perception === null) ok = false;
  const hp = requireNumber(bag, 'hp', obj.hp);
  if (hp === null) ok = false;

  const immunities = requireStringArray(bag, 'immunities', obj.immunities);
  if (immunities === null) ok = false;

  const resistancesRaw = requireArray(bag, 'resistances', obj.resistances);
  const resistances: { type: string; value: number }[] = [];
  if (resistancesRaw === null) ok = false;
  else {
    for (let i = 0; i < resistancesRaw.length; i++) {
      const r = validateDamageType(bag, `resistances[${i}]`, resistancesRaw[i]);
      if (r === null) ok = false;
      else resistances.push(r);
    }
  }

  const weaknessesRaw = requireArray(bag, 'weaknesses', obj.weaknesses);
  const weaknesses: { type: string; value: number }[] = [];
  if (weaknessesRaw === null) ok = false;
  else {
    for (let i = 0; i < weaknessesRaw.length; i++) {
      const w = validateDamageType(bag, `weaknesses[${i}]`, weaknessesRaw[i]);
      if (w === null) ok = false;
      else weaknesses.push(w);
    }
  }

  const speed = validateRecordOfNumbers(bag, 'speed', obj.speed);
  if (speed === null) ok = false;

  const attacksRaw = requireArray(bag, 'attacks', obj.attacks);
  const attacks: Attack[] = [];
  if (attacksRaw === null) ok = false;
  else {
    for (let i = 0; i < attacksRaw.length; i++) {
      const a = validateAttack(bag, `attacks[${i}]`, attacksRaw[i]);
      if (a === null) ok = false;
      else attacks.push(a);
    }
  }

  const passive = validateAbilityArray(bag, 'passiveAbilities', obj.passiveAbilities);
  if (passive === null) ok = false;
  const reactive = validateAbilityArray(bag, 'reactiveAbilities', obj.reactiveAbilities);
  if (reactive === null) ok = false;
  const active = validateAbilityArray(bag, 'activeAbilities', obj.activeAbilities);
  if (active === null) ok = false;

  const skills = validateRecordOfNumbers(bag, 'skills', obj.skills);
  if (skills === null) ok = false;

  const tags = requireStringArray(bag, 'tags', obj.tags);
  if (tags === null) ok = false;

  let alignment: string | undefined;
  if (obj.alignment !== undefined) {
    const s = requireString(bag, 'alignment', obj.alignment);
    if (s === null) ok = false;
    else alignment = s;
  }
  let source: string | undefined;
  if (obj.source !== undefined) {
    const s = requireString(bag, 'source', obj.source);
    if (s === null) ok = false;
    else source = s;
  }
  let notes: string | undefined;
  if (obj.notes !== undefined) {
    const s = requireString(bag, 'notes', obj.notes);
    if (s === null) ok = false;
    else notes = s;
  }

  let spellcasting: SpellcastingBlock[] | undefined;
  if (obj.spellcasting !== undefined) {
    const arr = requireArray(bag, 'spellcasting', obj.spellcasting);
    if (arr === null) ok = false;
    else {
      const blocks: SpellcastingBlock[] = [];
      for (let i = 0; i < arr.length; i++) {
        const b = validateSpellcastingBlock(bag, `spellcasting[${i}]`, arr[i]);
        if (b === null) ok = false;
        else blocks.push(b);
      }
      spellcasting = blocks;
    }
  }

  if (!ok) return { creature: null, issues: bag.issues };

  const creature: Creature = {
    id: id as string,
    name: name as string,
    level: level as number,
    traits: traits as string[],
    size: size as CreatureSize,
    rarity: rarity as CreatureRarity,
    ac: ac as number,
    fortitude: fortitude as number,
    reflex: reflex as number,
    will: will as number,
    perception: perception as number,
    hp: hp as number,
    immunities: immunities as string[],
    resistances,
    weaknesses,
    speed: speed as Record<string, number>,
    attacks,
    passiveAbilities: passive as Ability[],
    reactiveAbilities: reactive as Ability[],
    activeAbilities: active as Ability[],
    skills: skills as Record<string, number>,
    tags: tags as string[],
    ...(alignment !== undefined ? { alignment } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(spellcasting !== undefined ? { spellcasting } : {})
  };
  return { creature, issues: bag.issues };
}

function validateAbilityArray(bag: IssueBag, path: string, raw: unknown): Ability[] | null {
  const arr = requireArray(bag, path, raw);
  if (arr === null) return null;
  const out: Ability[] = [];
  let ok = true;
  for (let i = 0; i < arr.length; i++) {
    const a = validateAbility(bag, `${path}[${i}]`, arr[i]);
    if (a === null) ok = false;
    else out.push(a);
  }
  return ok ? out : null;
}
