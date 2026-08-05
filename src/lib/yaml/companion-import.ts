import type { Companion } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue, type YamlDocumentKind } from './envelope';
import { validateCompanion } from './companion-validator';

export interface CompanionSkippedDocument {
  documentIndex: number;
  kind: Exclude<YamlDocumentKind, 'companion'>;
}

export interface CompanionImportResult {
  companions: Companion[];
  issues: ValidationIssue[];
  skipped: CompanionSkippedDocument[];
}

export function importCompanionYaml(text: string): CompanionImportResult {
  const { envelopes, issues } = parseYamlEnvelopes(text);
  const companions: Companion[] = [];
  const skipped: CompanionSkippedDocument[] = [];
  const allIssues: ValidationIssue[] = [...issues];

  for (const envelope of envelopes) {
    if (envelope.kind !== 'companion') {
      skipped.push({ documentIndex: envelope.documentIndex, kind: envelope.kind });
      continue;
    }
    const result = validateCompanion(envelope.data, envelope.documentIndex);
    if (result.ok) companions.push(result.value);
    allIssues.push(...result.issues);
  }

  return { companions, issues: allIssues, skipped };
}
