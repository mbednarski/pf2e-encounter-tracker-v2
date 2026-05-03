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

  it('no-ops safely when indexedDB is unavailable (SSR / locked-down browsers)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      expect(await loadApiKey()).toBeNull();
      await expect(saveApiKey('sk-test')).resolves.toBeUndefined();
      await expect(clearApiKey()).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
