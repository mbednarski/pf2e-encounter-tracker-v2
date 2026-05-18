import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SpellIndexFile } from './types';
import { __resetForTests, ensureSpellIndex } from './index';

function file(): SpellIndexFile {
  return {
    version: 1,
    generatedAt: '2026-05-18T00:00:00Z',
    source: { repo: 'foundryvtt/pf2e', tag: 'test' },
    spells: [
      {
        slug: 'fireball',
        name: 'Fireball',
        baseLevel: 3,
        isCantrip: false,
        isFocus: false,
        actionCost: 2,
        traits: ['fire', 'evocation'],
        traditions: ['arcane', 'primal'],
        effectSummary: 'Burst of fire damage.',
        base: { damage: '6d6 fire' },
        aonUrl: 'https://2e.aonprd.com/Spells.aspx?ID=fireball'
      }
    ]
  };
}

afterEach(() => {
  __resetForTests();
  vi.unstubAllGlobals();
});

describe('ensureSpellIndex', () => {
  test('fetches index and exposes a slug lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(file()), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await ensureSpellIndex();

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.lookup('fireball')?.name).toBe('Fireball');
      expect(state.lookup('unknown-slug')).toBeUndefined();
    }
    expect(fetchMock).toHaveBeenCalledWith('/spell-index.json');
  });

  test('404 response leaves index unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    );
    const state = await ensureSpellIndex();
    expect(state.status).toBe('unavailable');
  });

  test('malformed JSON leaves index unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{not valid', { status: 200 }))
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = await ensureSpellIndex();
    expect(state.status).toBe('unavailable');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('concurrent calls share one fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(file()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b, c] = await Promise.all([
      ensureSpellIndex(),
      ensureSpellIndex(),
      ensureSpellIndex()
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.status).toBe('ready');
    expect(b.status).toBe('ready');
    expect(c.status).toBe('ready');
  });
});
