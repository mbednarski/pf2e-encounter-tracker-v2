import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hazard } from '../../domain';
import {
  addHazards,
  clearHazards,
  loadHazards,
  removeHazard
} from './hazard-library';

function makeHazard(overrides: Partial<Hazard> = {}): Hazard {
  return {
    id: 'test-hazard',
    name: 'Test Hazard',
    level: 1,
    traits: ['mechanical', 'trap'],
    rarity: 'common',
    ac: 15,
    fortitude: 5,
    reflex: 8,
    hp: 30,
    stealth: 12,
    immunities: [],
    resistances: [],
    weaknesses: [],
    disableChecks: [{ skill: 'thievery', dc: 18, requiredSuccesses: 1 }],
    routine: { actions: 1, description: 'Spins.' },
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    attacks: [],
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
    const trap = makeHazard({ id: 'pit', name: 'Spiked Pit' });
    const result = await addHazards([trap]);
    expect(result).toEqual({ ok: true, added: [trap], rejected: [] });
    expect(await loadOrThrow()).toEqual([trap]);
  });

  it('rejects hazards whose id is already present', async () => {
    const original = makeHazard({ id: 'pit', name: 'Original' });
    await addHazards([original]);

    const collision = makeHazard({ id: 'pit', name: 'Different' });
    const fresh = makeHazard({ id: 'dart', name: 'Dart Trap' });
    const result = await addHazards([collision, fresh]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([fresh]);
      expect(result.rejected).toEqual([collision]);
    }

    const stored = await loadOrThrow();
    expect(stored.find((h) => h.id === 'pit')?.name).toBe('Original');
  });

  it('removeHazard deletes a single record', async () => {
    await addHazards([makeHazard({ id: 'a' }), makeHazard({ id: 'b' })]);
    expect(await removeHazard('a')).toEqual({ ok: true, existed: true });
    const stored = await loadOrThrow();
    expect(stored.map((h) => h.id)).toEqual(['b']);
  });

  it('removeHazard reports existed: false for unknown ids', async () => {
    expect(await removeHazard('missing')).toEqual({ ok: true, existed: false });
  });

  it('persists hazards across a simulated reload', async () => {
    const trap = makeHazard({ id: 'pit', name: 'Spiked Pit' });
    await addHazards([trap]);

    vi.resetModules();
    const { loadHazards: load } = await import('./hazard-library');
    const result = await load();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hazards.map((h) => h.id)).toEqual(['pit']);
    }
  });
});

describe('hazard library when indexedDB is unavailable', () => {
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
    expect(await add([makeHazard({ id: 'x' })])).toEqual({
      ok: false,
      reason: 'unavailable'
    });
  });
});
