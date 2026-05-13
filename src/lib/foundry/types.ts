/**
 * Narrow TypeScript types for the subset of the Foundry pf2e NPC JSON schema
 * we actually read when mapping into our domain `Creature`.
 *
 * These are intentionally minimal — every field optional unless the mapper
 * truly requires it — because Foundry's real schema is sprawling and we want
 * the mapper to degrade gracefully on adventure-bestiary edge cases.
 */

export type FoundryActionType = 'passive' | 'action' | 'reaction' | 'free';

export interface FoundryNamedValue {
  value?: unknown;
}

export interface FoundryAttributes {
  ac?: { value?: number };
  hp?: { max?: number; value?: number };
  speed?: {
    value?: number;
    otherSpeeds?: { type?: string; value?: number }[];
  };
  immunities?: { type?: string; exceptions?: string[] }[];
  weaknesses?: { type?: string; value?: number; exceptions?: string[] }[];
  resistances?: { type?: string; value?: number; exceptions?: string[] }[];
}

export interface FoundrySaves {
  fortitude?: { value?: number };
  reflex?: { value?: number };
  will?: { value?: number };
}

export interface FoundryPerception {
  mod?: number;
  senses?: { type?: string; acuity?: string; range?: number }[];
}

export interface FoundryAbilities {
  str?: { mod?: number };
  dex?: { mod?: number };
  con?: { mod?: number };
  int?: { mod?: number };
  wis?: { mod?: number };
  cha?: { mod?: number };
}

export interface FoundryDetails {
  level?: { value?: number };
  alignment?: { value?: string };
  languages?: { value?: string[]; details?: string };
  publication?: { title?: string };
  publicNotes?: string;
}

export interface FoundryTraits {
  rarity?: string;
  size?: { value?: string };
  value?: string[];
}

export interface FoundryNpcSystem {
  attributes?: FoundryAttributes;
  saves?: FoundrySaves;
  perception?: FoundryPerception;
  abilities?: FoundryAbilities;
  details?: FoundryDetails;
  traits?: FoundryTraits;
  skills?: Record<string, { base?: number }>;
}

export interface FoundryMeleeSystem {
  bonus?: { value?: number };
  damageRolls?: Record<string, { damage?: string; damageType?: string; category?: string | null }>;
  range?: null | string | { increment?: number; max?: number | null };
  traits?: { value?: string[] };
  attackEffects?: { value?: string[]; custom?: string };
}

export interface FoundrySpellcastingEntrySystem {
  prepared?: { value?: string };
  tradition?: { value?: string };
  spelldc?: { dc?: number; value?: number; mod?: number };
  slots?: Record<string, { max?: number }>;
}

export interface FoundrySpellSystem {
  level?: { value?: number };
  location?: { value?: string };
  traits?: { value?: string[]; traditions?: string[] };
  time?: { value?: string };
  range?: { value?: string } | string;
}

export interface FoundryActionSystem {
  actionType?: { value?: FoundryActionType };
  actions?: { value?: number | null };
  category?: string;
  traits?: { value?: string[] };
  description?: { value?: string };
  frequency?: { max?: number; per?: string };
}

interface FoundryItemBase {
  _id?: string;
  name?: string;
}

export interface FoundryMeleeItem extends FoundryItemBase {
  type: 'melee';
  system?: FoundryMeleeSystem;
}

export interface FoundrySpellcastingEntryItem extends FoundryItemBase {
  type: 'spellcastingEntry';
  system?: FoundrySpellcastingEntrySystem;
}

export interface FoundrySpellItem extends FoundryItemBase {
  type: 'spell';
  system?: FoundrySpellSystem;
}

export interface FoundryActionItem extends FoundryItemBase {
  type: 'action';
  system?: FoundryActionSystem;
}

export interface FoundryOtherItem extends FoundryItemBase {
  type: string;
  system?: Record<string, unknown>;
}

export type FoundryItem =
  | FoundryMeleeItem
  | FoundrySpellcastingEntryItem
  | FoundrySpellItem
  | FoundryActionItem
  | FoundryOtherItem;

export interface FoundryNpc {
  _id?: string;
  name?: string;
  type?: string;
  system?: FoundryNpcSystem;
  items?: FoundryItem[];
}
