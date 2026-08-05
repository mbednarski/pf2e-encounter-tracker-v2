// scripts/spell-index/aon-ids.test.ts
import { describe, expect, test } from 'vitest';
import {
  aonSearchUrl,
  buildAonIndex,
  normalizeName,
  resolveAonUrl,
  type AonDoc
} from './aon-ids';

function index(docs: AonDoc[]) {
  return buildAonIndex(docs);
}

describe('normalizeName', () => {
  test('drops apostrophes and folds punctuation', () => {
    expect(normalizeName("Sage's Curse")).toBe('sages curse');
    expect(normalizeName('Anima Invocation (Modified)')).toBe('anima invocation modified');
    expect(normalizeName('Force  Barrage')).toBe('force barrage');
  });
});

describe('resolveAonUrl', () => {
  test('resolves a spell to its direct Spells.aspx page', () => {
    const idx = index([{ id: 'spell-1530', name: 'Fireball', level: 3 }]);
    expect(resolveAonUrl(idx, 'Fireball', 3)).toBe('https://2e.aonprd.com/Spells.aspx?ID=1530');
  });

  test('resolves a ritual to Rituals.aspx', () => {
    const idx = index([{ id: 'ritual-114', name: 'Commune', level: 5 }]);
    expect(resolveAonUrl(idx, 'Commune', 5)).toBe('https://2e.aonprd.com/Rituals.aspx?ID=114');
  });

  test('prefers the non-superseded (remastered) entry over the legacy one', () => {
    const idx = index([
      { id: 'spell-119', name: 'Fireball', level: 3, remaster_id: ['spell-1530'] },
      { id: 'spell-1530', name: 'Fireball', level: 3 }
    ]);
    expect(resolveAonUrl(idx, 'Fireball', 3)).toBe('https://2e.aonprd.com/Spells.aspx?ID=1530');
  });

  test('matches by renamed remaster name (Force Barrage, not Magic Missile)', () => {
    const idx = index([
      { id: 'spell-180', name: 'Magic Missile', level: 1, remaster_id: ['spell-1536'] },
      { id: 'spell-1536', name: 'Force Barrage', level: 1 }
    ]);
    expect(resolveAonUrl(idx, 'Force Barrage', 1)).toBe('https://2e.aonprd.com/Spells.aspx?ID=1536');
    // The legacy name still yields a working link (the legacy page redirects to
    // the remaster), but our remastered source data uses the new name anyway.
    expect(resolveAonUrl(idx, 'Magic Missile', 1)).toBe('https://2e.aonprd.com/Spells.aspx?ID=180');
  });

  test('falls back to the legacy entry when no remaster page exists', () => {
    const idx = index([{ id: 'spell-200', name: 'Old Spell', level: 2, remaster_id: ['spell-999'] }]);
    expect(resolveAonUrl(idx, 'Old Spell', 2)).toBe('https://2e.aonprd.com/Spells.aspx?ID=200');
  });

  test('disambiguates same-name entries by matching level', () => {
    const idx = index([
      { id: 'spell-500', name: 'Twin Spell', level: 1 },
      { id: 'spell-600', name: 'Twin Spell', level: 3 }
    ]);
    expect(resolveAonUrl(idx, 'Twin Spell', 3)).toBe('https://2e.aonprd.com/Spells.aspx?ID=600');
  });

  test('tiebreaks on highest id when level does not disambiguate', () => {
    const idx = index([
      { id: 'spell-571', name: 'Chilling Spray', level: 1 },
      { id: 'spell-1975', name: 'Chilling Spray', level: 1 }
    ]);
    expect(resolveAonUrl(idx, 'Chilling Spray', 1)).toBe('https://2e.aonprd.com/Spells.aspx?ID=1975');
  });

  test('returns undefined for an unknown spell', () => {
    const idx = index([{ id: 'spell-1', name: 'Known', level: 1 }]);
    expect(resolveAonUrl(idx, 'Unknown Spell', 1)).toBeUndefined();
  });

  test('ignores malformed or non-spell/ritual ids', () => {
    const idx = index([
      { id: 'feat-1', name: 'Not A Spell', level: 1 },
      { id: 'spell-', name: 'Bad Id', level: 1 }
    ]);
    expect(resolveAonUrl(idx, 'Not A Spell', 1)).toBeUndefined();
    expect(resolveAonUrl(idx, 'Bad Id', 1)).toBeUndefined();
  });
});

describe('aonSearchUrl', () => {
  test('uses the working q= parameter, not the legacy Query=&type=', () => {
    expect(aonSearchUrl('Magic Missile')).toBe('https://2e.aonprd.com/Search.aspx?q=Magic%20Missile');
  });
});
