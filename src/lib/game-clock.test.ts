import { describe, expect, it } from 'vitest';
import {
  clampClock,
  formatGameClock,
  fromParts,
  stepClock,
  toParts,
  MINUTES_PER_DAY,
  STEP_DAY,
  STEP_HOUR,
  STEP_TEN_MINUTES
} from './game-clock';

describe('clampClock', () => {
  it('floors at zero', () => {
    expect(clampClock(-5)).toBe(0);
  });

  it('rounds to whole minutes', () => {
    expect(clampClock(10.6)).toBe(11);
  });

  it('treats non-finite input as zero', () => {
    expect(clampClock(NaN)).toBe(0);
    expect(clampClock(Infinity)).toBe(0);
  });
});

describe('toParts / fromParts', () => {
  it('reads zero minutes as Day 1, 00:00', () => {
    expect(toParts(0)).toEqual({ day: 1, hour: 0, minute: 0 });
  });

  it('splits a multi-day value', () => {
    const minutes = 2 * MINUTES_PER_DAY + 14 * 60 + 30;
    expect(toParts(minutes)).toEqual({ day: 3, hour: 14, minute: 30 });
  });

  it('round-trips through fromParts', () => {
    const parts = { day: 4, hour: 9, minute: 45 };
    expect(toParts(fromParts(parts))).toEqual(parts);
  });

  it('clamps out-of-range parts when combining', () => {
    expect(fromParts({ day: 0, hour: 99, minute: -3 })).toBe(23 * 60);
  });
});

describe('stepClock', () => {
  it('advances by the given step', () => {
    expect(stepClock(0, STEP_TEN_MINUTES)).toBe(10);
    expect(stepClock(0, STEP_HOUR)).toBe(60);
    expect(stepClock(0, STEP_DAY)).toBe(MINUTES_PER_DAY);
  });

  it('never drops below zero', () => {
    expect(stepClock(5, -STEP_HOUR)).toBe(0);
  });
});

describe('formatGameClock', () => {
  it('pads hours and minutes', () => {
    expect(formatGameClock(0)).toBe('Day 1 · 00:00');
    expect(formatGameClock(9 * 60 + 5)).toBe('Day 1 · 09:05');
  });

  it('formats later days', () => {
    expect(formatGameClock(MINUTES_PER_DAY + 60)).toBe('Day 2 · 01:00');
  });
});
