import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SpellRow from './SpellRow.svelte';
import { __resetForTests } from '$lib/spell-index';
import type { SpellListEntry } from '../../domain';
import type { SpellIndexFile } from '$lib/spell-index';

function entry(over: Partial<SpellListEntry> = {}): SpellListEntry {
  return {
    spellSlug: over.spellSlug ?? 'fireball',
    name: over.name ?? 'Fireball',
    level: over.level ?? 3,
    ...over
  };
}

function stubIndex(spells: SpellIndexFile['spells']): void {
  const file: SpellIndexFile = {
    version: 1,
    generatedAt: '2026-05-18T00:00:00Z',
    source: { repo: 'foundryvtt/pf2e', tag: 'test' },
    spells
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 200 }))
  );
}

beforeEach(() => {
  __resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SpellRow', () => {
  test('renders the spell name and count in collapsed state', () => {
    render(SpellRow, {
      entry: entry({ count: 2 }),
      dc: 22,
      attackModifier: 12
    });
    expect(screen.getByText(/Fireball/)).toBeTruthy();
    expect(screen.getByText(/×2/)).toBeTruthy();
    expect(screen.queryByText(/Archives of Nethys/)).toBeNull();
  });

  test('clicking the row expands and shows mechanics from the spell index', async () => {
    stubIndex([
      {
        slug: 'fireball',
        name: 'Fireball',
        baseLevel: 3,
        isCantrip: false,
        isFocus: false,
        actionCost: 2,
        traits: ['fire', 'evocation'],
        traditions: ['arcane', 'primal'],
        range: '500 feet',
        area: '20-foot burst',
        defense: { kind: 'save', save: 'reflex', basic: true },
        effectSummary: 'A roaring blast of fire deals damage to creatures in a burst.',
        base: { damage: '6d6 fire' },
        heightening: { mode: 'interval', per: 1, delta: { damage: '+2d6 fire' } },
        aonUrl: 'https://2e.aonprd.com/Search.aspx?Query=Fireball&type=spell'
      }
    ]);

    render(SpellRow, {
      entry: entry({ level: 5 }),
      dc: 22,
      attackModifier: 12
    });

    await fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));

    expect(await screen.findByText(/Reflex DC 22 \(basic\)/)).toBeTruthy();
    expect(screen.getByText(/6d6 fire \+2d6 fire \+2d6 fire/)).toBeTruthy();
    expect(screen.getByText(/heightened from rank 3/)).toBeTruthy();
    expect(screen.getByText(/Archives of Nethys/)).toBeTruthy();
  });

  test('shows AoN search fallback when slug not in index', async () => {
    stubIndex([]);

    render(SpellRow, {
      entry: entry({ spellSlug: 'unknown-spell', name: 'Mystery Hex', level: 4 }),
      dc: 22
    });

    await fireEvent.click(screen.getByRole('button', { name: /Mystery Hex/ }));
    expect(await screen.findByText(/Search Archives of Nethys/)).toBeTruthy();
  });

  test('omits heightened caption when cast level matches base', async () => {
    stubIndex([
      {
        slug: 'fireball',
        name: 'Fireball',
        baseLevel: 3,
        isCantrip: false,
        isFocus: false,
        actionCost: 2,
        traits: ['fire'],
        traditions: ['arcane'],
        defense: { kind: 'save', save: 'reflex', basic: true },
        effectSummary: 'Fire damage.',
        base: { damage: '6d6 fire' },
        heightening: { mode: 'interval', per: 1, delta: { damage: '+2d6 fire' } },
        aonUrl: 'https://example.invalid'
      }
    ]);

    render(SpellRow, { entry: entry({ level: 3 }), dc: 22 });
    await fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));
    await screen.findByText(/6d6 fire/);
    expect(screen.queryByText(/heightened from/)).toBeNull();
  });
});
