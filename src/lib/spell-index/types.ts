// src/lib/spell-index/types.ts

export type SpellActionCost = 'reaction' | 'free' | 1 | 2 | 3 | 'varies';

export type SpellTradition = 'arcane' | 'divine' | 'occult' | 'primal';

export interface SpellDefense {
  kind: 'save' | 'attack';
  save?: 'fortitude' | 'reflex' | 'will';
  basic?: boolean;
}

export interface SpellLevelData {
  damage?: string;
}

export type SpellHeightening =
  | { mode: 'fixed'; levels: Record<number, Partial<SpellLevelData>> }
  | { mode: 'interval'; per: number; delta: Partial<SpellLevelData> };

export interface SpellIndexEntry {
  slug: string;
  name: string;
  baseLevel: number;
  isCantrip: boolean;
  isFocus: boolean;
  actionCost: SpellActionCost;
  traits: string[];
  traditions: SpellTradition[];
  range?: string;
  area?: string;
  targets?: string;
  duration?: string;
  defense?: SpellDefense;
  effectSummary: string;
  base: SpellLevelData;
  heightening?: SpellHeightening;
  aonUrl: string;
}

export interface SpellIndexFile {
  version: number;
  generatedAt: string;
  source: { repo: string; tag: string };
  spells: SpellIndexEntry[];
}
