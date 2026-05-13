import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { Creature, PartyMember } from '../domain';
import LibraryPane from './LibraryPane.svelte';

function creature(id: string, name: string): Creature {
  return {
    id,
    name,
    level: 1,
    traits: [],
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

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    canStart: false,
    creatures: [] as Creature[],
    partyMembers: [] as PartyMember[],
    conditionOptions: [],
    encounterCounts: {},
    onAddOneFromBestiary: vi.fn(),
    onRemoveOneFromBestiaryCount: vi.fn(),
    onAddManual: vi.fn(),
    onImportCreatureFiles: vi.fn(),
    onRemoveCreature: vi.fn(),
    onAddPartyMemberToEncounter: vi.fn(),
    onRemovePartyMember: vi.fn(),
    onSavePartyMember: vi.fn(),
    onImportPartyMemberYamlFiles: vi.fn(),
    onStart: vi.fn(),
    onReset: vi.fn(),
    ...overrides
  };
}

describe('LibraryPane', () => {
  test('renders a labelled aside with the Library heading', () => {
    render(LibraryPane, { props: baseProps() });
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
  });

  test('LibraryManageModal is not rendered initially', () => {
    render(LibraryPane, { props: baseProps({ creatures: [creature('goblin-1', 'Goblin')] }) });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  test('clicking "Manage…" from the bestiary section opens the manage modal', async () => {
    render(LibraryPane, { props: baseProps({ creatures: [creature('goblin-1', 'Goblin')] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Manage…' }));
    // Manage modal shows a "Done" button — the cheapest non-ambiguous handle.
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  test('closing the manage modal hides it again', async () => {
    render(LibraryPane, { props: baseProps({ creatures: [creature('goblin-1', 'Goblin')] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Manage…' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  test('manage modal forwards remove-creature events through onRemoveCreature', async () => {
    const onRemoveCreature = vi.fn();
    render(LibraryPane, {
      props: baseProps({
        creatures: [creature('goblin-1', 'Goblin Warrior')],
        onRemoveCreature
      })
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Manage…' }));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove Goblin Warrior from library' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRemoveCreature).toHaveBeenCalledWith('goblin-1');
  });
});
