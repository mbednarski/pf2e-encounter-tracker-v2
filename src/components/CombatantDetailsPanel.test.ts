import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { combatant } from '../domain/test-support';
import type { CombatantState } from '../domain';
import CombatantDetailsPanel from './CombatantDetailsPanel.svelte';

function renderPanel(c: CombatantState | undefined, props: Record<string, unknown> = {}) {
  return render(CombatantDetailsPanel, {
    props: {
      combatant: c,
      onSetNote: vi.fn(),
      ...props
    }
  });
}

describe('CombatantDetailsPanel', () => {
  test('renders empty state when combatant is undefined', () => {
    renderPanel(undefined);
    expect(screen.getByText('Select a combatant to see details.')).toBeInTheDocument();
  });

  test('renders header with name and no template badge by default', () => {
    renderPanel(combatant('goblin-1', { name: 'Goblin Warrior' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Goblin Warrior' })).toBeInTheDocument();
    expect(screen.queryByText(/Elite|Weak|Normal/)).not.toBeInTheDocument();
  });

  test('renders Elite badge when templateAdjustment is elite', () => {
    renderPanel(combatant('goblin-1', { name: 'Goblin', templateAdjustment: 'elite' }));
    expect(screen.getByText('Elite')).toBeInTheDocument();
  });

  test('renders defenses block with HP, AC, saves, perception, speed', () => {
    renderPanel(
      combatant('goblin-1', {
        currentHp: 12,
        tempHp: 0,
        baseStats: {
          hp: 18,
          ac: 17,
          fortitude: 5,
          reflex: 7,
          will: 3,
          perception: 6,
          speed: 25,
          skills: {}
        }
      })
    );

    const defenses = screen.getByLabelText('Defenses');
    expect(defenses).toHaveTextContent('12');
    expect(defenses).toHaveTextContent('/18');
    expect(defenses).toHaveTextContent('17');
    expect(defenses).toHaveTextContent('+5');
    expect(defenses).toHaveTextContent('+7');
    expect(defenses).toHaveTextContent('+3');
    expect(defenses).toHaveTextContent('+6');
    expect(defenses).toHaveTextContent('25 ft');
  });

  test('shows temp HP only when greater than zero', () => {
    const { unmount } = renderPanel(combatant('goblin-1', { tempHp: 5 }));
    expect(screen.getByText(/\+5 temp/)).toBeInTheDocument();
    unmount();

    renderPanel(combatant('goblin-2', { tempHp: 0 }));
    expect(screen.queryByText(/temp/)).not.toBeInTheDocument();
  });

  test('omits attacks section when combatant has no attacks', () => {
    renderPanel(combatant('goblin-1', { attacks: [] }));
    expect(screen.queryByLabelText('Attacks')).not.toBeInTheDocument();
  });

  test('renders attacks with name, type, and three MAP buttons', () => {
    renderPanel(
      combatant('goblin-1', {
        attacks: [
          {
            name: 'Longsword',
            type: 'melee',
            modifier: 12,
            traits: [],
            damage: [{ dice: 1, dieSize: 8, bonus: 3, type: 'slashing' }]
          }
        ]
      })
    );
    const attacks = screen.getByLabelText('Attacks');
    expect(attacks).toHaveTextContent('Longsword');
    expect(attacks).toHaveTextContent('melee');
    expect(screen.getByRole('button', { name: 'Roll Longsword 1st attack (+12)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Longsword 2nd attack (+7)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Longsword 3rd attack (+2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Longsword damage (1d8+3 slashing)' })).toBeInTheDocument();
  });

  test('agile attack uses -4/-8 MAP', () => {
    renderPanel(
      combatant('goblin-1', {
        attacks: [
          {
            name: 'Claw',
            type: 'melee',
            modifier: 15,
            traits: ['agile'],
            damage: [{ dice: 2, dieSize: 4, bonus: 8, type: 'slashing' }]
          }
        ]
      })
    );
    expect(screen.getByRole('button', { name: 'Roll Claw 2nd attack (+11)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Claw 3rd attack (+7)' })).toBeInTheDocument();
  });

  test('clicking attack button forwards onRollAttack with combatant id, variant, and click origin', async () => {
    const onRollAttack = vi.fn();
    renderPanel(
      combatant('spinesnapper', {
        attacks: [
          { name: 'Maul', type: 'melee', modifier: 15, traits: [], damage: [] }
        ]
      }),
      { onRollAttack }
    );
    const second = screen.getByRole('button', { name: 'Roll Maul 2nd attack (+10)' });
    second.click();
    expect(onRollAttack).toHaveBeenCalledTimes(1);
    expect(onRollAttack.mock.calls[0][0]).toBe('spinesnapper');
    expect(onRollAttack.mock.calls[0][1].name).toBe('Maul');
    expect(onRollAttack.mock.calls[0][2]).toMatchObject({ step: 1, modifier: 10 });
    expect(onRollAttack.mock.calls[0][3]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  test('clicking damage button forwards onRollDamage with the attack and click origin', () => {
    const onRollDamage = vi.fn();
    renderPanel(
      combatant('spinesnapper', {
        attacks: [
          {
            name: 'Maul',
            type: 'melee',
            modifier: 15,
            traits: [],
            damage: [{ dice: 1, dieSize: 12, bonus: 10, type: 'bludgeoning' }]
          }
        ]
      }),
      { onRollDamage }
    );
    const dmg = screen.getByRole('button', { name: 'Roll Maul damage (1d12+10 bludgeoning)' });
    dmg.click();
    expect(onRollDamage).toHaveBeenCalledTimes(1);
    expect(onRollDamage.mock.calls[0][0]).toBe('spinesnapper');
    expect(onRollDamage.mock.calls[0][1].name).toBe('Maul');
    expect(onRollDamage.mock.calls[0][2]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  test('omits each ability sub-section when its array is empty', () => {
    renderPanel(combatant('goblin-1'));
    expect(screen.queryByLabelText('Passive Abilities')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reactive Abilities')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Active Abilities')).not.toBeInTheDocument();
  });

  test('renders all three ability sub-sections when populated', () => {
    renderPanel(
      combatant('goblin-1', {
        passiveAbilities: [{ name: 'Darkvision', description: 'Sees in dark.' }],
        reactiveAbilities: [
          { name: 'Attack of Opportunity', description: 'Strike on trigger.', trigger: 'A foe moves.' }
        ],
        activeAbilities: [{ name: 'Brutal Charge', description: 'Charge and strike.', actions: 2 }]
      })
    );

    const passive = screen.getByLabelText('Passive Abilities');
    expect(passive).toHaveTextContent('Darkvision');
    expect(passive).toHaveTextContent('Sees in dark.');

    const reactive = screen.getByLabelText('Reactive Abilities');
    expect(reactive).toHaveTextContent('Attack of Opportunity');
    expect(reactive).toHaveTextContent('Trigger:');
    expect(reactive).toHaveTextContent('A foe moves.');

    const active = screen.getByLabelText('Active Abilities');
    expect(active).toHaveTextContent('Brutal Charge');
    // Action cost now rendered as glyph; the aria-label/title carries the readable form
    expect(active.querySelector('[title="2 actions"]')).not.toBeNull();
  });

  test('renders degree-of-success outcomes in their own labeled rows', () => {
    renderPanel(
      combatant('spinesnapper', {
        activeAbilities: [
          {
            name: 'Brutal Blow',
            actions: 2,
            description:
              'The spinesnapper makes a Strike. If it hits, attempt a DC 22 Fortitude save.\n' +
              'Critical Success The creature is unaffected.\n' +
              'Success The creature is unaffected.\n' +
              'Failure The creature is pushed 10 feet.\n' +
              'Critical Failure The target is pushed 10 feet and knocked prone.'
          }
        ]
      })
    );
    const active = screen.getByLabelText('Active Abilities');
    expect(active).toHaveTextContent('Critical Success');
    expect(active).toHaveTextContent('The target is pushed 10 feet and knocked prone.');
  });

  test('omits spellcasting section when combatant has none', () => {
    renderPanel(combatant('fighter-1'));
    expect(screen.queryByLabelText('Spellcasting')).not.toBeInTheDocument();
  });

  test('renders spellcasting block with slot pips that fire onUseSpellSlot', () => {
    const onUseSpellSlot = vi.fn();
    renderPanel(
      combatant('yaashka', {
        spellcasting: [
          {
            blockId: 'b1',
            name: 'Divine Prepared',
            tradition: 'divine',
            type: 'prepared',
            dc: 24,
            slots: { 3: 2 },
            entries: [{ spellSlug: 'harm', name: 'Harm', level: 3 }]
          }
        ]
      }),
      { onUseSpellSlot }
    );
    const sc = screen.getByLabelText('Spellcasting');
    expect(sc).toHaveTextContent('Divine Prepared');
    expect(sc).toHaveTextContent('Harm');
    const useBtn = screen.getAllByRole('button', { name: 'Use a 3rd-rank slot' })[0];
    useBtn.click();
    expect(onUseSpellSlot).toHaveBeenCalledWith('yaashka', 'b1', 3);
  });

  test('renders innate spellcasting with a repeated spell slug and stays in sync on rerender', async () => {
    // PF2e creatures can list the same innate spell at more than one rank (heightened
    // separately). Keying the spell list by slug used to throw `each_key_duplicate`,
    // which aborted the rest of the panel update and left stale content (e.g. the name).
    const caster = combatant('archmage', {
      name: 'Archmage',
      spellcasting: [
        {
          blockId: 'arcane-innate',
          name: 'Arcane Innate',
          tradition: 'arcane',
          type: 'innate',
          dc: 30,
          attackModifier: 22,
          entries: [
            { spellSlug: 'charm', name: 'Charm', level: 5, frequency: { type: 'atWill' } },
            { spellSlug: 'charm', name: 'Charm', level: 4, frequency: { type: 'atWill' } }
          ]
        }
      ]
    });

    const { rerender } = renderPanel(caster);
    expect(screen.getByRole('heading', { level: 2, name: 'Archmage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Spellcasting')).toHaveTextContent('Charm');

    await rerender({ combatant: combatant('goblin-1', { name: 'Goblin Sneak' }), onSetNote: vi.fn() });
    expect(screen.getByRole('heading', { level: 2, name: 'Goblin Sneak' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Spellcasting')).not.toBeInTheDocument();
  });

  test('renders existing notes inside the Notes section', () => {
    renderPanel(combatant('goblin-1', { notes: 'Hiding behind the cart.' }));
    const notes = screen.getByLabelText('Notes');
    expect(notes).toHaveTextContent('Hiding behind the cart.');
  });

  test('renders the Add note placeholder when combatant has no notes', () => {
    renderPanel(combatant('goblin-1'));
    const notes = screen.getByLabelText('Notes');
    expect(notes).toHaveTextContent('Add note…');
  });

  test('committing a note forwards onSetNote with the combatant id', async () => {
    const onSetNote = vi.fn();
    renderPanel(combatant('goblin-1', { notes: '' }), { onSetNote });
    const placeholder = screen.getByRole('button', { name: 'Edit note' });
    placeholder.click();
    const textarea = await screen.findByRole('textbox', { name: 'Edit note' });
    (textarea as HTMLTextAreaElement).value = 'Watch the door.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent('blur'));
    expect(onSetNote).toHaveBeenCalledTimes(1);
    expect(onSetNote).toHaveBeenCalledWith('goblin-1', 'Watch the door.');
  });
});
