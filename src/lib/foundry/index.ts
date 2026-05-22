import type { Creature, Hazard } from '../../domain';
import { validateCreature } from '../yaml/creature-validator';
import { validateHazard } from '../yaml/hazard-validator';
import type { CreatureImportResult, HazardImportResult } from '../yaml';
import { mapFoundryNpcToCreature } from './mapper';
import { mapFoundryHazardToHazard } from './hazard-mapper';

export { mapFoundryNpcToCreature, slugifyName } from './mapper';
export { mapFoundryHazardToHazard } from './hazard-mapper';
export { stripFoundryMarkup } from './text';
export type { MapResult } from './shared';

/**
 * Imports a single Foundry pf2e NPC JSON document and maps it to a domain
 * `Creature`. Returns the same `CreatureImportResult` shape used by the YAML
 * path so call sites can branch on extension only.
 *
 * Issues use document index 0 (Foundry NPC files are single-document) and
 * `skipped` is always empty here — non-NPC documents are reported as issues
 * rather than skipped because there is no notion of a multi-doc stream.
 */
export function importCreatureFoundryJson(text: string): CreatureImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      creatures: [],
      issues: [
        {
          documentIndex: 0,
          path: '',
          message: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`
        }
      ],
      skipped: []
    };
  }

  const mapped = mapFoundryNpcToCreature(parsed);
  if (!mapped.ok) {
    return {
      creatures: [],
      issues: [{ documentIndex: 0, path: '', message: mapped.error }],
      skipped: []
    };
  }

  const warningIssues = mapped.warnings.map((message) => ({
    documentIndex: 0,
    path: '',
    message: `Note: ${message}`
  }));

  const validation = validateCreature(mapped.value, 0);
  if (!validation.ok) {
    return { creatures: [], issues: [...warningIssues, ...validation.issues], skipped: [] };
  }

  const creatures: Creature[] = [validation.value];
  return { creatures, issues: [...warningIssues, ...validation.issues], skipped: [] };
}

/**
 * Imports a single Foundry pf2e `hazard` actor JSON document and maps it to a
 * domain `Hazard`. Mirrors `importCreatureFoundryJson` — returns the same
 * `HazardImportResult` shape as the YAML path so call sites branch on
 * extension only. Non-complex hazards are reported as an issue (not skipped),
 * since a single-document JSON file has no notion of a multi-doc stream.
 */
export function importHazardFoundryJson(text: string): HazardImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      hazards: [],
      issues: [
        {
          documentIndex: 0,
          path: '',
          message: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`
        }
      ],
      skipped: []
    };
  }

  const mapped = mapFoundryHazardToHazard(parsed);
  if (!mapped.ok) {
    return {
      hazards: [],
      issues: [{ documentIndex: 0, path: '', message: mapped.error }],
      skipped: []
    };
  }

  const warningIssues = mapped.warnings.map((message) => ({
    documentIndex: 0,
    path: '',
    message: `Note: ${message}`
  }));

  const validation = validateHazard(mapped.value, 0);
  if (!validation.ok) {
    return { hazards: [], issues: [...warningIssues, ...validation.issues], skipped: [] };
  }

  const hazards: Hazard[] = [validation.value];
  return { hazards, issues: [...warningIssues, ...validation.issues], skipped: [] };
}
