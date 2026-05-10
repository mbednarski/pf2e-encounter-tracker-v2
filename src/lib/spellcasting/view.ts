import type { CombatantSpellcasting, SpellListEntry, SpellFrequency } from '../../domain';

export interface SlotRow {
  rank: number;
  total: number;
  used: number;
}

export interface PreparedRankGroup {
  rank: number;
  total: number;
  used: number;
  entries: PreparedEntryView[];
}

export interface PreparedEntryView {
  spellSlug: string;
  name: string;
  count: number;
}

export interface SpontaneousRankGroup {
  rank: number;
  total: number;
  used: number;
  entries: SpellListEntry[];
}

export interface InnateEntryView {
  spellSlug: string;
  name: string;
  level: number;
  frequency: SpellFrequency | undefined;
  used: number;
  max: number | undefined;
  interactive: boolean;
  marker: string;
}

export interface CantripView {
  spellSlug: string;
  name: string;
  level: number;
}

export type SpellcastingView =
  | { type: 'prepared'; header: HeaderView; ranks: PreparedRankGroup[]; cantrips: CantripView[] }
  | { type: 'spontaneous'; header: HeaderView; ranks: SpontaneousRankGroup[]; cantrips: CantripView[] }
  | { type: 'innate'; header: HeaderView; entries: InnateEntryView[]; cantrips: CantripView[] }
  | {
      type: 'focus';
      header: HeaderView;
      focus: { total: number; used: number };
      entries: { spellSlug: string; name: string; level: number }[];
      cantrips: CantripView[];
    };

export interface HeaderView {
  blockId: string;
  name: string;
  tradition: string;
  type: string;
  dc: number;
  attackModifier: number | undefined;
}

function header(block: CombatantSpellcasting): HeaderView {
  return {
    blockId: block.blockId,
    name: block.name,
    tradition: block.tradition,
    type: block.type,
    dc: block.dc,
    attackModifier: block.attackModifier
  };
}

function partition(entries: SpellListEntry[]): { cantrips: SpellListEntry[]; spells: SpellListEntry[] } {
  const cantrips: SpellListEntry[] = [];
  const spells: SpellListEntry[] = [];
  for (const e of entries) {
    if (e.isCantrip) cantrips.push(e);
    else spells.push(e);
  }
  return { cantrips, spells };
}

function toCantripView(e: SpellListEntry): CantripView {
  return { spellSlug: e.spellSlug, name: e.name, level: e.level };
}

function frequencyMarker(freq: SpellFrequency | undefined): string {
  if (!freq) return '';
  if (freq.type === 'atWill') return 'at will';
  if (freq.type === 'constant') return 'constant';
  return `${freq.uses}/day`;
}

export function buildSpellcastingView(block: CombatantSpellcasting): SpellcastingView {
  const h = header(block);
  const { cantrips, spells } = partition(block.entries);
  const cantripViews = cantrips.map(toCantripView);

  if (block.type === 'prepared') {
    const slots = block.slots ?? {};
    const used = block.usedSlots ?? {};
    const byRank = new Map<number, PreparedEntryView[]>();
    for (const e of spells) {
      const list = byRank.get(e.level) ?? [];
      list.push({ spellSlug: e.spellSlug, name: e.name, count: e.count ?? 1 });
      byRank.set(e.level, list);
    }
    const ranks: PreparedRankGroup[] = Object.keys(slots)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
      .map((rank) => ({
        rank,
        total: slots[rank] ?? 0,
        used: used[rank] ?? 0,
        entries: (byRank.get(rank) ?? []).slice()
      }));
    return { type: 'prepared', header: h, ranks, cantrips: cantripViews };
  }

  if (block.type === 'spontaneous') {
    const slots = block.slots ?? {};
    const used = block.usedSlots ?? {};
    const byRank = new Map<number, SpellListEntry[]>();
    for (const e of spells) {
      const list = byRank.get(e.level) ?? [];
      list.push(e);
      byRank.set(e.level, list);
    }
    const ranks: SpontaneousRankGroup[] = Object.keys(slots)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
      .map((rank) => ({
        rank,
        total: slots[rank] ?? 0,
        used: used[rank] ?? 0,
        entries: (byRank.get(rank) ?? []).slice()
      }));
    return { type: 'spontaneous', header: h, ranks, cantrips: cantripViews };
  }

  if (block.type === 'focus') {
    const total = block.focusPoints ?? 0;
    const used = block.usedFocusPoints ?? 0;
    return {
      type: 'focus',
      header: h,
      focus: { total, used },
      entries: spells.map((e) => ({ spellSlug: e.spellSlug, name: e.name, level: e.level })),
      cantrips: cantripViews
    };
  }

  // innate
  const usedEntries = block.usedEntries ?? {};
  const innate: InnateEntryView[] = spells.map((e) => {
    const max = e.frequency?.type === 'perDay' ? e.frequency.uses : undefined;
    return {
      spellSlug: e.spellSlug,
      name: e.name,
      level: e.level,
      frequency: e.frequency,
      used: usedEntries[e.spellSlug] ?? 0,
      max,
      interactive: max !== undefined,
      marker: frequencyMarker(e.frequency)
    };
  });
  return { type: 'innate', header: h, entries: innate, cantrips: cantripViews };
}
