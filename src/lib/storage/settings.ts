import { getDb, SETTINGS_STORE } from './db';

const LLM_API_KEY = 'llmApiKey';

export async function saveApiKey(key: string): Promise<boolean> {
  const promise = getDb();
  if (!promise) return false;
  const db = await promise;
  await db.put(SETTINGS_STORE, key, LLM_API_KEY);
  return true;
}

export async function loadApiKey(): Promise<string | null> {
  const promise = getDb();
  if (!promise) return null;
  const db = await promise;
  const stored = (await db.get(SETTINGS_STORE, LLM_API_KEY)) as string | undefined;
  return stored ?? null;
}

export async function clearApiKey(): Promise<boolean> {
  const promise = getDb();
  if (!promise) return false;
  const db = await promise;
  await db.delete(SETTINGS_STORE, LLM_API_KEY);
  return true;
}
