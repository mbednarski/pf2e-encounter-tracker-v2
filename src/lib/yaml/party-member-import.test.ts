import { describe, expect, test } from 'vitest';
import { importPartyMemberYaml } from './party-member-import';

describe('importPartyMemberYaml', () => {
  test('round-trips a fully populated party-member document', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: lyra-sunwhisper
  name: Lyra Sunwhisper
  playerName: Alice
  level: 5
  ancestry: Elf
  class: Wizard
  ac: 19
  fortitude: 9
  reflex: 11
  will: 13
  perception: 11
  hp: 56
  speed: { land: 30 }
  skills: { arcana: 14, occultism: 14 }
  resistances: [{ type: cold, value: 2 }]
  weaknesses: [{ type: fire, value: 5 }]
  immunities: [sleep]
  notes: Studies the Esoteric Order of the Cypher Crown.
  tags: [arcane, party-leader]
  companionIds: []
  persistentEffects:
    - instanceId: wounded-1
      effectId: wounded
      value: 1
      duration: { type: unlimited }
`;

    const { partyMembers, issues, skipped } = importPartyMemberYaml(text);

    expect(issues).toEqual([]);
    expect(skipped).toEqual([]);
    expect(partyMembers).toHaveLength(1);
    expect(partyMembers[0]).toEqual({
      id: 'lyra-sunwhisper',
      name: 'Lyra Sunwhisper',
      playerName: 'Alice',
      level: 5,
      ancestry: 'Elf',
      class: 'Wizard',
      ac: 19,
      fortitude: 9,
      reflex: 11,
      will: 13,
      perception: 11,
      hp: 56,
      speed: { land: 30 },
      skills: { arcana: 14, occultism: 14 },
      resistances: [{ type: 'cold', value: 2 }],
      weaknesses: [{ type: 'fire', value: 5 }],
      immunities: ['sleep'],
      notes: 'Studies the Esoteric Order of the Cypher Crown.',
      tags: ['arcane', 'party-leader'],
      companionIds: [],
      persistentEffects: [
        {
          instanceId: 'wounded-1',
          effectId: 'wounded',
          value: 1,
          duration: { type: 'unlimited' }
        }
      ]
    });
  });

  test('accepts a minimal party-member document with only required fields', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 1
  ac: 17
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects: []
`;
    const { partyMembers, issues } = importPartyMemberYaml(text);
    expect(issues).toEqual([]);
    expect(partyMembers).toHaveLength(1);
    expect(partyMembers[0].id).toBe('dane');
  });

  test('defaults persistent-effect duration to unlimited when omitted', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 1
  ac: 17
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects:
    - instanceId: w-1
      effectId: wounded
      value: 1
`;
    const { partyMembers } = importPartyMemberYaml(text);
    expect(partyMembers[0].persistentEffects[0].duration).toEqual({ type: 'unlimited' });
  });

  test('reports an issue when a required field is missing', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 1
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects: []
`;
    const { partyMembers, issues } = importPartyMemberYaml(text);
    expect(partyMembers).toHaveLength(0);
    expect(issues.some((i) => i.path === 'ac')).toBe(true);
  });

  test('rejects level < 1', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 0
  ac: 17
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects: []
`;
    const { partyMembers, issues } = importPartyMemberYaml(text);
    expect(partyMembers).toHaveLength(0);
    const levelIssue = issues.find((i) => i.path === 'level');
    expect(levelIssue?.message).toBe('must be >= 1');
  });

  test('rejects negative defensive stats', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 1
  ac: -2
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects: []
`;
    const { partyMembers, issues } = importPartyMemberYaml(text);
    expect(partyMembers).toHaveLength(0);
    expect(issues.some((i) => i.path === 'ac' && />=/.test(i.message))).toBe(true);
  });

  test('reports a malformed persistent effect entry', () => {
    const text = `kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 1
  ac: 17
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects:
    - effectId: wounded
`;
    const { partyMembers, issues } = importPartyMemberYaml(text);
    expect(partyMembers).toHaveLength(0);
    expect(issues.some((i) => i.path === 'persistentEffects[0].instanceId')).toBe(true);
  });

  test('skips non-party-member envelopes (e.g. creature)', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: goblin
  name: Goblin
---
kind: party-member
schemaVersion: 1
data:
  id: dane
  name: Dane
  level: 1
  ac: 17
  fortitude: 7
  reflex: 5
  will: 6
  perception: 5
  hp: 22
  tags: []
  companionIds: []
  persistentEffects: []
`;
    const { partyMembers, skipped } = importPartyMemberYaml(text);
    expect(partyMembers).toHaveLength(1);
    expect(partyMembers[0].id).toBe('dane');
    expect(skipped).toEqual([{ documentIndex: 0, kind: 'creature' }]);
  });

  test('handles an empty input as an empty result', () => {
    const { partyMembers, issues, skipped } = importPartyMemberYaml('');
    expect(partyMembers).toEqual([]);
    expect(skipped).toEqual([]);
    // The envelope parser may surface an issue for an empty document; that's
    // fine — what we're asserting is that nothing crashes and no party
    // members are produced.
    expect(Array.isArray(issues)).toBe(true);
  });
});
