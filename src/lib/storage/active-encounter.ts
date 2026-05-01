import { openDB, type IDBPDatabase } from 'idb';
import type { EncounterState } from '../../domain/types';

const DB_NAME = 'pf2e-tracker-v2';
const DB_VERSION = 1;
const STORE = 'activeEncounter';
const KEY = 'current';

let dbPromise: Promise<IDBPDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getDb(): Promise<IDBPDatabase> | null {
  if (!hasIndexedDb()) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      }
    });
  }
  return dbPromise;
}

export async function saveActiveEncounter(state: EncounterState): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.put(STORE, state, KEY);
}

export async function loadActiveEncounter(): Promise<EncounterState | null> {
  const promise = getDb();
  if (!promise) return null;
  const db = await promise;
  const stored = (await db.get(STORE, KEY)) as EncounterState | undefined;
  if (!stored) return null;
  if (stored.phase === 'COMPLETED') return null;
  return stored;
}

export async function clearActiveEncounter(): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.delete(STORE, KEY);
}
