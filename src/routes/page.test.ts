import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { activeEncounter, resolvingEncounter } from '../domain/test-support';
import {
  clearActiveEncounter,
  loadActiveEncounter,
  saveActiveEncounter
} from '$lib/storage/active-encounter';
import Page from './+page.svelte';

beforeEach(async () => {
  await clearActiveEncounter();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearActiveEncounter();
});

describe('encounter discard flow', () => {
  test('confirmed discard resets the active state and clears active persistence', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Discard me' }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Discard me' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Discard Encounter…' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Discard Encounter' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Discard me' })).not.toBeInTheDocument());
    await expect(loadActiveEncounter()).resolves.toBeNull();
  });
});

describe('encounter lifecycle flow', () => {
  test('completes ACTIVE encounters into an explicit read-only review state', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Bridge at Dusk', round: 3 }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bridge at Dusk' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));

    expect(screen.getByRole('status')).toHaveTextContent('Encounter completed.');
    expect(screen.getByRole('status')).toHaveTextContent(/read-only review of the final table state/i);
    expect(screen.getByRole('button', { name: 'Prepare Rematch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Encounter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start New Encounter…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add condition' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /HP 20 of 20/ })).not.toBeInTheDocument();
  });

  test('does not offer completion while turn prompts are unresolved', async () => {
    await saveActiveEncounter(resolvingEncounter({ name: 'Pending saves' }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pending saves' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Complete Encounter' })).not.toBeInTheDocument();
  });

  test('prepares a rematch with reset combatants and the roster ready for new initiative', async () => {
    const wounded = activeEncounter({ name: 'Run It Again' });
    wounded.combatants['goblin-1'].currentHp = 2;
    wounded.combatants['goblin-1'].isAlive = false;
    const originalOrder = [...wounded.initiative.order];
    await saveActiveEncounter(wounded);
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Run It Again' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Prepare Rematch' }));

    expect(screen.getAllByText('PREPARING')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Start Encounter' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Roll all initiative' })).toBeInTheDocument();
    await waitFor(async () => {
      const restored = await loadActiveEncounter();
      expect(restored?.state.phase).toBe('PREPARING');
      expect(restored?.state.initiative.order).toEqual(originalOrder);
      expect(restored?.state.initiative.scores).toEqual({});
      expect(restored?.state.combatants['goblin-1']).toMatchObject({
        currentHp: 20,
        tempHp: 0,
        isAlive: true,
        appliedEffects: []
      });
    });
  });

  test('uses a contextual discard confirmation before starting a new encounter', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Old Encounter' }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Old Encounter' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Start New Encounter…' }));

    expect(screen.getByRole('dialog', { name: 'Start a new encounter?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Old Encounter' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Discard Encounter' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Old Encounter' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Local Encounter' })).toBeInTheDocument();
  });

  test('downloads a Unicode-safe encounter filename', async () => {
    const createObjectURL = vi.fn(() => 'blob:encounter');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    await saveActiveEncounter(activeEncounter({ name: 'Żółty Smok' }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Żółty Smok' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Export Encounter' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloads).toEqual(['zolty-smok.encounter.yaml']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:encounter');
  });

  test('restores a completed encounter as a read-only review after reload', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Completed Session' }));
    const first = render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Completed Session' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    await waitFor(async () => {
      expect((await loadActiveEncounter())?.state.phase).toBe('COMPLETED');
    });
    first.unmount();

    render(Page);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Completed Session' })).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Encounter completed.');
    expect(screen.getByRole('button', { name: 'Prepare Rematch' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add condition' })).not.toBeInTheDocument();
  });
});

describe('encounter history shortcuts', () => {
  test('Ctrl+Z is ignored while editing a number field', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Shortcut guard' }));
    render(Page);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Shortcut guard' })).toBeInTheDocument());

    await fireEvent.click(screen.getAllByRole('button', { name: /HP 20 of 20/ })[0]);
    const input = screen.getAllByLabelText(/Edit HP/)[0];
    await fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('Ctrl+Z and Ctrl+Shift+Z undo and redo accepted encounter commands', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Shortcut action' }));
    render(Page);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Shortcut action' })).toBeInTheDocument());

    await fireEvent.click(screen.getAllByRole('button', { name: 'Reaction used' })[0]);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
    await fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});
