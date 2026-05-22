import type { Attack, CreatureImmunity, CreatureRarity, Hazard } from '../../domain';
import {
  IssueBag,
  type ParseOutcome,
  requireArray,
  requireNumber,
  requireObject,
  requireString,
  requireStringArray,
  validateAbilityArray,
  validateAttack,
  validateCreatureImmunity,
  validateDamageType
} from './creature-validator';

const RARITIES: ReadonlySet<CreatureRarity> = new Set(['common', 'uncommon', 'rare', 'unique']);

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
  const ac = requireNumber(bag, 'ac', obj.ac);
  if (ac === null) ok = false;
  const fortitude = requireNumber(bag, 'fortitude', obj.fortitude);
  if (fortitude === null) ok = false;
  const reflex = requireNumber(bag, 'reflex', obj.reflex);
  if (reflex === null) ok = false;
  const will = requireNumber(bag, 'will', obj.will);
  if (will === null) ok = false;
  const hp = requireNumber(bag, 'hp', obj.hp);
  if (hp === null) ok = false;

  let hardness: number | undefined;
  if (obj.hardness !== undefined) {
    const n = requireNumber(bag, 'hardness', obj.hardness);
    if (n === null) ok = false;
    else hardness = n;
  }

  const immunitiesRaw = requireArray(bag, 'immunities', obj.immunities);
  const immunities: CreatureImmunity[] = [];
  if (immunitiesRaw === null) ok = false;
  else {
    for (let i = 0; i < immunitiesRaw.length; i++) {
      const im = validateCreatureImmunity(bag, `immunities[${i}]`, immunitiesRaw[i]);
      if (im === null) ok = false;
      else immunities.push(im);
    }
  }

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

  const optionalText: Record<
    'stealthNote' | 'routine' | 'disable' | 'reset' | 'description' | 'source' | 'notes',
    string | undefined
  > = {
    stealthNote: undefined,
    routine: undefined,
    disable: undefined,
    reset: undefined,
    description: undefined,
    source: undefined,
    notes: undefined
  };
  for (const key of [
    'stealthNote',
    'routine',
    'disable',
    'reset',
    'description',
    'source',
    'notes'
  ] as const) {
    if (obj[key] !== undefined) {
      const s = requireString(bag, key, obj[key]);
      if (s === null) ok = false;
      else optionalText[key] = s;
    }
  }

  if (
    !ok ||
    id === null ||
    name === null ||
    level === null ||
    traits === null ||
    rarity === null ||
    stealth === null ||
    ac === null ||
    fortitude === null ||
    reflex === null ||
    will === null ||
    hp === null ||
    passive === null ||
    reactive === null ||
    active === null ||
    tags === null
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
    ac,
    fortitude,
    reflex,
    will,
    hp,
    immunities,
    resistances,
    weaknesses,
    attacks,
    passiveAbilities: passive,
    reactiveAbilities: reactive,
    activeAbilities: active,
    tags,
    ...(hardness !== undefined ? { hardness } : {}),
    ...(optionalText.stealthNote !== undefined ? { stealthNote: optionalText.stealthNote } : {}),
    ...(optionalText.routine !== undefined ? { routine: optionalText.routine } : {}),
    ...(optionalText.disable !== undefined ? { disable: optionalText.disable } : {}),
    ...(optionalText.reset !== undefined ? { reset: optionalText.reset } : {}),
    ...(optionalText.description !== undefined ? { description: optionalText.description } : {}),
    ...(optionalText.source !== undefined ? { source: optionalText.source } : {}),
    ...(optionalText.notes !== undefined ? { notes: optionalText.notes } : {})
  };
  return { ok: true, value: hazard, issues: bag.issues };
}
