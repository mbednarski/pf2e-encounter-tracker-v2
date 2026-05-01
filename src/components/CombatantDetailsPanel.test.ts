import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { combatant } from '../domain/test-support';
import type { CombatantState } from '../domain';
import CombatantDetailsPanel from './CombatantDetailsPanel.svelte';

function renderPanel(c: CombatantState | undefined, onSetNote = vi.fn()) {
  return render(CombatantDetailsPanel, { props: { combatant: c, onSetNote } });
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

  test('renders attacks with name, type, modifier, and damage', () => {
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
    expect(attacks).toHaveTextContent('(melee)');
    expect(attacks).toHaveTextContent('+12');
    expect(attacks).toHaveTextContent('1d8+3 slashing');
  });

  test('renders multi-component damage with persistent suffix and bonus-only piece', () => {
    renderPanel(
      combatant('flame-drake-1', {
        attacks: [
          {
            name: 'Bite',
            type: 'melee',
            modifier: 14,
            traits: ['fire'],
            damage: [
              { dice: 2, dieSize: 8, bonus: 4, type: 'piercing' },
              { dice: 1, dieSize: 6, type: 'fire', persistent: true },
              { bonus: 2, type: 'precision' }
            ]
          }
        ]
      })
    );
    const damageLine = screen.getByText(/2d8\+4 piercing/);
    expect(damageLine).toHaveTextContent('2d8+4 piercing + 1d6 fire persistent + +2 precision');
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
    expect(active).toHaveTextContent('2 actions');
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
    renderPanel(combatant('goblin-1', { notes: '' }), onSetNote);
    const placeholder = screen.getByRole('button', { name: 'Add note…' });
    placeholder.click();
    const textarea = await screen.findByRole('textbox', { name: 'Edit note' });
    (textarea as HTMLTextAreaElement).value = 'Watch the door.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent('blur'));
    expect(onSetNote).toHaveBeenCalledTimes(1);
    expect(onSetNote).toHaveBeenCalledWith('goblin-1', 'Watch the door.');
  });
});
