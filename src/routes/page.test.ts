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
