import { describe, expect, test } from 'vitest';
import { buildSpellcastingView } from './view';
import type { CombatantSpellcasting } from '../../domain';

function preparedBlock(
  overrides: Partial<CombatantSpellcasting> = {}
): CombatantSpellcasting {
  return {
    blockId: 'yaashka-divine-prepared',
    name: 'Divine Prepared Spells',
    tradition: 'divine',
    type: 'prepared',
    dc: 24,
    attackModifier: 16,
    slots: { 1: 4, 2: 4, 3: 3 },
    entries: [
      { spellSlug: 'harm', name: 'Harm', level: 3 },
      { spellSlug: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, count: 2 },
      { spellSlug: 'command', name: 'Command', level: 1, count: 2 },
      { spellSlug: 'detect-magic', name: 'Detect Magic', level: 3, isCantrip: true }
    ],
    ...overrides
  };
}

describe('buildSpellcastingView (prepared)', () => {
  test('partitions cantrips and groups non-cantrips by rank, ascending', () => {
    const view = buildSpellcastingView(preparedBlock());
    expect(view.type).toBe('prepared');
    if (view.type !== 'prepared') return;
    expect(view.ranks.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(view.cantrips).toEqual([{ spellSlug: 'detect-magic', name: 'Detect Magic', level: 3 }]);
  });

  test('reflects usedSlots in per-rank used count', () => {
    const view = buildSpellcastingView(preparedBlock({ usedSlots: { 3: 1 } }));
    if (view.type !== 'prepared') throw new Error('expected prepared');
    expect(view.ranks.find((r) => r.rank === 3)).toMatchObject({ total: 3, used: 1 });
    expect(view.ranks.find((r) => r.rank === 1)).toMatchObject({ total: 4, used: 0 });
  });

  test('preserves prepared duplicates via count field', () => {
    const view = buildSpellcastingView(preparedBlock());
    if (view.type !== 'prepared') throw new Error('expected prepared');
    const rank2 = view.ranks.find((r) => r.rank === 2)!;
    expect(rank2.entries).toEqual([{ spellSlug: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, count: 2 }]);
  });
});

describe('buildSpellcastingView (focus)', () => {
  test('exposes focus pool total/used and lists entries', () => {
    const block: CombatantSpellcasting = {
      blockId: 'cleric-focus',
      name: 'Cleric Domain Spells',
      tradition: 'divine',
      type: 'focus',
      dc: 24,
      focusPoints: 1,
      usedFocusPoints: 0,
      entries: [{ spellSlug: 'athletic-rush', name: 'Athletic Rush', level: 3 }]
    };
    const view = buildSpellcastingView(block);
    if (view.type !== 'focus') throw new Error('expected focus');
    expect(view.focus).toEqual({ total: 1, used: 0 });
    expect(view.entries).toEqual([{ spellSlug: 'athletic-rush', name: 'Athletic Rush', level: 3 }]);
  });
});

describe('buildSpellcastingView (innate)', () => {
  test('marks per-day as interactive and at-will/constant as non-interactive', () => {
    const block: CombatantSpellcasting = {
      blockId: 'dragon-innate',
      name: 'Innate Spells',
      tradition: 'arcane',
      type: 'innate',
      dc: 30,
      entries: [
        { spellSlug: 'wall-of-fire', name: 'Wall of Fire', level: 7, frequency: { type: 'perDay', uses: 3 } },
        { spellSlug: 'detect-magic', name: 'Detect Magic', level: 1, frequency: { type: 'atWill' } },
        { spellSlug: 'mage-armor', name: 'Mage Armor', level: 1, frequency: { type: 'constant' } }
      ],
      usedEntries: { 'wall-of-fire': 1 }
    };
    const view = buildSpellcastingView(block);
    if (view.type !== 'innate') throw new Error('expected innate');

    const wallOfFire = view.entries.find((e) => e.spellSlug === 'wall-of-fire')!;
    expect(wallOfFire).toMatchObject({ used: 1, max: 3, interactive: true, marker: '3/day' });

    const detect = view.entries.find((e) => e.spellSlug === 'detect-magic')!;
    expect(detect.interactive).toBe(false);
    expect(detect.marker).toBe('at will');

    const mageArmor = view.entries.find((e) => e.spellSlug === 'mage-armor')!;
    expect(mageArmor.interactive).toBe(false);
    expect(mageArmor.marker).toBe('constant');
  });
});

describe('buildSpellcastingView (spontaneous)', () => {
  test('groups repertoire by rank using slots map', () => {
    const block: CombatantSpellcasting = {
      blockId: 'sorc-arcane',
      name: 'Arcane Spontaneous Spells',
      tradition: 'arcane',
      type: 'spontaneous',
      dc: 22,
      slots: { 1: 4, 2: 3 },
      entries: [
        { spellSlug: 'magic-missile', name: 'Magic Missile', level: 1 },
        { spellSlug: 'invisibility', name: 'Invisibility', level: 2 }
      ],
      usedSlots: { 2: 1 }
    };
    const view = buildSpellcastingView(block);
    if (view.type !== 'spontaneous') throw new Error('expected spontaneous');
    expect(view.ranks.map((r) => r.rank)).toEqual([1, 2]);
    expect(view.ranks.find((r) => r.rank === 2)).toMatchObject({ total: 3, used: 1 });
    expect(view.ranks.find((r) => r.rank === 1)?.entries[0].name).toBe('Magic Missile');
  });
});
