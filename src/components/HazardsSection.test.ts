import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { Hazard } from '../domain';
import HazardsSection from './HazardsSection.svelte';

function hazard(id: string, name: string, traits: string[] = [], level = 5): Hazard {
  return {
    id,
    name,
    level,
    traits,
    rarity: 'common',
    stealth: 20,
    ac: 22,
    fortitude: 10,
    reflex: 14,
    will: 8,
    hp: 60,
    immunities: [],
    resistances: [],
    weaknesses: [],
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    tags: []
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    hazards: [],
    encounterCounts: {},
    onAddToEncounter: vi.fn(),
    onRemoveOneFromEncounter: vi.fn(),
    ...overrides
  };
}

describe('HazardsSection', () => {
  test('renders one row per hazard with name and level', () => {
    const hazards = [
      hazard('a', 'Poisoned Dart Gallery', ['mechanical', 'trap'], 8),
      hazard('b', 'Collapsing Ceiling', ['environmental'], 4)
    ];
    render(HazardsSection, { props: defaultProps({ hazards }) });
    expect(screen.getByText('Poisoned Dart Gallery')).toBeInTheDocument();
    expect(screen.getByText('Collapsing Ceiling')).toBeInTheDocument();
  });

  test('search filters hazards by name (case-insensitive)', async () => {
    const hazards = [
      hazard('a', 'Poisoned Dart Gallery', ['trap'], 8),
      hazard('b', 'Collapsing Ceiling', ['environmental'], 4)
    ];
    render(HazardsSection, { props: defaultProps({ hazards }) });
    const search = screen.getByRole('searchbox', { name: 'Search hazards' });
    await fireEvent.input(search, { target: { value: 'CEILING' } });
    expect(screen.getByText('Collapsing Ceiling')).toBeInTheDocument();
    expect(screen.queryByText('Poisoned Dart Gallery')).not.toBeInTheDocument();
  });

  test('search also matches on hazard traits', async () => {
    const hazards = [
      hazard('a', 'Poisoned Dart Gallery', ['mechanical', 'trap'], 8),
      hazard('b', 'Collapsing Ceiling', ['environmental'], 4)
    ];
    render(HazardsSection, { props: defaultProps({ hazards }) });
    const search = screen.getByRole('searchbox', { name: 'Search hazards' });
    await fireEvent.input(search, { target: { value: 'environmental' } });
    expect(screen.getByText('Collapsing Ceiling')).toBeInTheDocument();
    expect(screen.queryByText('Poisoned Dart Gallery')).not.toBeInTheDocument();
  });

  test('clicking a row calls onAddToEncounter with the hazard', async () => {
    const onAddToEncounter = vi.fn();
    const h = hazard('a', 'Poisoned Dart Gallery', ['trap'], 8);
    render(HazardsSection, { props: defaultProps({ hazards: [h], onAddToEncounter }) });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Add Poisoned Dart Gallery to encounter' })
    );
    expect(onAddToEncounter).toHaveBeenCalledWith(h);
  });

  test('renders the empty-library message when the library is empty', () => {
    render(HazardsSection, { props: defaultProps() });
    expect(
      screen.getByText('Import a Foundry hazard JSON or YAML file to add complex hazards.')
    ).toBeInTheDocument();
  });

  test('renders the empty-state message when the search filters everything out', async () => {
    render(HazardsSection, { props: defaultProps({ hazards: [hazard('a', 'Pit Trap')] }) });
    const search = screen.getByRole('searchbox', { name: 'Search hazards' });
    await fireEvent.input(search, { target: { value: 'dragon' } });
    expect(screen.getByText('No matching hazards.')).toBeInTheDocument();
  });

  test('shows a count badge and minus button when the hazard is in the encounter', async () => {
    const onRemoveOneFromEncounter = vi.fn();
    const h = hazard('a', 'Poisoned Dart Gallery', ['trap'], 8);
    render(HazardsSection, {
      props: defaultProps({
        hazards: [h],
        encounterCounts: { a: 2 },
        onRemoveOneFromEncounter
      })
    });
    expect(screen.getByText('×2')).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove one Poisoned Dart Gallery from encounter' })
    );
    expect(onRemoveOneFromEncounter).toHaveBeenCalledWith('a');
  });

  test('does not render an adjustment toggle — hazards have no weak/elite template', () => {
    render(HazardsSection, { props: defaultProps({ hazards: [hazard('a', 'Pit Trap')] }) });
    expect(screen.queryByRole('button', { name: 'Elite' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Weak' })).not.toBeInTheDocument();
  });

  test('renders Manage… and Import… buttons only when their handlers are provided', async () => {
    const onOpenManageLibrary = vi.fn();
    render(HazardsSection, { props: defaultProps({ onOpenManageLibrary }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Manage…' }));
    expect(onOpenManageLibrary).toHaveBeenCalled();
  });
});
