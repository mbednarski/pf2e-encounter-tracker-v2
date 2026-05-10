import type {
  Ability,
  ActionCost,
  Attack,
  AttackType,
  CreatureRarity,
  DamageComponent,
  DisableCheck,
  Hazard,
  HazardRoutine
} from '../../domain';
import type { ValidationIssue } from './envelope';

const RARITIES: ReadonlySet<CreatureRarity> = new Set(['common', 'uncommon', 'rare', 'unique']);
const ATTACK_TYPES: ReadonlySet<AttackType> = new Set(['melee', 'ranged']);
const ACTION_COSTS = new Set<ActionCost>([1, 2, 3, 'free', 'reaction']);

export type ParseOutcome<T> =
  | { ok: true; value: T; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

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
    bag.add(path, 'must be a finite number');
    return null;
  }
  return value;
}

function requirePositiveInteger(bag: IssueBag, path: string, value: unknown): number | null {
  const n = requireNumber(bag, path, value);
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 1) {
    bag.add(path, 'must be a positive integer');
    return null;
  }
  return n;
}

function requireString(bag: IssueBag, path: string, value: unknown): string | null {
  if (typeof value !== 'string') {
    bag.add(path, 'must be a string');
    return null;
  }
  return value;
}

function requireStringArray(bag: IssueBag, path: string, value: unknown): string[] | null {
  if (!isStringArray(value)) {
    bag.add(path, 'must be an array of strings');
    return null;
  }
  return value;
}

function requireArray(bag: IssueBag, path: string, value: unknown): unknown[] | null {
  if (!Array.isArray(value)) {
    bag.add(path, 'must be an array');
    return null;
  }
  return value;
}

function requireObject(bag: IssueBag, path: string, value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    bag.add(path, 'must be a mapping (object)');
    return null;
  }
  return value;
}

function validateDamageType(
  bag: IssueBag,
  path: string,
  raw: unknown
): { type: string; value: number } | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  const type = requireString(bag, `${path}.type`, obj.type);
  const value = requireNumber(bag, `${path}.value`, obj.value);
  if (type === null || value === null) return null;
  return { type, value };
}

function validateDamageComponent(bag: IssueBag, path: string, raw: unknown): DamageComponent | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const type = requireString(bag, `${path}.type`, obj.type);
  if (type === null) ok = false;

  let dice: number | undefined;
  if (obj.dice !== undefined) {
    const n = requireNumber(bag, `${path}.dice`, obj.dice);
    if (n === null) ok = false;
    else dice = n;
  }
  let dieSize: number | undefined;
  if (obj.dieSize !== undefined) {
    const n = requireNumber(bag, `${path}.dieSize`, obj.dieSize);
    if (n === null) ok = false;
    else dieSize = n;
  }
  let bonus: number | undefined;
  if (obj.bonus !== undefined) {
    const n = requireNumber(bag, `${path}.bonus`, obj.bonus);
    if (n === null) ok = false;
    else bonus = n;
  }
  let persistent: boolean | undefined;
  if (obj.persistent !== undefined) {
    if (typeof obj.persistent !== 'boolean') {
      bag.add(`${path}.persistent`, 'must be a boolean');
      ok = false;
    } else persistent = obj.persistent;
  }

  if (!ok || type === null) return null;
  const out: DamageComponent = { type };
  if (dice !== undefined) out.dice = dice;
  if (dieSize !== undefined) out.dieSize = dieSize;
  if (bonus !== undefined) out.bonus = bonus;
  if (persistent !== undefined) out.persistent = persistent;
  return out;
}

function validateAttack(bag: IssueBag, path: string, raw: unknown): Attack | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const name = requireString(bag, `${path}.name`, obj.name);
  if (name === null) ok = false;

  let type: AttackType | null = null;
  if (typeof obj.type !== 'string' || !ATTACK_TYPES.has(obj.type as AttackType)) {
    bag.add(`${path}.type`, 'must be one of: melee, ranged');
    ok = false;
  } else type = obj.type as AttackType;

  const modifier = requireNumber(bag, `${path}.modifier`, obj.modifier);
  if (modifier === null) ok = false;
  const traits = requireStringArray(bag, `${path}.traits`, obj.traits);
  if (traits === null) ok = false;

  const damageRaw = requireArray(bag, `${path}.damage`, obj.damage);
  const damage: DamageComponent[] = [];
  if (damageRaw === null) ok = false;
  else {
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

  if (!ok || name === null || type === null || modifier === null || traits === null) return null;
  return {
    name,
    type,
    modifier,
    traits,
    damage,
    ...(effects !== undefined ? { effects } : {})
  };
}

function validateAbility(bag: IssueBag, path: string, raw: unknown): Ability | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const name = requireString(bag, `${path}.name`, obj.name);
  if (name === null) ok = false;
  const description = requireString(bag, `${path}.description`, obj.description);
  if (description === null) ok = false;

  let actions: ActionCost | undefined;
  if (obj.actions !== undefined) {
    if (!ACTION_COSTS.has(obj.actions as ActionCost)) {
      bag.add(`${path}.actions`, 'must be 1, 2, 3, "free", or "reaction"');
      ok = false;
    } else actions = obj.actions as ActionCost;
  }
  let traits: string[] | undefined;
  if (obj.traits !== undefined) {
    const t = requireStringArray(bag, `${path}.traits`, obj.traits);
    if (t === null) ok = false;
    else traits = t;
  }
  const optStrings: Record<'trigger' | 'frequency' | 'requirements', string | undefined> = {
    trigger: undefined,
    frequency: undefined,
    requirements: undefined
  };
  for (const key of ['trigger', 'frequency', 'requirements'] as const) {
    if (obj[key] !== undefined) {
      const s = requireString(bag, `${path}.${key}`, obj[key]);
      if (s === null) ok = false;
      else optStrings[key] = s;
    }
  }

  if (!ok || name === null || description === null) return null;
  const out: Ability = { name, description };
  if (actions !== undefined) out.actions = actions;
  if (traits !== undefined) out.traits = traits;
  if (optStrings.trigger !== undefined) out.trigger = optStrings.trigger;
  if (optStrings.frequency !== undefined) out.frequency = optStrings.frequency;
  if (optStrings.requirements !== undefined) out.requirements = optStrings.requirements;
  return out;
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

function validateDisableCheck(bag: IssueBag, path: string, raw: unknown): DisableCheck | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const skill = requireString(bag, `${path}.skill`, obj.skill);
  if (skill === null) ok = false;
  const dc = requireNumber(bag, `${path}.dc`, obj.dc);
  if (dc === null) ok = false;
  const requiredSuccesses = requirePositiveInteger(
    bag,
    `${path}.requiredSuccesses`,
    obj.requiredSuccesses
  );
  if (requiredSuccesses === null) ok = false;

  let note: string | undefined;
  if (obj.note !== undefined) {
    const s = requireString(bag, `${path}.note`, obj.note);
    if (s === null) ok = false;
    else note = s;
  }

  if (!ok || skill === null || dc === null || requiredSuccesses === null) return null;
  return { skill, dc, requiredSuccesses, ...(note !== undefined ? { note } : {}) };
}

function validateRoutine(bag: IssueBag, path: string, raw: unknown): HazardRoutine | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;
  const actions = requirePositiveInteger(bag, `${path}.actions`, obj.actions);
  if (actions === null) ok = false;
  const description = requireString(bag, `${path}.description`, obj.description);
  if (description === null) ok = false;
  if (!ok || actions === null || description === null) return null;
  return { actions, description };
}

export function validateHazard(raw: unknown, documentIndex: number): ParseOutcome<Hazard> {
  const bag = new IssueBag(documentIndex);

  const obj = requireObject(bag, '', raw);
  if (!obj) return { ok: false, issues: bag.issues };

  let ok = true;

  const id = requireString(bag, 'id', obj.id);
  if (id === null) ok = false;
  const name = requireString(bag, 'name', obj.name);
  if (name === null) ok = false;
  const level = requireNumber(bag, 'level', obj.level);
  if (level === null) ok = false;
  const traits = requireStringArray(bag, 'traits', obj.traits);
  if (traits === null) ok = false;

  let rarity: CreatureRarity | null = null;
  if (typeof obj.rarity !== 'string' || !RARITIES.has(obj.rarity as CreatureRarity)) {
    bag.add('rarity', 'must be one of: common, uncommon, rare, unique');
    ok = false;
  } else rarity = obj.rarity as CreatureRarity;

  const stealth = requireNumber(bag, 'stealth', obj.stealth);
  if (stealth === null) ok = false;
  let stealthNote: string | undefined;
  if (obj.stealthNote !== undefined) {
    const s = requireString(bag, 'stealthNote', obj.stealthNote);
    if (s === null) ok = false;
    else stealthNote = s;
  }

  let ac: number | undefined;
  if (obj.ac !== undefined) {
    const n = requireNumber(bag, 'ac', obj.ac);
    if (n === null) ok = false;
    else ac = n;
  }
  let fortitude: number | undefined;
  if (obj.fortitude !== undefined) {
    const n = requireNumber(bag, 'fortitude', obj.fortitude);
    if (n === null) ok = false;
    else fortitude = n;
  }
  let reflex: number | undefined;
  if (obj.reflex !== undefined) {
    const n = requireNumber(bag, 'reflex', obj.reflex);
    if (n === null) ok = false;
    else reflex = n;
  }
  let will: number | undefined;
  if (obj.will !== undefined) {
    const n = requireNumber(bag, 'will', obj.will);
    if (n === null) ok = false;
    else will = n;
  }
  let perception: number | undefined;
  if (obj.perception !== undefined) {
    const n = requireNumber(bag, 'perception', obj.perception);
    if (n === null) ok = false;
    else perception = n;
  }
  let hp: number | undefined;
  if (obj.hp !== undefined) {
    const n = requireNumber(bag, 'hp', obj.hp);
    if (n === null) ok = false;
    else hp = n;
  }
  let hardness: number | undefined;
  if (obj.hardness !== undefined) {
    const n = requireNumber(bag, 'hardness', obj.hardness);
    if (n === null) ok = false;
    else hardness = n;
  }

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

  const disableChecksRaw = requireArray(bag, 'disableChecks', obj.disableChecks);
  const disableChecks: DisableCheck[] = [];
  if (disableChecksRaw === null) {
    ok = false;
  } else if (disableChecksRaw.length === 0) {
    bag.add('disableChecks', 'must be a non-empty array');
    ok = false;
  } else {
    for (let i = 0; i < disableChecksRaw.length; i++) {
      const c = validateDisableCheck(bag, `disableChecks[${i}]`, disableChecksRaw[i]);
      if (c === null) ok = false;
      else disableChecks.push(c);
    }
  }

  const routine = validateRoutine(bag, 'routine', obj.routine);
  if (routine === null) ok = false;

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

  const tags = requireStringArray(bag, 'tags', obj.tags);
  if (tags === null) ok = false;

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
  let description: string | undefined;
  if (obj.description !== undefined) {
    const s = requireString(bag, 'description', obj.description);
    if (s === null) ok = false;
    else description = s;
  }

  if (
    !ok ||
    id === null ||
    name === null ||
    level === null ||
    traits === null ||
    rarity === null ||
    stealth === null ||
    immunities === null ||
    passive === null ||
    reactive === null ||
    active === null ||
    tags === null ||
    routine === null
  ) {
    return { ok: false, issues: bag.issues };
  }

  const hazard: Hazard = {
    id,
    name,
    level,
    traits,
    rarity,
    stealth,
    immunities,
    resistances,
    weaknesses,
    disableChecks,
    routine,
    passiveAbilities: passive,
    reactiveAbilities: reactive,
    activeAbilities: active,
    attacks,
    tags,
    ...(stealthNote !== undefined ? { stealthNote } : {}),
    ...(ac !== undefined ? { ac } : {}),
    ...(fortitude !== undefined ? { fortitude } : {}),
    ...(reflex !== undefined ? { reflex } : {}),
    ...(will !== undefined ? { will } : {}),
    ...(perception !== undefined ? { perception } : {}),
    ...(hp !== undefined ? { hp } : {}),
    ...(hardness !== undefined ? { hardness } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(notes !== undefined ? { notes } : {})
  };
  return { ok: true, value: hazard, issues: bag.issues };
}
