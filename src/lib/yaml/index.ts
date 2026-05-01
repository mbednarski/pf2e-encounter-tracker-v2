import type { Creature } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue } from './envelope';
import { validateCreature } from './creature-validator';

export type { ValidationIssue } from './envelope';

export interface CreatureImportResult {
  creatures: Creature[];
  issues: ValidationIssue[];
}

export function importCreatureYaml(text: string): CreatureImportResult {
  const { envelopes, issues } = parseYamlEnvelopes(text);
  const creatures: Creature[] = [];
  const allIssues: ValidationIssue[] = [...issues];

  for (const envelope of envelopes) {
    if (envelope.kind !== 'creature') {
      allIssues.push({
        documentIndex: envelope.documentIndex,
        path: 'kind',
        message: `Document kind "${envelope.kind}" is not yet supported by this build (only "creature" can be imported)`
      });
      continue;
    }

    const { creature, issues: creatureIssues } = validateCreature(envelope.data, envelope.documentIndex);
    if (creature) {
      creatures.push(creature);
    }
    allIssues.push(...creatureIssues);
  }

  return { creatures, issues: allIssues };
}
