import { describe, expect, test } from 'vitest';
import airMephitJson from './fixtures/air-mephit.json?raw';
import banditJson from './fixtures/bandit.json?raw';
import seaDevilScoutJson from './fixtures/sea-devil-scout.json?raw';
import { importCreatureFoundryJson } from './index';

describe('importCreatureFoundryJson', () => {
  test('returns a JSON parse issue on malformed input', () => {
    const result = importCreatureFoundryJson('{ this is not json');
    expect(result.creatures).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toMatch(/JSON parse error/);
  });

  test('returns an issue for non-NPC documents', () => {
    const result = importCreatureFoundryJson(JSON.stringify({ name: 'Sword', type: 'weapon' }));
    expect(result.creatures).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toMatch(/npc/i);
  });

  test('imports the air-mephit fixture and produces a valid Creature', () => {
    const result = importCreatureFoundryJson(airMephitJson);

    expect(result.skipped).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);

    const c = result.creatures[0]!;
    expect(c.id).toBe('air-mephit');
    expect(c.name).toBe('Air Mephit');
    expect(c.level).toBe(1);
    expect(c.ac).toBe(16);
    expect(c.hp).toBe(12);
    expect(c.size).toBe('small');
    expect(c.speed.land).toBe(20);
    expect(c.speed.fly).toBe(40);

    // immunities arrive as objects, not strings.
    expect(c.immunities.length).toBeGreaterThan(0);
    expect(typeof c.immunities[0]).toBe('object');
    expect(c.immunities.map((im) => im.type)).toEqual(
      expect.arrayContaining(['bleed', 'paralyzed', 'poison', 'sleep'])
    );

    // ability scores closed the backlog gap.
    expect(c.abilities).toBeDefined();
    expect(c.abilities!.dex).toBe(4);

    // senses present.
    expect(c.senses).toBeDefined();
    expect(c.senses!.some((s) => s.type === 'darkvision')).toBe(true);

    // has at least the claw attack with parsed damage.
    expect(c.attacks.length).toBeGreaterThan(0);
    const claw = c.attacks.find((a) => a.name === 'Claw');
    expect(claw).toBeDefined();
    expect(claw!.modifier).toBe(9);
    expect(claw!.damage[0]).toMatchObject({
      dice: 1,
      dieSize: 6,
      bonus: 1,
      type: 'slashing'
    });

    // spellcasting block was synthesized.
    expect(c.spellcasting).toBeDefined();
    expect(c.spellcasting!.length).toBeGreaterThanOrEqual(1);
    const block = c.spellcasting![0]!;
    expect(block.tradition).toBe('arcane');
    expect(block.type).toBe('innate');
    expect(block.dc).toBe(17);
    expect(block.entries.some((e) => e.name === 'Blur')).toBe(true);
    expect(block.entries.some((e) => e.name === 'Gust of Wind')).toBe(true);
  });

  test('imports the bandit fixture (humanoid with no spellcasting)', () => {
    const result = importCreatureFoundryJson(banditJson);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    const c = result.creatures[0]!;
    expect(c.name).toBe('Bandit');
    expect(c.id).toBe('bandit');
    expect(c.abilities).toBeDefined();
    expect(Array.isArray(c.immunities)).toBe(true);
  });

  test('imports the sea-devil-scout fixture', () => {
    const result = importCreatureFoundryJson(seaDevilScoutJson);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    const c = result.creatures[0]!;
    expect(c.name).toBe('Sea Devil Scout');
    expect(c.id).toBe('sea-devil-scout');
  });
});
