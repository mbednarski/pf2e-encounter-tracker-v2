import { parseAllDocuments } from 'yaml';

export type YamlDocumentKind =
  | 'creature'
  | 'spell'
  | 'effect-definition'
  | 'hazard'
  | 'party-member'
  | 'companion'
  | 'party'
  | 'encounter';

const KNOWN_KINDS: ReadonlySet<string> = new Set<YamlDocumentKind>([
  'creature',
  'spell',
  'effect-definition',
  'hazard',
  'party-member',
  'companion',
  'party',
  'encounter'
]);

const ENVELOPE_FIELDS: ReadonlySet<string> = new Set(['kind', 'schemaVersion', 'data']);

const SUPPORTED_SCHEMA_VERSION = 1;

export interface ParsedEnvelope {
  documentIndex: number;
  kind: YamlDocumentKind;
  schemaVersion: 1;
  data: unknown;
}

export interface ValidationIssue {
  documentIndex: number;
  path: string;
  message: string;
}

export interface EnvelopeParseResult {
  envelopes: ParsedEnvelope[];
  issues: ValidationIssue[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseYamlEnvelopes(text: string): EnvelopeParseResult {
  const envelopes: ParsedEnvelope[] = [];
  const issues: ValidationIssue[] = [];

  if (text.trim() === '') {
    return { envelopes, issues };
  }

  const docs = parseAllDocuments(text);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const docIssues: ValidationIssue[] = [];

    if (doc.errors.length > 0) {
      for (const err of doc.errors) {
        docIssues.push({
          documentIndex: i,
          path: '',
          message: `YAML parse error: ${err.message}`
        });
      }
      issues.push(...docIssues);
      continue;
    }

    const raw = doc.toJS({ maxAliasCount: 100 });

    // Skip the trailing empty document that `parseAllDocuments` may emit when
    // the input ends with a separator or whitespace.
    if (raw == null && docs.length > 1 && i === docs.length - 1) {
      continue;
    }

    if (!isPlainObject(raw)) {
      issues.push({
        documentIndex: i,
        path: '',
        message: 'Envelope must be a YAML mapping (object)'
      });
      continue;
    }

    const kindValue = raw.kind;
    if (kindValue === undefined) {
      docIssues.push({
        documentIndex: i,
        path: 'kind',
        message: '`kind` is required'
      });
    } else if (typeof kindValue !== 'string' || !KNOWN_KINDS.has(kindValue)) {
      docIssues.push({
        documentIndex: i,
        path: 'kind',
        message: `Unknown kind: ${JSON.stringify(kindValue)}`
      });
    }

    const versionValue = raw.schemaVersion;
    if (versionValue === undefined) {
      docIssues.push({
        documentIndex: i,
        path: 'schemaVersion',
        message: '`schemaVersion` is required'
      });
    } else if (versionValue !== SUPPORTED_SCHEMA_VERSION) {
      docIssues.push({
        documentIndex: i,
        path: 'schemaVersion',
        message: `Unsupported schemaVersion: ${JSON.stringify(versionValue)}`
      });
    }

    if (!('data' in raw)) {
      docIssues.push({
        documentIndex: i,
        path: 'data',
        message: '`data` is required'
      });
    }

    for (const key of Object.keys(raw)) {
      if (!ENVELOPE_FIELDS.has(key)) {
        docIssues.push({
          documentIndex: i,
          path: key,
          message: `Unknown field on envelope: ${key}`
        });
      }
    }

    if (docIssues.length > 0) {
      issues.push(...docIssues);
      continue;
    }

    envelopes.push({
      documentIndex: i,
      kind: kindValue as YamlDocumentKind,
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      data: raw.data
    });
  }

  return { envelopes, issues };
}
