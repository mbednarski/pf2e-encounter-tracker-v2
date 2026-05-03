/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sampleYaml from '../../../docs/sample-creatures.yaml?raw';
import { importCreatureYaml } from '../yaml';
import {
  addCreatures,
  clearCreatures,
  loadCreatures
} from './creature-library';

beforeEach(async () => {
  await clearCreatures();
});

afterEach(async () => {
  await clearCreatures();
});

describe('docs/sample-creatures.yaml', () => {
  it('parses cleanly through importCreatureYaml with no validation issues', () => {
    const result = importCreatureYaml(sampleYaml);
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.creatures.map((c) => c.id).sort()).toEqual([
      'cave-wolf',
      'goblin-warrior',
      'skeleton-guard'
    ]);
  });

  it('seeds an empty library with three creatures via the import flow', async () => {
    const { creatures } = importCreatureYaml(sampleYaml);
    const persistResult = await addCreatures(creatures);

    expect(persistResult.persisted).toBe(true);
    expect(persistResult.added.map((c) => c.id).sort()).toEqual([
      'cave-wolf',
      'goblin-warrior',
      'skeleton-guard'
    ]);
    expect(persistResult.rejected).toEqual([]);

    const stored = await loadCreatures();
    expect(stored.map((c) => c.id).sort()).toEqual([
      'cave-wolf',
      'goblin-warrior',
      'skeleton-guard'
    ]);
  });

  it('re-importing the sample after seed produces dedupe rejections, not duplicates', async () => {
    const { creatures } = importCreatureYaml(sampleYaml);

    await addCreatures(creatures);
    const second = await addCreatures(creatures);

    expect(second.added).toEqual([]);
    expect(second.rejected.map((c) => c.id).sort()).toEqual([
      'cave-wolf',
      'goblin-warrior',
      'skeleton-guard'
    ]);
    expect((await loadCreatures()).length).toBe(3);
  });
});
