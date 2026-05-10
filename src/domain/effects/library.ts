import type { EffectDefinition, EffectLibrary, Modifier } from '../types';

const negativeEffectValue = { kind: 'effectValue', sign: -1 } as const;

function allChecksAndDcsModifiers(): Modifier[] {
  return [
    { stat: 'ac', bonusType: 'status', value: negativeEffectValue },
    { stat: 'allSaves', bonusType: 'status', value: negativeEffectValue },
    { stat: 'perception', bonusType: 'status', value: negativeEffectValue },
    { stat: 'attackRolls', bonusType: 'status', value: negativeEffectValue },
    { stat: 'allSkills', bonusType: 'status', value: negativeEffectValue },
    { stat: 'allDCs', bonusType: 'status', value: negativeEffectValue }
  ];
}

function condition(definition: Omit<EffectDefinition, 'category'>): EffectDefinition {
  return { category: 'condition', ...definition };
}

function persistentDamage(type: string, name: string): EffectDefinition {
  return {
    id: `persistent-${type}`,
    name: `Persistent ${name}`,
    category: 'persistent-damage',
    hasValue: false,
    modifiers: [],
    turnEndSuggestion: {
      type: 'promptResolution',
      description: `Take {note} ${type} damage, then flat check DC 15 to remove.`
    },
    description:
      'At end of turn: take damage, then DC 15 flat check to end. Assisted recovery lowers DC to 10. Multiple sources: take only the highest.'
  };
}

function affliction(definition: Omit<EffectDefinition, 'category'>): EffectDefinition {
  return { category: 'affliction', ...definition };
}

function spellEffect(definition: Omit<EffectDefinition, 'category'>): EffectDefinition {
  return { category: 'spell', ...definition };
}

export const effectLibrary: EffectLibrary = {
  frightened: condition({
    id: 'frightened',
    name: 'Frightened',
    hasValue: true,
    maxValue: 4,
    modifiers: allChecksAndDcsModifiers(),
    turnEndSuggestion: { type: 'suggestDecrement', amount: 1 },
    description: 'Decreases by 1 at end of your turn.'
  }),
  sickened: condition({
    id: 'sickened',
    name: 'Sickened',
    hasValue: true,
    maxValue: 4,
    modifiers: allChecksAndDcsModifiers(),
    description:
      "Can spend an action to retch (Fortitude save vs source DC to reduce by 1, or 0 on critical success). Can't willingly ingest anything."
  }),
  clumsy: condition({
    id: 'clumsy',
    name: 'Clumsy',
    hasValue: true,
    maxValue: 4,
    modifiers: [
      { stat: 'ac', bonusType: 'status', value: negativeEffectValue },
      { stat: 'reflex', bonusType: 'status', value: negativeEffectValue },
      { stat: 'dexSkills', bonusType: 'status', value: negativeEffectValue }
    ],
    description: "Also applies to Dex-based attack rolls, which are not automated because creature attacks don't tag ability."
  }),
  enfeebled: condition({
    id: 'enfeebled',
    name: 'Enfeebled',
    hasValue: true,
    maxValue: 4,
    modifiers: [{ stat: 'strSkills', bonusType: 'status', value: negativeEffectValue }],
    description:
      "Also applies to Str-based melee attack rolls and damage rolls, which are not automated because creature attacks don't tag ability."
  }),
  stupefied: condition({
    id: 'stupefied',
    name: 'Stupefied',
    hasValue: true,
    maxValue: 4,
    modifiers: [
      { stat: 'mentalSkills', bonusType: 'status', value: negativeEffectValue },
      { stat: 'will', bonusType: 'status', value: negativeEffectValue },
      { stat: 'spellDcs', bonusType: 'status', value: negativeEffectValue },
      { stat: 'spellAttacks', bonusType: 'status', value: negativeEffectValue }
    ],
    description:
      'When casting a spell, DC 5 + value flat check or the spell is lost.'
  }),
  drained: condition({
    id: 'drained',
    name: 'Drained',
    hasValue: true,
    maxValue: 4,
    modifiers: [{ stat: 'fortitude', bonusType: 'status', value: negativeEffectValue }],
    persistAfterEncounter: true,
    description:
      "Reduces max HP by level times value. Also applies to Con-based checks beyond Fortitude. Decreases by 1 after a full night's rest."
  }),
  doomed: condition({
    id: 'doomed',
    name: 'Doomed',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    persistAfterEncounter: true,
    description: 'Death threshold becomes 4 - Doomed value. Decreases by 1 after a full night of rest.'
  }),
  wounded: condition({
    id: 'wounded',
    name: 'Wounded',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    persistAfterEncounter: true,
    description:
      'When you gain Dying, add Wounded value to the Dying value. Removed when restored to full HP. Increases by 1 each time you recover from Dying.'
  }),
  dying: condition({
    id: 'dying',
    name: 'Dying',
    hasValue: true,
    maxValue: 4,
    impliedEffects: ['unconscious'],
    modifiers: [],
    turnStartSuggestion: {
      type: 'promptResolution',
      description:
        'Recovery check: DC 10 + Dying value (+ Wounded if applicable). Crit Success reduces Dying by 2. Success reduces Dying by 1. Failure increases Dying by 1. Crit Failure increases Dying by 2.'
    },
    description: 'You are unconscious. Death occurs at Dying 4, or 4 - Doomed. Recovery check at start of each turn.'
  }),
  slowed: condition({
    id: 'slowed',
    name: 'Slowed',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    turnStartSuggestion: { type: 'reminder', description: 'Loses {value} action(s) this turn.' },
    description:
      'You have fewer actions. At start of turn, lose a number of actions equal to value. Slowed does not affect reactions or free actions.'
  }),
  stunned: condition({
    id: 'stunned',
    name: 'Stunned',
    hasValue: true,
    maxValue: 10,
    modifiers: [],
    turnStartSuggestion: {
      type: 'reminder',
      description:
        'Lose up to {value} action(s). Reduce Stunned value by the number lost. If also Slowed, Stunned actions are lost first.'
    },
    description:
      'You lose actions equal to Stunned value, total not per turn. Reduce Stunned by actions lost each turn. Overrides Slowed while active.'
  }),
  'off-guard': condition({
    id: 'off-guard',
    name: 'Off-Guard',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'circumstance', value: -2 }],
    description: 'You are flat-footed. -2 circumstance penalty to AC.'
  }),
  blinded: condition({
    id: 'blinded',
    name: 'Blinded',
    hasValue: false,
    impliedEffects: ['off-guard'],
    modifiers: [{ stat: 'perception', bonusType: 'status', value: -4 }],
    description:
      "Can't see. All terrain is difficult terrain. Auto-crit-fail Perception checks requiring sight. -4 status penalty to Perception if vision is your only precise sense."
  }),
  dazzled: condition({
    id: 'dazzled',
    name: 'Dazzled',
    hasValue: false,
    modifiers: [],
    description:
      "Everything is concealed to you (DC 5 flat check to target). If you have a non-visual precise sense, concealment only applies vs. creatures you'd need sight to perceive."
  }),
  encumbered: condition({
    id: 'encumbered',
    name: 'Encumbered',
    hasValue: false,
    impliedEffects: ['clumsy'],
    modifiers: [],
    description: 'All Speeds reduced by 10 feet, minimum 5 feet. Implies Clumsy 1.'
  }),
  prone: condition({
    id: 'prone',
    name: 'Prone',
    hasValue: false,
    impliedEffects: ['off-guard'],
    modifiers: [{ stat: 'attackRolls', bonusType: 'circumstance', value: -2 }],
    description:
      'Off-Guard. -2 circumstance to attack rolls. +1 circumstance bonus to AC vs ranged attacks is not automated. Must Crawl to move or spend an action to Stand.'
  }),
  fascinated: condition({
    id: 'fascinated',
    name: 'Fascinated',
    hasValue: false,
    modifiers: [
      { stat: 'perception', bonusType: 'status', value: -2 },
      { stat: 'allSkills', bonusType: 'status', value: -2 }
    ],
    description:
      "Can't use concentrate actions that don't relate to the source of fascination. Ends if a hostile action is taken against you or your allies."
  }),
  grabbed: condition({
    id: 'grabbed',
    name: 'Grabbed',
    hasValue: false,
    impliedEffects: ['off-guard', 'immobilized'],
    modifiers: [],
    description:
      "Off-Guard and Immobilized. Can attempt to Escape (Athletics or Acrobatics vs. grabber's Athletics DC). Ends if grabber moves away or releases."
  }),
  restrained: condition({
    id: 'restrained',
    name: 'Restrained',
    hasValue: false,
    impliedEffects: ['off-guard', 'immobilized'],
    modifiers: [],
    description:
      "Off-Guard and Immobilized. Can't use actions with the manipulate or move trait except Escape and Force Open. Can attempt to Escape."
  }),
  paralyzed: condition({
    id: 'paralyzed',
    name: 'Paralyzed',
    hasValue: false,
    impliedEffects: ['off-guard'],
    modifiers: [],
    description: "Off-Guard. Can't act. Can't move. Body is rigid. Fall prone if standing."
  }),
  petrified: condition({
    id: 'petrified',
    name: 'Petrified',
    hasValue: false,
    impliedEffects: ['off-guard'],
    modifiers: [],
    description:
      "Off-Guard. Can't act. Can't perceive. Turned to stone. Immune to most effects while petrified. Often permanent until reversed by magic."
  }),
  unconscious: condition({
    id: 'unconscious',
    name: 'Unconscious',
    hasValue: false,
    impliedEffects: ['off-guard'],
    modifiers: [
      { stat: 'ac', bonusType: 'status', value: -4 },
      { stat: 'perception', bonusType: 'status', value: -4 },
      { stat: 'reflex', bonusType: 'status', value: -4 }
    ],
    description:
      "Off-Guard. Can't act. Fall prone and drop held items. You don't perceive. A creature can Interact to wake you, or you wake from damage unless magical sleep."
  }),
  immobilized: condition({
    id: 'immobilized',
    name: 'Immobilized',
    hasValue: false,
    modifiers: [],
    description: "Can't use actions with the move trait. Can be dragged or teleported."
  }),
  concealed: condition({
    id: 'concealed',
    name: 'Concealed',
    hasValue: false,
    modifiers: [],
    description: "DC 5 flat check for attacks targeting this creature; on failure, attack misses. Doesn't change what senses can detect you."
  }),
  hidden: condition({
    id: 'hidden',
    name: 'Hidden',
    hasValue: false,
    modifiers: [],
    description: "Creatures know your space but can't see you. DC 11 flat check to target; on failure, attack misses. Must Seek to find with Perception."
  }),
  undetected: condition({
    id: 'undetected',
    name: 'Undetected',
    hasValue: false,
    modifiers: [],
    description:
      "Creatures don't know your location. Must guess the space to target; DC 11 flat check if correct space. Must Seek to become Hidden first."
  }),
  unnoticed: condition({
    id: 'unnoticed',
    name: 'Unnoticed',
    hasValue: false,
    modifiers: [],
    description: "Creatures don't know you're present at all. Can't be targeted or affected. More restrictive than Undetected."
  }),
  invisible: condition({
    id: 'invisible',
    name: 'Invisible',
    hasValue: false,
    modifiers: [],
    description:
      "Can't be seen. You are Hidden or Undetected to creatures relying on sight, depending on whether they can identify your space. Non-visual senses may still detect you."
  }),
  fleeing: condition({
    id: 'fleeing',
    name: 'Fleeing',
    hasValue: false,
    modifiers: [],
    description:
      'Must spend each action to move away from the source of fear using the most efficient route. Cannot Delay or Ready. If cornered, uses other actions as GM sees fit.'
  }),
  controlled: condition({
    id: 'controlled',
    name: 'Controlled',
    hasValue: false,
    modifiers: [],
    description: "Another creature determines your actions. The controller spends your actions. You're typically Off-Guard; apply separately if needed."
  }),
  confused: condition({
    id: 'confused',
    name: 'Confused',
    hasValue: false,
    impliedEffects: ['off-guard'],
    modifiers: [],
    description:
      "Off-Guard. Can't Delay, Ready, or use reactions. Treats all creatures as enemies. Each turn, Strike a random adjacent creature if possible; otherwise move toward the nearest creature."
  }),
  quickened: condition({
    id: 'quickened',
    name: 'Quickened',
    hasValue: false,
    modifiers: [],
    turnStartSuggestion: {
      type: 'reminder',
      description: 'Gains 1 extra action this turn (constrained to specified use, if any).'
    },
    description:
      'Gain 1 extra action at start of each turn. The extra action is often limited to specific uses by the granting effect, noted in AppliedEffect.note.'
  }),
  'persistent-fire': persistentDamage('fire', 'Fire'),
  'persistent-cold': persistentDamage('cold', 'Cold'),
  'persistent-acid': persistentDamage('acid', 'Acid'),
  'persistent-electricity': persistentDamage('electricity', 'Electricity'),
  'persistent-sonic': persistentDamage('sonic', 'Sonic'),
  'persistent-bleed': persistentDamage('bleed', 'Bleed'),
  'persistent-poison': persistentDamage('poison', 'Poison'),
  'persistent-mental': persistentDamage('mental', 'Mental'),
  'persistent-bludgeoning': persistentDamage('bludgeoning', 'Bludgeoning'),
  'persistent-piercing': persistentDamage('piercing', 'Piercing'),
  'persistent-slashing': persistentDamage('slashing', 'Slashing'),

  'ghoul-fever': affliction({
    id: 'ghoul-fever',
    name: 'Ghoul Fever',
    hasValue: true,
    maxValue: 4,
    modifiers: [],
    description:
      'Disease (DC 17 Fortitude). Stage 1: carrier (1 day). Stage 2: 3d8 negative damage and enfeebled 2 (1 day). Stage 3: 3d8 negative damage and enfeebled 2 (1 day). Stage 4: as stage 3, and the creature dies if reduced to 0 HP, rising as a ghoul on the next midnight.'
  }),
  'goblin-pox': affliction({
    id: 'goblin-pox',
    name: 'Goblin Pox',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    description:
      'Disease (DC 17 Fortitude). Stage 1: sickened 1 (1 round). Stage 2: sickened 2 and slowed 1 (1 round). Stage 3: sickened 2 (1 day). Goblins and goblin dogs are immune.'
  }),
  'drow-sleep-poison': affliction({
    id: 'drow-sleep-poison',
    name: 'Drow Sleep Poison',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    description:
      'Poison (DC 18 Fortitude). Stage 1: enfeebled 1 (1 round). Stage 2: fall unconscious (1 minute, with normal Perception checks to wake).'
  }),
  'spider-venom': affliction({
    id: 'spider-venom',
    name: 'Spider Venom',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    description:
      'Poison (DC 22 Fortitude). Stage 1: 1d4 poison damage and enfeebled 1 (1 round). Stage 2: 1d4 poison damage and enfeebled 2 (1 round). Stage 3: 2d4 poison damage and enfeebled 2 (1 round).'
  }),

  bless: spellEffect({
    id: 'bless',
    name: 'Bless',
    hasValue: false,
    modifiers: [{ stat: 'attackRolls', bonusType: 'status', value: 1 }],
    description: 'Allies in a 5-foot emanation gain a +1 status bonus to attack rolls. Sustained; emanation grows by 10 ft each turn (max 30 ft).'
  }),
  bane: spellEffect({
    id: 'bane',
    name: 'Bane',
    hasValue: false,
    modifiers: [{ stat: 'attackRolls', bonusType: 'status', value: -1 }],
    description: 'Enemies in a 5-foot emanation that fail Will save take a -1 status penalty to attack rolls. Sustained; emanation grows.'
  }),
  haste: spellEffect({
    id: 'haste',
    name: 'Haste',
    hasValue: false,
    modifiers: [],
    description: 'Target gains an extra Strike or Stride action each turn. 1 minute.'
  }),
  slow: spellEffect({
    id: 'slow',
    name: 'Slow (spell)',
    hasValue: false,
    modifiers: [],
    description: 'Target loses an action each turn (1 round on success, 1 minute on failure, plus slowed 2 on critical failure).'
  }),
  heroism: spellEffect({
    id: 'heroism',
    name: 'Heroism',
    hasValue: true,
    maxValue: 3,
    modifiers: [],
    description: 'Target gains a status bonus to attack rolls, Perception, saves, and skill checks (+1 at rank 3, +2 at rank 6, +3 at rank 9). 10 minutes.'
  }),
  'inspire-courage': spellEffect({
    id: 'inspire-courage',
    name: 'Inspire Courage',
    hasValue: false,
    modifiers: [
      { stat: 'attackRolls', bonusType: 'status', value: 1 },
      { stat: 'damageRolls', bonusType: 'status', value: 1 }
    ],
    description: 'Allies in a 60-foot emanation gain a +1 status bonus to attack rolls, damage rolls, and saves vs fear (the save bonus is too narrow to automate). Composition cantrip; 1 round.'
  }),
  'inspire-defense': spellEffect({
    id: 'inspire-defense',
    name: 'Inspire Defense',
    hasValue: false,
    modifiers: [
      { stat: 'ac', bonusType: 'status', value: 1 },
      { stat: 'allSaves', bonusType: 'status', value: 1 }
    ],
    description: 'Allies in a 60-foot emanation gain a +1 status bonus to AC and saves, plus resistance equal to half the bardic level to physical damage (resistance not automated). Composition cantrip; 1 round.'
  }),
  'mage-armor': spellEffect({
    id: 'mage-armor',
    name: 'Mage Armor',
    hasValue: false,
    modifiers: [{ stat: 'ac', bonusType: 'item', value: 1 }],
    description: 'Target gains a +1 item bonus to AC and a maximum Dex cap of +5 (Dex cap not modeled). 24 hours.'
  }),
  shield: spellEffect({
    id: 'shield',
    name: 'Shield (spell)',
    hasValue: false,
    modifiers: [],
    description: 'Conjures a shield (Hardness scales with rank). Can be Raised or used to Shield Block; broken shield cannot be cast again for 10 minutes.'
  }),
  soothe: spellEffect({
    id: 'soothe',
    name: 'Soothe',
    hasValue: false,
    modifiers: [],
    description: 'Target regains HP and gains +2 status bonus to saves vs mental effects. 1 minute.'
  })
};
