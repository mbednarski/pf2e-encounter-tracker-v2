import type { Party } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue, type YamlDocumentKind } from './envelope';
import { validateParty } from './party-validator';

export interface PartySkippedDocument {
  documentIndex: number;
  kind: Exclude<YamlDocumentKind, 'party'>;
}

export interface PartyImportResult {
  parties: Party[];
  issues: ValidationIssue[];
  skipped: PartySkippedDocument[];
}

export function importPartyYaml(text: string): PartyImportResult {
  const { envelopes, issues } = parseYamlEnvelopes(text);
  const parties: Party[] = [];
  const skipped: PartySkippedDocument[] = [];
  const allIssues: ValidationIssue[] = [...issues];

  for (const envelope of envelopes) {
    if (envelope.kind !== 'party') {
      skipped.push({ documentIndex: envelope.documentIndex, kind: envelope.kind });
      continue;
    }
    const result = validateParty(envelope.data, envelope.documentIndex);
    if (result.ok) parties.push(result.value);
    allIssues.push(...result.issues);
  }

  return { parties, issues: allIssues, skipped };
}
