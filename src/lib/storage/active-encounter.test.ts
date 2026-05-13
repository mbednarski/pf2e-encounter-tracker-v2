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

  it('migrates legacy baseStats+level combatants to baseSnapshot on load', async () => {
    // Regression: pre-#117 encounters stored combatants as
    // { baseStats: { hp, ac, ... }, level: number, templateAdjustment? }.
    // The new shape is { baseSnapshot: { level, hp, ac, ... },
    // templateAdjustment }. Without a migration, computeEncounterXP reads
    // c.baseSnapshot.level on these legacy combatants and throws
    // "Cannot read properties of undefined (reading 'level')", which broke
    // the bestiary list while the lazily-rendered Manage modal still worked.
    const state = activeEncounter();
    await saveActiveEncounter(state);

    const { getDb, ACTIVE_ENCOUNTER_STORE } = await import('./db');
    const db = await (getDb() as Promise<import('idb').IDBPDatabase>);
    const stored = (await db.get(ACTIVE_ENCOUNTER_STORE, 'current')) as Record<string, unknown>;
    const combatants = stored.combatants as Record<string, Record<string, unknown>>;
    for (const c of Object.values(combatants)) {
      const snap = c.baseSnapshot as Record<string, unknown>;
      c.baseStats = {
        hp: snap.hp,
        ac: snap.ac,
        fortitude: snap.fortitude,
        reflex: snap.reflex,
        will: snap.will,
        perception: snap.perception,
        speed: snap.speed,
        skills: snap.skills
      };
      c.level = snap.level;
      delete c.baseSnapshot;
    }
    await db.put(ACTIVE_ENCOUNTER_STORE, stored, 'current');

    const restored = await loadActiveEncounter();
    expect(restored).not.toBeNull();
    for (const c of Object.values(restored!.combatants)) {
      expect(c.baseSnapshot).toBeDefined();
      expect(c.baseSnapshot.level).toBe(1);
      expect(c.baseSnapshot.hp).toBe(20);
      expect(c.baseSnapshot.ac).toBe(16);
      expect(c.baseSnapshot.fortitude).toBe(7);
      expect(c.baseSnapshot.reflex).toBe(8);
      expect(c.baseSnapshot.will).toBe(5);
      expect(c.baseSnapshot.perception).toBe(6);
      expect(c.baseSnapshot.speed).toBe(25);
    }

    // The original symptom: computeEncounterXP threw on legacy combatants.
    // Importing here (rather than top-of-file) keeps the dependency local
    // to the regression test.
    const { computeEncounterXP } = await import('../../domain');
    expect(() => computeEncounterXP(restored!)).not.toThrow();
  });

  it('resets templateAdjustment to normal when migrating legacy combatants', async () => {
    // Old baseStats values were already post-adjustment (applyEliteWeak ran
    // before the snapshot was taken). Preserving templateAdjustment="elite"
    // would make getAdjustedView add +2 a second time. Force adjustment to
    // 'normal' on migrate so what the user saw before still matches.
    const state = activeEncounter();
    await saveActiveEncounter(state);

    const { getDb, ACTIVE_ENCOUNTER_STORE } = await import('./db');
    const db = await (getDb() as Promise<import('idb').IDBPDatabase>);
    const stored = (await db.get(ACTIVE_ENCOUNTER_STORE, 'current')) as Record<string, unknown>;
    const combatants = stored.combatants as Record<string, Record<string, unknown>>;
    for (const c of Object.values(combatants)) {
      const snap = c.baseSnapshot as Record<string, unknown>;
      c.baseStats = { ...snap };
      delete (c.baseStats as Record<string, unknown>).level;
      c.level = snap.level;
      c.templateAdjustment = 'elite';
      delete c.baseSnapshot;
    }
    await db.put(ACTIVE_ENCOUNTER_STORE, stored, 'current');

    const restored = await loadActiveEncounter();
    expect(restored).not.toBeNull();
    for (const c of Object.values(restored!.combatants)) {
      expect(c.templateAdjustment).toBe('normal');
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
