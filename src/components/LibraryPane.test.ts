import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { Creature, Hazard, PartyMember } from '../domain';
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

function hazard(id: string, name: string): Hazard {
  return {
    id,
    name,
    level: 5,
    traits: ['trap'],
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

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    canStart: false,
    creatures: [] as Creature[],
    hazards: [] as Hazard[],
    partyMembers: [] as PartyMember[],
    conditionOptions: [],
    encounterCounts: {},
    onAddOneFromBestiary: vi.fn(),
    onRemoveOneFromBestiaryCount: vi.fn(),
    onAddManual: vi.fn(),
    onImportCreatureFiles: vi.fn(),
    onRemoveCreature: vi.fn(),
    onAddOneFromHazards: vi.fn(),
    onRemoveOneFromHazardsCount: vi.fn(),
    onImportHazardFiles: vi.fn(),
    onRemoveHazard: vi.fn(),
    onAddPartyMemberToEncounter: vi.fn(),
    onRemovePartyMember: vi.fn(),
    onSavePartyMember: vi.fn(),
    onImportPartyMemberYamlFiles: vi.fn(),
    onStart: vi.fn(),
    onReset: vi.fn(),
    ...overrides
  };
}

// The Bestiary and Hazards sections each render their own "Manage…" button;
// both open the same modal, so the first is a fine handle.
function openManage() {
  return fireEvent.click(screen.getAllByRole('button', { name: 'Manage…' })[0]);
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
    await openManage();
    // Manage modal shows a "Done" button — the cheapest non-ambiguous handle.
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  test('closing the manage modal hides it again', async () => {
    render(LibraryPane, { props: baseProps({ creatures: [creature('goblin-1', 'Goblin')] }) });
    await openManage();
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
    await openManage();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove Goblin Warrior from library' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRemoveCreature).toHaveBeenCalledWith('goblin-1');
  });

  test('manage modal forwards remove-hazard events through onRemoveHazard', async () => {
    const onRemoveHazard = vi.fn();
    render(LibraryPane, {
      props: baseProps({
        hazards: [hazard('dart-gallery', 'Dart Gallery')],
        onRemoveHazard
      })
    });
    await openManage();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove Dart Gallery from library' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRemoveHazard).toHaveBeenCalledWith('dart-gallery');
  });
});

describe('LibraryPane collapse rail', () => {
  test('renders expanded by default with no collapse control unless enabled', () => {
    render(LibraryPane, { props: baseProps() });
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse library' })).toBeNull();
  });

  test('shows the collapse control when onToggleCollapsed is provided', async () => {
    const onToggleCollapsed = vi.fn();
    render(LibraryPane, { props: baseProps({ onToggleCollapsed }) });
    const collapse = screen.getByRole('button', { name: 'Collapse library' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.click(collapse);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  test('collapsed renders only the expand rail', async () => {
    const onToggleCollapsed = vi.fn();
    render(LibraryPane, { props: baseProps({ collapsed: true, onToggleCollapsed }) });
    expect(screen.queryByRole('heading', { name: 'Library' })).toBeNull();
    const expand = screen.getByRole('button', { name: 'Expand library' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(expand);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
