// scripts/spell-index/transform.test.ts
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSpell } from './transform';

function fixture(name: string): unknown {
  const raw = readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

describe('transformSpell', () => {
  test('fireball: interval heightening, save defense, traits', () => {
    const result = transformSpell(fixture('fireball'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const spell = result.value;
    expect(spell.slug).toBe('fireball');
    expect(spell.name).toBe('Fireball');
    expect(spell.baseLevel).toBe(3);
    expect(spell.isCantrip).toBe(false);
    expect(spell.traits).toContain('fire');
    expect(spell.traditions).toContain('arcane');
    expect(spell.defense?.kind).toBe('save');
    expect(spell.defense?.save).toBe('reflex');
    expect(spell.defense?.basic).toBe(true);
    expect(spell.heightening?.mode).toBe('interval');
    expect(spell.effectSummary.length).toBeGreaterThan(0);
    expect(spell.effectSummary.length).toBeLessThanOrEqual(200);
  });

  test('electric-arc: cantrip flag', () => {
    const result = transformSpell(fixture('electric-arc'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isCantrip).toBe(true);
  });

  test('blindness: no damage in base or heightening', () => {
    const result = transformSpell(fixture('blindness'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.base.damage).toBeUndefined();
    expect(result.value.heightening).toBeUndefined();
  });

  test('rejects non-spell input', () => {
    const result = transformSpell({ type: 'feat', name: 'Power Attack' });
    expect(result.ok).toBe(false);
  });
});
