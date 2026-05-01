import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  activeEncounter,
  completedEncounter,
  preparingEncounter,
  resolvingEncounter
} from '../../domain/test-support';
import {
  clearActiveEncounter,
  loadActiveEncounter,
  saveActiveEncounter
} from './active-encounter';

beforeEach(async () => {
  await clearActiveEncounter();
});

afterEach(async () => {
  await clearActiveEncounter();
});

describe('active encounter storage', () => {
  it('returns null when no encounter has been saved', async () => {
    expect(await loadActiveEncounter()).toBeNull();
  });

  it('round-trips an active encounter', async () => {
    const state = activeEncounter();
    await saveActiveEncounter(state);
    expect(await loadActiveEncounter()).toEqual(state);
  });

  it('overwrites the prior record on subsequent save', async () => {
    await saveActiveEncounter(preparingEncounter({ name: 'first' }));
    await saveActiveEncounter(activeEncounter({ name: 'second' }));
    const restored = await loadActiveEncounter();
    expect(restored?.name).toBe('second');
    expect(restored?.phase).toBe('ACTIVE');
  });

  it('restores PREPARING encounters', async () => {
    const state = preparingEncounter();
    await saveActiveEncounter(state);
    expect(await loadActiveEncounter()).toEqual(state);
  });

  it('restores RESOLVING encounters', async () => {
    const state = resolvingEncounter();
    await saveActiveEncounter(state);
    expect(await loadActiveEncounter()).toEqual(state);
  });

  it('does not auto-resume COMPLETED encounters', async () => {
    await saveActiveEncounter(completedEncounter());
    expect(await loadActiveEncounter()).toBeNull();
  });

  it('clearActiveEncounter removes the record', async () => {
    await saveActiveEncounter(activeEncounter());
    await clearActiveEncounter();
    expect(await loadActiveEncounter()).toBeNull();
  });
});
