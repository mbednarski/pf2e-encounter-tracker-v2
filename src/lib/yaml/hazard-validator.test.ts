import { describe, expect, test } from 'vitest';
import { importHazardYaml, dedupeNewHazards } from './index';

const POISONED_DART_GALLERY_YAML = `kind: hazard
schemaVersion: 1
data:
  id: poisoned-dart-gallery
  name: Poisoned Dart Gallery
  level: 8
  traits: [mechanical, trap]
  rarity: common

  stealth: 28
  stealthNote: expert

  ac: 27
  fortitude: 13
  reflex: 17
  hp: 100
  hardness: 10
  immunities: [critical-hits, object-immunities, precision]
  resistances: []
  weaknesses: []

  disableChecks:
    - skill: thievery
      dc: 26
      requiredSuccesses: 3
      note: "at a control panel on the far wall"
    - skill: athletics
      dc: 22
      requiredSuccesses: 1
      note: "to jam a single dart launcher"

  routine:
    actions: 2
    description: |
      The trap fires a volley of poisoned darts.

  attacks:
    - name: poisoned dart
      type: ranged
      modifier: 21
      traits: [range-60]
      damage:
        - dice: 3
          dieSize: 4
          bonus: 2
          type: piercing

  passiveAbilities: []
  reactiveAbilities: []
  activeAbilities: []
  tags: [extinction-curse]
  source: "Extinction Curse #3"
`;

describe('importHazardYaml', () => {
  test('round-trips the poisoned dart gallery fixture', () => {
    const result = importHazardYaml(POISONED_DART_GALLERY_YAML);
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.hazards).toHaveLength(1);

    const h = result.hazards[0];
    expect(h.id).toBe('poisoned-dart-gallery');
    expect(h.name).toBe('Poisoned Dart Gallery');
    expect(h.level).toBe(8);
    expect(h.ac).toBe(27);
    expect(h.fortitude).toBe(13);
    expect(h.reflex).toBe(17);
    expect(h.will).toBeUndefined();
    expect(h.hardness).toBe(10);
    expect(h.stealth).toBe(28);
    expect(h.stealthNote).toBe('expert');
    expect(h.immunities).toEqual(['critical-hits', 'object-immunities', 'precision']);
    expect(h.disableChecks).toHaveLength(2);
    expect(h.disableChecks[0].requiredSuccesses).toBe(3);
    expect(h.routine.actions).toBe(2);
    expect(h.attacks).toHaveLength(1);
  });

  test('rejects when required fields are missing', () => {
    const bad = `kind: hazard
schemaVersion: 1
data:
  id: incomplete
  name: Incomplete
  level: 1
  traits: []
  rarity: common
  stealth: 10
  immunities: []
  resistances: []
  weaknesses: []
  disableChecks: []
  routine:
    actions: 1
    description: noop
  attacks: []
  passiveAbilities: []
  reactiveAbilities: []
  activeAbilities: []
  tags: []
`;
    const result = importHazardYaml(bad);
    expect(result.hazards).toHaveLength(0);
    expect(result.issues.some((i) => i.path === 'disableChecks')).toBe(true);
  });

  test('skips non-hazard envelopes', () => {
    const yaml = `kind: creature
schemaVersion: 1
data:
  id: goblin
  name: Goblin
`;
    const result = importHazardYaml(yaml);
    expect(result.hazards).toHaveLength(0);
    expect(result.skipped).toEqual([{ documentIndex: 0, kind: 'creature' }]);
  });
});

describe('dedupeNewHazards', () => {
  function fakeHazard(id: string, name = id): import('../../domain').Hazard {
    return {
      id,
      name,
      level: 1,
      traits: [],
      rarity: 'common',
      stealth: 10,
      immunities: [],
      resistances: [],
      weaknesses: [],
      disableChecks: [{ skill: 'thievery', dc: 10, requiredSuccesses: 1 }],
      routine: { actions: 1, description: 'noop' },
      passiveAbilities: [],
      reactiveAbilities: [],
      activeAbilities: [],
      attacks: [],
      tags: []
    };
  }

  test('accepts ids not in the existing set', () => {
    const result = dedupeNewHazards(new Set(['pit']), [fakeHazard('dart')]);
    expect(result.accepted.map((h) => h.id)).toEqual(['dart']);
    expect(result.rejected).toEqual([]);
  });

  test('rejects ids already present', () => {
    const result = dedupeNewHazards(new Set(['pit']), [fakeHazard('pit')]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected.map((h) => h.id)).toEqual(['pit']);
  });

  test('rejects duplicates within an import batch', () => {
    const result = dedupeNewHazards(new Set(), [fakeHazard('a'), fakeHazard('a', 'A2')]);
    expect(result.accepted.map((h) => h.name)).toEqual(['a']);
    expect(result.rejected.map((h) => h.name)).toEqual(['A2']);
  });
});
