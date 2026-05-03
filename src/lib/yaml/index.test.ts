import { describe, expect, it } from 'vitest';
import type { Creature } from '../../domain';
import { dedupeNewCreatures, importCreatureYaml } from './index';

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

function fakeCreature(id: string, name: string): Creature {
  return {
    id,
    name,
    level: 1,
    traits: [],
    size: 'medium',
    rarity: 'common',
    ac: 10,
    fortitude: 0,
    reflex: 0,
    will: 0,
    perception: 0,
    hp: 1,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: {},
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    skills: {},
    tags: []
  };
}

describe('importCreatureYaml', () => {
  it('returns the parsed creature for a valid YAML document', () => {
    const result = importCreatureYaml(CREATURE_YAML);
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0].id).toBe('goblin');
    expect(result.creatures[0].attacks[0].name).toBe('dogslicer');
  });

  it('routes a non-creature kind through `skipped` (not `issues`)', () => {
    const text = `kind: spell
schemaVersion: 1
data:
  id: fireball
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([{ documentIndex: 0, kind: 'spell' }]);
  });

  it('returns issues from envelope validation (e.g., unknown kind)', () => {
    const text = `kind: invented
schemaVersion: 1
data:
  id: x
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toEqual([]);
    expect(result.skipped).toEqual([]);
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

  it('routes a scalar `data` payload through validator issues at root path', () => {
    const text = `kind: creature\nschemaVersion: 1\ndata: 42\n`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toEqual([]);
    expect(result.issues.some((i) => i.path === '' && /mapping/i.test(i.message))).toBe(true);
  });

  it('keeps valid creatures alongside skipped documents in a multi-doc stream', () => {
    const text = `${CREATURE_YAML}---
kind: spell
schemaVersion: 1
data:
  id: magic-missile
`;
    const result = importCreatureYaml(text);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0].id).toBe('goblin');
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([{ documentIndex: 1, kind: 'spell' }]);
  });

  it('returns empty results for empty input', () => {
    const result = importCreatureYaml('');
    expect(result.creatures).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('returns empty results for a comment-only document — but flagged as an issue', () => {
    const result = importCreatureYaml('# nothing here\n');
    expect(result.creatures).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toMatch(/empty|comment/i);
  });

  it('attaches the source document index to creature validation issues', () => {
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

describe('dedupeNewCreatures', () => {
  it('accepts creatures whose ids are not in the existing set', () => {
    const result = dedupeNewCreatures(new Set(['goblin']), [fakeCreature('skeleton', 'Skel')]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].id).toBe('skeleton');
    expect(result.rejected).toEqual([]);
  });

  it('rejects creatures whose id collides with the existing set', () => {
    const result = dedupeNewCreatures(new Set(['goblin']), [fakeCreature('goblin', 'Goblin')]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].id).toBe('goblin');
  });

  it('dedupes within the incoming list (only the first occurrence is accepted)', () => {
    const result = dedupeNewCreatures(new Set(), [
      fakeCreature('goblin', 'Goblin A'),
      fakeCreature('goblin', 'Goblin B')
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].name).toBe('Goblin A');
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].name).toBe('Goblin B');
  });
});
