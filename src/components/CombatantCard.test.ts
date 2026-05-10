import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { combatant } from '../domain/test-support';
import CombatantCard from './CombatantCard.svelte';

const noopActions = {
  canEndTurn: false,
  canMarkReactionUsed: false,
  canMarkDead: false,
  canRevive: false
};

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    combatant: combatant('goblin-1', { name: 'Goblin Warrior' }),
    isCurrent: false,
    phase: 'PREPARING' as const,
    actions: noopActions,
    appliedEffectsView: [],
    conditionOptions: [],
    onHpEdit: vi.fn(),
    onEndTurn: vi.fn(),
    onMarkReactionUsed: vi.fn(),
    onMarkDead: vi.fn(),
    onRevive: vi.fn(),
    onApplyCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onModifyConditionValue: vi.fn(),
    onSetConditionValue: vi.fn(),
    onMove: vi.fn(),
    isFirst: false,
    isLast: false,
    isSelected: false,
    onSelect: vi.fn(),
    ...overrides
  };
}

describe('CombatantCard select affordance', () => {
  test('renders the combatant name as a button', () => {
    render(CombatantCard, { props: baseProps() });
    const button = screen.getByRole('button', { name: 'Goblin Warrior' });
    expect(button.tagName.toLowerCase()).toBe('button');
    expect(button).toHaveTextContent('Goblin Warrior');
  });

  test('clicking the name button calls onSelect with the combatant id', () => {
    const onSelect = vi.fn();
    render(CombatantCard, { props: baseProps({ onSelect }) });
    screen.getByRole('button', { name: 'Goblin Warrior' }).click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('goblin-1');
  });

  test('isSelected applies selected-card class on the article', () => {
    const { container } = render(CombatantCard, { props: baseProps({ isSelected: true }) });
    const article = container.querySelector('article.combatant-card');
    expect(article).not.toBeNull();
    expect(article?.classList.contains('selected-card')).toBe(true);
  });

  test('isSelected false omits selected-card class', () => {
    const { container } = render(CombatantCard, { props: baseProps({ isSelected: false }) });
    const article = container.querySelector('article.combatant-card');
    expect(article?.classList.contains('selected-card')).toBe(false);
  });

  test('aria-pressed mirrors isSelected', () => {
    const { unmount } = render(CombatantCard, { props: baseProps({ isSelected: true }) });
    expect(screen.getByRole('button', { name: 'Goblin Warrior' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    unmount();

    render(CombatantCard, { props: baseProps({ isSelected: false }) });
    expect(screen.getByRole('button', { name: 'Goblin Warrior' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  test('clicking the card body calls onSelect with the combatant id', async () => {
    const onSelect = vi.fn();
    const { container } = render(CombatantCard, { props: baseProps({ onSelect }) });
    const article = container.querySelector('article.combatant-card') as HTMLElement;
    expect(article).not.toBeNull();
    await fireEvent.click(article);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('goblin-1');
  });

  test('clicking the inner name button does not double-fire onSelect from the card handler', async () => {
    const onSelect = vi.fn();
    render(CombatantCard, { props: baseProps({ onSelect }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Goblin Warrior' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('pressing Enter on the focused card calls onSelect', async () => {
    const onSelect = vi.fn();
    const { container } = render(CombatantCard, { props: baseProps({ onSelect }) });
    const article = container.querySelector('article.combatant-card') as HTMLElement;
    await fireEvent.keyDown(article, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('goblin-1');
  });
});

describe('CombatantCard initiative control', () => {
  function withInitiative(overrides: Record<string, unknown> = {}) {
    return baseProps({
      onSetInitiative: vi.fn(),
      ...overrides
    });
  }

  test('PREPARING: shows initiative input, Roll button, and perception hint', () => {
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    c.baseStats.perception = 5;
    render(CombatantCard, { props: withInitiative({ combatant: c }) });

    expect(screen.getByRole('spinbutton', { name: 'Initiative for Goblin Warrior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll initiative for Goblin Warrior' })).toBeInTheDocument();
    expect(screen.getByText('(+5 Perception)')).toBeInTheDocument();
  });

  test('initiative input pre-fills from initiativeScore prop', () => {
    render(CombatantCard, { props: withInitiative({ initiativeScore: 17 }) });
    const input = screen.getByRole('spinbutton', { name: /Initiative for/ }) as HTMLInputElement;
    expect(input.value).toBe('17');
  });

  test('blurring the input dispatches onSetInitiative with the parsed number', async () => {
    const onSetInitiative = vi.fn();
    render(CombatantCard, { props: withInitiative({ onSetInitiative }) });
    const input = screen.getByRole('spinbutton', { name: /Initiative for/ }) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '14' } });
    await fireEvent.blur(input);
    expect(onSetInitiative).toHaveBeenCalledWith('goblin-1', 14);
  });

  test('clearing a previously-set value dispatches onSetInitiative with null', async () => {
    const onSetInitiative = vi.fn();
    render(CombatantCard, { props: withInitiative({ onSetInitiative, initiativeScore: 12 }) });
    const input = screen.getByRole('spinbutton', { name: /Initiative for/ }) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.blur(input);
    expect(onSetInitiative).toHaveBeenCalledWith('goblin-1', null);
  });

  test('Roll button rolls 1d20 + perception and dispatches onSetInitiative', async () => {
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    c.baseStats.perception = 7;
    const onSetInitiative = vi.fn();
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*20)+1 = 11
    try {
      render(CombatantCard, { props: withInitiative({ combatant: c, onSetInitiative }) });
      await fireEvent.click(screen.getByRole('button', { name: 'Roll initiative for Goblin Warrior' }));
      expect(onSetInitiative).toHaveBeenCalledWith('goblin-1', 18);
    } finally {
      spy.mockRestore();
    }
  });

  test('ACTIVE phase: initiative control is hidden, reorder buttons remain', () => {
    render(CombatantCard, { props: withInitiative({ phase: 'ACTIVE' }) });
    expect(screen.queryByRole('spinbutton', { name: /Initiative for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Roll initiative/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Move .* up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move .* down/ })).toBeInTheDocument();
  });

  test('without onSetInitiative the control is hidden even in PREPARING', () => {
    render(CombatantCard, { props: baseProps() });
    expect(screen.queryByRole('spinbutton', { name: /Initiative for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Roll initiative/ })).toBeNull();
  });

  test('negative perception is rendered with explicit minus sign', () => {
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    c.baseStats.perception = -1;
    render(CombatantCard, { props: withInitiative({ combatant: c }) });
    expect(screen.getByText('(-1 Perception)')).toBeInTheDocument();
  });
});

describe('CombatantCard faction styling', () => {
  test('a creature combatant gets data-faction="enemy" and renders an Enemy tag', () => {
    const { container } = render(CombatantCard, {
      props: baseProps({ combatant: combatant('goblin-1', { sourceType: 'creature' }) })
    });
    const article = container.querySelector('article.combatant-card');
    expect(article?.getAttribute('data-faction')).toBe('enemy');
    expect(article?.textContent).toContain('Enemy');
  });

  test('a partyMember combatant gets data-faction="pc" and renders a PC tag', () => {
    const { container } = render(CombatantCard, {
      props: baseProps({ combatant: combatant('cleric-1', { sourceType: 'partyMember' }) })
    });
    const article = container.querySelector('article.combatant-card');
    expect(article?.getAttribute('data-faction')).toBe('pc');
    expect(article?.textContent).toContain('PC');
  });

  test('a hazard combatant gets data-faction="hazard" and renders a Hazard tag', () => {
    const { container } = render(CombatantCard, {
      props: baseProps({ combatant: combatant('trap-1', { sourceType: 'hazard' }) })
    });
    const article = container.querySelector('article.combatant-card');
    expect(article?.getAttribute('data-faction')).toBe('hazard');
    expect(article?.textContent).toContain('Hazard');
  });

  test('a companion combatant gets data-faction="ally"', () => {
    const { container } = render(CombatantCard, {
      props: baseProps({
        combatant: combatant('wolf-1', { sourceType: 'companion', name: 'Wolf' })
      })
    });
    const article = container.querySelector('article.combatant-card');
    expect(article?.getAttribute('data-faction')).toBe('ally');
    expect(article?.textContent).toContain('Ally');
  });
});

describe('CombatantCard save rolls', () => {
  test('renders a button per save with signed modifier', () => {
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    c.baseStats.fortitude = 12;
    c.baseStats.reflex = 9;
    c.baseStats.will = -1;
    render(CombatantCard, { props: baseProps({ combatant: c }) });

    const fort = screen.getByRole('button', {
      name: 'Roll Goblin Warrior Fortitude save (+12)'
    });
    expect(fort).toHaveTextContent('Fort');
    expect(fort).toHaveTextContent('+12');

    const ref = screen.getByRole('button', {
      name: 'Roll Goblin Warrior Reflex save (+9)'
    });
    expect(ref).toHaveTextContent('Ref');
    expect(ref).toHaveTextContent('+9');

    const will = screen.getByRole('button', {
      name: 'Roll Goblin Warrior Will save (-1)'
    });
    expect(will).toHaveTextContent('Will');
    expect(will).toHaveTextContent('-1');
  });

  test('clicking a save button forwards onRollSave with combatant id, save key, and click origin', async () => {
    const onRollSave = vi.fn();
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    c.baseStats.reflex = 7;
    render(CombatantCard, { props: baseProps({ combatant: c, onRollSave }) });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Roll Goblin Warrior Reflex save (+7)' }),
      { clientX: 11, clientY: 22 }
    );

    expect(onRollSave).toHaveBeenCalledTimes(1);
    expect(onRollSave).toHaveBeenCalledWith('goblin-1', 'reflex', { x: 11, y: 22 });
  });

  test('clicking a save button does not also fire the card onSelect handler', async () => {
    const onSelect = vi.fn();
    const onRollSave = vi.fn();
    const c = combatant('goblin-1', { name: 'Goblin Warrior' });
    c.baseStats.fortitude = 5;
    render(CombatantCard, { props: baseProps({ combatant: c, onSelect, onRollSave }) });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Roll Goblin Warrior Fortitude save (+5)' })
    );

    expect(onRollSave).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
