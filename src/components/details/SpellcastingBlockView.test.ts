import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { CombatantSpellcasting, SpellListEntry } from '../../domain';
import SpellcastingBlockView from './SpellcastingBlockView.svelte';

function entry(over: Partial<SpellListEntry> = {}): SpellListEntry {
  return {
    spellSlug: over.spellSlug ?? 'magic-missile',
    name: over.name ?? 'Magic Missile',
    level: over.level ?? 1,
    ...over
  };
}

function preparedBlock(over: Partial<CombatantSpellcasting> = {}): CombatantSpellcasting {
  return {
    blockId: 'wizard-1',
    name: 'Arcane Spells',
    tradition: 'arcane',
    type: 'prepared',
    dc: 22,
    attackModifier: 12,
    slots: { 1: 3, 2: 2 },
    entries: [
      entry({ spellSlug: 'magic-missile', name: 'Magic Missile', level: 1, count: 2 }),
      entry({ spellSlug: 'shield', name: 'Shield', level: 1, isCantrip: true })
    ],
    ...over
  };
}

function focusBlock(over: Partial<CombatantSpellcasting> = {}): CombatantSpellcasting {
  return {
    blockId: 'monk-1',
    name: 'Focus Spells',
    tradition: 'occult',
    type: 'focus',
    dc: 21,
    focusPoints: 2,
    entries: [entry({ spellSlug: 'ki-strike', name: 'Ki Strike', level: 4 })],
    ...over
  };
}

function innateBlock(over: Partial<CombatantSpellcasting> = {}): CombatantSpellcasting {
  return {
    blockId: 'dragon-1',
    name: 'Innate Spells',
    tradition: 'arcane',
    type: 'innate',
    dc: 30,
    entries: [
      entry({
        spellSlug: 'fireball',
        name: 'Fireball',
        level: 6,
        frequency: { type: 'perDay', uses: 3 }
      }),
      entry({
        spellSlug: 'detect-magic',
        name: 'Detect Magic',
        level: 1,
        frequency: { type: 'atWill' }
      }),
      entry({
        spellSlug: 'true-seeing',
        name: 'True Seeing',
        level: 6,
        frequency: { type: 'constant' }
      })
    ],
    ...over
  };
}

function baseHandlers() {
  return {
    onUseSlot: vi.fn(),
    onRestoreSlot: vi.fn(),
    onUseFocus: vi.fn(),
    onRestoreFocus: vi.fn(),
    onUseInnate: vi.fn(),
    onRestoreInnate: vi.fn()
  };
}

describe('SpellcastingBlockView — header', () => {
  test('renders block name, tradition, and type', () => {
    render(SpellcastingBlockView, {
      props: { block: preparedBlock(), ...baseHandlers() }
    });
    expect(screen.getByText('Arcane Spells')).toBeInTheDocument();
    expect(screen.getByText('arcane')).toBeInTheDocument();
    expect(screen.getByText('prepared')).toBeInTheDocument();
  });

  test('shows raw DC when dcBonus is 0', () => {
    render(SpellcastingBlockView, {
      props: { block: preparedBlock(), ...baseHandlers() }
    });
    expect(screen.getByText('DC 22')).toBeInTheDocument();
  });

  test('adds dcBonus to displayed DC and tags it as modified', () => {
    const { container } = render(SpellcastingBlockView, {
      props: { block: preparedBlock(), dcBonus: 2, dcTooltip: '+2 frightened', ...baseHandlers() }
    });
    expect(screen.getByText('DC 24')).toBeInTheDocument();
    expect(container.querySelector('.block__stat.modified')).not.toBeNull();
  });

  test('renders attack modifier with sign when present', () => {
    render(SpellcastingBlockView, {
      props: { block: preparedBlock({ attackModifier: 12 }), ...baseHandlers() }
    });
    expect(screen.getByText('atk +12')).toBeInTheDocument();
  });

  test('omits attack modifier line when undefined', () => {
    render(SpellcastingBlockView, {
      props: { block: preparedBlock({ attackModifier: undefined }), ...baseHandlers() }
    });
    expect(screen.queryByText(/^atk /)).not.toBeInTheDocument();
  });
});

describe('SpellcastingBlockView — prepared slot pips', () => {
  test('renders pip groups for each rank with full/empty pips based on usedSlots', () => {
    const block = preparedBlock({
      slots: { 1: 3 },
      usedSlots: { 1: 1 }
    });
    const { container } = render(SpellcastingBlockView, {
      props: { block, ...baseHandlers() }
    });
    const full = container.querySelectorAll('.pip--full');
    const empty = container.querySelectorAll('.pip--empty');
    expect(full.length).toBe(2);
    expect(empty.length).toBe(1);
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  test('clicking a full pip calls onUseSlot with block id and rank', async () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: { block: preparedBlock({ slots: { 2: 2 } }), ...handlers }
    });
    const pip = screen.getAllByRole('button', { name: /Use a 2nd-rank slot/ })[0];
    await fireEvent.click(pip);
    expect(handlers.onUseSlot).toHaveBeenCalledWith('wizard-1', 2);
  });

  test('right-click (contextmenu) on a full pip calls onRestoreSlot', async () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: { block: preparedBlock({ slots: { 2: 2 } }), ...handlers }
    });
    const pip = screen.getAllByRole('button', { name: /Use a 2nd-rank slot/ })[0];
    await fireEvent.contextMenu(pip);
    expect(handlers.onRestoreSlot).toHaveBeenCalledWith('wizard-1', 2);
  });

  test('clicking an empty pip restores the slot', async () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: { block: preparedBlock({ slots: { 1: 1 }, usedSlots: { 1: 1 } }), ...handlers }
    });
    const pip = screen.getByRole('button', { name: /Restore a 1st-rank slot/ });
    await fireEvent.click(pip);
    expect(handlers.onRestoreSlot).toHaveBeenCalledWith('wizard-1', 1);
  });

  test('prepared spells with count > 1 render a ×N suffix', () => {
    render(SpellcastingBlockView, {
      props: {
        block: preparedBlock({
          slots: { 1: 4 },
          entries: [entry({ spellSlug: 'mm', name: 'Magic Missile', level: 1, count: 3 })]
        }),
        ...baseHandlers()
      }
    });
    expect(screen.getByText('Magic Missile ×3')).toBeInTheDocument();
  });
});

describe('SpellcastingBlockView — focus pool', () => {
  test('renders focus pip pool and entries', () => {
    const { container } = render(SpellcastingBlockView, {
      props: { block: focusBlock({ usedFocusPoints: 1 }), ...baseHandlers() }
    });
    expect(container.querySelectorAll('.pip--full').length).toBe(1);
    expect(container.querySelectorAll('.pip--empty').length).toBe(1);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText(/Ki Strike/)).toBeInTheDocument();
  });

  test('clicking a full focus pip calls onUseFocus', async () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: { block: focusBlock(), ...handlers }
    });
    const pip = screen.getAllByRole('button', { name: /Spend a focus point/ })[0];
    await fireEvent.click(pip);
    expect(handlers.onUseFocus).toHaveBeenCalledWith('monk-1');
  });

  test('clicking an empty focus pip calls onRestoreFocus', async () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: {
        block: focusBlock({ focusPoints: 1, usedFocusPoints: 1 }),
        ...handlers
      }
    });
    const pip = screen.getByRole('button', { name: /Restore a focus point/ });
    await fireEvent.click(pip);
    expect(handlers.onRestoreFocus).toHaveBeenCalledWith('monk-1');
  });
});

describe('SpellcastingBlockView — innate spells', () => {
  test('per-day spell renders interactive pip pool with use buttons', () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: { block: innateBlock(), ...handlers }
    });
    // Fireball has uses=3 — should render 3 pips and a count.
    const useButtons = screen.getAllByRole('button', { name: 'Use Fireball' });
    expect(useButtons.length).toBe(3);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  test('at-will spell renders the "at will" marker instead of pips', () => {
    render(SpellcastingBlockView, {
      props: { block: innateBlock(), ...baseHandlers() }
    });
    expect(screen.getByText('at will')).toBeInTheDocument();
  });

  test('constant spell renders the "constant" marker', () => {
    render(SpellcastingBlockView, {
      props: { block: innateBlock(), ...baseHandlers() }
    });
    expect(screen.getByText('constant')).toBeInTheDocument();
  });

  test('clicking a full per-day pip calls onUseInnate with spell slug', async () => {
    const handlers = baseHandlers();
    render(SpellcastingBlockView, {
      props: { block: innateBlock(), ...handlers }
    });
    const pip = screen.getAllByRole('button', { name: 'Use Fireball' })[0];
    await fireEvent.click(pip);
    expect(handlers.onUseInnate).toHaveBeenCalledWith('dragon-1', 'fireball');
  });

  test('clicking an empty per-day pip calls onRestoreInnate', async () => {
    const handlers = baseHandlers();
    const block = innateBlock({
      entries: [
        entry({
          spellSlug: 'fireball',
          name: 'Fireball',
          level: 6,
          frequency: { type: 'perDay', uses: 2 }
        })
      ],
      usedEntries: { fireball: 2 }
    });
    render(SpellcastingBlockView, { props: { block, ...handlers } });
    const pip = screen.getAllByRole('button', { name: 'Restore use of Fireball' })[0];
    await fireEvent.click(pip);
    expect(handlers.onRestoreInnate).toHaveBeenCalledWith('dragon-1', 'fireball');
  });
});

describe('SpellcastingBlockView — cantrips', () => {
  test('renders the cantrips list when any cantrip is present', () => {
    render(SpellcastingBlockView, {
      props: {
        block: preparedBlock({
          slots: { 1: 2 },
          entries: [
            entry({ spellSlug: 'shield', name: 'Shield', level: 1, isCantrip: true }),
            entry({ spellSlug: 'electric-arc', name: 'Electric Arc', level: 1, isCantrip: true })
          ]
        }),
        ...baseHandlers()
      }
    });
    expect(screen.getByText(/Cantrips/)).toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Electric Arc')).toBeInTheDocument();
  });

  test('omits the cantrips section when there are no cantrips', () => {
    const { container } = render(SpellcastingBlockView, {
      props: {
        block: preparedBlock({ slots: { 1: 1 }, entries: [entry({ level: 1 })] }),
        ...baseHandlers()
      }
    });
    expect(container.querySelector('.cantrips')).toBeNull();
  });
});

test('expands a spell row to show mechanics from the spell index', async () => {
  const file = {
    version: 1,
    generatedAt: '2026-05-18T00:00:00Z',
    source: { repo: 'foundryvtt/pf2e', tag: 'test' },
    spells: [
      {
        slug: 'magic-missile',
        name: 'Magic Missile',
        baseLevel: 1,
        isCantrip: false,
        isFocus: false,
        actionCost: 'varies',
        traits: ['force'],
        traditions: ['arcane', 'occult'],
        defense: undefined,
        effectSummary: 'Force projectile hits without a roll.',
        base: { damage: '1d4+1 force' },
        aonUrl: 'https://example.invalid'
      }
    ]
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 200 }))
  );
  const { __resetForTests } = await import('$lib/spell-index');
  __resetForTests();

  render(SpellcastingBlockView, {
    props: {
      block: preparedBlock(),
      ...baseHandlers()
    }
  });

  await fireEvent.click(screen.getByRole('button', { name: /Magic Missile/ }));
  expect(await screen.findByText(/1d4\+1 force/)).toBeTruthy();
  expect(screen.getByText(/Archives of Nethys/)).toBeTruthy();
});
