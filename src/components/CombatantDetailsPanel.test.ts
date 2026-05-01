import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { combatant } from '../domain/test-support';
import CombatantDetailsPanel from './CombatantDetailsPanel.svelte';

describe('CombatantDetailsPanel', () => {
  test('renders empty state when combatant is undefined', () => {
    render(CombatantDetailsPanel, { props: { combatant: undefined } });
    expect(screen.getByText('Select a combatant to see details.')).toBeInTheDocument();
  });

  test('renders header with name and no template badge by default', () => {
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    render(CombatantDetailsPanel, { props: { combatant: c } });
    expect(screen.getByRole('heading', { level: 2, name: 'Goblin Warrior' })).toBeInTheDocument();
    expect(screen.queryByText(/Elite|Weak|Normal/)).not.toBeInTheDocument();
  });

  test('renders Elite badge when templateAdjustment is elite', () => {
    const c = combatant('goblin-1', { name: 'Goblin', templateAdjustment: 'elite' });
    render(CombatantDetailsPanel, { props: { combatant: c } });
    expect(screen.getByText('Elite')).toBeInTheDocument();
  });

  test('renders defenses block with HP, AC, saves, perception, speed', () => {
    const c = combatant('goblin-1', {
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
    });
    render(CombatantDetailsPanel, { props: { combatant: c } });

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
    const withTemp = combatant('goblin-1', { tempHp: 5 });
    const { unmount } = render(CombatantDetailsPanel, {
      props: { combatant: withTemp }
    });
    expect(screen.getByText(/\+5 temp/)).toBeInTheDocument();
    unmount();

    const noTemp = combatant('goblin-2', { tempHp: 0 });
    render(CombatantDetailsPanel, { props: { combatant: noTemp } });
    expect(screen.queryByText(/temp/)).not.toBeInTheDocument();
  });

  test('omits attacks section when combatant has no attacks', () => {
    const c = combatant('goblin-1', { attacks: [] });
    render(CombatantDetailsPanel, { props: { combatant: c } });
    expect(screen.queryByLabelText('Attacks')).not.toBeInTheDocument();
  });

  test('renders attacks with name, type, modifier, and damage', () => {
    const c = combatant('goblin-1', {
      attacks: [
        {
          name: 'Longsword',
          type: 'melee',
          modifier: 12,
          traits: [],
          damage: [{ dice: 1, dieSize: 8, bonus: 3, type: 'slashing' }]
        }
      ]
    });
    render(CombatantDetailsPanel, { props: { combatant: c } });
    const attacks = screen.getByLabelText('Attacks');
    expect(attacks).toHaveTextContent('Longsword');
    expect(attacks).toHaveTextContent('(melee)');
    expect(attacks).toHaveTextContent('+12');
    expect(attacks).toHaveTextContent('1d8+3 slashing');
  });

  test('omits each ability sub-section when its array is empty', () => {
    const c = combatant('goblin-1');
    render(CombatantDetailsPanel, { props: { combatant: c } });
    expect(screen.queryByLabelText('Passive Abilities')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reactive Abilities')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Active Abilities')).not.toBeInTheDocument();
  });

  test('renders all three ability sub-sections when populated', () => {
    const c = combatant('goblin-1', {
      passiveAbilities: [{ name: 'Darkvision', description: 'Sees in dark.' }],
      reactiveAbilities: [
        { name: 'Attack of Opportunity', description: 'Strike on trigger.', trigger: 'A foe moves.' }
      ],
      activeAbilities: [
        { name: 'Brutal Charge', description: 'Charge and strike.', actions: 2 }
      ]
    });
    render(CombatantDetailsPanel, { props: { combatant: c } });

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
});
