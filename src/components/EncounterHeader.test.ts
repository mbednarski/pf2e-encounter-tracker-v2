import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import EncounterHeader from './EncounterHeader.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Goblin Ambush',
    phase: 'PREPARING' as const,
    round: 0,
    activeName: undefined,
    canRollAll: false,
    canEndTurn: false,
    onRollAllInitiative: vi.fn(),
    onEndTurn: vi.fn(),
    ...overrides
  };
}

describe('EncounterHeader', () => {
  test('renders the encounter name as the h1', () => {
    render(EncounterHeader, { props: baseProps({ name: 'Storm at Saggorak' }) });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Storm at Saggorak');
  });

  test('renders the phase chip with the phase label', () => {
    render(EncounterHeader, { props: baseProps({ phase: 'ACTIVE' }) });
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  test('renders the round number', () => {
    render(EncounterHeader, { props: baseProps({ phase: 'ACTIVE', round: 3 }) });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('shows "No active turn" when no active combatant', () => {
    render(EncounterHeader, { props: baseProps({ activeName: undefined }) });
    expect(screen.getByText('No active turn')).toBeInTheDocument();
  });

  test("shows the active combatant's turn when activeName is provided", () => {
    render(EncounterHeader, {
      props: baseProps({ phase: 'ACTIVE', round: 1, activeName: 'Goblin Warrior' })
    });
    expect(screen.getByText("Goblin Warrior's turn")).toBeInTheDocument();
  });

  test('links to /settings', () => {
    render(EncounterHeader, { props: baseProps() });
    const link = screen.getByRole('link', { name: 'Settings' });
    expect(link).toHaveAttribute('href', '/settings');
  });

  test('the status region is labelled for assistive tech', () => {
    const { container } = render(EncounterHeader, { props: baseProps() });
    const status = container.querySelector('[aria-label="Encounter status"]');
    expect(status).not.toBeNull();
  });

  test('shows Roll all initiative only while PREPARING with combatants', () => {
    const { unmount } = render(EncounterHeader, {
      props: baseProps({ phase: 'PREPARING', canRollAll: true })
    });
    expect(screen.getByRole('button', { name: 'Roll all initiative' })).toBeInTheDocument();
    unmount();

    render(EncounterHeader, { props: baseProps({ phase: 'ACTIVE', canRollAll: true }) });
    expect(screen.queryByRole('button', { name: 'Roll all initiative' })).not.toBeInTheDocument();
  });

  test('hides Roll all initiative when there is nothing to roll', () => {
    render(EncounterHeader, { props: baseProps({ phase: 'PREPARING', canRollAll: false }) });
    expect(screen.queryByRole('button', { name: 'Roll all initiative' })).not.toBeInTheDocument();
  });

  test('Roll all initiative fires the callback', async () => {
    const onRollAllInitiative = vi.fn();
    render(EncounterHeader, {
      props: baseProps({ phase: 'PREPARING', canRollAll: true, onRollAllInitiative })
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Roll all initiative' }));
    expect(onRollAllInitiative).toHaveBeenCalledTimes(1);
  });

  test('shows End Turn only while ACTIVE', () => {
    const { unmount } = render(EncounterHeader, {
      props: baseProps({ phase: 'ACTIVE', canEndTurn: true })
    });
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
    unmount();

    render(EncounterHeader, { props: baseProps({ phase: 'PREPARING' }) });
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
  });

  test('End Turn is disabled when the turn cannot be ended', () => {
    render(EncounterHeader, { props: baseProps({ phase: 'ACTIVE', canEndTurn: false }) });
    expect(screen.getByRole('button', { name: 'End turn' })).toBeDisabled();
  });

  test('End Turn fires the callback', async () => {
    const onEndTurn = vi.fn();
    render(EncounterHeader, {
      props: baseProps({ phase: 'ACTIVE', canEndTurn: true, onEndTurn })
    });
    await fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });
});

describe('EncounterHeader library toggle', () => {
  test('hidden unless showLibraryToggle is set', () => {
    render(EncounterHeader, { props: baseProps() });
    expect(screen.queryByRole('button', { name: 'Toggle library' })).toBeNull();
  });

  test('renders with aria-expanded and fires the callback', async () => {
    const onToggleLibrary = vi.fn();
    render(EncounterHeader, {
      props: baseProps({ showLibraryToggle: true, libraryOpen: false, onToggleLibrary })
    });
    const toggle = screen.getByRole('button', { name: 'Toggle library' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(toggle);
    expect(onToggleLibrary).toHaveBeenCalledTimes(1);
  });
});
