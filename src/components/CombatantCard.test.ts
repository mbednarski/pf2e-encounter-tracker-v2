import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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
});
