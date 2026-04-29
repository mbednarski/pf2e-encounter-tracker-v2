import { describe, expect, test } from 'vitest';
import { effectLibrary } from './library';
import type { BonusType, Modifier, ModifierValue, StatTarget, TurnBoundarySuggestion } from '../types';

const supportedBonusTypes = new Set<BonusType>(['status', 'circumstance', 'item', 'untyped']);

const supportedStatTargets = new Set<StatTarget>([
  'ac',
  'fortitude',
  'reflex',
  'will',
  'allSaves',
  'perception',
  'attackRolls',
  'allDCs',
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

  test('models persistent damage as note-driven prompt definitions', () => {
    expect(effectLibrary['persistent-fire']).toMatchObject({
      id: 'persistent-fire',
      name: 'Persistent Fire',
      category: 'persistent-damage',
      hasValue: false,
      modifiers: [],
      turnStartSuggestion: {
        type: 'promptResolution',
        description: 'Take {note} fire damage, then flat check DC 15 to remove.'
      }
    });
  });
});
