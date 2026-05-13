import { describe, expect, test } from 'vitest';
import { mapFoundryNpcToCreature, parseDamageString, slugifyName } from './mapper';
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

describe('parseDamageString', () => {
  test('parses standard dice + bonus', () => {
    expect(parseDamageString('1d6+1')).toEqual({ dice: 1, dieSize: 6, bonus: 1, type: 'untyped' });
    expect(parseDamageString('2d8+5')).toEqual({ dice: 2, dieSize: 8, bonus: 5, type: 'untyped' });
  });

  test('parses dice with no bonus', () => {
    expect(parseDamageString('2d8')).toEqual({ dice: 2, dieSize: 8, type: 'untyped' });
    expect(parseDamageString('3d10')).toEqual({ dice: 3, dieSize: 10, type: 'untyped' });
  });

  test('parses negative bonus', () => {
    expect(parseDamageString('1d4-1')).toEqual({ dice: 1, dieSize: 4, bonus: -1, type: 'untyped' });
    expect(parseDamageString('1d6-2')).toEqual({ dice: 1, dieSize: 6, bonus: -2, type: 'untyped' });
  });

  test('parses flat damage (bonus only, no dice)', () => {
    expect(parseDamageString('+5')).toEqual({ bonus: 5, type: 'untyped' });
  });

  test('tolerates whitespace inside the expression', () => {
    expect(parseDamageString('  1d6 + 1  ')).toEqual({
      dice: 1,
      dieSize: 6,
      bonus: 1,
      type: 'untyped'
    });
  });

  test('returns null for unparseable strings', () => {
    expect(parseDamageString('foo')).toBeNull();
    expect(parseDamageString('1d')).toBeNull();
    expect(parseDamageString('1dX')).toBeNull();
    expect(parseDamageString('1d6+')).toBeNull();
    expect(parseDamageString('')).toBeNull();
    expect(parseDamageString('   ')).toBeNull();
  });

  test('returns null for an expression with neither dice nor bonus', () => {
    expect(parseDamageString('   ')).toBeNull();
  });
});

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

  test('keeps thrown weapons classified as melee even when range.increment is positive', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'jav',
          name: 'Javelin',
          type: 'melee',
          system: {
            bonus: { value: 8 },
            damageRolls: { '0': { damage: '1d6+2', damageType: 'piercing' } },
            range: { increment: 30, max: null },
            traits: { value: ['thrown-30'] }
          }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.attacks[0]!.type).toBe('melee');
  });

  test('plain thrown trait (no range suffix) also stays melee', () => {
    const npc = baseNpc({
      items: [
        {
          _id: 'dag',
          name: 'Dagger',
          type: 'melee',
          system: {
            bonus: { value: 6 },
            damageRolls: { '0': { damage: '1d4+1', damageType: 'piercing' } },
            range: { increment: 10, max: null },
            traits: { value: ['agile', 'thrown'] }
          }
        }
      ]
    });
    const result = mapFoundryNpcToCreature(npc);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.attacks[0]!.type).toBe('melee');
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

  describe('action partitioning edge cases', () => {
    test("'free' actionType lands in reactiveAbilities", () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'f1',
            name: 'Quick Quaff',
            type: 'action',
            system: {
              actionType: { value: 'free' },
              description: { value: '<p>Free.</p>' }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.reactiveAbilities.map((a) => a.name)).toEqual(['Quick Quaff']);
      expect(result.value.reactiveAbilities[0]!.actions).toBe('free');
    });

    test('warns and treats unknown actionType as active', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'odd',
            name: 'Downtime Ritual',
            type: 'action',
            system: {
              actionType: { value: 'downtime' as never },
              description: { value: '<p>Performed over hours.</p>' }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.activeAbilities.map((a) => a.name)).toEqual(['Downtime Ritual']);
      expect(result.warnings.some((w) => /Downtime Ritual.*downtime/.test(w))).toBe(true);
    });

    test('formats frequency on an ability', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'rare1',
            name: 'Rare Ability',
            type: 'action',
            system: {
              actionType: { value: 'action' },
              actions: { value: 1 },
              frequency: { max: 1, per: 'day' },
              description: { value: '<p>Once daily.</p>' }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.activeAbilities[0]!.frequency).toBe('1 per day');
    });
  });

  describe('damage parsing edge cases', () => {
    test('flags persistent damage on a melee strike', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'fang',
            name: 'Fang',
            type: 'melee',
            system: {
              bonus: { value: 12 },
              damageRolls: {
                '0': { damage: '2d8+5', damageType: 'piercing' },
                '1': { damage: '1d6', damageType: 'acid', category: 'persistent' }
              },
              range: null,
              traits: { value: [] }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      const damage = result.value.attacks[0]!.damage;
      expect(damage).toHaveLength(2);
      const persistent = damage.find((d) => d.persistent);
      expect(persistent).toMatchObject({
        dice: 1,
        dieSize: 6,
        type: 'acid',
        persistent: true
      });
    });

    test('silently drops a damage roll with an unparseable damage string', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'mix',
            name: 'Weird Strike',
            type: 'melee',
            system: {
              bonus: { value: 8 },
              damageRolls: {
                '0': { damage: '1d6+1', damageType: 'slashing' },
                '1': { damage: 'special — see text', damageType: 'untyped' }
              },
              range: null,
              traits: { value: [] }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.attacks[0]!.damage).toEqual([
        { dice: 1, dieSize: 6, bonus: 1, type: 'slashing' }
      ]);
    });

    test('keeps an attack even when every damage roll is unparseable', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'odd',
            name: 'Ineffable',
            type: 'melee',
            system: {
              bonus: { value: 0 },
              damageRolls: { '0': { damage: 'varies', damageType: 'untyped' } },
              range: null,
              traits: { value: [] }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.attacks).toHaveLength(1);
      expect(result.value.attacks[0]!.damage).toEqual([]);
    });
  });

  describe('spellcasting edge cases', () => {
    test('handles multiple spellcasting blocks on one creature', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'innate',
            name: 'Divine Innate',
            type: 'spellcastingEntry',
            system: {
              prepared: { value: 'innate' },
              tradition: { value: 'divine' },
              spelldc: { dc: 18 }
            }
          },
          {
            _id: 'prep',
            name: 'Divine Prepared',
            type: 'spellcastingEntry',
            system: {
              prepared: { value: 'prepared' },
              tradition: { value: 'divine' },
              spelldc: { dc: 19 },
              slots: { slot1: { max: 4 }, slot2: { max: 3 } }
            }
          },
          {
            _id: 's-innate',
            name: 'Heal',
            type: 'spell',
            system: { level: { value: 4 }, location: { value: 'innate' }, traits: { value: [] } }
          },
          {
            _id: 's-prep',
            name: 'Bless',
            type: 'spell',
            system: { level: { value: 1 }, location: { value: 'prep' }, traits: { value: [] } }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.spellcasting).toHaveLength(2);
      const byName = new Map(result.value.spellcasting!.map((b) => [b.name, b]));
      expect(byName.get('Divine Innate')!.entries.map((e) => e.name)).toEqual(['Heal']);
      expect(byName.get('Divine Prepared')!.entries.map((e) => e.name)).toEqual(['Bless']);
      expect(byName.get('Divine Prepared')!.slots).toEqual({ 1: 4, 2: 3 });
    });

    test('silently drops orphan spells whose location matches no entry', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'block1',
            name: 'Arcane',
            type: 'spellcastingEntry',
            system: { prepared: { value: 'innate' }, tradition: { value: 'arcane' }, spelldc: { dc: 15 } }
          },
          {
            _id: 'orphan',
            name: 'Lost Spell',
            type: 'spell',
            system: { level: { value: 1 }, location: { value: 'nonexistent-block' }, traits: { value: [] } }
          },
          {
            _id: 'kept',
            name: 'Kept Spell',
            type: 'spell',
            system: { level: { value: 1 }, location: { value: 'block1' }, traits: { value: [] } }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.spellcasting).toHaveLength(1);
      expect(result.value.spellcasting![0]!.entries.map((e) => e.name)).toEqual(['Kept Spell']);
    });

    test('drops zero-slot ranks but keeps non-zero ones', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'prep',
            name: 'Prepared',
            type: 'spellcastingEntry',
            system: {
              prepared: { value: 'prepared' },
              tradition: { value: 'divine' },
              spelldc: { dc: 18 },
              slots: { slot1: { max: 4 }, slot2: { max: 0 }, slot3: { max: 2 } }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.spellcasting![0]!.slots).toEqual({ 1: 4, 3: 2 });
    });

    test('falls back to safe defaults for unknown tradition / type strings and warns', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'x',
            name: 'Weird',
            type: 'spellcastingEntry',
            system: {
              prepared: { value: 'unknown-style' },
              tradition: { value: 'pyromantic' },
              spelldc: { dc: 12 }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.spellcasting![0]!.tradition).toBe('arcane');
      expect(result.value.spellcasting![0]!.type).toBe('innate');
      expect(result.warnings.some((w) => /tradition.*pyromantic/.test(w))).toBe(true);
      expect(result.warnings.some((w) => /type.*unknown-style/.test(w))).toBe(true);
    });

    test('innate daily-limited spells become perDay frequency', () => {
      const npc = baseNpc({
        items: [
          {
            _id: 'sce',
            name: 'Innate Arcane',
            type: 'spellcastingEntry',
            system: {
              prepared: { value: 'innate' },
              tradition: { value: 'arcane' },
              spelldc: { dc: 17 }
            }
          },
          {
            _id: 'sp-daily',
            name: 'Dispel Magic',
            type: 'spell',
            system: {
              level: { value: 3 },
              location: { value: 'sce', uses: { max: 1, value: 1 } },
              traits: { value: [] }
            }
          },
          {
            _id: 'sp-atwill',
            name: 'Blur',
            type: 'spell',
            system: {
              level: { value: 2 },
              location: { value: 'sce' },
              traits: { value: [] }
            }
          }
        ]
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      const entries = result.value.spellcasting![0]!.entries;
      const daily = entries.find((e) => e.name === 'Dispel Magic');
      expect(daily!.frequency).toEqual({ type: 'perDay', uses: 1 });
      const atWill = entries.find((e) => e.name === 'Blur');
      expect(atWill!.frequency).toEqual({ type: 'atWill' });
    });
  });

  describe('size and rarity mapping', () => {
    test.each([
      ['tiny', 'tiny'],
      ['sm', 'small'],
      ['small', 'small'],
      ['med', 'medium'],
      ['medium', 'medium'],
      ['lg', 'large'],
      ['large', 'large'],
      ['huge', 'huge'],
      ['grg', 'gargantuan'],
      ['gargantuan', 'gargantuan']
    ] as const)('maps Foundry size %s to %s', (foundrySize, expected) => {
      const npc = baseNpc({
        system: { ...baseNpc().system, traits: { rarity: 'common', size: { value: foundrySize }, value: [] } }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.size).toBe(expected);
    });

    test('falls back to medium for an unknown size', () => {
      const npc = baseNpc({
        system: { ...baseNpc().system, traits: { rarity: 'common', size: { value: 'colossal' }, value: [] } }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.size).toBe('medium');
    });

    test.each(['common', 'uncommon', 'rare', 'unique'] as const)('passes through %s rarity', (rarity) => {
      const npc = baseNpc({
        system: { ...baseNpc().system, traits: { rarity, size: { value: 'med' }, value: [] } }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.rarity).toBe(rarity);
    });

    test('falls back to common for an unknown rarity', () => {
      const npc = baseNpc({
        system: {
          ...baseNpc().system,
          traits: { rarity: 'legendary', size: { value: 'med' }, value: [] }
        }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.rarity).toBe('common');
    });
  });

  describe('graceful degradation on missing data', () => {
    test('rejects when load-bearing combat stats are missing', () => {
      const result = mapFoundryNpcToCreature({ name: 'Skeletal Stub', type: 'npc' });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected ok: false');
      expect(result.error).toMatch(/missing required fields/);
      expect(result.error).toMatch(/ac/);
      expect(result.error).toMatch(/hp/);
      expect(result.error).toMatch(/fortitude/);
    });

    test('rejects when a single required stat is missing and names it in the error', () => {
      const npc = baseNpc();
      delete npc.system!.saves!.reflex;
      const result = mapFoundryNpcToCreature(npc);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected ok: false');
      expect(result.error).toMatch(/saves\.reflex/);
    });

    test('uses hp.value when hp.max is missing', () => {
      const npc = baseNpc({
        system: {
          ...baseNpc().system,
          attributes: { ...baseNpc().system!.attributes, hp: { value: 7 } }
        }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.hp).toBe(7);
    });

    test('skips malformed sense entries instead of failing', () => {
      const npc = baseNpc({
        system: {
          ...baseNpc().system,
          perception: {
            mod: 5,
            senses: [{ type: 'darkvision' }, { range: 60 } as unknown as { type: string }]
          }
        }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.senses).toEqual([{ type: 'darkvision' }]);
    });

    test('omits languages when both value is empty and details is empty', () => {
      const npc = baseNpc({
        system: {
          ...baseNpc().system,
          details: { level: { value: 1 }, languages: { value: [], details: '' } }
        }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.languages).toBeUndefined();
    });

    test('keeps languages when only details is present', () => {
      const npc = baseNpc({
        system: {
          ...baseNpc().system,
          details: { level: { value: 1 }, languages: { value: [], details: 'telepathy 100 feet' } }
        }
      });
      const result = mapFoundryNpcToCreature(npc);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.languages).toEqual({ value: [], details: 'telepathy 100 feet' });
    });
  });
});
