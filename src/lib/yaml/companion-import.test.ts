import { describe, expect, test } from 'vitest';
import { importCompanionYaml } from './companion-import';

const VALID_COMPANION = `
kind: companion
schemaVersion: 1
data:
  id: fang
  name: Fang
  type: animal-companion
  masterId: lyra
  level: 5
  ac: 21
  fortitude: 11
  reflex: 12
  will: 9
  perception: 10
  hp: 60
  speed:
    land: 35
  attacks:
    - name: Jaws
      type: melee
      modifier: 13
      traits: [finesse]
      damage:
        - dice: 2
          dieSize: 6
          bonus: 5
          type: piercing
  persistentEffects: []
  tags: []
`;

describe('importCompanionYaml', () => {
  test('imports a valid companion document', () => {
    const result = importCompanionYaml(VALID_COMPANION);
    expect(result.issues).toEqual([]);
    expect(result.companions).toHaveLength(1);
    expect(result.companions[0]).toMatchObject({
      id: 'fang',
      type: 'animal-companion',
      masterId: 'lyra',
      speed: { land: 35 }
    });
    expect(result.companions[0].attacks[0].name).toBe('Jaws');
  });

  test('rejects an invalid companion type with a field-path issue', () => {
    const result = importCompanionYaml(VALID_COMPANION.replace('animal-companion', 'wolf'));
    expect(result.companions).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'type', message: expect.stringContaining('must be one of') })
    );
  });

  test('requires speed, attacks, and persistentEffects', () => {
    const result = importCompanionYaml(`
kind: companion
schemaVersion: 1
data:
  id: fang
  name: Fang
  type: familiar
  masterId: lyra
  level: 1
  ac: 15
  fortitude: 5
  reflex: 7
  will: 6
  perception: 5
  hp: 10
  tags: []
`);
    expect(result.companions).toEqual([]);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('speed');
    expect(paths).toContain('attacks');
    expect(paths).toContain('persistentEffects');
  });

  test('skips non-companion documents with their kind', () => {
    const result = importCompanionYaml(`
kind: creature
schemaVersion: 1
data:
  id: goblin
`);
    expect(result.companions).toEqual([]);
    expect(result.skipped).toEqual([expect.objectContaining({ kind: 'creature' })]);
  });

  test('persisted effects default duration to unlimited', () => {
    const withEffect = VALID_COMPANION.replace(
      'persistentEffects: []',
      `persistentEffects:
    - instanceId: w-1
      effectId: wounded
      value: 1`
    );
    const result = importCompanionYaml(withEffect);
    expect(result.companions[0].persistentEffects).toEqual([
      { instanceId: 'w-1', effectId: 'wounded', value: 1, duration: { type: 'unlimited' } }
    ]);
  });
});
