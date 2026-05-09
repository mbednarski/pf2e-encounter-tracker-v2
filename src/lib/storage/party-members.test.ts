import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartyMember } from '../../domain';
import {
  addPartyMembers,
  clearPartyMembers,
  loadPartyMembers,
  removePartyMember,
  savePartyMember
} from './party-members';

function makePartyMember(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    id: 'lyra',
    name: 'Lyra Sunwhisper',
    level: 5,
    ac: 19,
    fortitude: 9,
    reflex: 11,
    will: 13,
    perception: 11,
    hp: 56,
    persistentEffects: [],
    companionIds: [],
    tags: [],
    ...overrides
  };
}

async function loadOrThrow(): Promise<PartyMember[]> {
  const result = await loadPartyMembers();
  if (!result.ok) throw new Error(`loadPartyMembers failed: ${result.reason}`);
  return result.partyMembers;
}

beforeEach(async () => {
  await clearPartyMembers();
});

afterEach(async () => {
  await clearPartyMembers();
});

describe('party member storage', () => {
  it('returns an empty list when nothing has been imported', async () => {
    expect(await loadOrThrow()).toEqual([]);
  });

  it('round-trips an imported party member', async () => {
    const lyra = makePartyMember({ id: 'lyra', name: 'Lyra' });
    const result = await addPartyMembers([lyra]);
    expect(result).toEqual({ ok: true, added: [lyra], rejected: [] });
    expect(await loadOrThrow()).toEqual([lyra]);
  });

  it('persists multiple party members from a single import', async () => {
    const lyra = makePartyMember({ id: 'lyra', name: 'Lyra' });
    const dane = makePartyMember({ id: 'dane', name: 'Dane' });
    await addPartyMembers([lyra, dane]);
    const stored = await loadOrThrow();
    expect(stored).toHaveLength(2);
    expect(stored.map((m) => m.id).sort()).toEqual(['dane', 'lyra']);
  });

  it('rejects party members whose id is already present, accepting the rest', async () => {
    const original = makePartyMember({ id: 'lyra', name: 'Original Lyra' });
    await addPartyMembers([original]);

    const collision = makePartyMember({ id: 'lyra', name: 'Different Lyra' });
    const fresh = makePartyMember({ id: 'dane', name: 'Dane' });
    const result = await addPartyMembers([collision, fresh]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([fresh]);
      expect(result.rejected).toEqual([collision]);
    }

    const stored = await loadOrThrow();
    const lyra = stored.find((m) => m.id === 'lyra');
    expect(lyra?.name).toBe('Original Lyra');
  });

  it('rejects internal duplicates within a single import batch', async () => {
    const a = makePartyMember({ id: 'lyra', name: 'First' });
    const b = makePartyMember({ id: 'lyra', name: 'Second' });
    const result = await addPartyMembers([a, b]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toEqual([a]);
      expect(result.rejected).toEqual([b]);
    }
  });

  it('savePartyMember writes a new record', async () => {
    const lyra = makePartyMember({ id: 'lyra', name: 'Lyra' });
    expect(await savePartyMember(lyra)).toEqual({ ok: true });
    expect(await loadOrThrow()).toEqual([lyra]);
  });

  it('savePartyMember overwrites an existing record (upsert)', async () => {
    const original = makePartyMember({ id: 'lyra', name: 'Original' });
    await addPartyMembers([original]);

    const updated = makePartyMember({ id: 'lyra', name: 'Updated', ac: 22 });
    expect(await savePartyMember(updated)).toEqual({ ok: true });

    const stored = await loadOrThrow();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Updated');
    expect(stored[0].ac).toBe(22);
  });

  it('removePartyMember deletes a single record without touching siblings', async () => {
    const lyra = makePartyMember({ id: 'lyra' });
    const dane = makePartyMember({ id: 'dane' });
    await addPartyMembers([lyra, dane]);
    expect(await removePartyMember('lyra')).toEqual({ ok: true, existed: true });
    const stored = await loadOrThrow();
    expect(stored.map((m) => m.id)).toEqual(['dane']);
  });

  it('removePartyMember reports existed: false for unknown ids', async () => {
    expect(await removePartyMember('does-not-exist')).toEqual({
      ok: true,
      existed: false
    });
    expect(await loadOrThrow()).toEqual([]);
  });

  it('clearPartyMembers empties the store', async () => {
    await addPartyMembers([makePartyMember({ id: 'a' }), makePartyMember({ id: 'b' })]);
    expect(await clearPartyMembers()).toEqual({ ok: true });
    expect(await loadOrThrow()).toEqual([]);
  });

  it('persists party members across a simulated page reload', async () => {
    const lyra = makePartyMember({ id: 'lyra', name: 'Lyra' });
    await addPartyMembers([lyra]);

    vi.resetModules();
    const { loadPartyMembers: load } = await import('./party-members');
    const result = await load();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.partyMembers.map((m) => m.id)).toEqual(['lyra']);
    }
  });
});

describe('party member storage when indexedDB is unavailable', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadPartyMembers returns ok: false / unavailable', async () => {
    const { loadPartyMembers: load } = await import('./party-members');
    expect(await load()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('addPartyMembers returns ok: false / unavailable', async () => {
    const { addPartyMembers: add } = await import('./party-members');
    const result = await add([makePartyMember({ id: 'x' })]);
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('savePartyMember returns ok: false / unavailable', async () => {
    const { savePartyMember: save } = await import('./party-members');
    const result = await save(makePartyMember({ id: 'x' }));
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('removePartyMember returns ok: false / unavailable', async () => {
    const { removePartyMember: remove } = await import('./party-members');
    expect(await remove('any')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('clearPartyMembers returns ok: false / unavailable', async () => {
    const { clearPartyMembers: clear } = await import('./party-members');
    expect(await clear()).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('party member storage when indexedDB throws at runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('idb');
    vi.unstubAllGlobals();
  });

  it('loadPartyMembers returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() => Promise.reject(new Error('simulated open failure')))
      };
    });
    const { loadPartyMembers: load } = await import('./party-members');
    const result = await load();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('failed');
      expect((result.error as Error).message).toBe('simulated open failure');
    }
  });

  it('addPartyMembers returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() => Promise.reject(new Error('simulated open failure')))
      };
    });
    const { addPartyMembers: add } = await import('./party-members');
    const result = await add([makePartyMember({ id: 'x' })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });

  it('savePartyMember returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() => Promise.reject(new Error('simulated open failure')))
      };
    });
    const { savePartyMember: save } = await import('./party-members');
    const result = await save(makePartyMember({ id: 'x' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });

  it('removePartyMember returns ok: false / failed when openDB rejects', async () => {
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn(() => Promise.reject(new Error('simulated open failure')))
      };
    });
    const { removePartyMember: remove } = await import('./party-members');
    const result = await remove('any');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });
});
