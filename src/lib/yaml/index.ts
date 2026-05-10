import type { Creature, Hazard } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue, type YamlDocumentKind } from './envelope';
import { validateCreature } from './creature-validator';
import { validateHazard } from './hazard-validator';

export type { ValidationIssue } from './envelope';
export type { ParseOutcome } from './creature-validator';
export {
  importPartyMemberYaml,
  type PartyMemberImportResult,
  type PartyMemberSkippedDocument
} from './party-member-import';

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

export interface HazardSkippedDocument {
  documentIndex: number;
  kind: Exclude<YamlDocumentKind, 'hazard'>;
}

export interface HazardImportResult {
  hazards: Hazard[];
  issues: ValidationIssue[];
  skipped: HazardSkippedDocument[];
}

export function importHazardYaml(text: string): HazardImportResult {
  const { envelopes, issues } = parseYamlEnvelopes(text);
  const hazards: Hazard[] = [];
  const skipped: HazardSkippedDocument[] = [];
  const allIssues: ValidationIssue[] = [...issues];

  for (const envelope of envelopes) {
    if (envelope.kind !== 'hazard') {
      skipped.push({ documentIndex: envelope.documentIndex, kind: envelope.kind });
      continue;
    }
    const result = validateHazard(envelope.data, envelope.documentIndex);
    if (result.ok) hazards.push(result.value);
    allIssues.push(...result.issues);
  }

  return { hazards, issues: allIssues, skipped };
}

export interface HazardDedupeResult {
  accepted: Hazard[];
  rejected: Hazard[];
}

export function dedupeNewHazards(
  existingIds: ReadonlySet<string>,
  incoming: readonly Hazard[]
): HazardDedupeResult {
  const accepted: Hazard[] = [];
  const rejected: Hazard[] = [];
  const seen = new Set(existingIds);
  for (const hazard of incoming) {
    if (seen.has(hazard.id)) {
      rejected.push(hazard);
    } else {
      seen.add(hazard.id);
      accepted.push(hazard);
    }
  }
  return { accepted, rejected };
}
