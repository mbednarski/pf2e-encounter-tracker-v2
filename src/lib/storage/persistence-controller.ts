import type { EncounterState } from '../../domain/types';

export interface PersistenceControllerOptions {
  load: () => Promise<EncounterState | null>;
  save: (state: EncounterState) => Promise<void>;
  clear: () => Promise<void>;
  onRestoreFailed?: () => void;
  onPersistFailed?: () => void;
}

export interface PersistenceController {
  restore(): Promise<EncounterState | null>;
  persist(state: EncounterState): void;
  reset(): void;
}

export function createPersistenceController(
  options: PersistenceControllerOptions
): PersistenceController {
  let persistWarned = false;

  function notifyPersistFailure(err: unknown) {
    console.error('Failed to persist encounter', err);
    if (persistWarned) return;
    persistWarned = true;
    options.onPersistFailed?.();
  }

  return {
    async restore() {
      try {
        return await options.load();
      } catch (err) {
        console.error('Failed to restore encounter', err);
        options.onRestoreFailed?.();
        return null;
      }
    },
    persist(state: EncounterState) {
      const op =
        state.phase === 'COMPLETED' ? options.clear() : options.save(state);
      op.catch(notifyPersistFailure);
    },
    reset() {
      options.clear().catch(notifyPersistFailure);
    }
  };
}
