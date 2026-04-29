import type {
  AppliedEffect,
  AppliedModifier,
  BonusType,
  ComputedModifierBucket,
  ComputedStat,
  ComputedStats,
  CreatureBaseStats,
  EffectDefinition,
  EffectLibrary,
  Modifier,
  StatTarget
} from '../types';

type BaseStatKey = 'ac' | 'fortitude' | 'reflex' | 'will' | 'perception';
type BucketKey = 'attackRolls' | 'allDCs';
type ModifierTarget =
  | { kind: 'base'; key: BaseStatKey }
  | { kind: 'bucket'; key: BucketKey }
  | { kind: 'skill'; key: string };

const baseStatKeys: BaseStatKey[] = ['ac', 'fortitude', 'reflex', 'will', 'perception'];

const skillMetaTargets: Record<'strSkills' | 'dexSkills' | 'intSkills' | 'wisSkills' | 'chaSkills', string[]> = {
  strSkills: ['athletics'],
  dexSkills: ['acrobatics', 'stealth', 'thievery'],
  intSkills: ['arcana', 'crafting', 'occultism', 'society'],
  wisSkills: ['medicine', 'nature', 'religion', 'survival'],
  chaSkills: ['deception', 'diplomacy', 'intimidation', 'performance']
};

export function deriveStats(
  baseStats: CreatureBaseStats,
  appliedEffects: AppliedEffect[],
  effectLibrary: EffectLibrary
): ComputedStats {
  const modifiersByTarget = collectModifiers(baseStats, appliedEffects, effectLibrary);

  return {
    ac: computeBaseStat(baseStats.ac, modifiersByTarget.ac),
    fortitude: computeBaseStat(baseStats.fortitude, modifiersByTarget.fortitude),
    reflex: computeBaseStat(baseStats.reflex, modifiersByTarget.reflex),
    will: computeBaseStat(baseStats.will, modifiersByTarget.will),
    perception: computeBaseStat(baseStats.perception, modifiersByTarget.perception),
    skills: computeSkills(baseStats.skills, modifiersByTarget.skills),
    attackRolls: computeBucket(modifiersByTarget.attackRolls),
    allDCs: computeBucket(modifiersByTarget.allDCs)
  };
}

function collectModifiers(
  baseStats: CreatureBaseStats,
  appliedEffects: AppliedEffect[],
  effectLibrary: EffectLibrary
): {
  [K in BaseStatKey | BucketKey]: AppliedModifier[];
} & { skills: Record<string, AppliedModifier[]> } {
  const collected = {
    ac: [],
    fortitude: [],
    reflex: [],
    will: [],
    perception: [],
    attackRolls: [],
    allDCs: [],
    skills: Object.fromEntries(Object.keys(baseStats.skills).map((skill) => [skill, []]))
  } as {
    [K in BaseStatKey | BucketKey]: AppliedModifier[];
  } & { skills: Record<string, AppliedModifier[]> };

  for (const appliedEffect of appliedEffects) {
    const definition = effectLibrary[appliedEffect.effectId];

    if (!definition) {
      continue;
    }

    for (const modifier of definition.modifiers) {
      const value = resolveModifierValue(modifier, appliedEffect);

      for (const target of expandTarget(modifier.stat, baseStats.skills)) {
        const appliedModifier = toAppliedModifier(definition, appliedEffect, modifier.bonusType, value);

        if (target.kind === 'skill') {
          collected.skills[target.key].push(appliedModifier);
        } else {
          collected[target.key].push(appliedModifier);
        }
      }
    }
  }

  return collected;
}

function computeBaseStat(base: number, modifiers: AppliedModifier[]): ComputedStat {
  const stackedModifiers = applyStacking(modifiers);

  return {
    base,
    final: base + sumActive(stackedModifiers),
    modifiers: stackedModifiers
  };
}

function computeBucket(modifiers: AppliedModifier[]): ComputedModifierBucket {
  const stackedModifiers = applyStacking(modifiers);

  return {
    total: sumActive(stackedModifiers),
    modifiers: stackedModifiers
  };
}

function computeSkills(
  skills: Record<string, number>,
  modifiersBySkill: Record<string, AppliedModifier[]>
): Record<string, ComputedStat> {
  return Object.fromEntries(
    Object.entries(skills).map(([skill, base]) => [skill, computeBaseStat(base, modifiersBySkill[skill] ?? [])])
  );
}

function applyStacking(modifiers: AppliedModifier[]): AppliedModifier[] {
  const active = new Set<AppliedModifier>();

  for (const bonusType of uniqueBonusTypes(modifiers)) {
    const typedModifiers = modifiers.filter((modifier) => modifier.bonusType === bonusType);
    const bonuses = typedModifiers.filter((modifier) => modifier.value > 0);
    const penalties = typedModifiers.filter((modifier) => modifier.value < 0);

    keepSelected(bonuses, active, (modifier, selected) => modifier.value > selected.value);

    if (bonusType === 'untyped') {
      for (const penalty of penalties) {
        active.add(penalty);
      }
    } else {
      keepSelected(penalties, active, (modifier, selected) => modifier.value < selected.value);
    }

    for (const zero of typedModifiers.filter((modifier) => modifier.value === 0)) {
      active.add(zero);
    }
  }

  return modifiers.map((modifier) => ({ ...modifier, suppressed: !active.has(modifier) }));
}

function uniqueBonusTypes(modifiers: AppliedModifier[]): BonusType[] {
  return Array.from(new Set(modifiers.map((modifier) => modifier.bonusType)));
}

function keepSelected(
  modifiers: AppliedModifier[],
  active: Set<AppliedModifier>,
  isBetterSelection: (modifier: AppliedModifier, selected: AppliedModifier) => boolean
): void {
  const selected = modifiers.reduce<AppliedModifier | undefined>(
    (current, modifier) => (!current || isBetterSelection(modifier, current) ? modifier : current),
    undefined
  );

  if (selected) {
    active.add(selected);
  }
}

function sumActive(modifiers: AppliedModifier[]): number {
  return modifiers.reduce((total, modifier) => total + (modifier.suppressed ? 0 : modifier.value), 0);
}

function resolveModifierValue(modifier: Modifier, appliedEffect: AppliedEffect): number {
  if (typeof modifier.value === 'number') {
    return modifier.value;
  }

  return modifier.value.sign * resolveAppliedEffectValue(appliedEffect);
}

function resolveAppliedEffectValue(appliedEffect: AppliedEffect): number {
  return appliedEffect.value ?? 1;
}

function toAppliedModifier(
  definition: EffectDefinition,
  appliedEffect: AppliedEffect,
  bonusType: BonusType,
  value: number
): AppliedModifier {
  return {
    effectId: appliedEffect.effectId,
    instanceId: appliedEffect.instanceId,
    sourceName: definition.hasValue ? `${definition.name} ${resolveAppliedEffectValue(appliedEffect)}` : definition.name,
    bonusType,
    value,
    suppressed: false
  };
}

function expandTarget(stat: StatTarget, skills: Record<string, number>): ModifierTarget[] {
  if (isBaseStatKey(stat)) {
    return [{ kind: 'base', key: stat }];
  }

  if (isBucketKey(stat)) {
    return [{ kind: 'bucket', key: stat }];
  }

  if (stat === 'allSaves') {
    return [
      { kind: 'base', key: 'fortitude' },
      { kind: 'base', key: 'reflex' },
      { kind: 'base', key: 'will' }
    ];
  }

  if (stat === 'allSkills') {
    return Object.keys(skills).map((skill) => ({ kind: 'skill', key: skill }));
  }

  if (stat === 'mentalSkills') {
    return expandSkillNames(
      [...skillMetaTargets.intSkills, ...skillMetaTargets.wisSkills, ...skillMetaTargets.chaSkills],
      skills
    );
  }

  if (isSkillMetaTarget(stat)) {
    return expandSkillNames(skillMetaTargets[stat], skills);
  }

  return Object.prototype.hasOwnProperty.call(skills, stat) ? [{ kind: 'skill', key: stat }] : [];
}

function expandSkillNames(skillNames: string[], skills: Record<string, number>): ModifierTarget[] {
  return skillNames
    .filter((skill) => Object.prototype.hasOwnProperty.call(skills, skill))
    .map((skill) => ({ kind: 'skill', key: skill }));
}

function isBaseStatKey(stat: StatTarget): stat is BaseStatKey {
  return baseStatKeys.includes(stat as BaseStatKey);
}

function isBucketKey(stat: StatTarget): stat is BucketKey {
  return stat === 'attackRolls' || stat === 'allDCs';
}

function isSkillMetaTarget(
  stat: StatTarget
): stat is 'strSkills' | 'dexSkills' | 'intSkills' | 'wisSkills' | 'chaSkills' {
  return (
    stat === 'strSkills' ||
    stat === 'dexSkills' ||
    stat === 'intSkills' ||
    stat === 'wisSkills' ||
    stat === 'chaSkills'
  );
}
