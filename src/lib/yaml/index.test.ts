import { describe, expect, it } from 'vitest';
import { importCreatureYaml } from './index';

const CREATURE_YAML = `kind: creature
schemaVersion: 1
data:
  id: goblin
  name: Goblin
  level: 1
  traits: [goblin, humanoid]
  size: small
  rarity: common
  ac: 16
  fortitude: 6
  reflex: 8
  will: 5
  perception: 7
  hp: 18
  immunities: []
  resistances: []
  weaknesses: []
  speed: { land: 25 }
  attacks:
    - name: dogslicer
      type: melee
      modifier: 8
      traits: [agile, finesse]
      damage:
        - { dice: 1, dieSize: 6, bonus: 2, type: slashing }
  passiveAbilities: []
  reactiveAbilities: []
  activeAbilities: []
  skills: { acrobatics: 8 }
  tags: []
`;

describe('importCreatureYaml', () => {
  it('returns the parsed creature for a valid YAML document', () => {
    const result = importCreatureYaml(CREATURE_YAML);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0].id).toBe('goblin');
    expect(result.creatures[0].attacks[0].name).toBe('dogslicer');
  });

  it('skips a non-creature kind with an unsupported-kind issue but no crash', () => {
    const text = `kind: spell
schemaVersion: 1
data:
  id: fireball
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].documentIndex).toBe(0);
    expect(result.issues[0].message).toMatch(/not yet supported/i);
  });

  it('returns issues from envelope validation (e.g., unknown kind)', () => {
    const text = `kind: invented
schemaVersion: 1
data:
  id: x
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].path).toBe('kind');
  });

  it('returns issues from creature validation when shape is wrong', () => {
    const text = `kind: creature
schemaVersion: 1
data:
  id: bad
  name: Bad
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((i) => i.documentIndex === 0)).toBe(true);
  });

  it('keeps valid creatures alongside unsupported documents in a multi-doc stream', () => {
    const text = `${CREATURE_YAML}---
kind: spell
schemaVersion: 1
data:
  id: magic-missile
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0].id).toBe('goblin');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].documentIndex).toBe(1);
    expect(result.issues[0].message).toMatch(/not yet supported/i);
  });

  it('returns empty results for empty input', () => {
    const result = importCreatureYaml('');
    expect(result.creatures).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('attaches the source document index to creature validation issues', () => {
    // First doc is a malformed creature; second is a valid creature
    const text = `kind: creature
schemaVersion: 1
data:
  id: only-id
---
${CREATURE_YAML.trimEnd()}
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0].id).toBe('goblin');
    expect(result.issues.every((i) => i.documentIndex === 0)).toBe(true);
  });
});
