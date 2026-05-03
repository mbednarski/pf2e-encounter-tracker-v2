import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'pf2e-tracker-v2';
export const DB_VERSION = 2;
export const ACTIVE_ENCOUNTER_STORE = 'activeEncounter';
export const SETTINGS_STORE = 'settings';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function getDb(): Promise<IDBPDatabase> | null {
  if (!hasIndexedDb()) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Idempotent migration: each store is created only if missing,
        // so users on v1 (activeEncounter only) get the new settings store
        // without losing existing data.
        if (!db.objectStoreNames.contains(ACTIVE_ENCOUNTER_STORE)) {
          db.createObjectStore(ACTIVE_ENCOUNTER_STORE);
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      }
    }).catch((err) => {
      // Don't pin a rejected promise to the cache: a transient first-open failure
      // (Firefox private-browsing InvalidStateError, VersionError from another tab,
      // QuotaExceededError) would otherwise stay broken until full page reload.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
