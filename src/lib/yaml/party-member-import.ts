import type { PartyMember } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue, type YamlDocumentKind } from './envelope';
import { validatePartyMember } from './party-member-validator';

export interface PartyMemberSkippedDocument {
  documentIndex: number;
  kind: Exclude<YamlDocumentKind, 'party-member'>;
}

export interface PartyMemberImportResult {
  partyMembers: PartyMember[];
  issues: ValidationIssue[];
  skipped: PartyMemberSkippedDocument[];
}

export function importPartyMemberYaml(text: string): PartyMemberImportResult {
  const { envelopes, issues } = parseYamlEnvelopes(text);
  const partyMembers: PartyMember[] = [];
  const skipped: PartyMemberSkippedDocument[] = [];
  const allIssues: ValidationIssue[] = [...issues];

  for (const envelope of envelopes) {
    if (envelope.kind !== 'party-member') {
      skipped.push({ documentIndex: envelope.documentIndex, kind: envelope.kind });
      continue;
    }
    const result = validatePartyMember(envelope.data, envelope.documentIndex);
    if (result.ok) partyMembers.push(result.value);
    allIssues.push(...result.issues);
  }

  return { partyMembers, issues: allIssues, skipped };
}
