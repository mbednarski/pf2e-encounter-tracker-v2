/**
 * Pure helpers for the in-game clock. The clock is stored as a single integer:
 * total minutes elapsed since the start of Day 1 at 00:00. Days are 1-based for
 * display, so 0 minutes reads as "Day 1 · 00:00". The value is clamped at 0 — the
 * clock never runs before the start of the campaign's first day.
 */

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** Step sizes for the increment/decrement buttons, in minutes. */
export const STEP_TEN_MINUTES = 10;
export const STEP_HOUR = MINUTES_PER_HOUR;
export const STEP_DAY = MINUTES_PER_DAY;

export interface GameClockParts {
  /** 1-based day number (Day 1 is the first day). */
  day: number;
  /** Hour of day, 0–23. */
  hour: number;
  /** Minute of hour, 0–59. */
  minute: number;
}

/** Clamps to a non-negative whole number of minutes. Non-finite input becomes 0. */
export function clampClock(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.round(minutes));
}

/** Adds a (possibly negative) step and clamps the result at 0. */
export function stepClock(minutes: number, delta: number): number {
  return clampClock(clampClock(minutes) + delta);
}

export function toParts(minutes: number): GameClockParts {
  const total = clampClock(minutes);
  const day = Math.floor(total / MINUTES_PER_DAY) + 1;
  const rem = total % MINUTES_PER_DAY;
  return {
    day,
    hour: Math.floor(rem / MINUTES_PER_HOUR),
    minute: rem % MINUTES_PER_HOUR
  };
}

/**
 * Combines day/hour/minute into total minutes. Day is clamped to at least 1;
 * hour and minute are clamped to their valid ranges so out-of-range inputs from
 * a manual edit can't produce a negative or malformed clock.
 */
export function fromParts(parts: GameClockParts): number {
  const day = Math.max(1, Math.floor(parts.day) || 1);
  const hour = Math.min(23, Math.max(0, Math.floor(parts.hour) || 0));
  const minute = Math.min(59, Math.max(0, Math.floor(parts.minute) || 0));
  return (day - 1) * MINUTES_PER_DAY + hour * MINUTES_PER_HOUR + minute;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Formats the clock as "Day N · HH:MM" for display. */
export function formatGameClock(minutes: number): string {
  const { day, hour, minute } = toParts(minutes);
  return `Day ${day} · ${pad(hour)}:${pad(minute)}`;
}
