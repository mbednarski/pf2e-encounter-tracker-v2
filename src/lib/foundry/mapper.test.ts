import { describe, expect, test } from 'vitest';
import { mapFoundryNpcToCreature, slugifyName } from './mapper';
import type { FoundryNpc } from './types';

function baseNpc(overrides: Partial<FoundryNpc> = {}): FoundryNpc {
  return {
    _id: 'abc',
    name: 'Test Goblin',
    type: 'npc',
    items: [],
    system: {
      details: { level: { value: 1 } },
      traits: { rarity: 'common', size: { value: 'sm' }, value: ['goblin', 'humanoid'] },
      attributes: {
        ac: { value: 16 },
        hp: { max: 12, value: 12 },
        speed: { value: 25, otherSpeeds: [{ type: 'climb', value: 15 }] },
        immunities: [],
        resistances: [],
        weaknesses: []
      },
      saves: { fortitude: { value: 5 }, reflex: { value: 7 }, will: { value: 3 } },
      perception: { mod: 6, senses: [{ type: 'darkvision' }] },
      abilities: {
        str: { mod: 1 },
        dex: { mod: 4 },
        con: { mod: 0 },
        int: { mod: -1 },
        wis: { mod: 0 },
        cha: { mod: 1 }
      },
      skills: { athletics: { base: 5 }, stealth: { base: 8 } }
    },
    ...overrides
  };
}

describe('slugifyName', () => {
  test('lowercases and kebab-cases names', () => {
    expect(slugifyName('Air Mephit')).toBe('air-mephit');
    expect(slugifyName("Gluttondark Babau")).toBe('gluttondark-babau');
    expect(slugifyName("Yaashka, Xulgath Elder")).toBe('yaashka-xulgath-elder');
  });

  test('strips apostrophes', () => {
    expect(slugifyName("Old One's Herald")).toBe('old-ones-herald');
  });
});

describe('mapFoundryNpcToCreature', () => {
  test('maps a minimal humanoid NPC end-to-end', () => {
    const result = mapFoundryNpcToCreature(baseNpc());
    if (!result.ok) throw new Error(result.error);

    expect(result.value.id).toBe('test-goblin');
    expect(result.value.name).toBe('Test Goblin');
    expect(result.value.level).toBe(1);
    expect(result.value.size).toBe('small');
    expect(result.value.rarity).toBe('common');
    expect(result.value.ac).toBe(16);
    expect(result.value.hp).toBe(12);
    expect(result.value.fortitude).toBe(5);
    expect(result.value.reflex).toBe(7);
    expect(result.value.will).toBe(3);
    expect(result.value.perception).toBe(6);
    expect(result.value.speed).toEqual({ land: 25, climb: 15 });
    expect(result.value.traits).toEqual(['goblin', 'humanoid']);
    expect(result.value.skills).toEqual({ athletics: 5, stealth: 8 });
  });

  test('rejects non-npc documents', () => {
    const result = mapFoundryNpcToCreature({ name: 'Sword', type: 'weapon' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/npc/i);
  });

  test('rejects non-objects', () => {
    expect(mapFoundryNpcToCreature(null).ok).toBe(false);
    expect(mapFoundryNpcToCreature('text').ok).toBe(false);
    expect(mapFoundryNpcToCreature([]).ok).toBe(false);
  });

  test('rejects NPC without a name', () => {
    const result = mapFoundryNpcToCreature({ type: 'npc' });
    expect(result.ok).toBe(false);
  });

  test('maps ability score modifiers', () => {
    const result = mapFoundryNpcToCreature(baseNpc());
    if (!result.ok) throw new Error(result.error);
    expect(result.value.abilities).toEqual({
      str: 1,
      dex: 4,
      con: 0,
      int: -1,
      wis: 0,
      cha: 1
    });
  });

  test('omits abilities when any score is missing', () => {
    const npc = baseNpc();
    delete npc.system!.abilities!.wis;
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.abilities).toBeUndefined();
  });

  test('maps senses with optional range', () => {
    const npc = baseNpc({
      system: {
        ...baseNpc().system,
        perception: {
          mod: 7,
          senses: [{ type: 'darkvision' }, { type: 'scent', range: 30, acuity: 'imprecise' }]
        }
      }
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.senses).toEqual([
      { type: 'darkvision' },
      { type: 'scent', acuity: 'imprecise', range: 30 }
    ]);
  });

  test('maps languages with details', () => {
    const npc = baseNpc({
      system: {
        ...baseNpc().system,
        details: {
          level: { value: 1 },
          languages: { value: ['common', 'goblin'], details: 'telepathy 100 feet' }
        }
      }
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.languages).toEqual({
      value: ['common', 'goblin'],
      details: 'telepathy 100 feet'
    });
  });

  test('maps immunities as objects with optional exceptions', () => {
    const npc = baseNpc({
      system: {
        ...baseNpc().system,
        attributes: {
          ...baseNpc().system!.attributes,
          immunities: [{ type: 'fire' }, { type: 'sleep' }],
          resistances: [{ type: 'physical', value: 15, exceptions: ['vorpal-adamantine'] }],
          weaknesses: [{ type: 'cold', value: 5 }]
        }
      }
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.immunities).toEqual([{ type: 'fire' }, { type: 'sleep' }]);
    expect(result.value.resistances).toEqual([{ type: 'physical', value: 15 }]);
    expect(result.value.weaknesses).toEqual([{ type: 'cold', value: 5 }]);
  });

  test('maps melee attacks with damage roll parsing', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'claw1',
          name: 'Claw',
          type: 'melee',
          system: {
            bonus: { value: 9 },
            damageRolls: {
              gn46d6t3xy: { damage: '1d6+1', damageType: 'slashing' }
            },
            range: null,
            traits: { value: ['agile', 'finesse'] }
          }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.attacks).toEqual([
      {
        name: 'Claw',
        type: 'melee',
        modifier: 9,
        traits: ['agile', 'finesse'],
        damage: [{ dice: 1, dieSize: 6, bonus: 1, type: 'slashing' }]
      }
    ]);
  });

  test('detects ranged attacks via non-null range', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'r1',
          name: 'Shortbow',
          type: 'melee',
          system: {
            bonus: { value: 7 },
            damageRolls: { '0': { damage: '1d6', damageType: 'piercing' } },
            range: { increment: 60, max: null },
            traits: { value: ['deadly-d10'] }
          }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.attacks[0]!.type).toBe('ranged');
  });

  test('partitions actions into passive / reactive / active', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'a1',
          name: 'Sneak Attack',
          type: 'action',
          system: { actionType: { value: 'passive' }, description: { value: '<p>Bonus.</p>' } }
        },
        {
          _id: 'a2',
          name: 'Attack of Opportunity',
          type: 'action',
          system: { actionType: { value: 'reaction' }, description: { value: '<p>React.</p>' } }
        },
        {
          _id: 'a3',
          name: 'Breath Weapon',
          type: 'action',
          system: {
            actionType: { value: 'action' },
            actions: { value: 2 },
            description: { value: '<p>Breathe.</p>' }
          }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.passiveAbilities.map((a) => a.name)).toEqual(['Sneak Attack']);
    expect(result.value.reactiveAbilities.map((a) => a.name)).toEqual(['Attack of Opportunity']);
    expect(result.value.activeAbilities.map((a) => a.name)).toEqual(['Breath Weapon']);
    expect(result.value.activeAbilities[0]!.actions).toBe(2);
    expect(result.value.passiveAbilities[0]!.description).toBe('Bonus.');
  });

  test('groups spells under their spellcasting entry by location', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'sce1',
          name: 'Arcane Innate Spells',
          type: 'spellcastingEntry',
          system: {
            prepared: { value: 'innate' },
            tradition: { value: 'arcane' },
            spelldc: { dc: 17, value: 9 }
          }
        },
        {
          _id: 'sp1',
          name: 'Blur',
          type: 'spell',
          system: { level: { value: 2 }, location: { value: 'sce1' }, traits: { value: ['illusion'] } }
        },
        {
          _id: 'sp2',
          name: 'Light',
          type: 'spell',
          system: { level: { value: 0 }, location: { value: 'sce1' }, traits: { value: ['cantrip'] } }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.spellcasting).toHaveLength(1);
    const block = result.value.spellcasting![0]!;
    expect(block.tradition).toBe('arcane');
    expect(block.type).toBe('innate');
    expect(block.dc).toBe(17);
    expect(block.attackModifier).toBe(9);
    expect(block.entries.map((e) => e.name)).toEqual(['Blur', 'Light']);
    expect(block.entries.find((e) => e.name === 'Light')!.isCantrip).toBe(true);
    expect(block.entries.find((e) => e.name === 'Blur')!.frequency).toEqual({ type: 'atWill' });
  });

  test('reads prepared slot counts', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'sce-prep',
          name: 'Divine Prepared',
          type: 'spellcastingEntry',
          system: {
            prepared: { value: 'prepared' },
            tradition: { value: 'divine' },
            spelldc: { dc: 18 },
            slots: { slot1: { max: 4 }, slot2: { max: 3 }, slot3: { max: 0 } }
          }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    const block = result.value.spellcasting![0]!;
    expect(block.slots).toEqual({ 1: 4, 2: 3 });
  });

  test('strips HTML and macros from notes', () => {
    const npc = baseNpc({
      system: {
        ...baseNpc().system,
        details: {
          level: { value: 1 },
          publicNotes:
            '<p>An <strong>air mephit</strong> grants @UUID[Compendium.pf2e.conditionitems.Item.Concealed]{concealed} status.</p>'
        }
      }
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.notes).toBe('An air mephit grants concealed status.');
  });

  test('maps publication title to source', () => {
    const npc = baseNpc({
      system: {
        ...baseNpc().system,
        details: {
          level: { value: 1 },
          publication: { title: 'Pathfinder Bestiary' }
        }
      }
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.source).toBe('Pathfinder Bestiary');
  });
});
