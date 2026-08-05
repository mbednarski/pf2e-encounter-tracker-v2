import type { CombatantId, Duration, EffectDurationSpec } from '../types';

const ROUNDS_PER_MINUTE = 10;

/**
 * Converts a spell effect's declarative default duration into a concrete
 * `Duration` anchored to the caster. Rounds and minutes become auto-ticking
 * anchored round counts; hours and longer outlast any encounter and map to
 * `unlimited`.
 */
export function durationFromSpec(
  spec: EffectDurationSpec | undefined,
  anchorId: CombatantId
): Duration {
  if (!spec) {
    return { type: 'unlimited' };
  }

  switch (spec.unit) {
    case 'rounds':
    case 'minutes': {
      const value = spec.value ?? 1;
      if (value <= 0) {
        return { type: 'unlimited' };
      }
      const count = spec.unit === 'minutes' ? value * ROUNDS_PER_MINUTE : value;
      return { type: 'rounds', count, anchorId, expiry: spec.expiry ?? 'turnStart' };
    }
    case 'hours':
    case 'days':
    case 'unlimited':
      return { type: 'unlimited' };
  }
}
