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

describe('BestiarySection', () => {
  test('renders one row per creature with name and level', () => {
    const creatures = [
      creature('a', 'Goblin Warrior', ['goblin', 'humanoid'], 1),
      creature('b', 'Cave Wolf', ['animal'], 2)
    ];
    render(BestiarySection, { props: { creatures, onAddCreature: vi.fn() } });
    expect(screen.getByText('Goblin Warrior')).toBeInTheDocument();
    expect(screen.getByText('Cave Wolf')).toBeInTheDocument();
  });

  test('renders the empty-state message when the search filters everything out', async () => {
    const creatures = [creature('a', 'Goblin Warrior', ['goblin'], 1)];
    render(BestiarySection, { props: { creatures, onAddCreature: vi.fn() } });
    const search = screen.getByRole('searchbox', { name: 'Search bestiary' });
    await fireEvent.input(search, { target: { value: 'dragon' } });
    expect(screen.getByText('No matching creatures.')).toBeInTheDocument();
  });

  test('search filters creatures by name (case-insensitive)', async () => {
    const creatures = [
      creature('a', 'Goblin Warrior', ['goblin'], 1),
      creature('b', 'Cave Wolf', ['animal'], 2)
    ];
    render(BestiarySection, { props: { creatures, onAddCreature: vi.fn() } });
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
    render(BestiarySection, { props: { creatures, onAddCreature: vi.fn() } });
    const search = screen.getByRole('searchbox', { name: 'Search bestiary' });
    await fireEvent.input(search, { target: { value: 'animal' } });
    expect(screen.getByText('Cave Wolf')).toBeInTheDocument();
    expect(screen.queryByText('Goblin Warrior')).not.toBeInTheDocument();
  });

  test('the per-row + button calls onAddCreature with that creature', async () => {
    const onAddCreature = vi.fn();
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, { props: { creatures: [c], onAddCreature } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add Goblin Warrior' }));
    expect(onAddCreature).toHaveBeenCalledWith(c);
  });

  test('renders the empty-library message (not the no-match copy) when the library is empty', () => {
    render(BestiarySection, { props: { creatures: [], onAddCreature: vi.fn() } });
    expect(
      screen.getByText('Import a YAML file to add creatures.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No matching creatures.')).not.toBeInTheDocument();
  });

  test('renders no remove button when onRemoveCreature is not provided', () => {
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, { props: { creatures: [c], onAddCreature: vi.fn() } });
    expect(
      screen.queryByRole('button', { name: 'Remove Goblin Warrior' })
    ).not.toBeInTheDocument();
  });

  test('the per-row remove button calls onRemoveCreature with that creature id', async () => {
    const onRemoveCreature = vi.fn();
    const c = creature('a', 'Goblin Warrior', ['goblin'], 1);
    render(BestiarySection, {
      props: { creatures: [c], onAddCreature: vi.fn(), onRemoveCreature }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Goblin Warrior' }));
    expect(onRemoveCreature).toHaveBeenCalledWith('a');
  });
});
