import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hazard } from '../../domain';
import { addHazards, clearHazards, loadHazards, removeHazard } from './hazard-library';

function makeHazard(overrides: Partial<Hazard> = {}): Hazard {
  return {
    id: 'test-hazard',
    name: 'Test Hazard',
    level: 5,
    traits: ['trap'],
    rarity: 'common',
    stealth: 20,
    ac: 22,
    fortitude: 10,
    reflex: 14,
    will: 8,
    hp: 60,
    hardness: 8,
    immunities: [],
    resistances: [],
    weaknesses: [],
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    tags: [],
    ...overrides
  };
}

async function loadOrThrow(): Promise<Hazard[]> {
  const result = await loadHazards();
  if (!result.ok) throw new Error(`loadHazards failed: ${result.reason}`);
  return result.hazards;
}

beforeEach(async () => {
  await clearHazards();
});

afterEach(async () => {
  await clearHazards();
});

describe('hazard library storage', () => {
  it('returns an empty list when nothing has been imported', async () => {
    expect(await loadOrThrow()).toEqual([]);
  });

  it('round-trips an imported hazard', async () => {
    const gallery = makeHazard({ id: 'dart-gallery', name: 'Dart Gallery' });
    const result = await addHazards([gallery]);
    expect(result).toEqual({ ok: true, added: [gallery], rejected: [] });
    expect(await loadOrThrow()).toEqual([gallery]);
  });

  it('rejects hazards whose id is already present, accepting the rest', async () => {
    await addHazards([makeHazard({ id: 'dart-gallery', name: 'Original' })]);

    const collision = makeHazard({ id: 'dart-gallery', name: 'Different' });
    const fresh = makeHazard({ id: 'pit-trap', name: 'Pit Trap' });
    const result = await addHazards([collision, fresh]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([fresh]);
      expect(result.rejected).toEqual([collision]);
    }

    const stored = await loadOrThrow();
    expect(stored.find((h) => h.id === 'dart-gallery')?.name).toBe('Original');
  });

  it('rejects internal duplicates within a single import batch', async () => {
    const a = makeHazard({ id: 'dart-gallery', name: 'First' });
    const b = makeHazard({ id: 'dart-gallery', name: 'Second' });
    const result = await addHazards([a, b]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([a]);
      expect(result.rejected).toEqual([b]);
    }
  });

  it('removeHazard deletes a single record without touching siblings', async () => {
    await addHazards([makeHazard({ id: 'dart-gallery' }), makeHazard({ id: 'pit-trap' })]);
    expect(await removeHazard('dart-gallery')).toEqual({ ok: true, existed: true });
    expect((await loadOrThrow()).map((h) => h.id)).toEqual(['pit-trap']);
  });

  it('removeHazard reports existed: false for unknown ids', async () => {
    expect(await removeHazard('does-not-exist')).toEqual({ ok: true, existed: false });
  });

  it('clearHazards empties the store', async () => {
    await addHazards([makeHazard({ id: 'a' }), makeHazard({ id: 'b' })]);
    expect(await clearHazards()).toEqual({ ok: true });
    expect(await loadOrThrow()).toEqual([]);
  });

  it('persists hazards across a simulated page reload', async () => {
    await addHazards([makeHazard({ id: 'dart-gallery', name: 'Dart Gallery' })]);

    vi.resetModules();
    const { loadHazards: load } = await import('./hazard-library');
    const result = await load();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hazards.map((h) => h.id)).toEqual(['dart-gallery']);
    }
  });
});

describe('hazard library storage when indexedDB is unavailable', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadHazards returns ok: false / unavailable', async () => {
    const { loadHazards: load } = await import('./hazard-library');
    expect(await load()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('addHazards returns ok: false / unavailable', async () => {
    const { addHazards: add } = await import('./hazard-library');
    expect(await add([makeHazard({ id: 'x' })])).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('removeHazard returns ok: false / unavailable', async () => {
    const { removeHazard: remove } = await import('./hazard-library');
    expect(await remove('any')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('clearHazards returns ok: false / unavailable', async () => {
    const { clearHazards: clear } = await import('./hazard-library');
    expect(await clear()).toEqual({ ok: false, reason: 'unavailable' });
  });
});
