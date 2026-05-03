import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Creature } from '../../domain';
import {
  addCreatures,
  clearCreatures,
  loadCreatures,
  removeCreature
} from './creature-library';

function makeCreature(overrides: Partial<Creature> = {}): Creature {
  return {
    id: 'test-creature',
    name: 'Test Creature',
    level: 1,
    traits: [],
    size: 'medium',
    rarity: 'common',
    ac: 16,
    fortitude: 6,
    reflex: 8,
    will: 5,
    perception: 7,
    hp: 18,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 25 },
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    skills: {},
    tags: [],
    ...overrides
  };
}

async function loadOrThrow(): Promise<Creature[]> {
  const result = await loadCreatures();
  if (!result.ok) throw new Error(`loadCreatures failed: ${result.reason}`);
  return result.creatures;
}

beforeEach(async () => {
  await clearCreatures();
});

afterEach(async () => {
  await clearCreatures();
});

describe('creature library storage', () => {
  it('returns an empty list when nothing has been imported', async () => {
    expect(await loadOrThrow()).toEqual([]);
  });

  it('round-trips an imported creature', async () => {
    const goblin = makeCreature({ id: 'goblin', name: 'Goblin' });
    const result = await addCreatures([goblin]);
    expect(result).toEqual({ ok: true, added: [goblin], rejected: [] });
    expect(await loadOrThrow()).toEqual([goblin]);
  });

  it('persists multiple creatures from a single import', async () => {
    const goblin = makeCreature({ id: 'goblin', name: 'Goblin' });
    const wolf = makeCreature({ id: 'wolf', name: 'Wolf' });
    await addCreatures([goblin, wolf]);
    const stored = await loadOrThrow();
    expect(stored).toHaveLength(2);
    expect(stored.map((c) => c.id).sort()).toEqual(['goblin', 'wolf']);
  });

  it('rejects creatures whose id is already present, accepting the rest', async () => {
    const original = makeCreature({ id: 'goblin', name: 'Original Goblin' });
    await addCreatures([original]);

    const collision = makeCreature({ id: 'goblin', name: 'Different Goblin' });
    const fresh = makeCreature({ id: 'wolf', name: 'Wolf' });
    const result = await addCreatures([collision, fresh]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([fresh]);
      expect(result.rejected).toEqual([collision]);
    }

    // Original record is preserved — collision did not overwrite.
    const stored = await loadOrThrow();
    const goblin = stored.find((c) => c.id === 'goblin');
    expect(goblin?.name).toBe('Original Goblin');
  });

  it('rejects internal duplicates within a single import batch', async () => {
    const a = makeCreature({ id: 'goblin', name: 'First' });
    const b = makeCreature({ id: 'goblin', name: 'Second' });
    const result = await addCreatures([a, b]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([a]);
      expect(result.rejected).toEqual([b]);
    }
  });

  it('removeCreature deletes a single record without touching siblings', async () => {
    const goblin = makeCreature({ id: 'goblin' });
    const wolf = makeCreature({ id: 'wolf' });
    await addCreatures([goblin, wolf]);
    expect(await removeCreature('goblin')).toEqual({ ok: true, existed: true });
    const stored = await loadOrThrow();
    expect(stored.map((c) => c.id)).toEqual(['wolf']);
  });

  it('removeCreature reports existed: false for unknown ids', async () => {
    expect(await removeCreature('does-not-exist')).toEqual({
      ok: true,
      existed: false
    });
    expect(await loadOrThrow()).toEqual([]);
  });

  it('clearCreatures empties the store', async () => {
    await addCreatures([makeCreature({ id: 'a' }), makeCreature({ id: 'b' })]);
    expect(await clearCreatures()).toEqual({ ok: true });
    expect(await loadOrThrow()).toEqual([]);
  });

  it('persists creatures across a simulated page reload', async () => {
    // First "page load": import.
    const goblin = makeCreature({ id: 'goblin', name: 'Goblin' });
    await addCreatures([goblin]);

    // Simulate reload: drop module cache so the dbPromise singleton + idb
    // wrapper are re-created. fake-indexeddb's underlying global persists,
    // so a fresh getDb() must still see the previously written record.
    vi.resetModules();
    const { loadCreatures: load } = await import('./creature-library');
    const result = await load();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.creatures.map((c) => c.id)).toEqual(['goblin']);
    }
  });
});

describe('creature library storage when indexedDB is unavailable', () => {
  // Reset the module-level dbPromise singleton + stub indexedDB before each
  // dynamic import so the !hasIndexedDb() guard actually fires (a cached
  // resolved promise from an earlier test would otherwise short-circuit it).
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadCreatures returns ok: false / unavailable', async () => {
    const { loadCreatures: load } = await import('./creature-library');
    expect(await load()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('addCreatures returns ok: false / unavailable so callers can surface a save-failed feedback', async () => {
    const { addCreatures: add } = await import('./creature-library');
    const result = await add([makeCreature({ id: 'x' })]);
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('removeCreature returns ok: false / unavailable', async () => {
    const { removeCreature: remove } = await import('./creature-library');
    expect(await remove('any')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('clearCreatures returns ok: false / unavailable', async () => {
    const { clearCreatures: clear } = await import('./creature-library');
    expect(await clear()).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('creature library storage when indexedDB throws at runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('idb');
    vi.unstubAllGlobals();
  });

  it('loadCreatures returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() =>
          Promise.reject(new Error('simulated open failure'))
        )
      };
    });
    const { loadCreatures: load } = await import('./creature-library');
    const result = await load();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('failed');
      expect((result.error as Error).message).toBe('simulated open failure');
    }
  });

  it('addCreatures returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() =>
          Promise.reject(new Error('simulated open failure'))
        )
      };
    });
    const { addCreatures: add } = await import('./creature-library');
    const result = await add([makeCreature({ id: 'x' })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });

  it('removeCreature returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() =>
          Promise.reject(new Error('simulated open failure'))
        )
      };
    });
    const { removeCreature: remove } = await import('./creature-library');
    const result = await remove('any');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });
});
