import type { Creature } from '../domain';

export const creatureLibrary: Creature[] = [
  {
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
    passiveAbilities: [
      {
        name: 'Goblin Scuttle',
        description: 'Step quickly through the melee when an enemy creates an opening.'
      }
    ],
    reactiveAbilities: [],
    activeAbilities: [
      {
        name: 'Slash',
        actions: 1,
        description: 'Make a dogslicer Strike.'
      }
    ],
    skills: { acrobatics: 8, stealth: 10 },
    source: 'Seeded sample',
    tags: ['sample']
  },
  {
    id: 'skeleton-guard',
    name: 'Skeleton Guard',
    level: 1,
    traits: ['mindless', 'skeleton', 'undead'],
    size: 'medium',
    rarity: 'common',
    ac: 17,
    fortitude: 7,
    reflex: 8,
    will: 5,
    perception: 6,
    hp: 20,
    immunities: ['death effects', 'disease', 'mental', 'paralyzed', 'poison', 'unconscious'],
    resistances: [{ type: 'piercing', value: 5 }],
    weaknesses: [{ type: 'bludgeoning', value: 5 }],
    speed: { land: 25 },
    attacks: [
      {
        name: 'scimitar',
        type: 'melee',
        modifier: 8,
        traits: ['forceful', 'sweep'],
        damage: [{ dice: 1, dieSize: 6, bonus: 3, type: 'slashing' }]
      },
      {
        name: 'claw',
        type: 'melee',
        modifier: 8,
        traits: ['agile', 'finesse'],
        damage: [{ dice: 1, dieSize: 4, bonus: 3, type: 'slashing' }]
      }
    ],
    passiveAbilities: [
      {
        name: 'Bone Rattle',
        description: 'Creatures that first see the guard in dim light may need to steady themselves against fear.'
      }
    ],
    reactiveAbilities: [],
    activeAbilities: [],
    skills: { athletics: 7, intimidation: 5 },
    source: 'Seeded sample',
    tags: ['sample']
  },
  {
    id: 'cave-wolf',
    name: 'Cave Wolf',
    level: 2,
    traits: ['animal'],
    size: 'medium',
    rarity: 'common',
    ac: 18,
    fortitude: 9,
    reflex: 11,
    will: 6,
    perception: 10,
    hp: 32,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 35 },
    attacks: [
      {
        name: 'jaws',
        type: 'melee',
        modifier: 11,
        traits: ['unarmed'],
        damage: [{ dice: 1, dieSize: 8, bonus: 4, type: 'piercing' }],
        effects: ['knockdown']
      }
    ],
    passiveAbilities: [
      {
        name: 'Pack Hunter',
        description: 'The wolf gains tactical advantage when an ally threatens the same prey.'
      }
    ],
    reactiveAbilities: [],
    activeAbilities: [
      {
        name: 'Terrifying Howl',
        actions: 2,
        description: 'Creatures in a 30-foot emanation attempt a DC 18 Will save.'
      }
    ],
    skills: { athletics: 9, stealth: 11, survival: 8 },
    source: 'Seeded sample',
    tags: ['sample']
  }
];
