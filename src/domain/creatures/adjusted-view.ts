import type {
  Ability,
  Attack,
  CombatantState,
  CreatureBaseStats,
  DamageComponent,
  SpellListEntry,
  SpellcastingBlock,
  SpellcastingType,
  TemplateAdjustment
} from '../types';

const STAT_DELTA: Record<TemplateAdjustment, number> = {
  normal: 0,
  elite: 2,
  weak: -2
};

export function getEffectiveLevel(baseLevel: number, adjustment: TemplateAdjustment): number {
  if (adjustment === 'elite') {
    return baseLevel <= 0 ? baseLevel + 2 : baseLevel + 1;
  }
  if (adjustment === 'weak') {
    return baseLevel === 1 ? baseLevel - 2 : baseLevel - 1;
  }
  return baseLevel;
}

export function adjustedDC(dc: number, adjustment: TemplateAdjustment): number {
  return dc + STAT_DELTA[adjustment];
}

export function adjustedHp(baseHp: number, baseLevel: number, adjustment: TemplateAdjustment): number {
  if (adjustment === 'normal') return baseHp;
  if (adjustment === 'elite') return baseHp + eliteHpIncrease(baseLevel);
  return Math.max(1, baseHp - weakHpDecrease(baseLevel));
}

function eliteHpIncrease(level: number): number {
  if (level <= 1) return 10;
  if (level <= 4) return 15;
  if (level <= 19) return 20;
  return 30;
}

function weakHpDecrease(level: number): number {
  if (level <= 2) return 10;
  if (level <= 5) return 15;
  if (level <= 20) return 20;
  return 30;
}

export function adjustedDamage(
  components: DamageComponent[],
  adjustment: TemplateAdjustment,
  opts: { limitedUse: boolean; primaryIndex: number }
): DamageComponent[] {
  if (adjustment === 'normal' || components.length === 0) return components.map((c) => ({ ...c }));
  const magnitude = opts.limitedUse ? 4 : 2;
  const delta = adjustment === 'elite' ? magnitude : -magnitude;
  const index = opts.primaryIndex >= 0 && opts.primaryIndex < components.length ? opts.primaryIndex : 0;
  return components.map((component, i) => {
    if (i !== index) return { ...component };
    const base = component.bonus ?? 0;
    return { ...component, bonus: base + delta };
  });
}

export function adjustedAttack(attack: Attack, adjustment: TemplateAdjustment): Attack {
  if (adjustment === 'normal') return { ...attack, damage: attack.damage.map((c) => ({ ...c })) };
  return {
    ...attack,
    modifier: attack.modifier + STAT_DELTA[adjustment],
    damage: adjustedDamage(attack.damage, adjustment, {
      limitedUse: false,
      primaryIndex: attack.primaryDamageIndex ?? 0
    })
  };
}

export function adjustedAbility(ability: Ability, adjustment: TemplateAdjustment): Ability {
  if (adjustment === 'normal') return { ...ability };
  const next: Ability = { ...ability };
  if (ability.save) {
    next.save = { ...ability.save, dc: adjustedDC(ability.save.dc, adjustment) };
  }
  if (ability.damage && ability.damage.length > 0) {
    next.damage = adjustedDamage(ability.damage, adjustment, {
      limitedUse: ability.isLimitedUse ?? false,
      primaryIndex: 0
    });
  }
  return next;
}

export function adjustedSpellBlock(block: SpellcastingBlock, adjustment: TemplateAdjustment): SpellcastingBlock {
  if (adjustment === 'normal') {
    return { ...block, entries: block.entries.map((e) => ({ ...e })) };
  }
  const next: SpellcastingBlock = {
    ...block,
    dc: adjustedDC(block.dc, adjustment),
    entries: block.entries.map((entry) => adjustedSpellEntry(entry, block.type, adjustment))
  };
  if (block.attackModifier !== undefined) {
    next.attackModifier = block.attackModifier + STAT_DELTA[adjustment];
  }
  return next;
}

export function adjustedSpellEntry(
  entry: SpellListEntry,
  blockType: SpellcastingType,
  adjustment: TemplateAdjustment
): SpellListEntry {
  if (adjustment === 'normal') return { ...entry };
  if (!entry.damage || entry.damage.length === 0) return { ...entry };
  return {
    ...entry,
    damage: adjustedDamage(entry.damage, adjustment, {
      limitedUse: isLimitedUseSpell(entry, blockType),
      primaryIndex: 0
    })
  };
}

function isLimitedUseSpell(entry: SpellListEntry, blockType: SpellcastingType): boolean {
  if (entry.isCantrip) return false;
  if (entry.frequency?.type === 'atWill' || entry.frequency?.type === 'constant') return false;
  if (entry.frequency?.type === 'perDay') return true;
  return blockType === 'prepared' || blockType === 'spontaneous' || blockType === 'focus';
}

export interface AdjustedView extends CreatureBaseStats {
  level: number;
  adjustment: TemplateAdjustment;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getAdjustedView(_combatant: CombatantState): AdjustedView {
  throw new Error('getAdjustedView is wired in Task 5');
}
