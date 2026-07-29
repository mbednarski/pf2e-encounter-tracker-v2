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

    expect(screen.getByRole('heading', { name: 'Encounter complete' })).toBeInTheDocument();
    expect(screen.getByText('Finished in round 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prepare Rematch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Encounter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start New Encounter…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Custom' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
  });

  test('does not offer completion while turn prompts are unresolved', async () => {
    await saveActiveEncounter(resolvingEncounter({ name: 'Pending saves' }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pending saves' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Complete Encounter' })).not.toBeInTheDocument();
  });

  test('prepares a rematch with the roster reset to PREPARING', async () => {
    const wounded = activeEncounter({ name: 'Run It Again' });
    wounded.combatants['goblin-1'].currentHp = 2;
    wounded.combatants['goblin-1'].isAlive = false;
    await saveActiveEncounter(wounded);
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Run It Again' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Prepare Rematch' }));

    expect(screen.getAllByText('PREPARING')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Start Encounter' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Roll all initiative' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'HP 20 of 20, click to edit' })).toHaveLength(2);
    expect(screen.queryByText('Encounter complete')).not.toBeInTheDocument();
  });

  test('uses the safe discard confirmation before starting a new encounter', async () => {
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

  test('downloads the completed encounter as YAML', async () => {
    const createObjectURL = vi.fn(() => 'blob:encounter');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    await saveActiveEncounter(activeEncounter({ name: 'Bridge at Dusk' }));
    render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bridge at Dusk' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Export Encounter' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloads).toEqual(['bridge-at-dusk.yaml']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:encounter');
  });

  test('does not restore a completed encounter as active after reload', async () => {
    await saveActiveEncounter(activeEncounter({ name: 'Completed Session' }));
    const first = render(Page);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Completed Session' })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: 'Complete Encounter' }));
    expect(screen.getByRole('heading', { name: 'Encounter complete' })).toBeInTheDocument();
    first.unmount();

    render(Page);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Local Encounter' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Completed Session' })).not.toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });
});
