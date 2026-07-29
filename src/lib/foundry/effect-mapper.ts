/**
 * Maps Foundry pf2e `effect` items (the `spell-effects` pack and friends)
 * into domain `EffectDefinition`s with category `'spell'`.
 *
 * Only rule elements the tracker can automate become modifiers:
 * un-predicated `FlatModifier`s with numeric values (or values using the
 * ubiquitous `ternary(gte(@item.level,N),…)` rank formula, evaluated at the
 * effect's own level). `GrantItem` rules that grant a built-in condition
 * become implied effects. Everything else (auras, resistances, damage dice,
 * modifier upgrades) stays in the description text for the GM to adjudicate,
 * with a short "Not automated" note so nobody trusts the sheet too much.
 */
import type {
  BonusType,
  EffectDefinition,
  EffectDurationSpec,
  EffectDurationUnit,
  Modifier,
  RoundsExpiry,
  StatTarget
} from '../../domain';
import { effectLibrary } from '../../domain';
import { slugifyName, type MapResult, type Warn } from './shared';
import { stripFoundryMarkup } from './text';

interface FoundryDuration {
  unit?: unknown;
  value?: unknown;
  expiry?: unknown;
  sustained?: unknown;
}

interface FoundryEffectDoc {
  name?: unknown;
  type?: unknown;
  system?: {
    description?: { value?: unknown };
    duration?: FoundryDuration;
    level?: { value?: unknown };
    rules?: unknown;
    traits?: { value?: unknown };
  };
}

interface FoundryRule {
  key?: unknown;
  selector?: unknown;
  type?: unknown;
  value?: unknown;
  predicate?: unknown;
  uuid?: unknown;
}

const NAME_PREFIX = /^(spell effect|effect|aura|stance):\s*/i;

const SELECTOR_TO_STAT: Record<string, StatTarget> = {
  ac: 'ac',
  fortitude: 'fortitude',
  reflex: 'reflex',
  will: 'will',
  'saving-throw': 'allSaves',
  perception: 'perception',
  attack: 'attackRolls',
  'attack-roll': 'attackRolls',
  'strike-attack-roll': 'attackRolls',
  damage: 'damageRolls',
  'strike-damage': 'damageRolls',
  'skill-check': 'allSkills',
  'spell-attack': 'spellAttacks',
  'spell-attack-roll': 'spellAttacks',
  'spell-dc': 'spellDcs',
  'class-or-spell-dc': 'spellDcs'
};

const SKILL_SELECTORS: ReadonlySet<string> = new Set([
  'acrobatics',
  'arcana',
  'athletics',
  'crafting',
  'deception',
  'diplomacy',
  'intimidation',
  'medicine',
  'nature',
  'occultism',
  'performance',
  'religion',
  'society',
  'stealth',
  'survival',
  'thievery'
]);

const BONUS_TYPES: ReadonlySet<BonusType> = new Set(['status', 'circumstance', 'item']);

/** Rule keys that never affect tracker-visible numbers — dropped silently. */
const IGNORED_RULE_KEYS: ReadonlySet<string> = new Set([
  'RollOption',
  'ChoiceSet',
  'TokenLight',
  'TokenImage',
  'TokenName',
  'DexterityModifierCap',
  'CreatureSize',
  'ActorTraits',
  'ItemAlteration',
  'EphemeralEffect',
  'Note'
]);

const DURATION_UNITS: ReadonlySet<EffectDurationUnit> = new Set([
  'rounds',
  'minutes',
  'hours',
  'days',
  'unlimited'
]);

function numOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function mapFoundryEffectToDefinition(doc: unknown): MapResult<EffectDefinition> {
  const effect = doc as FoundryEffectDoc;
  if (!effect || typeof effect !== 'object') {
    return { ok: false, error: 'Not a JSON object' };
  }
  if (effect.type !== 'effect') {
    return { ok: false, error: `Expected a Foundry "effect" item, got type "${String(effect.type)}"` };
  }
  if (typeof effect.name !== 'string' || effect.name.trim() === '') {
    return { ok: false, error: 'Effect has no name' };
  }

  const warnings: string[] = [];
  const warn: Warn = (msg) => warnings.push(msg);

  const fullName = effect.name.trim();
  const displayName = fullName.replace(NAME_PREFIX, '');
  const id = slugifyName(fullName);
  const level = numOrUndefined(effect.system?.level?.value);

  const { modifiers, impliedEffects, notAutomated } = mapRules(effect.system?.rules, level ?? 1, warn);

  const baseDescription = stripFoundryMarkup(effect.system?.description?.value ?? '');
  const description = notAutomated.length > 0
    ? `${baseDescription}${baseDescription ? '\n' : ''}Not automated: ${notAutomated.join(', ')}.`
    : baseDescription;

  const traitsRaw = effect.system?.traits?.value;
  const traits = Array.isArray(traitsRaw)
    ? traitsRaw.filter((t): t is string => typeof t === 'string')
    : [];

  const definition: EffectDefinition = {
    id,
    name: displayName,
    category: 'spell',
    modifiers,
    hasValue: false,
    ...(description ? { description } : {}),
    ...(impliedEffects.length > 0 ? { impliedEffects } : {}),
    ...(traits.length > 0 ? { traits } : {}),
    ...(level !== undefined ? { level } : {}),
    defaultDuration: mapDuration(effect.system?.duration, warn),
    sourceSpellSlug: slugifyName(displayName.replace(/\s*\(.*\)\s*$/, ''))
  };

  return { ok: true, value: definition, warnings };
}

function mapDuration(raw: FoundryDuration | undefined, warn: Warn): EffectDurationSpec {
  const unitRaw = typeof raw?.unit === 'string' ? raw.unit : 'unlimited';
  let unit: EffectDurationUnit;
  if (DURATION_UNITS.has(unitRaw as EffectDurationUnit)) {
    unit = unitRaw as EffectDurationUnit;
  } else if (unitRaw === 'encounter') {
    unit = 'unlimited';
  } else {
    warn(`Unknown duration unit "${unitRaw}" treated as unlimited`);
    unit = 'unlimited';
  }

  const value = numOrUndefined(raw?.value);
  const expiry: RoundsExpiry | undefined =
    raw?.expiry === 'turn-end' ? 'turnEnd' : raw?.expiry === 'turn-start' ? 'turnStart' : undefined;

  return {
    unit,
    ...(value !== undefined && unit !== 'unlimited' ? { value } : {}),
    ...(expiry ? { expiry } : {}),
    ...(raw?.sustained === true ? { sustained: true } : {})
  };
}

function mapRules(
  rulesRaw: unknown,
  level: number,
  warn: Warn
): { modifiers: Modifier[]; impliedEffects: string[]; notAutomated: string[] } {
  const modifiers: Modifier[] = [];
  const impliedEffects: string[] = [];
  const notAutomated: string[] = [];
  const noteSkipped = (label: string) => {
    if (!notAutomated.includes(label)) notAutomated.push(label);
  };

  if (!Array.isArray(rulesRaw)) {
    return { modifiers, impliedEffects, notAutomated };
  }

  for (const ruleRaw of rulesRaw) {
    const rule = ruleRaw as FoundryRule;
    const key = typeof rule?.key === 'string' ? rule.key : '';
    if (!key || IGNORED_RULE_KEYS.has(key)) {
      continue;
    }

    if (key === 'FlatModifier') {
      if (rule.predicate !== undefined) {
        noteSkipped('conditional bonus');
        continue;
      }
      const value = evaluateRuleValue(rule.value, level);
      if (value === null) {
        warn(`FlatModifier value ${JSON.stringify(rule.value)} could not be evaluated`);
        noteSkipped('formula bonus');
        continue;
      }
      if (typeof rule.value === 'string') {
        warn(`Rank-dependent value evaluated at rank ${level}; heightened casts may differ`);
      }
      const bonusType: BonusType =
        typeof rule.type === 'string' && BONUS_TYPES.has(rule.type as BonusType)
          ? (rule.type as BonusType)
          : 'untyped';
      for (const selector of selectorList(rule.selector)) {
        const stat = mapSelector(selector);
        if (!stat) {
          warn(`FlatModifier selector "${selector}" is not automated`);
          continue;
        }
        modifiers.push({ stat, bonusType, value });
      }
      continue;
    }

    if (key === 'GrantItem') {
      const uuid = typeof rule.uuid === 'string' ? rule.uuid : '';
      const conditionMatch = /^Compendium\.pf2e\.conditionitems\.Item\.(.+)$/.exec(uuid);
      const conditionId = conditionMatch ? slugifyName(conditionMatch[1]) : undefined;
      if (conditionId && effectLibrary[conditionId]) {
        if (!impliedEffects.includes(conditionId)) impliedEffects.push(conditionId);
      } else {
        noteSkipped('granted item');
      }
      continue;
    }

    noteSkipped(ruleKeyLabel(key));
  }

  return { modifiers, impliedEffects, notAutomated };
}

function selectorList(raw: unknown): string[] {
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  return [];
}

function mapSelector(selector: string): StatTarget | null {
  if (SELECTOR_TO_STAT[selector]) return SELECTOR_TO_STAT[selector];
  if (SKILL_SELECTORS.has(selector)) return selector;
  return null;
}

function ruleKeyLabel(key: string): string {
  switch (key) {
    case 'Resistance':
      return 'resistance';
    case 'Weakness':
      return 'weakness';
    case 'Immunity':
      return 'immunity';
    case 'DamageDice':
      return 'bonus damage dice';
    case 'Aura':
      return 'aura';
    case 'TempHP':
      return 'temporary HP';
    case 'FastHealing':
      return 'fast healing';
    case 'AdjustModifier':
      return 'modifier adjustment';
    case 'BaseSpeed':
      return 'speed change';
    default:
      return key;
  }
}

/**
 * Evaluates a Foundry rule value: plain numbers pass through; strings are
 * accepted only when they are the common nested rank formula
 * `ternary(gte(@item.level,N),A,B)` (with A/B numbers or nested ternaries),
 * evaluated against the given level. Anything else returns null.
 */
export function evaluateRuleValue(raw: unknown, level: number): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  return evalExpr(raw.trim(), level);
}

function evalExpr(expr: string, level: number): number | null {
  const asNumber = Number(expr);
  if (expr !== '' && Number.isFinite(asNumber)) return asNumber;

  const match = /^ternary\(gte\(@item\.level,\s*(\d+)\),\s*(.+)\)$/.exec(expr);
  if (!match) return null;

  const threshold = Number(match[1]);
  const args = splitTopLevelComma(match[2]);
  if (!args) return null;

  const [whenTrue, whenFalse] = args;
  const trueValue = evalExpr(whenTrue.trim(), level);
  const falseValue = evalExpr(whenFalse.trim(), level);
  if (trueValue === null || falseValue === null) return null;

  return level >= threshold ? trueValue : falseValue;
}

function splitTopLevelComma(input: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      return [input.slice(0, i), input.slice(i + 1)];
    }
  }
  return null;
}
