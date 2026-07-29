import { stringify } from 'yaml';
import type { EncounterState } from '../../domain';

export function serializeEncounterYaml(state: EncounterState): string {
  return stringify(
    {
      kind: 'encounter',
      schemaVersion: 2,
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
  return `${slug || 'encounter'}.yaml`;
}
