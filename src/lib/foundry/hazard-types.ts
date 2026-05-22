/**
 * Narrow TypeScript types for the subset of the Foundry pf2e `hazard` actor
 * JSON schema the hazard mapper reads. Like `types.ts` (the NPC schema), every
 * field is optional unless the mapper truly requires it — Foundry's real
 * schema is sprawling and adventure hazards carry edge cases.
 *
 * Hazard `items` are the same shape as NPC items (`action`, `melee`, …), so we
 * reuse `FoundryItem` / `FoundrySaves` / `FoundryTraits` from `types.ts`.
 */
import type { FoundryItem, FoundrySaves, FoundryTraits } from './types';

export interface FoundryHazardDetails {
  level?: { value?: number };
  /** Complex hazards act in initiative; simple hazards are not tracked. */
  isComplex?: boolean;
  /** Free-form HTML — what the hazard does each round. */
  routine?: string;
  /** Free-form HTML — how the hazard is disabled. */
  disable?: string;
  /** Free-form HTML — how the hazard resets. */
  reset?: string;
  /** Free-form HTML — flavor text. */
  description?: string;
  publication?: { title?: string };
}

export interface FoundryHazardAttributes {
  ac?: { value?: number };
  hp?: { max?: number; value?: number };
  /** Newer schema stores a bare number; older data nests it under `value`. */
  hardness?: number | { value?: number };
  /** Stealth `value` is the complex hazard's initiative modifier. */
  stealth?: { value?: number; details?: string };
  immunities?: { type?: string; exceptions?: string[] }[];
  weaknesses?: { type?: string; value?: number; exceptions?: string[] }[];
  resistances?: { type?: string; value?: number; exceptions?: string[] }[];
}

export interface FoundryHazardSystem {
  details?: FoundryHazardDetails;
  attributes?: FoundryHazardAttributes;
  saves?: FoundrySaves;
  traits?: FoundryTraits;
}

export interface FoundryHazard {
  _id?: string;
  name?: string;
  type?: string;
  system?: FoundryHazardSystem;
  items?: FoundryItem[];
}
