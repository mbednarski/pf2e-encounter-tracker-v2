import { describe, expect, it } from 'vitest';
import { validateCreature } from './creature-validator';

const minimalCreature = {
  id: 'goblin-warrior',
  name: 'Goblin Warrior',
  level: 1,
  traits: ['goblin', 'humanoid'],
  size: 'small',
  rarity: 'common',
  ac: 16,
  fortitude: 6,
  reflex: 8,
  will: 5,
  perception: 7,
  hp: 18,
  immunities: [],
  resistances: [],
  weaknesses: [],
  speed: { land: 25 },
  attacks: [
    {
      name: 'dogslicer',
      type: 'melee',
      modifier: 8,
      traits: ['agile', 'finesse'],
      damage: [{ dice: 1, dieSize: 6, bonus: 2, type: 'slashing' }]
    }
  ],
  passiveAbilities: [],
  reactiveAbilities: [],
  activeAbilities: [],
  skills: { acrobatics: 8 },
  tags: []
};

describe('validateCreature', () => {
  it('accepts a minimal valid creature and returns it untouched', () => {
    const result = validateCreature(minimalCreature, 0);
    expect(result.issues).toEqual([]);
    expect(result.creature).toEqual(minimalCreature);
  });

  it('rejects non-object data with a single issue at the root path', () => {
    const result = validateCreature('not an object', 3);
    expect(result.creature).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toEqual({
      documentIndex: 3,
      path: '',
      message: expect.stringMatching(/object/i)
    });
  });

  it('reports each missing required scalar field', () => {
    const data = { ...minimalCreature };
    delete (data as Record<string, unknown>).name;
    delete (data as Record<string, unknown>).level;
    delete (data as Record<string, unknown>).hp;

    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    const paths = result.issues.map((i) => i.path).sort();
    expect(paths).toContain('name');
    expect(paths).toContain('level');
    expect(paths).toContain('hp');
  });

  it('reports a wrong-typed scalar field', () => {
    const data = { ...minimalCreature, ac: 'sixteen' };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'ac' && /number/i.test(i.message))).toBe(true);
  });

  it('rejects an unknown size enum value', () => {
    const data = { ...minimalCreature, size: 'planet' };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'size')).toBe(true);
  });

  it('rejects an unknown rarity enum value', () => {
    const data = { ...minimalCreature, rarity: 'mythic' };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'rarity')).toBe(true);
  });

  it('rejects traits that is not a string array', () => {
    const data = { ...minimalCreature, traits: 'goblin' };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'traits')).toBe(true);
  });

  it('reports paths with array indices for bad attacks', () => {
    const data = {
      ...minimalCreature,
      attacks: [
        {
          name: 'fine',
          type: 'melee',
          modifier: 1,
          traits: [],
          damage: [{ type: 'slashing' }]
        },
        {
          name: 'broken',
          type: 'plasma',
          modifier: 1,
          traits: [],
          damage: [{ type: 'slashing' }]
        }
      ]
    };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'attacks[1].type')).toBe(true);
  });

  it('rejects resistances that are not {type, value} objects', () => {
    const data = { ...minimalCreature, resistances: ['fire'] };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path.startsWith('resistances'))).toBe(true);
  });

  it('rejects weaknesses with a non-numeric value', () => {
    const data = { ...minimalCreature, weaknesses: [{ type: 'cold', value: 'a lot' }] };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'weaknesses[0].value')).toBe(true);
  });

  it('rejects speed that is not Record<string, number>', () => {
    const data = { ...minimalCreature, speed: { land: 'fast' } };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'speed.land')).toBe(true);
  });

  it('rejects skills with non-numeric values', () => {
    const data = { ...minimalCreature, skills: { stealth: '+10' } };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'skills.stealth')).toBe(true);
  });

  it('accepts an ability with all optional fields populated', () => {
    const data = {
      ...minimalCreature,
      reactiveAbilities: [
        {
          name: 'Attack of Opportunity',
          actions: 'reaction',
          traits: ['general'],
          trigger: 'A creature within reach uses a manipulate action.',
          frequency: 'once per turn',
          requirements: 'Wielding a melee weapon.',
          description: 'Make a Strike against the triggering creature.'
        }
      ]
    };
    const result = validateCreature(data, 0);
    expect(result.issues).toEqual([]);
    expect(result.creature?.reactiveAbilities[0].actions).toBe('reaction');
  });

  it('rejects an ability missing description', () => {
    const data = {
      ...minimalCreature,
      passiveAbilities: [{ name: 'Pack Hunter' }]
    };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'passiveAbilities[0].description')).toBe(true);
  });

  it('accepts optional fields when present (alignment, source, notes, spellcasting)', () => {
    const data = {
      ...minimalCreature,
      alignment: 'NE',
      source: 'Bestiary 1',
      notes: 'Loves shiny rocks.',
      spellcasting: [
        {
          blockId: 'innate-1',
          name: 'Innate Primal Spells',
          tradition: 'primal',
          type: 'innate',
          dc: 18,
          entries: [
            { spellSlug: 'fear', name: 'Fear', level: 1, frequency: { type: 'perDay', uses: 2 } }
          ]
        }
      ]
    };
    const result = validateCreature(data, 0);
    expect(result.issues).toEqual([]);
    expect(result.creature?.spellcasting?.[0].tradition).toBe('primal');
  });

  it('rejects an attack with bad damage component (non-string type)', () => {
    const data = {
      ...minimalCreature,
      attacks: [
        {
          name: 'jaws',
          type: 'melee',
          modifier: 1,
          traits: [],
          damage: [{ dice: 1, dieSize: 6, type: 7 }]
        }
      ]
    };
    const result = validateCreature(data, 0);
    expect(result.creature).toBeNull();
    expect(result.issues.some((i) => i.path === 'attacks[0].damage[0].type')).toBe(true);
  });
});
