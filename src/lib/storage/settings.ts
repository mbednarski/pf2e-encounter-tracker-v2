import { getDb, SETTINGS_STORE } from './db';

const LLM_API_KEY = 'llmApiKey';

export async function saveApiKey(key: string): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.put(SETTINGS_STORE, key, LLM_API_KEY);
}

export async function loadApiKey(): Promise<string | null> {
  const promise = getDb();
  if (!promise) return null;
  const db = await promise;
  const stored = (await db.get(SETTINGS_STORE, LLM_API_KEY)) as string | undefined;
  return stored ?? null;
}

export async function clearApiKey(): Promise<void> {
  const promise = getDb();
  if (!promise) return;
  const db = await promise;
  await db.delete(SETTINGS_STORE, LLM_API_KEY);
}
