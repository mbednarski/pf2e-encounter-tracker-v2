import { stringify } from 'yaml';
import type { CombatantState, EncounterState } from '../../domain';
import { parseYamlEnvelopes, type ValidationIssue } from './envelope';

export const ENCOUNTER_SCHEMA_VERSION = 1;

export type EncounterImportResult =
  | { ok: true; state: EncounterState; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

export function exportEncounterYaml(state: EncounterState): string {
  return stringify(
    {
      kind: 'encounter',
      schemaVersion: ENCOUNTER_SCHEMA_VERSION,
      data: state
    },
    { lineWidth: 0 }
  );
}

export function encounterExportFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'encounter'}.encounter.yaml`;
}

export function importEncounterYaml(text: string): EncounterImportResult {
  const parsed = parseYamlEnvelopes(text);
  const issues = [...parsed.issues];
  const encounterDocuments = parsed.envelopes.filter((envelope) => envelope.kind === 'encounter');

  if (encounterDocuments.length !== 1) {
    issues.push({
      documentIndex: 0,
      path: 'kind',
      message:
        encounterDocuments.length === 0
          ? 'Expected one encounter document'
          : 'Import exactly one encounter document at a time'
    });
  }

  for (const envelope of parsed.envelopes) {
    if (envelope.kind !== 'encounter') {
      issues.push({
        documentIndex: envelope.documentIndex,
        path: 'kind',
        message: `Expected kind "encounter", received "${envelope.kind}"`
      });
    }
  }

  const envelope = encounterDocuments[0];
  if (!envelope || issues.length > 0) return { ok: false, issues };
  if (envelope.schemaVersion !== ENCOUNTER_SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [{
        documentIndex: envelope.documentIndex,
        path: 'schemaVersion',
        message: `Encounter schema ${envelope.schemaVersion} is not supported; expected ${ENCOUNTER_SCHEMA_VERSION}`
      }]
    };
  }

  const validation = validateEncounterState(envelope.data, envelope.documentIndex);
  if (validation.issues.length > 0 || !validation.state) {
    return { ok: false, issues: validation.issues };
  }
  return {
    ok: true,
    state: {
      ...validation.state,
      phase: 'PREPARING',
      round: 0,
      initiative: { ...validation.state.initiative, currentIndex: -1 },
      pendingPrompts: [],
      turnResolution: undefined
    },
    issues: []
  };
}

function validateEncounterState(
  value: unknown,
  documentIndex: number
): { state?: EncounterState; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ documentIndex, path, message });
  if (!isObject(value)) {
    add('data', 'Encounter data must be a mapping');
    return { issues };
  }

  stringField(value, 'id', 'data.id', add);
  stringField(value, 'name', 'data.name', add);
  if (!['PREPARING', 'ACTIVE', 'RESOLVING', 'COMPLETED'].includes(String(value.phase))) {
    add('data.phase', 'Expected PREPARING, ACTIVE, RESOLVING, or COMPLETED');
  }
  numberField(value, 'round', 'data.round', add);
  if (!isObject(value.initiative)) add('data.initiative', 'Initiative must be a mapping');
  if (!isObject(value.combatants)) add('data.combatants', 'Combatants must be a mapping');
  if (!Array.isArray(value.pendingPrompts)) add('data.pendingPrompts', 'Expected an array');
  if (!Array.isArray(value.combatLog)) add('data.combatLog', 'Expected an array');
  if (!Array.isArray(value.recentEffectIds)) add('data.recentEffectIds', 'Expected an array');

  const combatants = isObject(value.combatants) ? value.combatants : {};
  for (const [id, raw] of Object.entries(combatants)) {
    validateCombatant(raw, id, `data.combatants.${id}`, add);
  }

  if (isObject(value.initiative)) {
    const initiative = value.initiative;
    if (!Array.isArray(initiative.order) || !initiative.order.every((id) => typeof id === 'string')) {
      add('data.initiative.order', 'Expected an array of combatant IDs');
    } else {
      const seen = new Set<string>();
      initiative.order.forEach((id, index) => {
        if (seen.has(id)) add(`data.initiative.order.${index}`, `Duplicate combatant ID "${id}"`);
        if (!(id in combatants)) add(`data.initiative.order.${index}`, `Unknown combatant ID "${id}"`);
        seen.add(id);
      });
    }
    numberField(initiative, 'currentIndex', 'data.initiative.currentIndex', add);
    if (!isObject(initiative.scores)) {
      add('data.initiative.scores', 'Scores must be a mapping');
    } else {
      for (const [id, score] of Object.entries(initiative.scores)) {
        if (!(id in combatants)) add(`data.initiative.scores.${id}`, `Unknown combatant ID "${id}"`);
        if (typeof score !== 'number' || !Number.isFinite(score)) {
          add(`data.initiative.scores.${id}`, 'Expected a finite number');
        }
      }
    }
  }

  if (issues.length > 0) return { issues };
  return { state: value as unknown as EncounterState, issues };
}

function validateCombatant(
  value: unknown,
  key: string,
  path: string,
  add: (path: string, message: string) => void
) {
  if (!isObject(value)) {
    add(path, 'Combatant must be a mapping');
    return;
  }
  if (value.id !== key) add(`${path}.id`, `Expected ID to match key "${key}"`);
  stringField(value, 'name', `${path}.name`, add);
  stringField(value, 'sourceId', `${path}.sourceId`, add);
  if (!['creature', 'partyMember', 'companion', 'hazard'].includes(String(value.sourceType))) {
    add(`${path}.sourceType`, 'Expected creature, partyMember, companion, or hazard');
  }
  if (!isObject(value.baseSnapshot)) {
    add(`${path}.baseSnapshot`, 'Base snapshot must be a mapping');
  } else {
    for (const field of ['level', 'hp', 'ac', 'fortitude', 'reflex', 'will', 'perception', 'speed']) {
      numberField(value.baseSnapshot, field, `${path}.baseSnapshot.${field}`, add);
    }
    if (!isObject(value.baseSnapshot.skills)) add(`${path}.baseSnapshot.skills`, 'Skills must be a mapping');
  }
  for (const field of ['currentHp', 'tempHp']) numberField(value, field, `${path}.${field}`, add);
  for (const field of ['isAlive', 'reactionUsedThisRound']) {
    if (typeof value[field] !== 'boolean') add(`${path}.${field}`, 'Expected a boolean');
  }
  for (const field of ['appliedEffects', 'attacks', 'passiveAbilities', 'reactiveAbilities', 'activeAbilities']) {
    if (!Array.isArray(value[field])) add(`${path}.${field}`, 'Expected an array');
  }
}

function stringField(
  object: Record<string, unknown>,
  field: string,
  path: string,
  add: (path: string, message: string) => void
) {
  if (typeof object[field] !== 'string' || object[field] === '') add(path, 'Expected a non-empty string');
}

function numberField(
  object: Record<string, unknown>,
  field: string,
  path: string,
  add: (path: string, message: string) => void
) {
  const value = object[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) add(path, 'Expected a finite number');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
