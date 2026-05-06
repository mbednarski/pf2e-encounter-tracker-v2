import type { AppliedEffect, Duration, PartyMember } from '../../domain';
import type { ValidationIssue } from './envelope';

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

function requireNonNegativeNumber(bag: IssueBag, path: string, value: unknown): number | null {
  const n = requireNumber(bag, path, value);
  if (n === null) return null;
  if (n < 0) {
    bag.add(path, 'must be >= 0');
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

function requireNonEmptyString(bag: IssueBag, path: string, value: unknown): string | null {
  const s = requireString(bag, path, value);
  if (s === null) return null;
  if (s.trim() === '') {
    bag.add(path, 'must not be empty');
    return null;
  }
  return s;
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
      bag.add(`${path}.${k}`, 'must be a finite number');
      ok = false;
    } else {
      out[k] = v;
    }
  }
  return ok ? out : null;
}

function validateTypedValueArray(
  bag: IssueBag,
  path: string,
  raw: unknown
): { type: string; value: number }[] | null {
  const arr = requireArray(bag, path, raw);
  if (!arr) return null;
  const out: { type: string; value: number }[] = [];
  let ok = true;
  for (let i = 0; i < arr.length; i++) {
    const obj = requireObject(bag, `${path}[${i}]`, arr[i]);
    if (!obj) {
      ok = false;
      continue;
    }
    const type = requireNonEmptyString(bag, `${path}[${i}].type`, obj.type);
    const value = requireNumber(bag, `${path}[${i}].value`, obj.value);
    if (type === null || value === null) ok = false;
    else out.push({ type, value });
  }
  return ok ? out : null;
}

function validateDuration(bag: IssueBag, path: string, raw: unknown): Duration | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  const type = requireString(bag, `${path}.type`, obj.type);
  if (type === null) return null;
  switch (type) {
    case 'untilTurnEnd':
    case 'untilTurnStart': {
      const combatantId = requireNonEmptyString(bag, `${path}.combatantId`, obj.combatantId);
      if (combatantId === null) return null;
      return { type, combatantId };
    }
    case 'rounds': {
      const count = requireNumber(bag, `${path}.count`, obj.count);
      if (count === null) return null;
      return { type: 'rounds', count };
    }
    case 'unlimited':
      return { type: 'unlimited' };
    case 'conditional': {
      const description = requireString(bag, `${path}.description`, obj.description);
      if (description === null) return null;
      return { type: 'conditional', description };
    }
    default:
      bag.add(`${path}.type`, 'must be one of: untilTurnEnd, untilTurnStart, rounds, unlimited, conditional');
      return null;
  }
}

function validatePersistentEffect(bag: IssueBag, path: string, raw: unknown): AppliedEffect | null {
  const obj = requireObject(bag, path, raw);
  if (!obj) return null;
  let ok = true;

  const instanceId = requireNonEmptyString(bag, `${path}.instanceId`, obj.instanceId);
  if (instanceId === null) ok = false;
  const effectId = requireNonEmptyString(bag, `${path}.effectId`, obj.effectId);
  if (effectId === null) ok = false;

  let value: number | undefined;
  if (obj.value !== undefined) {
    const n = requireNumber(bag, `${path}.value`, obj.value);
    if (n === null) ok = false;
    else value = n;
  }

  let note: string | undefined;
  if (obj.note !== undefined) {
    const s = requireString(bag, `${path}.note`, obj.note);
    if (s === null) ok = false;
    else note = s;
  }

  let parentInstanceId: string | undefined;
  if (obj.parentInstanceId !== undefined) {
    const s = requireNonEmptyString(bag, `${path}.parentInstanceId`, obj.parentInstanceId);
    if (s === null) ok = false;
    else parentInstanceId = s;
  }

  // Duration is optional in YAML; defaults to { type: 'unlimited' } since
  // persisted effects between encounters have no encounter-scoped duration.
  let duration: Duration = { type: 'unlimited' };
  if (obj.duration !== undefined) {
    const d = validateDuration(bag, `${path}.duration`, obj.duration);
    if (d === null) ok = false;
    else duration = d;
  }

  if (!ok || instanceId === null || effectId === null) return null;
  const out: AppliedEffect = { instanceId, effectId, duration };
  if (value !== undefined) out.value = value;
  if (note !== undefined) out.note = note;
  if (parentInstanceId !== undefined) out.parentInstanceId = parentInstanceId;
  return out;
}

export function validatePartyMember(raw: unknown, documentIndex: number): ParseOutcome<PartyMember> {
  const bag = new IssueBag(documentIndex);
  const obj = requireObject(bag, '', raw);
  if (!obj) return { ok: false, issues: bag.issues };

  let ok = true;

  const id = requireNonEmptyString(bag, 'id', obj.id);
  if (id === null) ok = false;
  const name = requireNonEmptyString(bag, 'name', obj.name);
  if (name === null) ok = false;

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

  const tags = requireStringArray(bag, 'tags', obj.tags);
  if (tags === null) ok = false;
  const companionIds = requireStringArray(bag, 'companionIds', obj.companionIds);
  if (companionIds === null) ok = false;

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

  let playerName: string | undefined;
  if (obj.playerName !== undefined) {
    const s = requireString(bag, 'playerName', obj.playerName);
    if (s === null) ok = false;
    else playerName = s;
  }
  let ancestry: string | undefined;
  if (obj.ancestry !== undefined) {
    const s = requireString(bag, 'ancestry', obj.ancestry);
    if (s === null) ok = false;
    else ancestry = s;
  }
  let classField: string | undefined;
  if (obj.class !== undefined) {
    const s = requireString(bag, 'class', obj.class);
    if (s === null) ok = false;
    else classField = s;
  }
  let notes: string | undefined;
  if (obj.notes !== undefined) {
    const s = requireString(bag, 'notes', obj.notes);
    if (s === null) ok = false;
    else notes = s;
  }

  let speed: Record<string, number> | undefined;
  if (obj.speed !== undefined) {
    const r = validateRecordOfNumbers(bag, 'speed', obj.speed);
    if (r === null) ok = false;
    else speed = r;
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

  if (
    !ok ||
    id === null ||
    name === null ||
    level === null ||
    ac === null ||
    fortitude === null ||
    reflex === null ||
    will === null ||
    perception === null ||
    hp === null ||
    tags === null ||
    companionIds === null
  ) {
    return { ok: false, issues: bag.issues };
  }

  const member: PartyMember = {
    id,
    name,
    level,
    ac,
    fortitude,
    reflex,
    will,
    perception,
    hp,
    persistentEffects,
    companionIds,
    tags
  };
  if (playerName !== undefined) member.playerName = playerName;
  if (ancestry !== undefined) member.ancestry = ancestry;
  if (classField !== undefined) member.class = classField;
  if (notes !== undefined) member.notes = notes;
  if (speed !== undefined) member.speed = speed;
  if (skills !== undefined) member.skills = skills;
  if (resistances !== undefined) member.resistances = resistances;
  if (weaknesses !== undefined) member.weaknesses = weaknesses;
  if (immunities !== undefined) member.immunities = immunities;

  return { ok: true, value: member, issues: bag.issues };
}
