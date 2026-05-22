import type { Hazard } from '../../domain';
import { stripFoundryMarkup } from './text';
import {
  type MapResult,
  type Warn,
  mapAttacks,
  mapDamageTypeArray,
  mapImmunities,
  mapRarity,
  partitionAbilities,
  requireNum,
  slugifyName
} from './shared';
import type { FoundryHazard, FoundryHazardSystem } from './hazard-types';

function mapHardness(raw: number | { value?: number } | undefined): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === 'object' && typeof raw.value === 'number' && Number.isFinite(raw.value)) {
    return raw.value;
  }
  return undefined;
}

/** Maps a non-empty stripped text block, or undefined when the source is blank. */
function textBlock(raw: string | undefined): string | undefined {
  const stripped = stripFoundryMarkup(raw);
  return stripped === '' ? undefined : stripped;
}

/**
 * Maps a single Foundry pf2e `hazard` actor document to a domain `Hazard`.
 *
 * Only complex hazards are tracked — simple hazards are a GM note, not an
 * encounter entity — so a non-complex document is rejected. Foundry stores the
 * routine and disable instructions as free-form HTML; they are HTML-stripped
 * into plain text the GM reads at the table.
 */
export function mapFoundryHazardToHazard(doc: unknown): MapResult<Hazard> {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { ok: false, error: 'Foundry document must be a JSON object' };
  }
  const hazardDoc = doc as FoundryHazard;
  if (hazardDoc.type !== 'hazard') {
    return {
      ok: false,
      error: `Expected document type "hazard", got ${JSON.stringify(hazardDoc.type)}`
    };
  }
  if (typeof hazardDoc.name !== 'string' || hazardDoc.name.trim() === '') {
    return { ok: false, error: 'Foundry hazard is missing a name' };
  }

  const sys: FoundryHazardSystem = hazardDoc.system ?? {};
  const details = sys.details ?? {};
  const attributes = sys.attributes ?? {};

  if (details.isComplex !== true) {
    return {
      ok: false,
      error: `Foundry hazard "${hazardDoc.name}" is not complex — only complex hazards are tracked as encounter participants`
    };
  }

  const level = requireNum(details.level?.value);
  if (level === null) {
    return {
      ok: false,
      error: `Foundry hazard "${hazardDoc.name}" is missing required field: system.details.level.value`
    };
  }

  const warnings: string[] = [];
  const warn: Warn = (msg) => warnings.push(msg);

  const stealth = requireNum(attributes.stealth?.value);
  if (stealth === null) {
    warn('Hazard has no Stealth value — defaulted to 0 (set the initiative modifier manually)');
  }
  const ac = requireNum(attributes.ac?.value);
  if (ac === null) warn('Hazard has no AC — defaulted to 0');
  const hp = requireNum(attributes.hp?.max) ?? requireNum(attributes.hp?.value);
  if (hp === null) warn('Hazard has no HP — defaulted to 0');

  const items = Array.isArray(hazardDoc.items) ? hazardDoc.items : [];
  const attacks = mapAttacks(items);
  const { passive, reactive, active } = partitionAbilities(items, warn);

  const hazard: Hazard = {
    id: slugifyName(hazardDoc.name),
    name: hazardDoc.name,
    level,
    traits: Array.isArray(sys.traits?.value)
      ? sys.traits.value.filter((t): t is string => typeof t === 'string')
      : [],
    rarity: mapRarity(sys.traits?.rarity),
    stealth: stealth ?? 0,
    ac: ac ?? 0,
    fortitude: requireNum(sys.saves?.fortitude?.value) ?? 0,
    reflex: requireNum(sys.saves?.reflex?.value) ?? 0,
    will: requireNum(sys.saves?.will?.value) ?? 0,
    hp: hp ?? 0,
    immunities: mapImmunities(attributes.immunities),
    resistances: mapDamageTypeArray(attributes.resistances),
    weaknesses: mapDamageTypeArray(attributes.weaknesses),
    attacks,
    passiveAbilities: passive,
    reactiveAbilities: reactive,
    activeAbilities: active,
    tags: []
  };

  const stealthNote = textBlock(attributes.stealth?.details);
  if (stealthNote !== undefined) hazard.stealthNote = stealthNote;

  const hardness = mapHardness(attributes.hardness);
  if (hardness !== undefined) hazard.hardness = hardness;

  const routine = textBlock(details.routine);
  if (routine !== undefined) hazard.routine = routine;

  const disable = textBlock(details.disable);
  if (disable !== undefined) hazard.disable = disable;

  const reset = textBlock(details.reset);
  if (reset !== undefined) hazard.reset = reset;

  const description = textBlock(details.description);
  if (description !== undefined) hazard.description = description;

  const source = details.publication?.title;
  if (typeof source === 'string' && source.trim() !== '') hazard.source = source.trim();

  return { ok: true, value: hazard, warnings };
}
