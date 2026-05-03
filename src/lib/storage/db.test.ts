import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { ACTIVE_ENCOUNTER_STORE, DB_NAME, SETTINGS_STORE } from './db';

// fake-indexeddb's deleteDB blocks until every open connection is closed,
// so each test pushes its connections here and afterEach closes them all.
const openConnections: IDBPDatabase[] = [];

beforeEach(() => {
  // Reset the module-level dbPromise singleton so each test starts with
  // a fresh getDb() — otherwise a cached resolved promise (from an earlier
  // test or test file) would bypass the very paths we want to exercise.
  vi.resetModules();
});

afterEach(async () => {
  for (const db of openConnections) {
    try {
      db.close();
    } catch {
      // ignore — connection may already be closed
    }
  }
  openConnections.length = 0;
  vi.doUnmock('idb');
  vi.unstubAllGlobals();
  await deleteDB(DB_NAME);
});

describe('IndexedDB schema migration', () => {
  it('preserves a v1 activeEncounter record and adds the settings store when upgrading to v2', async () => {
    // Seed a v1 database with only the activeEncounter store and a sentinel record,
    // mirroring what an existing user would have on disk before this PR.
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(ACTIVE_ENCOUNTER_STORE);
      }
    });
    await v1.put(ACTIVE_ENCOUNTER_STORE, { sentinel: 'v1-data' }, 'current');
    v1.close();

    // Open via the production getDb(), which targets v2 — the upgrade callback
    // must run, add the settings store, and leave the sentinel intact.
    const { getDb } = await import('./db');
    const db = await getDb()!;
    openConnections.push(db);

    expect(Array.from(db.objectStoreNames).sort()).toEqual(
      [ACTIVE_ENCOUNTER_STORE, SETTINGS_STORE].sort()
    );
    expect(await db.get(ACTIVE_ENCOUNTER_STORE, 'current')).toEqual({
      sentinel: 'v1-data'
    });
  });

  it('creates both stores on a fresh install (no prior database)', async () => {
    const { getDb } = await import('./db');
    const db = await getDb()!;
    openConnections.push(db);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(
      [ACTIVE_ENCOUNTER_STORE, SETTINGS_STORE].sort()
    );
  });
});

describe('getDb singleton', () => {
  it('returns null (does not throw) when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { getDb } = await import('./db');
    expect(getDb()).toBeNull();
  });

  it('does not cache a rejected open — the next call retries instead of re-yielding the rejection', async () => {
    let calls = 0;
    vi.doMock('idb', async () => {
      const actual = await vi.importActual<typeof import('idb')>('idb');
      return {
        ...actual,
        openDB: vi.fn((...args: Parameters<typeof actual.openDB>) => {
          calls++;
          if (calls === 1) {
            return Promise.reject(new Error('simulated first-open failure'));
          }
          return actual.openDB(...args);
        })
      };
    });

    const { getDb } = await import('./db');

    await expect(getDb()).rejects.toThrow('simulated first-open failure');

    // Critical: the second call must NOT return the cached rejected promise.
    // If `dbPromise = null` were removed from the catch handler, this would
    // re-throw and `calls` would stay at 1.
    const db = await getDb()!;
    openConnections.push(db);
    expect(db).toBeTruthy();
    expect(calls).toBe(2);
  });
});
