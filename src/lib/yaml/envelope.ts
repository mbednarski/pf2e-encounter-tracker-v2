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

export interface ParsedEnvelope<K extends YamlDocumentKind = YamlDocumentKind> {
  documentIndex: number;
  kind: K;
  schemaVersion: 1;
  data: unknown;
}

export type CreatureEnvelope = ParsedEnvelope<'creature'>;

export interface ValidationIssue {
  documentIndex: number;
  path: string;
  message: string;
  line?: number;
}

export interface EnvelopeParseResult {
  envelopes: ParsedEnvelope[];
  issues: ValidationIssue[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorLine(err: { linePos?: ReadonlyArray<{ line: number }> | undefined }): number | undefined {
  return err.linePos?.[0]?.line;
}

export function parseYamlEnvelopes(text: string): EnvelopeParseResult {
  const envelopes: ParsedEnvelope[] = [];
  const issues: ValidationIssue[] = [];

  if (text.trim() === '') {
    return { envelopes, issues };
  }

  let docs;
  try {
    docs = parseAllDocuments(text);
  } catch (err) {
    issues.push({
      documentIndex: 0,
      path: '',
      message: `YAML parser error: ${err instanceof Error ? err.message : String(err)}`
    });
    return { envelopes, issues };
  }

  if (docs.length === 0) {
    issues.push({
      documentIndex: 0,
      path: '',
      message: 'Document is empty or contains only comments'
    });
    return { envelopes, issues };
  }

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const docIssues: ValidationIssue[] = [];

    if (doc.errors.length > 0) {
      for (const err of doc.errors) {
        const line = errorLine(err);
        docIssues.push({
          documentIndex: i,
          path: '',
          message: `YAML parse error: ${err.message}`,
          ...(line !== undefined ? { line } : {})
        });
      }
      issues.push(...docIssues);
      continue;
    }

    let raw: unknown;
    try {
      // Cap alias expansion to bound parse work on hostile input (alias-bomb DoS).
      raw = doc.toJS({ maxAliasCount: 100 });
    } catch (err) {
      issues.push({
        documentIndex: i,
        path: '',
        message: `YAML materialization error: ${err instanceof Error ? err.message : String(err)}`
      });
      continue;
    }

    // Trailing `---` / blank trailing whitespace makes `parseAllDocuments`
    // emit a final null document. Skipping it here only when it is the last
    // doc in a multi-doc stream avoids hiding genuinely empty single-doc
    // input, which we still want to flag below.
    if (raw == null && docs.length > 1 && i === docs.length - 1) {
      continue;
    }

    if (raw == null) {
      issues.push({
        documentIndex: i,
        path: '',
        message: 'Document is empty or contains only comments'
      });
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
