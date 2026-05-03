import { describe, expect, it } from 'vitest';
import { parseYamlEnvelopes } from './envelope';

describe('parseYamlEnvelopes', () => {
  it('parses a valid single-document creature envelope', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: goblin
  name: Goblin
`;
    const result = parseYamlEnvelopes(text);

    expect(result.issues).toEqual([]);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0]).toEqual({
      documentIndex: 0,
      kind: 'creature',
      schemaVersion: 1,
      data: { id: 'goblin', name: 'Goblin' }
    });
  });

  it('parses a multi-document YAML stream into multiple envelopes', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: goblin
  name: Goblin
---
kind: creature
schemaVersion: 1
data:
  id: skeleton
  name: Skeleton
`;
    const result = parseYamlEnvelopes(text);

    expect(result.issues).toEqual([]);
    expect(result.envelopes).toHaveLength(2);
    expect(result.envelopes[0].documentIndex).toBe(0);
    expect(result.envelopes[1].documentIndex).toBe(1);
    expect((result.envelopes[1].data as { id: string }).id).toBe('skeleton');
  });

  it('skips a trailing empty document produced by a final --- separator', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: goblin
---
`;
    const result = parseYamlEnvelopes(text);

    expect(result.issues).toEqual([]);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0].documentIndex).toBe(0);
  });

  it('rejects unknown kind with an issue and emits no envelope', () => {
    const text = `kind: invented
schemaVersion: 1
data:
  id: x
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].documentIndex).toBe(0);
    expect(result.issues[0].path).toBe('kind');
    expect(result.issues[0].message).toMatch(/unknown kind/i);
  });

  it('rejects unsupported schemaVersion with an issue', () => {
    const text = `kind: creature
schemaVersion: 2
data:
  id: x
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues.some((i) => i.path === 'schemaVersion' && /unsupported/i.test(i.message))).toBe(
      true
    );
  });

  it('rejects schemaVersion as a string (must be the numeric literal 1)', () => {
    const text = `kind: creature
schemaVersion: "1"
data:
  id: x
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues.some((i) => i.path === 'schemaVersion')).toBe(true);
  });

  it('rejects missing schemaVersion with an issue', () => {
    const text = `kind: creature
data:
  id: x
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues.some((i) => i.path === 'schemaVersion' && /required/i.test(i.message))).toBe(
      true
    );
  });

  it('rejects missing data with an issue', () => {
    const text = `kind: creature
schemaVersion: 1
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues.some((i) => i.path === 'data' && /required/i.test(i.message))).toBe(true);
  });

  it('rejects a top-level list document with an issue', () => {
    const text = `- just
- a
- list
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toBe('');
    expect(result.issues[0].message).toMatch(/mapping/i);
  });

  it('reports a clear issue for a comment-only document', () => {
    const text = `# nothing here\n# really\n`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toMatch(/empty|comment/i);
  });

  it('reports a parse issue (no crash) when YAML is syntactically invalid', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: x
  name: "unterminated
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].documentIndex).toBe(0);
    expect(result.issues[0].message.toLowerCase()).toContain('yaml');
  });

  it('reports an issue (no throw) for an alias-bomb document', () => {
    const bomb = [
      'kind: creature',
      'schemaVersion: 1',
      'data:',
      '  a: &a [x,x,x,x,x,x,x,x,x,x]',
      '  b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]',
      '  c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]',
      '  d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c,*c]',
      ''
    ].join('\n');

    expect(() => parseYamlEnvelopes(bomb)).not.toThrow();
    const result = parseYamlEnvelopes(bomb);
    expect(result.envelopes).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].message.toLowerCase()).toMatch(/yaml|alias|resource/);
  });

  it('parses a document with a leading UTF-8 BOM', () => {
    const text = '﻿kind: creature\nschemaVersion: 1\ndata:\n  id: a\n';
    const result = parseYamlEnvelopes(text);

    expect(result.issues).toEqual([]);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0].kind).toBe('creature');
  });

  it('keeps valid envelopes when one document in the stream is invalid', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: ok
---
kind: invented
schemaVersion: 1
data:
  id: bad
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0].documentIndex).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].documentIndex).toBe(1);
  });

  it('rejects unknown extra fields on the envelope as issues', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: x
extraneous: true
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues.some((i) => /unknown field/i.test(i.message) && i.path === 'extraneous')).toBe(
      true
    );
  });

  it('returns no envelopes and no issues for empty input', () => {
    const result = parseYamlEnvelopes('');
    expect(result.envelopes).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
