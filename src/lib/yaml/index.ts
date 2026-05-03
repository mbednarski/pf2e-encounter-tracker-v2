import type { Creature } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue, type YamlDocumentKind } from './envelope';
import { validateCreature } from './creature-validator';

export type { ValidationIssue } from './envelope';
export type { ParseOutcome } from './creature-validator';

export interface SkippedDocument {
  documentIndex: number;
  kind: Exclude<YamlDocumentKind, 'creature'>;
}

export interface CreatureImportResult {
  creatures: Creature[];
  issues: ValidationIssue[];
  skipped: SkippedDocument[];
}

export function importCreatureYaml(text: string): CreatureImportResult {
  const { envelopes, issues } = parseYamlEnvelopes(text);
  const creatures: Creature[] = [];
  const skipped: SkippedDocument[] = [];
  const allIssues: ValidationIssue[] = [...issues];

  for (const envelope of envelopes) {
    if (envelope.kind !== 'creature') {
      skipped.push({ documentIndex: envelope.documentIndex, kind: envelope.kind });
      continue;
    }

    const result = validateCreature(envelope.data, envelope.documentIndex);
    if (result.ok) {
      creatures.push(result.value);
    }
    allIssues.push(...result.issues);
  }

  return { creatures, issues: allIssues, skipped };
}

export interface DedupeResult {
  accepted: Creature[];
  rejected: Creature[];
}

export function dedupeNewCreatures(
  existingIds: ReadonlySet<string>,
  incoming: readonly Creature[]
): DedupeResult {
  const accepted: Creature[] = [];
  const rejected: Creature[] = [];
  const seen = new Set(existingIds);
  for (const creature of incoming) {
    if (seen.has(creature.id)) {
      rejected.push(creature);
    } else {
      seen.add(creature.id);
      accepted.push(creature);
    }
  }
  return { accepted, rejected };
}
