import { describe, expect, test } from 'vitest';
import { validatePartyMember } from './party-member-validator';

function minimalRaw() {
  return {
    id: 'aric',
    name: 'Aric',
    level: 3,
    ac: 18,
    fortitude: 7,
    reflex: 8,
    will: 6,
    perception: 7,
    hp: 32,
    tags: [],
    companionIds: [],
    persistentEffects: []
  };
}

describe('validatePartyMember — happy path', () => {
  test('returns ok with the minimal required fields and no issues', () => {
    const result = validatePartyMember(minimalRaw(), 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issues).toEqual([]);
    expect(result.value.id).toBe('aric');
    expect(result.value.persistentEffects).toEqual([]);
  });

  test('passes through optional string fields when provided', () => {
    const result = validatePartyMember(
      { ...minimalRaw(), playerName: 'Mateusz', ancestry: 'Elf', class: 'Wizard', notes: 'Hi.' },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.playerName).toBe('Mateusz');
    expect(result.value.ancestry).toBe('Elf');
    expect(result.value.class).toBe('Wizard');
    expect(result.value.notes).toBe('Hi.');
  });

  test('passes through speed and skills records when provided', () => {
    const result = validatePartyMember(
      { ...minimalRaw(), speed: { land: 30, fly: 20 }, skills: { arcana: 12 } },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.speed).toEqual({ land: 30, fly: 20 });
    expect(result.value.skills).toEqual({ arcana: 12 });
  });

  test('passes through resistances and weaknesses arrays', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        resistances: [{ type: 'cold', value: 5 }],
        weaknesses: [{ type: 'fire', value: 10 }]
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resistances).toEqual([{ type: 'cold', value: 5 }]);
    expect(result.value.weaknesses).toEqual([{ type: 'fire', value: 10 }]);
  });

  test('passes through immunities when provided', () => {
    const result = validatePartyMember({ ...minimalRaw(), immunities: ['sleep'] }, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.immunities).toEqual(['sleep']);
  });
});

describe('validatePartyMember — required-field rejection', () => {
  test('rejects when the raw value is not an object', () => {
    const result = validatePartyMember('not an object', 0);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain('must be a mapping');
    expect(result.issues[0].documentIndex).toBe(0);
  });

  test('rejects when id is empty', () => {
    const result = validatePartyMember({ ...minimalRaw(), id: '   ' }, 1);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'id' && i.message.includes('must not be empty')))
      .toBe(true);
    expect(result.issues.every((i) => i.documentIndex === 1)).toBe(true);
  });

  test('rejects when level is below 1', () => {
    const result = validatePartyMember({ ...minimalRaw(), level: 0 }, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'level' && i.message.includes('>= 1'))).toBe(true);
  });

  test('rejects when a defensive stat is negative', () => {
    const result = validatePartyMember({ ...minimalRaw(), ac: -1 }, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'ac' && i.message.includes('>= 0'))).toBe(true);
  });

  test('rejects when level is not a finite number', () => {
    const result = validatePartyMember({ ...minimalRaw(), level: 'three' }, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'level')).toBe(true);
  });

  test('rejects when tags is not a string array', () => {
    const result = validatePartyMember({ ...minimalRaw(), tags: ['ok', 7] }, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'tags')).toBe(true);
  });

  test('rejects when persistentEffects is missing', () => {
    const raw = minimalRaw() as Record<string, unknown>;
    delete raw.persistentEffects;
    const result = validatePartyMember(raw, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'persistentEffects')).toBe(true);
  });

  test('rejects when an optional record field has a non-numeric entry', () => {
    const result = validatePartyMember({ ...minimalRaw(), speed: { land: 'fast' } }, 0);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'speed.land')).toBe(true);
  });
});

describe('validatePartyMember — persistentEffects', () => {
  test('accepts an effect with value, note, parentInstanceId, and default duration unlimited', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [
          {
            instanceId: 'p1',
            effectId: 'frightened',
            value: 2,
            note: 'failed save',
            parentInstanceId: 'aura-1'
          }
        ]
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.persistentEffects[0]).toEqual({
      instanceId: 'p1',
      effectId: 'frightened',
      duration: { type: 'unlimited' },
      value: 2,
      note: 'failed save',
      parentInstanceId: 'aura-1'
    });
  });

  test('accepts a rounds duration', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [
          {
            instanceId: 'p1',
            effectId: 'haste',
            duration: { type: 'rounds', count: 3 }
          }
        ]
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.persistentEffects[0].duration).toEqual({ type: 'rounds', count: 3 });
  });

  test('accepts a conditional duration with description', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [
          {
            instanceId: 'p1',
            effectId: 'blessed',
            duration: { type: 'conditional', description: 'until you sleep' }
          }
        ]
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.persistentEffects[0].duration).toEqual({
      type: 'conditional',
      description: 'until you sleep'
    });
  });

  test('accepts untilTurnEnd duration with combatantId', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [
          {
            instanceId: 'p1',
            effectId: 'flat-footed',
            duration: { type: 'untilTurnEnd', combatantId: 'goblin-1' }
          }
        ]
      },
      0
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.persistentEffects[0].duration).toEqual({
      type: 'untilTurnEnd',
      combatantId: 'goblin-1'
    });
  });

  test('rejects an unknown duration type', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [
          { instanceId: 'p1', effectId: 'oddly', duration: { type: 'forever' } }
        ]
      },
      0
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.path === 'persistentEffects[0].duration.type')
    ).toBe(true);
  });

  test('rejects when instanceId is missing or empty', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [{ instanceId: '', effectId: 'frightened' }]
      },
      0
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.path === 'persistentEffects[0].instanceId')
    ).toBe(true);
  });

  test('rejects when a persistent effect entry is not an object', () => {
    const result = validatePartyMember(
      { ...minimalRaw(), persistentEffects: ['not an object'] },
      0
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'persistentEffects[0]')).toBe(true);
  });

  test('rejects when value field is non-numeric', () => {
    const result = validatePartyMember(
      {
        ...minimalRaw(),
        persistentEffects: [{ instanceId: 'p1', effectId: 'frightened', value: 'two' }]
      },
      0
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'persistentEffects[0].value')).toBe(true);
  });
});
