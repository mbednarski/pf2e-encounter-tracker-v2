import { describe, expect, test } from 'vitest';
import { completedEncounter } from '../../domain/test-support';
import { exportEncounterYaml, importEncounterYaml } from './encounter';

describe('encounter YAML', () => {
  test('round-trips encounter state and imports it into PREPARING', () => {
    const source = completedEncounter({
      name: 'Clockwork Vault',
      combatants: {
        ...completedEncounter().combatants,
        'goblin-1': {
          ...completedEncounter().combatants['goblin-1'],
          currentHp: 7,
          tempHp: 3,
          notes: 'Retreats at 5 HP',
          templateAdjustment: 'elite'
        }
      },
      initiative: {
        order: ['fighter-1', 'goblin-1'],
        currentIndex: 1,
        scores: { 'fighter-1': 24, 'goblin-1': 18 }
      }
    });

    const result = importEncounterYaml(exportEncounterYaml(source));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.name).toBe('Clockwork Vault');
    expect(result.state.phase).toBe('PREPARING');
    expect(result.state.round).toBe(0);
    expect(result.state.initiative.order).toEqual(['fighter-1', 'goblin-1']);
    expect(result.state.initiative.scores).toEqual({ 'fighter-1': 24, 'goblin-1': 18 });
    expect(result.state.combatants['goblin-1']).toMatchObject({
      currentHp: 7,
      tempHp: 3,
      notes: 'Retreats at 5 HP',
      templateAdjustment: 'elite'
    });
  });

  test('reports actionable field paths and returns no partial state', () => {
    const yaml = exportEncounterYaml(completedEncounter()).replace('currentHp: 20', 'currentHp: nope');
    const result = importEncounterYaml(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('currentHp') })
      ])
    );
  });

  test('rejects non-encounter documents', () => {
    const result = importEncounterYaml('kind: creature\nschemaVersion: 1\ndata: {}\n');
    expect(result.ok).toBe(false);
  });
});
