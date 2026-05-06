import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('back-fills sourceId from a legacy creatureId on load', async () => {
    // Simulate an encounter saved before the creatureId -> sourceId rename
    // by mutating the persisted record after save, since current types reject
    // creatureId at compile time.
    const state = activeEncounter();
    await saveActiveEncounter(state);

    const { getDb, ACTIVE_ENCOUNTER_STORE } = await import('./db');
    const db = await (getDb() as Promise<import('idb').IDBPDatabase>);
    const stored = (await db.get(ACTIVE_ENCOUNTER_STORE, 'current')) as Record<string, unknown>;
    const combatants = stored.combatants as Record<string, Record<string, unknown>>;
    for (const c of Object.values(combatants)) {
      c.creatureId = c.sourceId;
      delete c.sourceId;
    }
    await db.put(ACTIVE_ENCOUNTER_STORE, stored, 'current');

    const restored = await loadActiveEncounter();
    expect(restored).not.toBeNull();
    for (const c of Object.values(restored!.combatants)) {
      expect(c.sourceId).toBeDefined();
      expect(c.sourceId).toBe(`${c.id}-creature`);
    }
  });

});

describe('active encounter storage when indexedDB is unavailable', () => {
  // Reset the module-level dbPromise singleton + stub indexedDB before
  // importing, otherwise a cached promise from an earlier test would let
  // getDb() bypass the !hasIndexedDb() guard we want to exercise here.
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadActiveEncounter returns null', async () => {
    const { loadActiveEncounter: load } = await import('./active-encounter');
    expect(await load()).toBeNull();
  });

  it('saveActiveEncounter no-ops without throwing', async () => {
    const { saveActiveEncounter: save } = await import('./active-encounter');
    await expect(save(activeEncounter())).resolves.toBeUndefined();
  });

  it('clearActiveEncounter no-ops without throwing', async () => {
    const { clearActiveEncounter: clear } = await import('./active-encounter');
    await expect(clear()).resolves.toBeUndefined();
  });
});
