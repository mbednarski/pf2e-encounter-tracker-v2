import type { Creature } from '../../domain';
import { validateCreature } from '../yaml/creature-validator';
import type { CreatureImportResult } from '../yaml';
import { mapFoundryNpcToCreature } from './mapper';

export { mapFoundryNpcToCreature, slugifyName } from './mapper';
export { stripFoundryMarkup } from './text';
export type { MapResult } from './mapper';

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
