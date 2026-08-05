import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EffectDefinition } from '../../domain';
import {
  addSpellEffects,
  clearSpellEffects,
  dedupeNewSpellEffects,
  loadSpellEffects,
  removeSpellEffect
} from './spell-effect-library';

function makeEffect(overrides: Partial<EffectDefinition> = {}): EffectDefinition {
  return {
    id: 'spell-effect-rallying-anthem',
    name: 'Rallying Anthem',
    category: 'spell',
    hasValue: false,
    modifiers: [
      { stat: 'ac', bonusType: 'status', value: 1 },
      { stat: 'allSaves', bonusType: 'status', value: 1 }
    ],
    defaultDuration: { unit: 'rounds', value: 1, expiry: 'turnStart' },
    sourceSpellSlug: 'rallying-anthem',
    ...overrides
  };
}

async function loadOrThrow(): Promise<EffectDefinition[]> {
  const result = await loadSpellEffects();
  if (!result.ok) throw new Error(`loadSpellEffects failed: ${result.reason}`);
  return result.effects;
}

beforeEach(async () => {
  await clearSpellEffects();
});

afterEach(async () => {
  await clearSpellEffects();
});

describe('spell effect library storage', () => {
  it('returns an empty list when nothing has been imported', async () => {
    expect(await loadOrThrow()).toEqual([]);
  });

  it('round-trips an imported effect', async () => {
    const anthem = makeEffect();
    const result = await addSpellEffects([anthem]);
    expect(result).toEqual({ ok: true, added: [anthem], rejected: [] });
    expect(await loadOrThrow()).toEqual([anthem]);
  });

  it('rejects duplicate ids on re-import', async () => {
    const anthem = makeEffect();
    await addSpellEffects([anthem]);
    const again = await addSpellEffects([anthem, makeEffect({ id: 'spell-effect-bless', name: 'Bless' })]);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.added.map((e) => e.id)).toEqual(['spell-effect-bless']);
      expect(again.rejected.map((e) => e.id)).toEqual(['spell-effect-rallying-anthem']);
    }
    expect((await loadOrThrow()).map((e) => e.id).sort()).toEqual([
      'spell-effect-bless',
      'spell-effect-rallying-anthem'
    ]);
  });

  it('removes effects by id and reports whether they existed', async () => {
    await addSpellEffects([makeEffect()]);
    expect(await removeSpellEffect('spell-effect-rallying-anthem')).toEqual({
      ok: true,
      existed: true
    });
    expect(await removeSpellEffect('spell-effect-rallying-anthem')).toEqual({
      ok: true,
      existed: false
    });
    expect(await loadOrThrow()).toEqual([]);
  });
});

describe('dedupeNewSpellEffects', () => {
  it('rejects ids already present and dedupes within the batch', () => {
    const existing = new Set(['spell-effect-bless']);
    const bless = makeEffect({ id: 'spell-effect-bless' });
    const anthem = makeEffect();
    const { accepted, rejected } = dedupeNewSpellEffects(existing, [bless, anthem, anthem]);
    expect(accepted).toEqual([anthem]);
    expect(rejected).toEqual([bless, anthem]);
  });
});
