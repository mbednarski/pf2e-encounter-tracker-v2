import { describe, expect, test } from 'vitest';
import { stripFoundryMarkup } from './text';

describe('stripFoundryMarkup', () => {
  test('strips simple HTML tags and preserves text', () => {
    expect(stripFoundryMarkup('<p>Hello <strong>world</strong>.</p>')).toBe('Hello world.');
  });

  test('replaces paragraph closes with newlines', () => {
    expect(stripFoundryMarkup('<p>One.</p><p>Two.</p>')).toBe('One.\nTwo.');
  });

  test('keeps the label part of @UUID with braces', () => {
    expect(
      stripFoundryMarkup('Becomes @UUID[Compendium.pf2e.conditionitems.Item.Off-Guard]{off-guard}.')
    ).toBe('Becomes off-guard.');
  });

  test('falls back to last path segment for bare @UUID', () => {
    expect(
      stripFoundryMarkup('Becomes @UUID[Compendium.pf2e.conditionitems.Item.Prone].')
    ).toBe('Becomes Prone.');
  });

  test('formats @Check macros as readable text', () => {
    expect(stripFoundryMarkup('Roll @Check[reflex|dc:17|basic|options:area-effect].')).toBe(
      'Roll Reflex DC 17 basic.'
    );
  });

  test('formats @Damage macros', () => {
    expect(stripFoundryMarkup('Takes @Damage[2d6[slashing]|options:area-damage] damage.')).toBe(
      'Takes 2d6 slashing damage.'
    );
  });

  test('drops @Localize markers entirely', () => {
    expect(stripFoundryMarkup('See @Localize[PF2E.NPC.Abilities.Glossary.FastHealing] for rules.')).toBe(
      'See  for rules.'.replace(/\s+/g, ' ')
    );
  });

  test('preserves the dice expression of inline rolls and drops macro names/comments', () => {
    expect(stripFoundryMarkup('Then [[/gmr 1d4 #Recharge]] to recharge.')).toBe(
      'Then 1d4 to recharge.'
    );
  });

  test('handles <hr> and <br> as paragraph breaks', () => {
    expect(stripFoundryMarkup('Top<hr/>Middle<br>Bottom')).toBe('Top\nMiddle\nBottom');
  });

  test('returns empty string for null/undefined input', () => {
    expect(stripFoundryMarkup(undefined)).toBe('');
    expect(stripFoundryMarkup(null)).toBe('');
  });

  test('collapses non-breaking spaces and runs of whitespace', () => {
    expect(stripFoundryMarkup('a    b c')).toBe('a b c');
  });

  test('handles multiple markers in one description', () => {
    const input =
      '<p><strong>Failure</strong> The creature is knocked @UUID[Compendium.pf2e.conditionitems.Item.Prone]. Make a @Check[reflex|dc:20|basic] save.</p>';
    expect(stripFoundryMarkup(input)).toBe(
      'Failure The creature is knocked Prone. Make a Reflex DC 20 basic save.'
    );
  });
});
