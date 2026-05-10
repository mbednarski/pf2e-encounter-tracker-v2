import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { Creature } from '../domain';
import BestiarySection from './BestiarySection.svelte';

function creature(id: string, name: string, traits: string[] = [], level = 1): Creature {
  return {
    id,
    name,
    level,
    traits,
    size: 'medium',
    rarity: 'common',
    ac: 16,
    fortitude: 5,
    reflex: 5,
    will: 5,
    perception: 5,
    hp: 20,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 25 },
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    skills: {},
    source: 'test',
    tags: []
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    creatures: [],
    encounterCounts: {},
    onAddToEncounter: vi.fn(),
    onRemoveOneFromEncounter: vi.fn(),
    ...overrides
  };
}

describe('BestiarySection', () => {
  test('renders one row per creature with name and level', () => {
    const creatures = [
      creature('a', 'Goblin Warrior', ['goblin', 'humanoid'], 1),
      creature('b', 'Cave Wolf', ['animal'], 2)
    ];
    render(BestiarySection, { props: defaultProps({ creatures }) });
    expect(screen.getByText('Goblin Warrior')).toBeInTheDocument();
    expect(screen.getByText('Cave Wolf')).toBeInTheDocument();
  });

  test('renders the empty-state message when the search filters everything out', async () => {
    const creatures = [creature('a', 'Goblin Warrior', ['goblin'], 1)];
    render(BestiarySection, { props: defaultProps({ creatures }) });
    const search = screen.getByRole('searchbox', { name: 'Search bestiary' });
    await fireEvent.input(search, { target: { value: 'dragon' } });
    expect(screen.getByText('No matching creatures.')).toBeInTheDocument();
  });

  test('search filters creatures by name (case-insensitive)', async () => {
    const creatures = [
      creature('a', 'Goblin Warrior', ['goblin'], 1),
      creature('b', 'Cave Wolf', ['animal'], 2)
    ];
    render(BestiarySection, { props: defaultProps({ creatures }) });
    const search = screen.getByRole('searchbox', { name: 'Search bestiary' });
    await fireEvent.input(search, { target: { value: 'WOLF' } });
    expect(screen.getByText('Cave Wolf')).toBeInTheDocument();
    expect(screen.queryByText('Goblin Warrior')).not.toBeInTheDocument();
  });

  test('search also matches on creature traits', async () => {
    const creatures = [
      creature('a', 'Goblin Warrior', ['goblin', 'humanoid'], 1),
      creature('b', 'Cave Wolf', ['animal'], 2)
    ];
    render(BestiarySection, { props: defaultProps({ creatures }) });
    const search = screen.getByRole('searchbox', { name: 'Search bestiary' });
    await fireEvent.input(search, { target: { value: 'animal' } });
    expect(screen.getByText('Cave Wolf')).toBeInTheDocument();
    expect(screen.queryByText('Goblin Warrior')).not.toBeInTheDocument();
  });

  test('clicking a row calls onAddToEncounter with the creature and current adjustment', async () => {
    const onAddToEncounter = vi.fn();
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, { props: defaultProps({ creatures: [c], onAddToEncounter }) });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Add Goblin Warrior to encounter' })
    );
    expect(onAddToEncounter).toHaveBeenCalledWith(c, 'normal');
  });

  test('row click uses the selected adjustment when Elite is active', async () => {
    const onAddToEncounter = vi.fn();
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, { props: defaultProps({ creatures: [c], onAddToEncounter }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Elite' }));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Add Goblin Warrior to encounter' })
    );
    expect(onAddToEncounter).toHaveBeenCalledWith(c, 'elite');
  });

  test('renders the empty-library message when the library is empty', () => {
    render(BestiarySection, { props: defaultProps() });
    expect(
      screen.getByText('Import a YAML file to add creatures.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No matching creatures.')).not.toBeInTheDocument();
  });

  test('does not render any per-row remove-from-library button', () => {
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, { props: defaultProps({ creatures: [c] }) });
    expect(
      screen.queryByRole('button', { name: /Remove Goblin Warrior$/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove from library' })
    ).not.toBeInTheDocument();
  });

  test('shows a count badge and minus button when the creature is in the encounter', async () => {
    const onRemoveOneFromEncounter = vi.fn();
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, {
      props: defaultProps({
        creatures: [c],
        encounterCounts: { a: 3 },
        onRemoveOneFromEncounter
      })
    });
    expect(screen.getByText('×3')).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove one Goblin Warrior from encounter' })
    );
    expect(onRemoveOneFromEncounter).toHaveBeenCalledWith('a');
  });

  test('does not show count badge or minus when count is zero', () => {
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, {
      props: defaultProps({ creatures: [c], encounterCounts: { a: 0 } })
    });
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove one Goblin Warrior from encounter' })
    ).not.toBeInTheDocument();
  });

  test('renders Manage… button when onOpenManageLibrary is provided', async () => {
    const onOpenManageLibrary = vi.fn();
    render(BestiarySection, {
      props: defaultProps({ onOpenManageLibrary })
    });
    const manage = screen.getByRole('button', { name: 'Manage…' });
    await fireEvent.click(manage);
    expect(onOpenManageLibrary).toHaveBeenCalled();
  });

  test('does not render Manage… or Import buttons when their handlers are absent', () => {
    render(BestiarySection, { props: defaultProps() });
    expect(screen.queryByRole('button', { name: 'Manage…' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import YAML…' })).not.toBeInTheDocument();
  });
});
