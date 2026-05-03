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

beforeEach(async () => {
  await clearCreatures();
});

afterEach(async () => {
  await clearCreatures();
});

describe('creature library storage', () => {
  it('returns an empty array when nothing has been imported', async () => {
    expect(await loadCreatures()).toEqual([]);
  });

  it('round-trips an imported creature', async () => {
    const goblin = makeCreature({ id: 'goblin', name: 'Goblin' });
    const result = await addCreatures([goblin]);
    expect(result).toEqual({ added: [goblin], rejected: [], persisted: true });
    expect(await loadCreatures()).toEqual([goblin]);
  });

  it('persists multiple creatures from a single import', async () => {
    const goblin = makeCreature({ id: 'goblin', name: 'Goblin' });
    const wolf = makeCreature({ id: 'wolf', name: 'Wolf' });
    await addCreatures([goblin, wolf]);
    const stored = await loadCreatures();
    expect(stored).toHaveLength(2);
    expect(stored.map((c) => c.id).sort()).toEqual(['goblin', 'wolf']);
  });

  it('rejects creatures whose id is already present, accepting the rest', async () => {
    const original = makeCreature({ id: 'goblin', name: 'Original Goblin' });
    await addCreatures([original]);

    const collision = makeCreature({ id: 'goblin', name: 'Different Goblin' });
    const fresh = makeCreature({ id: 'wolf', name: 'Wolf' });
    const result = await addCreatures([collision, fresh]);

    expect(result.added).toEqual([fresh]);
    expect(result.rejected).toEqual([collision]);
    expect(result.persisted).toBe(true);

    // Original record is preserved — collision did not overwrite.
    const stored = await loadCreatures();
    const goblin = stored.find((c) => c.id === 'goblin');
    expect(goblin?.name).toBe('Original Goblin');
  });

  it('rejects internal duplicates within a single import batch', async () => {
    const a = makeCreature({ id: 'goblin', name: 'First' });
    const b = makeCreature({ id: 'goblin', name: 'Second' });
    const result = await addCreatures([a, b]);
    expect(result.added).toEqual([a]);
    expect(result.rejected).toEqual([b]);
  });

  it('removeCreature deletes a single record without touching siblings', async () => {
    const goblin = makeCreature({ id: 'goblin' });
    const wolf = makeCreature({ id: 'wolf' });
    await addCreatures([goblin, wolf]);
    expect(await removeCreature('goblin')).toBe(true);
    const stored = await loadCreatures();
    expect(stored.map((c) => c.id)).toEqual(['wolf']);
  });

  it('removeCreature is a no-op for unknown ids', async () => {
    expect(await removeCreature('does-not-exist')).toBe(true);
    expect(await loadCreatures()).toEqual([]);
  });

  it('clearCreatures empties the store', async () => {
    await addCreatures([makeCreature({ id: 'a' }), makeCreature({ id: 'b' })]);
    expect(await clearCreatures()).toBe(true);
    expect(await loadCreatures()).toEqual([]);
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

  it('loadCreatures returns []', async () => {
    const { loadCreatures: load } = await import('./creature-library');
    expect(await load()).toEqual([]);
  });

  it('addCreatures returns persisted: false so callers can surface a save-failed feedback', async () => {
    const { addCreatures: add } = await import('./creature-library');
    const result = await add([
      // makeCreature isn't importable here because resetModules invalidated it;
      // an inline minimal shape is sufficient — addCreatures never inspects
      // fields beyond `id` along the IDB-unavailable path.
      { id: 'x' } as Creature
    ]);
    expect(result).toEqual({ added: [], rejected: [], persisted: false });
  });

  it('removeCreature returns false', async () => {
    const { removeCreature: remove } = await import('./creature-library');
    expect(await remove('any')).toBe(false);
  });

  it('clearCreatures returns false', async () => {
    const { clearCreatures: clear } = await import('./creature-library');
    expect(await clear()).toBe(false);
  });
});
