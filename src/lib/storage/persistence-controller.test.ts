import { describe, expect, it, vi } from 'vitest';
import {
  activeEncounter,
  completedEncounter,
  preparingEncounter
} from '../../domain/test-support';
import { createPersistenceController } from './persistence-controller';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeDeps(overrides: Partial<{
  load: () => Promise<ReturnType<typeof activeEncounter> | null>;
  save: (state: ReturnType<typeof activeEncounter>) => Promise<void>;
  clear: () => Promise<void>;
}> = {}) {
  return {
    load: overrides.load ?? vi.fn().mockResolvedValue(null),
    save: overrides.save ?? vi.fn().mockResolvedValue(undefined),
    clear: overrides.clear ?? vi.fn().mockResolvedValue(undefined)
  };
}

describe('createPersistenceController', () => {
  describe('persist', () => {
    it('saves non-COMPLETED states', async () => {
      const deps = makeDeps();
      const controller = createPersistenceController(deps);
      const state = activeEncounter();

      controller.persist(state);
      await flush();

      expect(deps.save).toHaveBeenCalledWith(state);
      expect(deps.clear).not.toHaveBeenCalled();
    });

    it('clears COMPLETED states instead of saving', async () => {
      const deps = makeDeps();
      const controller = createPersistenceController(deps);

      controller.persist(completedEncounter());
      await flush();

      expect(deps.clear).toHaveBeenCalledOnce();
      expect(deps.save).not.toHaveBeenCalled();
    });

    it('saves PREPARING states (not just ACTIVE)', async () => {
      const deps = makeDeps();
      const controller = createPersistenceController(deps);
      const state = preparingEncounter();

      controller.persist(state);
      await flush();

      expect(deps.save).toHaveBeenCalledWith(state);
    });

    it('fires onPersistFailed once on save rejection', async () => {
      const onPersistFailed = vi.fn();
      const deps = makeDeps({
        save: vi.fn().mockRejectedValue(new Error('quota'))
      });
      const controller = createPersistenceController({ ...deps, onPersistFailed });

      controller.persist(activeEncounter());
      controller.persist(activeEncounter());
      controller.persist(activeEncounter());
      await flush();

      expect(onPersistFailed).toHaveBeenCalledOnce();
    });

    it('fires onPersistFailed when COMPLETED clear rejects', async () => {
      const onPersistFailed = vi.fn();
      const deps = makeDeps({
        clear: vi.fn().mockRejectedValue(new Error('blocked'))
      });
      const controller = createPersistenceController({ ...deps, onPersistFailed });

      controller.persist(completedEncounter());
      await flush();

      expect(onPersistFailed).toHaveBeenCalledOnce();
    });

    it('does not throw to the caller when save rejects', () => {
      const deps = makeDeps({
        save: vi.fn().mockRejectedValue(new Error('boom'))
      });
      const controller = createPersistenceController(deps);

      expect(() => controller.persist(activeEncounter())).not.toThrow();
    });
  });

  describe('reset', () => {
    it('clears storage', async () => {
      const deps = makeDeps();
      const controller = createPersistenceController(deps);

      controller.reset();
      await flush();

      expect(deps.clear).toHaveBeenCalledOnce();
      expect(deps.save).not.toHaveBeenCalled();
    });

    it('fires onPersistFailed when clear rejects', async () => {
      const onPersistFailed = vi.fn();
      const deps = makeDeps({
        clear: vi.fn().mockRejectedValue(new Error('blocked'))
      });
      const controller = createPersistenceController({ ...deps, onPersistFailed });

      controller.reset();
      await flush();

      expect(onPersistFailed).toHaveBeenCalledOnce();
    });
  });

  describe('restore', () => {
    it('returns null when storage is empty', async () => {
      const deps = makeDeps();
      const controller = createPersistenceController(deps);

      expect(await controller.restore()).toBeNull();
    });

    it('returns the loaded state', async () => {
      const state = activeEncounter();
      const deps = makeDeps({ load: vi.fn().mockResolvedValue(state) });
      const controller = createPersistenceController(deps);

      expect(await controller.restore()).toBe(state);
    });

    it('returns null and fires onRestoreFailed on load rejection', async () => {
      const onRestoreFailed = vi.fn();
      const deps = makeDeps({
        load: vi.fn().mockRejectedValue(new Error('corrupt'))
      });
      const controller = createPersistenceController({ ...deps, onRestoreFailed });

      expect(await controller.restore()).toBeNull();
      expect(onRestoreFailed).toHaveBeenCalledOnce();
    });

    it('does not gate onRestoreFailed by the persist warn-once flag', async () => {
      const onRestoreFailed = vi.fn();
      const onPersistFailed = vi.fn();
      const deps = makeDeps({
        load: vi.fn().mockRejectedValue(new Error('corrupt')),
        save: vi.fn().mockRejectedValue(new Error('quota'))
      });
      const controller = createPersistenceController({
        ...deps,
        onRestoreFailed,
        onPersistFailed
      });

      controller.persist(activeEncounter());
      await flush();
      await controller.restore();

      expect(onPersistFailed).toHaveBeenCalledOnce();
      expect(onRestoreFailed).toHaveBeenCalledOnce();
    });
  });
});
