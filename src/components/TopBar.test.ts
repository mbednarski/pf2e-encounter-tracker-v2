import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import TopBar from './TopBar.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Goblin Ambush',
    phase: 'PREPARING' as const,
    round: 0,
    activeName: undefined,
    ...overrides
  };
}

describe('TopBar', () => {
  test('renders the encounter name as the h1', () => {
    render(TopBar, { props: baseProps({ name: 'Storm at Saggorak' }) });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Storm at Saggorak');
  });

  test('renders the phase chip with the phase label', () => {
    render(TopBar, { props: baseProps({ phase: 'ACTIVE' }) });
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  test('renders the round number', () => {
    render(TopBar, { props: baseProps({ phase: 'ACTIVE', round: 3 }) });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('shows "No active turn" when no active combatant', () => {
    render(TopBar, { props: baseProps({ activeName: undefined }) });
    expect(screen.getByText('No active turn')).toBeInTheDocument();
  });

  test('shows the active combatant\'s turn when activeName is provided', () => {
    render(TopBar, {
      props: baseProps({ phase: 'ACTIVE', round: 1, activeName: 'Goblin Warrior' })
    });
    expect(screen.getByText("Goblin Warrior's turn")).toBeInTheDocument();
  });

  test('links to /settings', () => {
    render(TopBar, { props: baseProps() });
    const link = screen.getByRole('link', { name: 'Settings' });
    expect(link).toHaveAttribute('href', '/settings');
  });

  test('the status region is labelled for assistive tech', () => {
    const { container } = render(TopBar, { props: baseProps() });
    const status = container.querySelector('[aria-label="Encounter status"]');
    expect(status).not.toBeNull();
  });

  test('offers completion only during ACTIVE and calls the lifecycle callback', async () => {
    const onComplete = vi.fn();
    const { rerender } = render(TopBar, {
      props: baseProps({ phase: 'ACTIVE', onComplete })
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    expect(onComplete).toHaveBeenCalledOnce();

    await rerender(baseProps({ phase: 'RESOLVING', onComplete }));
    expect(screen.queryByRole('button', { name: 'Complete Encounter' })).not.toBeInTheDocument();
  });

  test('renders the completed encounter actions and forwards rematch and export', async () => {
    const onPrepareRematch = vi.fn();
    const onExport = vi.fn();
    render(TopBar, {
      props: baseProps({
        phase: 'COMPLETED',
        round: 4,
        activeName: 'Goblin Warrior',
        onPrepareRematch,
        onExport
      })
    });

    expect(screen.getByText('Encounter complete')).toBeInTheDocument();
    expect(screen.queryByText("Goblin Warrior's turn")).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Prepare Rematch' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Export Encounter' }));

    expect(onPrepareRematch).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Start New Encounter…' })).toBeInTheDocument();
  });
});
