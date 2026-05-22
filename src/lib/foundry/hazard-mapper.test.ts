import { describe, expect, test } from 'vitest';
import { mapFoundryHazardToHazard } from './hazard-mapper';
import type { FoundryHazard } from './hazard-types';

describe('mapFoundryHazardToHazard', () => {
  test('maps a complex Foundry hazard actor to a domain Hazard', () => {
    const result = mapFoundryHazardToHazard(sampleHazard());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      id: 'poisoned-dart-gallery',
      name: 'Poisoned Dart Gallery',
      level: 8,
      traits: ['mechanical', 'trap'],
      rarity: 'common',
      stealth: 28,
      stealthNote: 'DC 30 to detect; trained',
      ac: 27,
      fortitude: 13,
      reflex: 17,
      will: 8,
      hp: 100,
      hardness: 10,
      source: 'Extinction Curse'
    });
  });

  test('HTML-strips the routine and disable text blocks', () => {
    const result = mapFoundryHazardToHazard(sampleHazard());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.routine).toBe('The trap fires a volley of poisoned darts.');
    expect(result.value.disable).toBe('Thievery DC 26 to disarm a launcher.');
    expect(result.value.routine).not.toContain('<');
  });

  test('maps Strike items and reaction items', () => {
    const result = mapFoundryHazardToHazard(sampleHazard());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attacks).toHaveLength(1);
    expect(result.value.attacks[0]).toMatchObject({ name: 'Dart', type: 'ranged', modifier: 21 });
    expect(result.value.reactiveAbilities).toHaveLength(1);
    expect(result.value.reactiveAbilities[0].name).toBe('Dart Volley');
  });

  test('rejects a non-hazard document', () => {
    const result = mapFoundryHazardToHazard({ ...sampleHazard(), type: 'npc' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Expected document type "hazard"');
  });

  test('rejects a simple (non-complex) hazard', () => {
    const doc = sampleHazard();
    doc.system!.details!.isComplex = false;
    const result = mapFoundryHazardToHazard(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not complex');
  });

  test('rejects a hazard missing its level', () => {
    const doc = sampleHazard();
    delete doc.system!.details!.level;
    const result = mapFoundryHazardToHazard(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('level');
  });

  test('warns and defaults when AC, HP, or Stealth are absent', () => {
    const doc = sampleHazard();
    delete doc.system!.attributes!.ac;
    delete doc.system!.attributes!.hp;
    delete doc.system!.attributes!.stealth;
    const result = mapFoundryHazardToHazard(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ac).toBe(0);
    expect(result.value.hp).toBe(0);
    expect(result.value.stealth).toBe(0);
    expect(result.warnings).toHaveLength(3);
  });

  test('accepts hardness stored as a bare number', () => {
    const doc = sampleHazard();
    doc.system!.attributes!.hardness = 14;
    const result = mapFoundryHazardToHazard(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hardness).toBe(14);
  });
});

function sampleHazard(): FoundryHazard {
  return {
    name: 'Poisoned Dart Gallery',
    type: 'hazard',
    system: {
      details: {
        level: { value: 8 },
        isComplex: true,
        routine: '<p>The trap fires a volley of poisoned darts.</p>',
        disable: '<p>Thievery DC 26 to disarm a launcher.</p>',
        reset: '<p>The trap resets after one hour.</p>',
        description: '<p>A gallery lined with hidden dart launchers.</p>',
        publication: { title: 'Extinction Curse' }
      },
      attributes: {
        ac: { value: 27 },
        hp: { max: 100, value: 100 },
        hardness: { value: 10 },
        stealth: { value: 28, details: 'DC 30 to detect; trained' },
        immunities: [{ type: 'object-immunities' }],
        weaknesses: [],
        resistances: []
      },
      saves: {
        fortitude: { value: 13 },
        reflex: { value: 17 },
        will: { value: 8 }
      },
      traits: {
        value: ['mechanical', 'trap'],
        rarity: 'common'
      }
    },
    items: [
      {
        type: 'melee',
        name: 'Dart',
        system: {
          bonus: { value: 21 },
          damageRolls: { a: { damage: '3d4+2', damageType: 'piercing' } },
          range: { increment: 60 },
          traits: { value: [] }
        }
      },
      {
        type: 'action',
        name: 'Dart Volley',
        system: {
          actionType: { value: 'reaction' },
          description: { value: '<p>The trap Strikes the triggering creature.</p>' }
        }
      }
    ]
  };
}
