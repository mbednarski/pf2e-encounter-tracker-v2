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
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toBe('schemaVersion');
    expect(result.issues[0].message).toMatch(/unsupported schemaVersion/i);
  });

  it('rejects missing schemaVersion with an issue', () => {
    const text = `kind: creature
data:
  id: x
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues[0].path).toBe('schemaVersion');
    expect(result.issues[0].message).toMatch(/required/i);
  });

  it('rejects missing data with an issue', () => {
    const text = `kind: creature
schemaVersion: 1
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues[0].path).toBe('data');
    expect(result.issues[0].message).toMatch(/required/i);
  });

  it('rejects a non-object document with an issue', () => {
    const text = `- just
- a
- list
`;
    const result = parseYamlEnvelopes(text);

    expect(result.envelopes).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toBe('');
    expect(result.issues[0].message).toMatch(/object/i);
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
    expect(result.issues.some((i) => /unknown field/i.test(i.message) && i.path === 'extraneous')).toBe(true);
  });

  it('returns no envelopes and no issues for empty input', () => {
    const result = parseYamlEnvelopes('');
    expect(result.envelopes).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
