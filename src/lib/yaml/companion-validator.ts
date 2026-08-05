import type { AppliedEffect, Attack, Companion, CompanionType, CreatureSize } from '../../domain';
import { validateAttack } from './creature-validator';
import {
  IssueBag,
  requireArray,
  requireNonEmptyString,
  requireNonNegativeNumber,
  requireNumber,
  requireString,
  requireStringArray,
  validatePersistentEffect,
  validateRecordOfNumbers,
  validateTypedValueArray,
  type ParseOutcome
} from './party-member-validator';

const COMPANION_TYPES: ReadonlySet<string> = new Set<CompanionType>([
  'animal-companion',
  'familiar',
  'eidolon',
  'other'
]);

const CREATURE_SIZES: ReadonlySet<string> = new Set<CreatureSize>([
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan'
]);

function requireObject(bag: IssueBag, path: string, value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    bag.add(path, 'must be a mapping (object)');
    return null;
  }
  return value as Record<string, unknown>;
}

export function validateCompanion(raw: unknown, documentIndex: number): ParseOutcome<Companion> {
  const bag = new IssueBag(documentIndex);
  const obj = requireObject(bag, '', raw);
  if (!obj) return { ok: false, issues: bag.issues };

  let ok = true;

  const id = requireNonEmptyString(bag, 'id', obj.id);
  if (id === null) ok = false;
  const name = requireNonEmptyString(bag, 'name', obj.name);
  if (name === null) ok = false;
  const masterId = requireNonEmptyString(bag, 'masterId', obj.masterId);
  if (masterId === null) ok = false;

  const typeRaw = requireNonEmptyString(bag, 'type', obj.type);
  let type: CompanionType | null = null;
  if (typeRaw === null) {
    ok = false;
  } else if (!COMPANION_TYPES.has(typeRaw)) {
    bag.add('type', 'must be one of: animal-companion, familiar, eidolon, other');
    ok = false;
  } else {
    type = typeRaw as CompanionType;
  }

  const level = requireNumber(bag, 'level', obj.level);
  if (level === null) ok = false;
  else if (level < 1) {
    bag.add('level', 'must be >= 1');
    ok = false;
  }

  const ac = requireNonNegativeNumber(bag, 'ac', obj.ac);
  if (ac === null) ok = false;
  const fortitude = requireNonNegativeNumber(bag, 'fortitude', obj.fortitude);
  if (fortitude === null) ok = false;
  const reflex = requireNonNegativeNumber(bag, 'reflex', obj.reflex);
  if (reflex === null) ok = false;
  const will = requireNonNegativeNumber(bag, 'will', obj.will);
  if (will === null) ok = false;
  const perception = requireNonNegativeNumber(bag, 'perception', obj.perception);
  if (perception === null) ok = false;
  const hp = requireNonNegativeNumber(bag, 'hp', obj.hp);
  if (hp === null) ok = false;

  const speed = validateRecordOfNumbers(bag, 'speed', obj.speed);
  if (speed === null) ok = false;

  const tags = requireStringArray(bag, 'tags', obj.tags);
  if (tags === null) ok = false;

  const attacksRaw = requireArray(bag, 'attacks', obj.attacks);
  const attacks: Attack[] = [];
  if (attacksRaw === null) {
    ok = false;
  } else {
    for (let i = 0; i < attacksRaw.length; i++) {
      const a = validateAttack(bag, `attacks[${i}]`, attacksRaw[i]);
      if (a === null) ok = false;
      else attacks.push(a);
    }
  }

  const persistentEffectsRaw = requireArray(bag, 'persistentEffects', obj.persistentEffects);
  const persistentEffects: AppliedEffect[] = [];
  if (persistentEffectsRaw === null) {
    ok = false;
  } else {
    for (let i = 0; i < persistentEffectsRaw.length; i++) {
      const e = validatePersistentEffect(bag, `persistentEffects[${i}]`, persistentEffectsRaw[i]);
      if (e === null) ok = false;
      else persistentEffects.push(e);
    }
  }

  let traits: string[] | undefined;
  if (obj.traits !== undefined) {
    const a = requireStringArray(bag, 'traits', obj.traits);
    if (a === null) ok = false;
    else traits = a;
  }

  let size: CreatureSize | undefined;
  if (obj.size !== undefined) {
    const s = requireNonEmptyString(bag, 'size', obj.size);
    if (s === null) ok = false;
    else if (!CREATURE_SIZES.has(s)) {
      bag.add('size', 'must be one of: tiny, small, medium, large, huge, gargantuan');
      ok = false;
    } else {
      size = s as CreatureSize;
    }
  }

  let skills: Record<string, number> | undefined;
  if (obj.skills !== undefined) {
    const r = validateRecordOfNumbers(bag, 'skills', obj.skills);
    if (r === null) ok = false;
    else skills = r;
  }

  let resistances: { type: string; value: number }[] | undefined;
  if (obj.resistances !== undefined) {
    const v = validateTypedValueArray(bag, 'resistances', obj.resistances);
    if (v === null) ok = false;
    else resistances = v;
  }
  let weaknesses: { type: string; value: number }[] | undefined;
  if (obj.weaknesses !== undefined) {
    const v = validateTypedValueArray(bag, 'weaknesses', obj.weaknesses);
    if (v === null) ok = false;
    else weaknesses = v;
  }
  let immunities: string[] | undefined;
  if (obj.immunities !== undefined) {
    const a = requireStringArray(bag, 'immunities', obj.immunities);
    if (a === null) ok = false;
    else immunities = a;
  }

  let notes: string | undefined;
  if (obj.notes !== undefined) {
    const s = requireString(bag, 'notes', obj.notes);
    if (s === null) ok = false;
    else notes = s;
  }

  if (
    !ok ||
    id === null ||
    name === null ||
    masterId === null ||
    type === null ||
    level === null ||
    ac === null ||
    fortitude === null ||
    reflex === null ||
    will === null ||
    perception === null ||
    hp === null ||
    speed === null ||
    tags === null
  ) {
    return { ok: false, issues: bag.issues };
  }

  const companion: Companion = {
    id,
    name,
    type,
    masterId,
    level,
    ac,
    fortitude,
    reflex,
    will,
    perception,
    hp,
    speed,
    attacks,
    persistentEffects,
    tags
  };
  if (traits !== undefined) companion.traits = traits;
  if (size !== undefined) companion.size = size;
  if (skills !== undefined) companion.skills = skills;
  if (resistances !== undefined) companion.resistances = resistances;
  if (weaknesses !== undefined) companion.weaknesses = weaknesses;
  if (immunities !== undefined) companion.immunities = immunities;
  if (notes !== undefined) companion.notes = notes;

  return { ok: true, value: companion, issues: bag.issues };
}
