/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import { evaluateRuleValue, mapFoundryEffectToDefinition } from './effect-mapper';
import { importSpellEffectFoundryJson } from './index';
import rallyingAnthem from './fixtures/spell-effect-rallying-anthem.json?raw';
import courageousAnthem from './fixtures/spell-effect-courageous-anthem.json?raw';
import songOfStrength from './fixtures/spell-effect-song-of-strength.json?raw';
import fortissimoComposition from './fixtures/spell-effect-fortissimo-composition.json?raw';
import heroism from './fixtures/spell-effect-heroism.json?raw';
import haste from './fixtures/spell-effect-haste.json?raw';
import mysticArmor from './fixtures/spell-effect-mystic-armor.json?raw';

const FIXTURES: Record<string, string> = {
  'spell-effect-rallying-anthem': rallyingAnthem,
  'spell-effect-courageous-anthem': courageousAnthem,
  'spell-effect-song-of-strength': songOfStrength,
  'spell-effect-fortissimo-composition': fortissimoComposition,
  'spell-effect-heroism': heroism,
  'spell-effect-haste': haste,
  'spell-effect-mystic-armor': mysticArmor
};

function fixture(name: string): string {
  const raw = FIXTURES[name];
  if (!raw) throw new Error(`Unknown fixture ${name}`);
  return raw;
}

function mapFixture(name: string) {
  const result = mapFoundryEffectToDefinition(JSON.parse(fixture(name)));
  if (!result.ok) throw new Error(`Expected fixture ${name} to map: ${result.error}`);
  return result;
}

describe('mapFoundryEffectToDefinition', () => {
  test('maps Rallying Anthem with AC/save modifiers and a 1-round turn-start duration', () => {
    const { value, warnings } = mapFixture('spell-effect-rallying-anthem');

    expect(value.id).toBe('spell-effect-rallying-anthem');
    expect(value.name).toBe('Rallying Anthem');
    expect(value.category).toBe('spell');
    expect(value.sourceSpellSlug).toBe('rallying-anthem');
    expect(value.level).toBe(2);
    expect(value.hasValue).toBe(false);
    expect(value.modifiers).toEqual([
      { stat: 'ac', bonusType: 'status', value: 1 },
      { stat: 'allSaves', bonusType: 'status', value: 1 }
    ]);
    expect(value.defaultDuration).toEqual({
      unit: 'rounds',
      value: 1,
      expiry: 'turnStart'
    });
    // Resistance rule is not automated and must be called out.
    expect(value.description).toContain('Not automated: resistance');
    expect(warnings).toEqual([]);
  });

  test('maps Courageous Anthem attack/damage modifiers and skips predicated save bonus', () => {
    const { value } = mapFixture('spell-effect-courageous-anthem');

    expect(value.modifiers).toEqual([
      { stat: 'attackRolls', bonusType: 'status', value: 1 },
      { stat: 'damageRolls', bonusType: 'status', value: 1 }
    ]);
    expect(value.description).toContain('Not automated: conditional bonus');
  });

  test('maps Song of Strength to an athletics modifier', () => {
    const { value } = mapFixture('spell-effect-song-of-strength');

    expect(value.modifiers).toEqual([{ stat: 'athletics', bonusType: 'status', value: 1 }]);
  });

  test('evaluates Heroism rank formula at the effect level', () => {
    const { value, warnings } = mapFixture('spell-effect-heroism');

    // Level-3 heroism grants +1 to attack, saves, skills, and perception.
    expect(value.level).toBe(3);
    expect(value.modifiers).toEqual([
      { stat: 'attackRolls', bonusType: 'status', value: 1 },
      { stat: 'allSaves', bonusType: 'status', value: 1 },
      { stat: 'allSkills', bonusType: 'status', value: 1 },
      { stat: 'perception', bonusType: 'status', value: 1 }
    ]);
    expect(value.defaultDuration).toEqual({ unit: 'minutes', value: 10, expiry: 'turnStart' });
    expect(warnings.some((w) => w.includes('heightened casts may differ'))).toBe(true);
  });

  test('maps Haste GrantItem(Quickened) to an implied effect', () => {
    const { value } = mapFixture('spell-effect-haste');

    expect(value.impliedEffects).toEqual(['quickened']);
    expect(value.modifiers).toEqual([]);
    expect(value.defaultDuration).toEqual({ unit: 'minutes', value: 1, expiry: 'turnStart' });
  });

  test('maps multi-day Mystic Armor duration and item bonus', () => {
    const { value } = mapFixture('spell-effect-mystic-armor');

    expect(value.modifiers).toEqual([{ stat: 'ac', bonusType: 'item', value: 1 }]);
    expect(value.defaultDuration).toMatchObject({ unit: 'days', value: 1 });
  });

  test('maps Fortissimo Composition as a marker effect with unautomated adjustment', () => {
    const { value } = mapFixture('spell-effect-fortissimo-composition');

    expect(value.modifiers).toEqual([]);
    expect(value.description).toContain('Not automated: modifier adjustment');
    expect(value.defaultDuration).toEqual({ unit: 'rounds', value: 1, expiry: 'turnStart' });
  });

  test('rejects non-effect documents', () => {
    const result = mapFoundryEffectToDefinition({ type: 'npc', name: 'Bandit' });
    expect(result).toEqual({
      ok: false,
      error: 'Expected a Foundry "effect" item, got type "npc"'
    });
  });
});

describe('importSpellEffectFoundryJson', () => {
  test('imports a single document', () => {
    const result = importSpellEffectFoundryJson(fixture('spell-effect-rallying-anthem'));
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].id).toBe('spell-effect-rallying-anthem');
  });

  test('imports an array of documents and reports per-index issues', () => {
    const docs = [
      JSON.parse(fixture('spell-effect-courageous-anthem')),
      { type: 'npc', name: 'Bandit' }
    ];
    const result = importSpellEffectFoundryJson(JSON.stringify(docs));

    expect(result.effects.map((e) => e.id)).toEqual(['spell-effect-courageous-anthem']);
    expect(result.issues).toContainEqual({
      documentIndex: 1,
      path: '',
      message: 'Expected a Foundry "effect" item, got type "npc"'
    });
  });

  test('reports JSON parse errors', () => {
    const result = importSpellEffectFoundryJson('{nope');
    expect(result.effects).toEqual([]);
    expect(result.issues[0].message).toMatch(/^JSON parse error:/);
  });
});

describe('evaluateRuleValue', () => {
  test('passes numbers through', () => {
    expect(evaluateRuleValue(2, 1)).toBe(2);
  });

  test('evaluates nested rank ternaries', () => {
    const formula = 'ternary(gte(@item.level,9),3,ternary(gte(@item.level,6),2,1))';
    expect(evaluateRuleValue(formula, 3)).toBe(1);
    expect(evaluateRuleValue(formula, 6)).toBe(2);
    expect(evaluateRuleValue(formula, 9)).toBe(3);
  });

  test('returns null for unsupported formulas', () => {
    expect(evaluateRuleValue('floor(( @item.level ) / 2 )', 4)).toBeNull();
    expect(evaluateRuleValue(undefined, 1)).toBeNull();
  });
});
