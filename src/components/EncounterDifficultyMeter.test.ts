import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { EncounterXPSummary } from '../domain';
import EncounterDifficultyMeter from './EncounterDifficultyMeter.svelte';

function summary(overrides: Partial<EncounterXPSummary> = {}): EncounterXPSummary {
  return {
    partyLevel: 3,
    partySize: 4,
    enemyCount: 2,
    totalXP: 80,
    difficulty: 'Moderate',
    thresholds: { trivial: 40, low: 60, moderate: 80, severe: 120, extreme: 160 },
    xpAward: 80,
    hasOutOfRange: false,
    contributions: [],
    ...overrides
  };
}

describe('EncounterDifficultyMeter — visibility gate', () => {
  test('hides entirely when there are no enemies', () => {
    const { container } = render(EncounterDifficultyMeter, {
      props: { summary: summary({ enemyCount: 0, difficulty: null }) }
    });
    expect(container.querySelector('section.meter')).toBeNull();
  });

  test('shows the empty hint when there are enemies but no party level', () => {
    render(EncounterDifficultyMeter, {
      props: {
        summary: summary({
          partyLevel: null,
          thresholds: null,
          difficulty: null,
          xpAward: 0,
          totalXP: 40,
          enemyCount: 1
        })
      }
    });
    expect(
      screen.getByText('Add party members to compute encounter difficulty.')
    ).toBeInTheDocument();
  });
});

describe('EncounterDifficultyMeter — main render', () => {
  test('renders the difficulty label in the difficulty slot', () => {
    const { container } = render(EncounterDifficultyMeter, {
      props: { summary: summary({ difficulty: 'Severe', totalXP: 120, xpAward: 120 }) }
    });
    expect(container.querySelector('.meter__difficulty')).toHaveTextContent('Severe');
  });

  test('renders the total budget XP and awarded XP in their respective slots', () => {
    const { container } = render(EncounterDifficultyMeter, {
      props: { summary: summary({ totalXP: 95, xpAward: 60 }) }
    });
    const numbers = container.querySelectorAll('.meter__number .meter__value');
    // Two number slots: Budget (totalXP) and Awarded to party (xpAward), in that order.
    expect(numbers[0]).toHaveTextContent('95');
    expect(numbers[1]).toHaveTextContent('60');
  });

  test('renders the party meta line with level and size', () => {
    render(EncounterDifficultyMeter, {
      props: { summary: summary({ partyLevel: 5, partySize: 4 }) }
    });
    expect(screen.getByText('Party L5')).toBeInTheDocument();
    expect(screen.getByText('4 PC')).toBeInTheDocument();
  });

  test('renders one band per difficulty tier', () => {
    const { container } = render(EncounterDifficultyMeter, {
      props: { summary: summary() }
    });
    expect(container.querySelectorAll('.meter__zone').length).toBe(5);
  });

  test('marks the current band with the --current modifier class', () => {
    const { container } = render(EncounterDifficultyMeter, {
      props: { summary: summary({ difficulty: 'Severe', totalXP: 120 }) }
    });
    const current = container.querySelector('.meter__zone--current');
    expect(current).not.toBeNull();
    expect(current?.classList.contains('meter__zone--severe')).toBe(true);
  });
});

describe('EncounterDifficultyMeter — out-of-range and overflow', () => {
  test('appends * to the difficulty label and renders the note when hasOutOfRange', () => {
    const { container } = render(EncounterDifficultyMeter, {
      props: { summary: summary({ hasOutOfRange: true, difficulty: 'Moderate' }) }
    });
    expect(container.querySelector('.meter__difficulty')).toHaveTextContent('Moderate*');
    expect(screen.getByText(/clamped to 160/i)).toBeInTheDocument();
  });

  test('omits the out-of-range note when hasOutOfRange is false', () => {
    render(EncounterDifficultyMeter, {
      props: { summary: summary({ hasOutOfRange: false }) }
    });
    expect(screen.queryByText(/clamped to 160/i)).not.toBeInTheDocument();
  });

  test('shows totalXP + "+" suffix when total exceeds the extreme*1.25 ceiling', () => {
    render(EncounterDifficultyMeter, {
      props: {
        summary: summary({
          totalXP: 300,
          difficulty: 'Extreme',
          thresholds: { trivial: 40, low: 60, moderate: 80, severe: 120, extreme: 160 }
        })
      }
    });
    expect(screen.getByText('300+')).toBeInTheDocument();
  });
});
