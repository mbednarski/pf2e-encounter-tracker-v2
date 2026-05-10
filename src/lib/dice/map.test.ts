import { describe, expect, test } from 'vitest';
import { mapVariants } from './map';

describe('mapVariants', () => {
  test('non-agile attack: +0 / -5 / -10', () => {
    expect(mapVariants(15, ['shove'])).toEqual([
      { step: 0, label: '1st', modifier: 15 },
      { step: 1, label: '2nd', modifier: 10 },
      { step: 2, label: '3rd', modifier: 5 }
    ]);
  });

  test('agile attack: +0 / -4 / -8', () => {
    expect(mapVariants(15, ['agile'])).toEqual([
      { step: 0, label: '1st', modifier: 15 },
      { step: 1, label: '2nd', modifier: 11 },
      { step: 2, label: '3rd', modifier: 7 }
    ]);
  });

  test('agile detection is case-insensitive', () => {
    expect(mapVariants(10, ['Agile'])[1].modifier).toBe(6);
    expect(mapVariants(10, ['AGILE'])[2].modifier).toBe(2);
  });

  test('handles empty traits as non-agile', () => {
    expect(mapVariants(8, [])).toEqual([
      { step: 0, label: '1st', modifier: 8 },
      { step: 1, label: '2nd', modifier: 3 },
      { step: 2, label: '3rd', modifier: -2 }
    ]);
  });

  test('propagates negative base modifiers correctly', () => {
    expect(mapVariants(-2, ['agile'])).toEqual([
      { step: 0, label: '1st', modifier: -2 },
      { step: 1, label: '2nd', modifier: -6 },
      { step: 2, label: '3rd', modifier: -10 }
    ]);
  });
});
