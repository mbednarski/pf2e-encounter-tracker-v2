import type { SpellIndexEntry, SpellIndexFile } from './types';

export type SpellIndexState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; lookup: (slug: string) => SpellIndexEntry | undefined }
  | { status: 'unavailable' };

let inflight: Promise<SpellIndexState> | null = null;
let cached: SpellIndexState = { status: 'idle' };

export async function ensureSpellIndex(): Promise<SpellIndexState> {
  if (cached.status === 'ready' || cached.status === 'unavailable') {
    return cached;
  }
  if (inflight) return inflight;

  inflight = (async (): Promise<SpellIndexState> => {
    try {
      const res = await fetch('/spell-index.json');
      if (!res.ok) {
        cached = { status: 'unavailable' };
        return cached;
      }
      const payload = (await res.json()) as SpellIndexFile;
      const bySlug = new Map(payload.spells.map((s) => [s.slug, s]));
      cached = {
        status: 'ready',
        lookup: (slug: string) => bySlug.get(slug)
      };
      return cached;
    } catch (err) {
      console.warn('spell-index: failed to load', err);
      cached = { status: 'unavailable' };
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function __resetForTests(): void {
  cached = { status: 'idle' };
  inflight = null;
}

export { resolveAtLevel } from './resolve';
export type {
  SpellActionCost,
  SpellDefense,
  SpellHeightening,
  SpellIndexEntry,
  SpellIndexFile,
  SpellLevelData,
  SpellTradition
} from './types';
