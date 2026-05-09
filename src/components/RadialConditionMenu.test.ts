import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import RadialConditionMenu from './RadialConditionMenu.svelte';
import type { ConditionOption } from '$lib/encounter-app';

function baseProps(overrides: Record<string, unknown> = {}) {
  const recentOptions: ConditionOption[] = [
    { id: 'frightened', name: 'Frightened', value: { kind: 'valued', defaultValue: 1, maxValue: 4 } },
    { id: 'off-guard', name: 'Off-Guard', value: { kind: 'unvalued' } },
    { id: 'stunned', name: 'Stunned', value: { kind: 'valued', defaultValue: 1, maxValue: 10 } }
  ];
  return {
    combatantId: 'goblin-1',
    combatantName: 'Goblin Warrior',
    combatantHpLabel: '18/18 HP',
    anchor: { x: 200, y: 200 },
    recentOptions,
    appliedCount: 0,
    wedgeCounts: { conditions: 28, persistent: 11, spells: 10, afflictions: 4 },
    onApply: vi.fn(),
    onOpenModal: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
}

describe('RadialConditionMenu', () => {
  test('renders all six wedge labels', () => {
    render(RadialConditionMenu, { props: baseProps() });
    for (const label of ['Recent', 'Conditions', 'Persistent', 'Manage', 'Effects', 'Afflictions']) {
      expect(screen.getByText(label.toUpperCase())).toBeInTheDocument();
    }
  });

  test('all wedges are active (no aria-disabled)', () => {
    const { container } = render(RadialConditionMenu, { props: baseProps() });
    const wedges = container.querySelectorAll('g.wedge[role="menuitem"]');
    expect(wedges.length).toBe(6);
    for (const wedge of Array.from(wedges)) {
      expect(wedge.getAttribute('aria-disabled')).toBeNull();
    }
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

  test('keyboard-activating each non-Recent wedge calls onOpenModal with the right tab', async () => {
    const expected: Array<[string, string]> = [
      ['Conditions', 'conditions'],
      ['Persistent', 'persistent'],
      ['Manage', 'applied'],
      ['Effects', 'effects'],
      ['Afflictions', 'afflictions']
    ];

    for (const [label, tab] of expected) {
      const onOpenModal = vi.fn();
      const onClose = vi.fn();
      const { container, unmount } = render(RadialConditionMenu, {
        props: baseProps({ onOpenModal, onClose })
      });
      const svg = container.querySelector('svg.radial-svg') as SVGSVGElement;

      // Hub starts un-hovered. ArrowRight focuses wedge 0 (Recent), then walks to the target.
      // WEDGES order: Recent (0), Conditions (1), Persistent (2), Manage (3), Effects (4), Afflictions (5).
      const target =
        label === 'Conditions'
          ? 2
          : label === 'Persistent'
            ? 3
            : label === 'Manage'
              ? 4
              : label === 'Effects'
                ? 5
                : 6; // Afflictions
      for (let i = 0; i < target; i++) {
        await fireEvent.keyDown(svg, { key: 'ArrowRight' });
      }
      await fireEvent.keyDown(svg, { key: 'Enter' });

      expect(onOpenModal).toHaveBeenCalledTimes(1);
      expect(onOpenModal).toHaveBeenCalledWith(tab);
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  test('hovering item K in the Recent sub-arc highlights item K, not its mirror (regression #92)', async () => {
    // Build a 5-item Recent list so the sub-arc has clear angular spread.
    const recentOptions: ConditionOption[] = [
      { id: 'r0', name: 'R0', value: { kind: 'unvalued' } },
      { id: 'r1', name: 'R1', value: { kind: 'unvalued' } },
      { id: 'r2', name: 'R2', value: { kind: 'unvalued' } },
      { id: 'r3', name: 'R3', value: { kind: 'unvalued' } },
      { id: 'r4', name: 'R4', value: { kind: 'unvalued' } }
    ];
    const { container } = render(RadialConditionMenu, { props: baseProps({ recentOptions }) });
    const svg = container.querySelector('svg.radial-svg') as SVGSVGElement;

    // Open the Recent sub-arc via keyboard: hub → ArrowRight to wedge 0 (Recent) → Enter.
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    await fireEvent.keyDown(svg, { key: 'Enter' });

    // Geometry constants must match the component.
    const CX = 220;
    const CY = 220;
    const SUB_LABEL_R = 165;
    const SLICE = 60;
    const RECENT_MID_DEG = 0; // wedge 0 sits at 12 o'clock.
    const count = recentOptions.length;
    const span = Math.min(240, Math.max(110, 9 * (count - 1)));
    const step = span / (count - 1);

    // Stub getScreenCTM so clientToSvg is a no-op identity transform.
    const identity = {
      inverse: () => identity,
      multiply: () => identity,
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0
    } as unknown as DOMMatrix;
    (svg as unknown as { getScreenCTM: () => DOMMatrix }).getScreenCTM = () => identity;
    (svg as unknown as { createSVGPoint: () => DOMPoint }).createSVGPoint = () => {
      const pt = { x: 0, y: 0 } as DOMPoint;
      (pt as unknown as { matrixTransform: (m: DOMMatrix) => DOMPoint }).matrixTransform = () => pt;
      return pt;
    };

    function pointFor(index: number) {
      const angDeg = RECENT_MID_DEG - span / 2 + index * step;
      const rad = ((angDeg - 90) * Math.PI) / 180;
      return {
        clientX: CX + Math.cos(rad) * SUB_LABEL_R,
        clientY: CY + Math.sin(rad) * SUB_LABEL_R
      };
    }

    // Hover item 0 (leftmost): expect bubble around the R0 label, NOT around R4.
    const targetIdx = 0;
    await fireEvent.pointerMove(svg, pointFor(targetIdx));

    const bubble = container.querySelector('g.subitem-hover');
    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute('aria-label')).toBe(`R${targetIdx}`);
    // Sanity: also verify that the rightmost item is NOT the highlighted one.
    expect(bubble?.getAttribute('aria-label')).not.toBe(`R${count - 1 - targetIdx}`);
  });
});
