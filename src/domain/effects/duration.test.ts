import { describe, expect, test } from 'vitest';
import { durationFromSpec } from './duration';

describe('durationFromSpec', () => {
  test('defaults to unlimited without a spec', () => {
    expect(durationFromSpec(undefined, 'bard-1')).toEqual({ type: 'unlimited' });
  });

  test('maps rounds to anchored auto-ticking rounds with turnStart expiry', () => {
    expect(durationFromSpec({ unit: 'rounds', value: 1, expiry: 'turnStart' }, 'bard-1')).toEqual({
      type: 'rounds',
      count: 1,
      anchorId: 'bard-1',
      expiry: 'turnStart'
    });
  });

  test('keeps an explicit turnEnd expiry', () => {
    expect(durationFromSpec({ unit: 'rounds', value: 2, expiry: 'turnEnd' }, 'bard-1')).toEqual({
      type: 'rounds',
      count: 2,
      anchorId: 'bard-1',
      expiry: 'turnEnd'
    });
  });

  test('converts minutes to rounds at 10 rounds per minute', () => {
    expect(durationFromSpec({ unit: 'minutes', value: 1 }, 'bard-1')).toEqual({
      type: 'rounds',
      count: 10,
      anchorId: 'bard-1',
      expiry: 'turnStart'
    });
  });

  test('maps hours, days, and unlimited to unlimited', () => {
    expect(durationFromSpec({ unit: 'hours', value: 8 }, 'bard-1')).toEqual({ type: 'unlimited' });
    expect(durationFromSpec({ unit: 'days', value: 1 }, 'bard-1')).toEqual({ type: 'unlimited' });
    expect(durationFromSpec({ unit: 'unlimited' }, 'bard-1')).toEqual({ type: 'unlimited' });
  });

  test('treats non-positive values as unlimited', () => {
    expect(durationFromSpec({ unit: 'rounds', value: 0 }, 'bard-1')).toEqual({ type: 'unlimited' });
  });
});
