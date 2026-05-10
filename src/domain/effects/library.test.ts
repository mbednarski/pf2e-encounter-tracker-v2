import { describe, expect, test } from 'vitest';
import { effectLibrary } from './library';
import { deriveStats } from './derivation';
import type {
  AppliedEffect,
  BonusType,
  CreatureBaseStats,
  Modifier,
  ModifierValue,
  StatTarget,
  TurnBoundarySuggestion
} from '../types';

const supportedBonusTypes = new Set<BonusType>(['status', 'circumstance', 'item', 'untyped']);

const supportedStatTargets = new Set<StatTarget>([
  'ac',
  'fortitude',
  'reflex',
  'will',
  'allSaves',
  'perception',
  'attackRolls',
  'damageRolls',
  'allDCs',
  'spellDcs',
  'spellAttacks',
  'allSkills',
  'strSkills',
  'dexSkills',
  'intSkills',
  'wisSkills',
  'chaSkills',
  'mentalSkills'
]);

const supportedSuggestionTypes = new Set<TurnBoundarySuggestion['type']>([
  'suggestDecrement',
  'suggestRemove',
  'confirmSustained',
  'promptResolution',
  'reminder'
]);

function expectModifierShape(modifier: Modifier): void {
  expect(supportedStatTargets.has(modifier.stat)).toBe(true);
  expect(supportedBonusTypes.has(modifier.bonusType)).toBe(true);
  expect(isSupportedModifierValue(modifier.value)).toBe(true);
}

function isSupportedModifierValue(value: ModifierValue): boolean {
  return (
    typeof value === 'number' ||
    (value.kind === 'effectValue' && (value.sign === 1 || value.sign === -1))
  );
}

function expectSuggestionShape(suggestion: TurnBoundarySuggestion): void {
  expect(supportedSuggestionTypes.has(suggestion.type)).toBe(true);

  if (suggestion.type === 'suggestDecrement') {
    expect(typeof suggestion.amount).toBe('number');
    expect(suggestion.amount).toBeGreaterThan(0);
  }

  if (
    suggestion.type === 'suggestRemove' ||
    suggestion.type === 'promptResolution' ||
    suggestion.type === 'reminder'
  ) {
    expect(typeof suggestion.description).toBe('string');
    expect(suggestion.description.length).toBeGreaterThan(0);
  }
}

describe('effectLibrary', () => {
  test('uses matching record keys and definition ids', () => {
    for (const [key, definition] of Object.entries(effectLibrary)) {
      expect(definition.id).toBe(key);
    }
  });

  test('contains only serializable definitions with supported modifier and suggestion shapes', () => {
    expect(JSON.parse(JSON.stringify(effectLibrary))).toEqual(effectLibrary);

    for (const definition of Object.values(effectLibrary)) {
      expect(definition.name.length).toBeGreaterThan(0);
      expect(['condition', 'spell', 'affliction', 'persistent-damage', 'custom']).toContain(definition.category);
      expect(Array.isArray(definition.modifiers)).toBe(true);

      for (const modifier of definition.modifiers) {
        expectModifierShape(modifier);
      }

      if (definition.turnStartSuggestion) {
        expectSuggestionShape(definition.turnStartSuggestion);
      }

      if (definition.turnEndSuggestion) {
        expectSuggestionShape(definition.turnEndSuggestion);
      }
    }
  });

  test('references only existing definitions from implied effects', () => {
    for (const definition of Object.values(effectLibrary)) {
      for (const impliedEffect of definition.impliedEffects ?? []) {
        expect(effectLibrary[impliedEffect], `${definition.id} implies ${impliedEffect}`).toBeDefined();
      }
    }
  });

  test('defines high-risk condition mechanics from the canonical library spec', () => {
    expect(effectLibrary.frightened).toMatchObject({
      id: 'frightened',
      hasValue: true,
      maxValue: 4,
      turnEndSuggestion: { type: 'suggestDecrement', amount: 1 }
    });
    expect(effectLibrary.frightened.modifiers).toContainEqual({
      stat: 'attackRolls',
      bonusType: 'status',
      value: { kind: 'effectValue', sign: -1 }
    });

    expect(effectLibrary['off-guard']).toMatchObject({
      id: 'off-guard',
      hasValue: false,
      modifiers: [{ stat: 'ac', bonusType: 'circumstance', value: -2 }]
    });

    expect(effectLibrary.dying).toMatchObject({
      id: 'dying',
      hasValue: true,
      maxValue: 4,
      impliedEffects: ['unconscious'],
      turnStartSuggestion: { type: 'promptResolution' }
    });

    expect(effectLibrary.encumbered).toMatchObject({
      id: 'encumbered',
      hasValue: false,
      impliedEffects: ['clumsy']
    });
  });

  test('wires Stupefied to spell DC and spell attack rolls via deriveStats', () => {
    const baseStats: CreatureBaseStats = {
      hp: 30,
      ac: 18,
      fortitude: 7,
      reflex: 7,
      will: 9,
      perception: 8,
      speed: 25,
      skills: { arcana: 10, occultism: 9 }
    };
    const applied: AppliedEffect = {
      instanceId: 'stupefied-2',
      effectId: 'stupefied',
      value: 2,
      duration: { type: 'unlimited' }
    };

    const computed = deriveStats(baseStats, [applied], effectLibrary);

    expect(computed.spellDcs.total).toBe(-2);
    expect(computed.spellAttacks.total).toBe(-2);
    expect(computed.will!.final).toBe(7);
    expect(computed.skills.arcana.final).toBe(8);
  });

  test('wires Bless and Bane attack-roll modifiers', () => {
    const baseStats: CreatureBaseStats = {
      hp: 20,
      ac: 18,
      fortitude: 7,
      reflex: 7,
      will: 7,
      perception: 6,
      speed: 25,
      skills: {}
    };
    const blessed: AppliedEffect = { instanceId: 'b1', effectId: 'bless', duration: { type: 'unlimited' } };
    const baned: AppliedEffect = { instanceId: 'b2', effectId: 'bane', duration: { type: 'unlimited' } };

    expect(deriveStats(baseStats, [blessed], effectLibrary).attackRolls.total).toBe(1);
    expect(deriveStats(baseStats, [baned], effectLibrary).attackRolls.total).toBe(-1);
  });

  test('wires Inspire Courage to attack and damage rolls', () => {
    const baseStats: CreatureBaseStats = {
      hp: 20,
      ac: 18,
      fortitude: 7,
      reflex: 7,
      will: 7,
      perception: 6,
      speed: 25,
      skills: {}
    };
    const applied: AppliedEffect = { instanceId: 'ic', effectId: 'inspire-courage', duration: { type: 'unlimited' } };

    const computed = deriveStats(baseStats, [applied], effectLibrary);

    expect(computed.attackRolls.total).toBe(1);
    expect(computed.damageRolls.total).toBe(1);
  });

  test('wires Inspire Defense to AC and saves', () => {
    const baseStats: CreatureBaseStats = {
      hp: 20,
      ac: 18,
      fortitude: 7,
      reflex: 7,
      will: 7,
      perception: 6,
      speed: 25,
      skills: {}
    };
    const applied: AppliedEffect = { instanceId: 'id', effectId: 'inspire-defense', duration: { type: 'unlimited' } };

    const computed = deriveStats(baseStats, [applied], effectLibrary);

    expect(computed.ac!.final).toBe(19);
    expect(computed.fortitude!.final).toBe(8);
    expect(computed.reflex!.final).toBe(8);
    expect(computed.will!.final).toBe(8);
  });

  test('wires Mage Armor to AC as item bonus', () => {
    const baseStats: CreatureBaseStats = {
      hp: 20,
      ac: 18,
      fortitude: 7,
      reflex: 7,
      will: 7,
      perception: 6,
      speed: 25,
      skills: {}
    };
    const applied: AppliedEffect = { instanceId: 'ma', effectId: 'mage-armor', duration: { type: 'unlimited' } };

    const computed = deriveStats(baseStats, [applied], effectLibrary);

    expect(computed.ac!.final).toBe(19);
    expect(computed.ac!.modifiers[0]?.bonusType).toBe('item');
  });

  test('models persistent damage as note-driven prompt definitions', () => {
    expect(effectLibrary['persistent-fire']).toMatchObject({
      id: 'persistent-fire',
      name: 'Persistent Fire',
      category: 'persistent-damage',
      hasValue: false,
      modifiers: [],
      turnEndSuggestion: {
        type: 'promptResolution',
        description: 'Take {note} fire damage, then flat check DC 15 to remove.'
      }
    });
  });
});
