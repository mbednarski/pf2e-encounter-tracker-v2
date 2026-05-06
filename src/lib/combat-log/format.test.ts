import { describe, expect, test } from 'vitest';
import { formatEvent, formatEvents } from './format';
import type { DomainEvent, EncounterState } from '../../domain';
import { newEncounterState } from '../encounter-app';

function stateWith(partial: Partial<EncounterState['combatants']>): EncounterState {
  return {
    ...newEncounterState(),
    combatants: partial as EncounterState['combatants']
  };
}

const goblinAndFighter = stateWith({
  'goblin-1': makeCombatant('goblin-1', 'Goblin Warrior'),
  'fighter-1': makeCombatant('fighter-1', 'Fighter')
});

function makeCombatant(id: string, name: string) {
  return {
    id,
    creatureId: `${id}-creature`,
    name,
    sourceType: 'creature' as const,
    baseStats: { hp: 10, ac: 15, fortitude: 5, reflex: 5, will: 5, perception: 5, speed: 25, skills: {} },
    currentHp: 10,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: []
  };
}

function fmt(event: DomainEvent, state: EncounterState = goblinAndFighter) {
  return formatEvent(event, { commandId: 'cmd-1', index: 0, state });
}

describe('formatEvent — exhaustive over DomainEvent', () => {
  test('encounter lifecycle events', () => {
    expect(fmt({ type: 'encounter-started' })).toMatchObject({ message: 'Encounter started.', tone: 'success' });
    expect(fmt({ type: 'encounter-completed' })).toMatchObject({ message: 'Encounter completed.', tone: 'success' });
    expect(fmt({ type: 'encounter-reset' })).toMatchObject({ message: 'Encounter reset.', tone: 'info' });
    expect(fmt({ type: 'phase-changed', from: 'PREPARING', to: 'ACTIVE' })).toMatchObject({
      message: 'Phase: PREPARING → ACTIVE.',
      tone: 'info'
    });
    expect(fmt({ type: 'round-started', round: 3 })).toMatchObject({ message: 'Round 3 started.' });
    expect(fmt({ type: 'all-combatants-dead' })).toMatchObject({
      message: 'All combatants are down.',
      tone: 'danger'
    });
  });

  test('combatant lifecycle events', () => {
    expect(
      fmt({ type: 'combatant-added', combatantId: 'goblin-1', name: 'Goblin Warrior', sourceType: 'creature' })
    ).toMatchObject({ message: 'Goblin Warrior joined the encounter.' });
    expect(
      fmt({ type: 'combatant-removed', combatantId: 'gone-1', name: 'Removed Mob' })
    ).toMatchObject({ message: 'Removed Mob removed from the encounter.' });
    expect(
      fmt({ type: 'combatant-renamed', combatantId: 'goblin-1', oldName: 'Goblin', newName: 'Goblin Boss' })
    ).toMatchObject({ message: 'Goblin renamed to Goblin Boss.' });
  });

  test('initiative + turn events resolve names from state', () => {
    expect(fmt({ type: 'initiative-set', order: ['goblin-1', 'fighter-1'] })).toMatchObject({
      message: 'Initiative order: Goblin Warrior, Fighter.'
    });
    expect(fmt({ type: 'initiative-changed', combatantId: 'fighter-1', newIndex: 0 })).toMatchObject({
      message: 'Fighter moved to position 1 in the order.'
    });
    expect(fmt({ type: 'combatant-delayed', combatantId: 'goblin-1' })).toMatchObject({
      message: 'Goblin Warrior is delaying.'
    });
    expect(
      fmt({ type: 'combatant-resumed-from-delay', combatantId: 'goblin-1', insertIndex: 1 })
    ).toMatchObject({ message: 'Goblin Warrior resumed from delay.' });
    expect(fmt({ type: 'turn-started', combatantId: 'goblin-1', round: 2 })).toMatchObject({
      message: "Goblin Warrior's turn (round 2)."
    });
    expect(fmt({ type: 'turn-ended', combatantId: 'fighter-1' })).toMatchObject({
      message: 'Fighter ended their turn.'
    });
  });

  test('death and revival events', () => {
    expect(fmt({ type: 'combatant-died', combatantId: 'goblin-1', cause: 'marked-dead' })).toMatchObject({
      message: 'Goblin Warrior died.',
      tone: 'danger'
    });
    expect(
      fmt({ type: 'combatant-died', combatantId: 'fighter-1', cause: 'dying-threshold' })
    ).toMatchObject({
      message: 'Fighter died (dying threshold reached).',
      tone: 'danger'
    });
    expect(fmt({ type: 'combatant-revived', combatantId: 'fighter-1' })).toMatchObject({
      message: 'Fighter revived.',
      tone: 'success'
    });
  });

  test('reaction events: manual reset logs, auto reset is suppressed', () => {
    expect(fmt({ type: 'reaction-used', combatantId: 'goblin-1' })).toMatchObject({
      message: 'Goblin Warrior used a reaction.'
    });
    expect(fmt({ type: 'reaction-reset', combatantId: 'goblin-1', cause: 'manual' })).toMatchObject({
      message: 'Goblin Warrior reaction reset.'
    });
    expect(fmt({ type: 'reaction-reset', combatantId: 'goblin-1', cause: 'auto' })).toBeNull();
  });

  test('note-changed: looks up post-state to differentiate updated vs cleared', () => {
    const withNote = stateWith({
      'goblin-1': { ...makeCombatant('goblin-1', 'Goblin Warrior'), notes: 'Watch the door.' },
      'fighter-1': makeCombatant('fighter-1', 'Fighter')
    });
    expect(fmt({ type: 'note-changed', combatantId: 'goblin-1' }, withNote)).toMatchObject({
      message: 'Goblin Warrior note updated.'
    });
    expect(fmt({ type: 'note-changed', combatantId: 'goblin-1' }, goblinAndFighter)).toMatchObject({
      message: 'Goblin Warrior note cleared.'
    });
  });

  test('effect lifecycle events', () => {
    expect(
      fmt({
        type: 'effect-applied',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'inst-1',
        value: 2
      })
    ).toMatchObject({ message: 'Fighter gained Frightened 2.' });

    expect(
      fmt({
        type: 'effect-applied',
        combatantId: 'fighter-1',
        effectId: 'unconscious',
        effectName: 'Unconscious',
        instanceId: 'inst-2',
        parentInstanceId: 'inst-1'
      })
    ).toMatchObject({ message: 'Fighter gained Unconscious (implied).' });

    expect(
      fmt({
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'inst-1',
        reason: 'expired'
      })
    ).toMatchObject({ message: 'Fighter lost Frightened (expired).' });

    expect(
      fmt({
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'unconscious',
        effectName: 'Unconscious',
        instanceId: 'inst-2',
        reason: 'cascade'
      })
    ).toMatchObject({ message: 'Fighter lost Unconscious (cascade).' });

    expect(
      fmt({
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'inst-1',
        reason: 'auto-decremented'
      })
    ).toMatchObject({ message: 'Fighter lost Frightened (decremented).' });

    expect(
      fmt({
        type: 'effect-removed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'inst-1',
        reason: 'removed'
      })
    ).toMatchObject({ message: 'Fighter lost Frightened.' });

    expect(
      fmt({
        type: 'effect-value-changed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'inst-1',
        from: 2,
        to: 1
      })
    ).toMatchObject({ message: 'Fighter Frightened: 2 → 1.' });

    expect(
      fmt({
        type: 'effect-duration-changed',
        combatantId: 'fighter-1',
        effectId: 'frightened',
        effectName: 'Frightened',
        instanceId: 'inst-1'
      })
    ).toMatchObject({ message: 'Fighter Frightened duration changed.' });
  });

  test('prompt events', () => {
    expect(
      fmt({
        type: 'prompt-generated',
        promptId: 'p-1',
        boundary: { type: 'turnEnd', ownerId: 'fighter-1' },
        targetId: 'fighter-1',
        effectInstanceId: 'inst-1',
        effectName: 'Frightened',
        suggestionType: 'suggestDecrement',
        description: 'decrease by 1'
      })
    ).toMatchObject({ message: 'Prompt: Fighter Frightened — decrease by 1.' });

    expect(
      fmt({ type: 'prompt-resolved', promptId: 'p-1', resolution: { type: 'accept' } })
    ).toMatchObject({ message: 'Prompt resolved: accepted.' });
    expect(
      fmt({ type: 'prompt-resolved', promptId: 'p-1', resolution: { type: 'dismiss' } })
    ).toMatchObject({ message: 'Prompt resolved: dismissed.' });
    expect(
      fmt({ type: 'prompt-resolved', promptId: 'p-1', resolution: { type: 'remove' } })
    ).toMatchObject({ message: 'Prompt resolved: removed effect.' });
    expect(
      fmt({ type: 'prompt-resolved', promptId: 'p-1', resolution: { type: 'setValue', value: 3 } })
    ).toMatchObject({ message: 'Prompt resolved: set to 3.' });
  });

  test('hp-changed: damage / healing / set / set-temp', () => {
    expect(
      fmt({
        type: 'hp-changed',
        combatantId: 'goblin-1',
        hpFrom: 10,
        hpTo: 3,
        tempHpFrom: 0,
        tempHpTo: 0,
        cause: 'damage'
      })
    ).toMatchObject({ message: 'Goblin Warrior took 7 damage.', tone: 'danger' });

    expect(
      fmt({
        type: 'hp-changed',
        combatantId: 'goblin-1',
        hpFrom: 10,
        hpTo: 5,
        tempHpFrom: 3,
        tempHpTo: 0,
        cause: 'damage',
        damageType: 'fire'
      })
    ).toMatchObject({ message: 'Goblin Warrior took 8 fire damage.', tone: 'danger' });

    expect(
      fmt({
        type: 'hp-changed',
        combatantId: 'goblin-1',
        hpFrom: 3,
        hpTo: 8,
        tempHpFrom: 0,
        tempHpTo: 0,
        cause: 'healing'
      })
    ).toMatchObject({ message: 'Goblin Warrior healed 5 HP.', tone: 'success' });

    expect(
      fmt({
        type: 'hp-changed',
        combatantId: 'goblin-1',
        hpFrom: 3,
        hpTo: 10,
        tempHpFrom: 0,
        tempHpTo: 0,
        cause: 'set'
      })
    ).toMatchObject({ message: 'Goblin Warrior HP set to 10.' });

    expect(
      fmt({
        type: 'hp-changed',
        combatantId: 'goblin-1',
        hpFrom: 10,
        hpTo: 10,
        tempHpFrom: 0,
        tempHpTo: 5,
        cause: 'set-temp'
      })
    ).toMatchObject({ message: 'Goblin Warrior temp HP set to 5.' });
  });

  test('hp-reached-zero', () => {
    expect(fmt({ type: 'hp-reached-zero', combatantId: 'fighter-1' })).toMatchObject({
      message: 'Fighter dropped to 0 HP.',
      tone: 'danger'
    });
  });

  test('command-rejected', () => {
    expect(
      fmt({ type: 'command-rejected', commandType: 'START_ENCOUNTER', reason: 'requires at least 2 combatants' })
    ).toMatchObject({
      message: 'START_ENCOUNTER rejected: requires at least 2 combatants.',
      tone: 'danger'
    });
  });

  test('falls back to combatantId when name is unknown', () => {
    const empty = newEncounterState();
    expect(fmt({ type: 'turn-started', combatantId: 'ghost', round: 1 }, empty)).toMatchObject({
      message: "ghost's turn (round 1)."
    });
  });
});

describe('formatEvents — batch with stable ids', () => {
  test('returns one entry per event, indexed by position, drops nulls', () => {
    const events: DomainEvent[] = [
      { type: 'turn-ended', combatantId: 'goblin-1' },
      { type: 'reaction-reset', combatantId: 'fighter-1', cause: 'auto' },
      { type: 'turn-started', combatantId: 'fighter-1', round: 2 }
    ];
    const result = formatEvents(events, { commandId: 'cmd-end-turn', state: goblinAndFighter });
    expect(result.map((e) => e.id)).toEqual(['cmd-end-turn-0', 'cmd-end-turn-2']);
    expect(result.map((e) => e.message)).toEqual([
      'Goblin Warrior ended their turn.',
      "Fighter's turn (round 2)."
    ]);
  });
});
