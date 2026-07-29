import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { activeEncounter } from '../../domain/test-support';
import { encounterExportFilename, serializeEncounterYaml } from './encounter-export';

describe('encounter YAML export', () => {
  test('wraps the full encounter in the canonical versioned envelope', () => {
    const state = activeEncounter({ name: 'Bridge at Dusk' });

    expect(parse(serializeEncounterYaml(state))).toEqual({
      kind: 'encounter',
      schemaVersion: 2,
      data: state
    });
  });

  test.each([
    ['Bridge at Dusk', 'bridge-at-dusk.yaml'],
    ['  Żółty Smok!  ', 'zolty-smok.yaml'],
    ['***', 'encounter.yaml']
  ])('turns %j into a safe download name', (name, expected) => {
    expect(encounterExportFilename(name)).toBe(expected);
  });
});
