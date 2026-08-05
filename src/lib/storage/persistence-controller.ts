import type { EncounterState } from '../../domain/types';

export interface PersistenceControllerOptions {
  load: () => Promise<EncounterState | null>;
  save: (state: EncounterState) => Promise<void>;
  clear: () => Promise<void>;
  onRestoreFailed?: () => void;
  onPersistFailed?: () => void;
  onClearFailed?: () => void;
}

export interface PersistenceController {
  restore(): Promise<EncounterState | null>;
  persist(state: EncounterState): void;
  reset(): Promise<boolean>;
}

export function createPersistenceController(
  options: PersistenceControllerOptions
): PersistenceController {
  let persistWarned = false;
  let operationQueue: Promise<void> = Promise.resolve();

  function notifyPersistFailure(err: unknown) {
    console.error('Failed to persist encounter', err);
    if (persistWarned) return;
    persistWarned = true;
    options.onPersistFailed?.();
  }

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = operationQueue.then(operation);
    // Let later writes continue even after an earlier IndexedDB operation
    // fails. Each caller handles its own rejection.
    operationQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
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
      void enqueue(() => options.save(state)).catch(notifyPersistFailure);
    },
    async reset() {
      try {
        await enqueue(options.clear);
        return true;
      } catch (err) {
        console.error('Failed to clear active encounter', err);
        options.onClearFailed?.();
        return false;
      }
    }
  };
}
