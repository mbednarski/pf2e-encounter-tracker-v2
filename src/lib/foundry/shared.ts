/**
 * Helpers shared by the Foundry NPC mapper (`mapper.ts`) and the Foundry
 * hazard mapper (`hazard-mapper.ts`). Foundry stores Strikes, actions, and
 * reactions identically on `npc` and `hazard` actors, so the item-level
 * mapping is reused verbatim by both.
 */
import type {
  Ability,
  AbilitySave,
  ActionCost,
  Attack,
  AttackType,
  CreatureImmunity,
  CreatureRarity,
  DamageComponent
} from '../../domain';
import { stripFoundryMarkup } from './text';
import type {
  FoundryActionItem,
  FoundryActionSystem,
  FoundryItem,
  FoundryMeleeItem,
  FoundryMeleeSystem
} from './types';

export type MapResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string };

export type Warn = (msg: string) => void;

const RARITIES: ReadonlySet<CreatureRarity> = new Set(['common', 'uncommon', 'rare', 'unique']);
const THROWN_TRAIT = /^thrown(-\d+)?$/;
const PHYSICAL_DAMAGE: ReadonlySet<string> = new Set(['slashing', 'piercing', 'bludgeoning']);

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseDamageString(raw: string): DamageComponent | null {
  // Examples: "1d6+1", "2d8", "1d4-1", "+5"
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

export function requireNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapRarity(raw: string | undefined): CreatureRarity {
  if (raw && RARITIES.has(raw as CreatureRarity)) return raw as CreatureRarity;
  return 'common';
}

export function mapImmunities(
  raw: { type?: string; exceptions?: string[] }[] | undefined
): CreatureImmunity[] {
  const out: CreatureImmunity[] = [];
  for (const im of raw ?? []) {
    if (typeof im?.type !== 'string') continue;
    const entry: CreatureImmunity = { type: im.type };
    if (Array.isArray(im.exceptions) && im.exceptions.length > 0) {
      entry.exceptions = im.exceptions.filter((e): e is string => typeof e === 'string');
    }
    out.push(entry);
  }
  return out;
}

export function mapDamageTypeArray(
  raw: { type?: string; value?: number; exceptions?: string[] }[] | undefined
): { type: string; value: number }[] {
  const out: { type: string; value: number }[] = [];
  for (const r of raw ?? []) {
    if (typeof r?.type !== 'string' || typeof r?.value !== 'number') continue;
    out.push({ type: r.type, value: r.value });
  }
  return out;
}

function isRangedAttack(range: FoundryMeleeSystem['range']): boolean {
  if (range == null) return false;
  if (typeof range === 'string') return range.trim() !== '';
  return typeof range.increment === 'number' && range.increment > 0;
}

export function mapAttack(item: FoundryMeleeItem): Attack | null {
  if (typeof item.name !== 'string') return null;
  const sys: FoundryMeleeSystem = item.system ?? {};
  const modifier = typeof sys.bonus?.value === 'number' ? sys.bonus.value : 0;
  const traits = Array.isArray(sys.traits?.value)
    ? sys.traits.value.filter((t): t is string => typeof t === 'string')
    : [];
  // Foundry stores thrown melee weapons (javelin, dagger) as type:"melee" with a
  // positive range.increment so the engine can resolve both modes. Bestiary
  // statblocks render these as melee Strikes, so prefer melee when the trait
  // says thrown.
  const thrown = traits.some((t) => THROWN_TRAIT.test(t));
  const type: AttackType = thrown ? 'melee' : isRangedAttack(sys.range) ? 'ranged' : 'melee';

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
  const physicalIndex = damage.findIndex((d) => PHYSICAL_DAMAGE.has(d.type));
  if (physicalIndex > 0) out.primaryDamageIndex = physicalIndex;
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
  const isLimitedUse = frequency !== undefined ? true : undefined;

  const damage: DamageComponent[] = [];
  for (const roll of Object.values(sys.damageRolls ?? {})) {
    if (!roll) continue;
    const parsed = typeof roll.damage === 'string' ? parseDamageString(roll.damage) : null;
    if (!parsed) continue;
    parsed.type = typeof roll.damageType === 'string' && roll.damageType !== '' ? roll.damageType : 'untyped';
    if (roll.category === 'persistent') parsed.persistent = true;
    damage.push(parsed);
  }

  let save: AbilitySave | undefined;
  if (
    sys.savingThrow &&
    typeof sys.savingThrow.statistic === 'string' &&
    typeof sys.savingThrow.dc === 'number'
  ) {
    save = { defense: sys.savingThrow.statistic, dc: sys.savingThrow.dc };
    if (sys.savingThrow.basic === true) save.basic = true;
  }

  const ability: Ability = { name: item.name, description };
  if (actions !== undefined) ability.actions = actions;
  if (traits !== undefined && traits.length > 0) ability.traits = traits;
  if (frequency !== undefined) ability.frequency = frequency;
  if (damage.length > 0) ability.damage = damage;
  if (save !== undefined) ability.save = save;
  if (isLimitedUse !== undefined) ability.isLimitedUse = isLimitedUse;
  return ability;
}

export function partitionAbilities(
  items: FoundryItem[],
  warn: Warn
): {
  passive: Ability[];
  reactive: Ability[];
  active: Ability[];
} {
  const passive: Ability[] = [];
  const reactive: Ability[] = [];
  const active: Ability[] = [];
  for (const item of items) {
    if (item.type !== 'action') continue;
    const actionItem = item as FoundryActionItem;
    const sys = actionItem.system;
    const ability = mapAbility(actionItem);
    if (!ability) continue;
    const kind = sys?.actionType?.value ?? 'passive';
    if (kind === 'passive') passive.push(ability);
    else if (kind === 'reaction' || kind === 'free') reactive.push(ability);
    else if (kind === 'action') active.push(ability);
    else {
      warn(`Ability "${ability.name}": unknown actionType "${kind}", treated as active`);
      active.push(ability);
    }
  }
  return { passive, reactive, active };
}

export function mapAttacks(items: FoundryItem[]): Attack[] {
  const attacks: Attack[] = [];
  for (const item of items) {
    if (item.type !== 'melee') continue;
    const a = mapAttack(item as FoundryMeleeItem);
    if (a) attacks.push(a);
  }
  return attacks;
}
