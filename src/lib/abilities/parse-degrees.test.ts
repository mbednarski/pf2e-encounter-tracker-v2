import { describe, expect, test } from 'vitest';
import { parseDegrees } from './parse-degrees';

describe('parseDegrees', () => {
  test('parses Brutal Blow with all four outcomes', () => {
    const text =
      'The spinesnapper makes a claw or weapon Strike. If it hits, in addition to dealing damage, the creature must attempt a DC 22 Fortitude saving throw, with the following effects.\n' +
      'Critical Success The creature is unaffected and the spinesnapper is flat-footed until the start of its next turn.\n' +
      'Success The creature is unaffected.\n' +
      'Failure The creature is pushed 10 feet.\n' +
      'Critical Failure The target is pushed 10 feet and knocked prone.';

    const result = parseDegrees(text);

    expect(result.preface).toMatch(/^The spinesnapper makes/);
    expect(result.preface).toMatch(/with the following effects\.$/);
    expect(result.outcomes).toHaveLength(4);
    expect(result.outcomes[0]).toEqual({
      degree: 'critSuccess',
      text: 'The creature is unaffected and the spinesnapper is flat-footed until the start of its next turn.'
    });
    expect(result.outcomes[1]).toEqual({ degree: 'success', text: 'The creature is unaffected.' });
    expect(result.outcomes[2]).toEqual({ degree: 'failure', text: 'The creature is pushed 10 feet.' });
    expect(result.outcomes[3]).toEqual({
      degree: 'critFailure',
      text: 'The target is pushed 10 feet and knocked prone.'
    });
  });

  test('returns empty outcomes when no degree labels appear', () => {
    const text =
      '30 feet. A creature that enters the aura must attempt a DC 21 Fortitude save. On a failure, the creature is sickened 1.';
    const result = parseDegrees(text);
    expect(result.preface).toBe(text);
    expect(result.outcomes).toEqual([]);
  });

  test('does not split mid-prose "failure" inside a sentence', () => {
    const text = 'On a failure, the creature is sickened 1, and on a critical failure, the creature also takes a -5 penalty.';
    const result = parseDegrees(text);
    expect(result.outcomes).toEqual([]);
    expect(result.preface).toBe(text);
  });

  test('handles outcomes separated by colons', () => {
    const text =
      'The target attempts a Reflex save.\nCritical Success: Unaffected.\nSuccess: Half damage.\nFailure: Full damage.\nCritical Failure: Double damage.';
    const result = parseDegrees(text);
    expect(result.outcomes.map((o) => o.degree)).toEqual([
      'critSuccess',
      'success',
      'failure',
      'critFailure'
    ]);
    expect(result.outcomes[0].text).toBe('Unaffected.');
    expect(result.outcomes[3].text).toBe('Double damage.');
  });

  test('empty input returns empty preface and outcomes', () => {
    expect(parseDegrees('')).toEqual({ preface: '', outcomes: [] });
  });
});
