import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import EncounterHeader from './EncounterHeader.svelte';

function props(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'ACTIVE' as const,
    pendingPromptCount: 0,
    onComplete: vi.fn(),
    onPrepareRematch: vi.fn(),
    onExport: vi.fn(),
    onDiscard: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe('EncounterHeader', () => {
  test('offers completion only during ACTIVE', async () => {
    const onComplete = vi.fn();
    render(EncounterHeader, { props: props({ onComplete }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  test('does not expose completion while prompts are resolving', () => {
    render(EncounterHeader, { props: props({ phase: 'RESOLVING', pendingPromptCount: 1 }) });
    expect(screen.queryByRole('button', { name: 'Complete Encounter' })).not.toBeInTheDocument();
    expect(screen.getByText(/resolve all turn prompts/i)).toBeInTheDocument();
  });

  test('offers rematch, export, and safe start-new actions in COMPLETED', async () => {
    const onPrepareRematch = vi.fn();
    const onExport = vi.fn();
    render(EncounterHeader, {
      props: props({ phase: 'COMPLETED', onPrepareRematch, onExport })
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Prepare Rematch' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Export Encounter' }));
    expect(onPrepareRematch).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Start New Encounter…' })).toBeInTheDocument();
  });
});
