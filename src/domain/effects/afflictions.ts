import type { AfflictionData, EffectDefinition } from '../types';

/**
 * Affliction display + validation helpers (afflictions spec §6, §10).
 * Reminder-only subsystem: no commands or events of its own — these helpers
 * feed the UI and importers; the reducer treats afflictions as plain effects.
 */

/**
 * Stage description for the current value (spec §6.1): value N shows
 * stages[N-1]; values past the highest defined stage clamp to the last stage;
 * value 0 or below has no stage text (recovery removes the effect anyway).
 */
export function afflictionStageDescription(
  definition: EffectDefinition,
  value: number | undefined
): string | undefined {
  const stages = definition.afflictionData?.stages;
  if (!stages || stages.length === 0) return undefined;
  const stageValue = value ?? 1;
  if (stageValue <= 0) return undefined;
  const index = Math.min(stageValue, stages.length) - 1;
  return stages[index].description;
}

/** Save line for display: "Fortitude DC 18" plus a virulent marker. */
export function afflictionSaveLabel(data: AfflictionData): string {
  const type = data.saveType.charAt(0).toUpperCase() + data.saveType.slice(1);
  return `${type} DC ${data.saveDC}${data.virulent ? ' (virulent)' : ''}`;
}

/**
 * Save-outcome deltas for MODIFY_EFFECT_VALUE (spec §5.2/§5.3). Virulent
 * afflictions recover more slowly: crit success −1, success no change.
 */
export function afflictionSaveDeltas(data: AfflictionData): {
  critSuccess: number;
  success: number;
  failure: number;
  critFailure: number;
} {
  return data.virulent
    ? { critSuccess: -1, success: 0, failure: 1, critFailure: 2 }
    : { critSuccess: -2, success: -1, failure: 1, critFailure: 2 };
}

const SAVE_TYPES: ReadonlySet<string> = new Set(['fortitude', 'reflex', 'will']);

/**
 * Structural validation for affliction definitions (spec §10, error-severity
 * rules only). Returns human-readable problems; empty means valid. Importers
 * and library authors call this — the reducer never does.
 */
export function afflictionDataIssues(definition: EffectDefinition): string[] {
  const issues: string[] = [];
  const data = definition.afflictionData;

  if (definition.category === 'affliction') {
    if (!data) {
      issues.push('category "affliction" requires afflictionData');
      return issues;
    }
  } else if (data) {
    issues.push(`afflictionData is only valid on category "affliction" (got "${definition.category}")`);
    return issues;
  } else {
    return issues;
  }

  if (!SAVE_TYPES.has(data.saveType)) {
    issues.push('afflictionData.saveType must be one of: fortitude, reflex, will');
  }
  if (!Number.isInteger(data.saveDC) || data.saveDC < 0) {
    issues.push('afflictionData.saveDC must be an integer >= 0');
  }
  if (typeof data.interval !== 'string' || data.interval.trim() === '') {
    issues.push('afflictionData.interval must be a non-empty string');
  }
  if (!Array.isArray(data.stages) || data.stages.length === 0) {
    issues.push('afflictionData.stages must be non-empty');
  } else {
    data.stages.forEach((stage, i) => {
      if (!Number.isInteger(stage.stage)) {
        issues.push(`afflictionData.stages[${i}].stage must be an integer`);
      } else if (stage.stage !== i + 1) {
        issues.push(`afflictionData.stages[${i}].stage must be ${i + 1} (stages are 1-indexed and contiguous)`);
      }
      if (typeof stage.description !== 'string' || stage.description.trim() === '') {
        issues.push(`afflictionData.stages[${i}].description must be a non-empty string`);
      }
    });
  }

  return issues;
}
