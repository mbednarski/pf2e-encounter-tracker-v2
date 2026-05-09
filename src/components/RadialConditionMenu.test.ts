import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import RadialConditionMenu from './RadialConditionMenu.svelte';
import type { ConditionOption, RemovableEffectOption } from '$lib/encounter-app';

function baseProps(overrides: Record<string, unknown> = {}) {
  const conditionOptions: ConditionOption[] = [
    { id: 'frightened', name: 'Frightened', value: { kind: 'valued', defaultValue: 1, maxValue: 4 } },
    { id: 'off-guard', name: 'Off-Guard', value: { kind: 'unvalued' } },
    { id: 'stunned', name: 'Stunned', value: { kind: 'valued', defaultValue: 1, maxValue: 10 } }
  ];
  const recentOptions: ConditionOption[] = [conditionOptions[0]];
  const removableEffects: RemovableEffectOption[] = [];
  return {
    combatantId: 'goblin-1',
    combatantName: 'Goblin Warrior',
    combatantHpLabel: '18/18 HP',
    anchor: { x: 200, y: 200 },
    conditionOptions,
    recentOptions,
    removableEffects,
    wedgeCounts: { conditions: 28, persistent: 11, buffs: 0, afflictions: 0 },
    onApply: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
}

describe('RadialConditionMenu', () => {
  test('renders all six wedge labels', () => {
    render(RadialConditionMenu, { props: baseProps() });
    for (const label of ['Recent', 'Conditions', 'Persistent', 'Remove', 'Buffs', 'Afflictions']) {
      expect(screen.getByText(label.toUpperCase())).toBeInTheDocument();
    }
  });

  test('marks placeholder wedges as aria-disabled', () => {
    const { container } = render(RadialConditionMenu, { props: baseProps() });
    const wedges = container.querySelectorAll('g.wedge[role="menuitem"]');
    const disabled = Array.from(wedges).filter(
      (g) => g.getAttribute('aria-disabled') === 'true'
    );
    const labels = disabled.map((g) => g.getAttribute('aria-label') ?? '');
    expect(labels.some((label) => label.startsWith('Persistent'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Buffs'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Afflictions'))).toBe(true);
  });

  test('Escape from the hub calls onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(RadialConditionMenu, { props: baseProps({ onClose }) });
    const svg = container.querySelector('svg.radial-svg');
    expect(svg).not.toBeNull();
    await fireEvent.keyDown(svg!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    render(RadialConditionMenu, { props: baseProps({ onClose }) });
    screen.getByRole('button', { name: 'Close radial menu' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('applying an unvalued condition via keyboard nav fires onApply with kind unvalued', async () => {
    const onApply = vi.fn();
    const { container } = render(RadialConditionMenu, { props: baseProps({ onApply }) });
    const svg = container.querySelector('svg.radial-svg') as SVGSVGElement;

    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    await fireEvent.keyDown(svg, { key: 'Enter' });

    await fireEvent.keyDown(svg, { key: 'ArrowDown' });
    await fireEvent.keyDown(svg, { key: 'ArrowDown' });
    await fireEvent.keyDown(svg, { key: 'Enter' });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ kind: 'unvalued', effectId: 'off-guard' });
  });
});
