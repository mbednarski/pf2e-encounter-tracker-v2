import { describe, expect, test } from 'vitest';
import {
  activeEncounter,
  completedEncounter,
  expectSerializable,
  preparingEncounter,
  resolvingEncounter
} from './test-support';
import type { EncounterPhase, EncounterState } from './types';

describe('domain test-support fixtures', () => {
  test.each<[string, EncounterPhase, () => EncounterState]>([
    ['preparingEncounter', 'PREPARING', preparingEncounter],
    ['activeEncounter', 'ACTIVE', activeEncounter],
    ['resolvingEncounter', 'RESOLVING', resolvingEncounter],
    ['completedEncounter', 'COMPLETED', completedEncounter]
  ])('%s builds a serializable encounter state', (_name, phase, buildFixture) => {
    const state = buildFixture();

    expect(state.phase).toBe(phase);
    expect(Object.keys(state.combatants)).toEqual(['goblin-1', 'fighter-1']);
    expect(state.initiative.order).toEqual(['goblin-1', 'fighter-1']);
    expectSerializable(state);
  });
});
