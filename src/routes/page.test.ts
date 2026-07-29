import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { activeEncounter } from '../domain/test-support';
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
