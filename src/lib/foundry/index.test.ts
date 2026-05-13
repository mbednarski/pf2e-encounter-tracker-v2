import { describe, expect, test } from 'vitest';
import aasimarRedeemerJson from './fixtures/aasimar-redeemer.json?raw';
import airMephitJson from './fixtures/air-mephit.json?raw';
import banditJson from './fixtures/bandit.json?raw';
import barbazuJson from './fixtures/barbazu.json?raw';
import bloodseekerJson from './fixtures/bloodseeker.json?raw';
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

    expect(c.immunities.length).toBeGreaterThan(0);
    expect(typeof c.immunities[0]).toBe('object');
    expect(c.immunities.map((im) => im.type)).toEqual(
      expect.arrayContaining(['bleed', 'paralyzed', 'poison', 'sleep'])
    );

    expect(c.abilities).toBeDefined();
    expect(c.abilities!.dex).toBe(4);

    expect(c.senses).toBeDefined();
    expect(c.senses!.some((s) => s.type === 'darkvision')).toBe(true);

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

  test('imports the aasimar-redeemer fixture and surfaces both spellcasting blocks', () => {
    const result = importCreatureFoundryJson(aasimarRedeemerJson);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    const c = result.creatures[0]!;
    expect(c.name).toBe('Aasimar Redeemer');

    expect(c.spellcasting).toBeDefined();
    expect(c.spellcasting!.length).toBeGreaterThanOrEqual(2);
    const traditions = c.spellcasting!.map((b) => b.tradition);
    expect(traditions).toEqual(expect.arrayContaining(['divine']));
    const types = c.spellcasting!.map((b) => b.type);
    expect(types).toEqual(expect.arrayContaining(['innate', 'focus']));

    const focusBlock = c.spellcasting!.find((b) => b.type === 'focus');
    expect(focusBlock).toBeDefined();
    expect(focusBlock!.entries.some((e) => /lay on hands/i.test(e.name))).toBe(true);
  });

  test('imports the barbazu fixture with a free action and innate spellcasting', () => {
    const result = importCreatureFoundryJson(barbazuJson);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    const c = result.creatures[0]!;
    expect(c.name).toBe('Barbazu');
    expect(c.size).toBe('medium');

    const reposition = c.reactiveAbilities.find((a) => a.name === 'Reposition');
    expect(reposition).toBeDefined();
    expect(reposition!.actions).toBe('free');

    expect(c.languages).toBeDefined();
    expect(c.languages!.value.length).toBeGreaterThan(0);

    expect(c.spellcasting).toBeDefined();
    expect(c.spellcasting!.some((b) => b.type === 'innate')).toBe(true);
  });

  test('imports the bloodseeker fixture (tiny creature)', () => {
    const result = importCreatureFoundryJson(bloodseekerJson);
    expect(result.skipped).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.creatures).toHaveLength(1);
    const c = result.creatures[0]!;
    expect(c.name).toBe('Bloodseeker');
    expect(c.size).toBe('tiny');

    expect(c.attacks.some((a) => a.name === 'Barbed Leg')).toBe(true);

    expect(c.senses).toBeDefined();
    const senseTypes = c.senses!.map((s) => s.type);
    expect(senseTypes).toEqual(expect.arrayContaining(['darkvision', 'scent']));

    const allAbilityNames = [
      ...c.passiveAbilities,
      ...c.reactiveAbilities,
      ...c.activeAbilities
    ].map((a) => a.name);
    expect(allAbilityNames).toEqual(expect.arrayContaining(['Attach', 'Blood Drain']));
  });
});
