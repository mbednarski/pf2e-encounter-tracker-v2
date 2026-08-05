import { describe, expect, test } from 'vitest';
import { importPartyYaml } from './party-import';

describe('importPartyYaml', () => {
  test('imports a valid party document', () => {
    const result = importPartyYaml(`
kind: party
schemaVersion: 1
data:
  id: extinction-curse
  name: Extinction Curse Party
  memberIds: [lyra, brog]
  level: 5
  notes: Circus crew.
`);
    expect(result.issues).toEqual([]);
    expect(result.parties).toEqual([
      {
        id: 'extinction-curse',
        name: 'Extinction Curse Party',
        memberIds: ['lyra', 'brog'],
        level: 5,
        notes: 'Circus crew.'
      }
    ]);
  });

  test('rejects a party with missing name and bad level', () => {
    const result = importPartyYaml(`
kind: party
schemaVersion: 1
data:
  id: bad
  name: ""
  memberIds: []
  level: 0
`);
    expect(result.parties).toEqual([]);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('name');
    expect(paths).toContain('level');
  });

  test('rejects empty member id entries', () => {
    const result = importPartyYaml(`
kind: party
schemaVersion: 1
data:
  id: p1
  name: Party
  memberIds: ["lyra", ""]
  level: 3
`);
    expect(result.parties).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'memberIds[1]', message: 'must not be empty' })
    );
  });

  test('skips non-party documents with their kind', () => {
    const result = importPartyYaml(`
kind: party-member
schemaVersion: 1
data:
  id: lyra
`);
    expect(result.parties).toEqual([]);
    expect(result.skipped).toEqual([expect.objectContaining({ kind: 'party-member' })]);
  });
});
