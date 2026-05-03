import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApiKey, loadApiKey, saveApiKey } from './settings';

beforeEach(async () => {
  await clearApiKey();
});

afterEach(async () => {
  await clearApiKey();
});

describe('settings storage', () => {
  it('returns null when no api key has been saved', async () => {
    expect(await loadApiKey()).toBeNull();
  });

  it('round-trips an api key', async () => {
    await saveApiKey('sk-test-abc123');
    expect(await loadApiKey()).toBe('sk-test-abc123');
  });

  it('overwrites the prior key on subsequent save', async () => {
    await saveApiKey('first-key');
    await saveApiKey('second-key');
    expect(await loadApiKey()).toBe('second-key');
  });

  it('clearApiKey removes the key', async () => {
    await saveApiKey('sk-test-abc123');
    await clearApiKey();
    expect(await loadApiKey()).toBeNull();
  });

  it('saveApiKey returns true when persisted', async () => {
    expect(await saveApiKey('sk-test')).toBe(true);
  });

  it('clearApiKey returns true when cleared (even if no prior key)', async () => {
    expect(await clearApiKey()).toBe(true);
  });
});

describe('settings storage when indexedDB is unavailable', () => {
  // Use vi.resetModules + dynamic import so the module-level dbPromise
  // singleton is fresh for every test in this block — otherwise an earlier
  // test in the file may have cached a resolved promise, and getDb() would
  // bypass the !hasIndexedDb() guard we are trying to exercise here.
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadApiKey returns null', async () => {
    const { loadApiKey: load } = await import('./settings');
    expect(await load()).toBeNull();
  });

  it('saveApiKey returns false (signals "not persisted") instead of silently no-opping', async () => {
    const { saveApiKey: save } = await import('./settings');
    expect(await save('sk-test')).toBe(false);
  });

  it('clearApiKey returns false (signals "not cleared") instead of silently no-opping', async () => {
    const { clearApiKey: clear } = await import('./settings');
    expect(await clear()).toBe(false);
  });
});
