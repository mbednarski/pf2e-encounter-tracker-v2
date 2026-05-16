import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import RadialConditionMenu from './RadialConditionMenu.svelte';
import type { ConditionOption } from '$lib/encounter-app';

// Geometry mirrors RadialConditionMenu.svelte. Keep in sync if those constants change.
const GEOMETRY = {
  CX: 220,
  CY: 220,
  INNER_R: 56, // hub radius
  RING_R: 130, // outer ring radius
  SUB_LABEL_R: 165, // radius at which sub-arc labels sit
  SLICE: 60, // 360 / WEDGE_COUNT (6)
  // Mid-angle for the active radius band: inside (INNER_R + 4)..RING_R.
  ACTIVE_BAND_INSIDE: 60
} as const;

// Wedge order is load-bearing for keyboard navigation. Recent is index 0.
const WEDGE_LABELS: ReadonlyArray<string> = [
  'Recent',
  'Conditions',
  'Persistent',
  'Manage',
  'Effects',
  'Afflictions'
];

/**
 * Stub jsdom's missing SVG CTM/SVGPoint so `clientToSvg` becomes an identity
 * transform: clientX/clientY pass through to SVG-local coordinates unchanged.
 */
function stubSvgGeometry(svg: SVGSVGElement): void {
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
}

/** Convert a (radius, degrees) polar point centred on (CX, CY) into clientX/clientY. */
function pointAt(angleDeg: number, radius: number): { clientX: number; clientY: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    clientX: GEOMETRY.CX + Math.cos(rad) * radius,
    clientY: GEOMETRY.CY + Math.sin(rad) * radius
  };
}

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
    for (const label of WEDGE_LABELS) {
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
    const tabsByLabel: Record<string, string> = {
      Conditions: 'conditions',
      Persistent: 'persistent',
      Manage: 'applied',
      Effects: 'effects',
      Afflictions: 'afflictions'
    };

    for (const [label, tab] of Object.entries(tabsByLabel)) {
      const onOpenModal = vi.fn();
      const onClose = vi.fn();
      const { container, unmount } = render(RadialConditionMenu, {
        props: baseProps({ onOpenModal, onClose })
      });
      const svg = container.querySelector('svg.radial-svg') as SVGSVGElement;

      // Hub starts un-hovered. The first ArrowRight focuses wedge 0 (Recent);
      // each subsequent ArrowRight advances by one wedge. Total presses to reach
      // wedge i is i + 1.
      const wedgeIndex = WEDGE_LABELS.indexOf(label);
      const presses = wedgeIndex + 1;
      for (let i = 0; i < presses; i++) {
        await fireEvent.keyDown(svg, { key: 'ArrowRight' });
      }
      await fireEvent.keyDown(svg, { key: 'Enter' });

      expect(onOpenModal).toHaveBeenCalledTimes(1);
      expect(onOpenModal).toHaveBeenCalledWith(tab);
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  test('pointerdown inside a non-Recent wedge calls onOpenModal with its tab and onClose', async () => {
    const onOpenModal = vi.fn();
    const onClose = vi.fn();
    const { container } = render(RadialConditionMenu, {
      props: baseProps({ onOpenModal, onClose })
    });
    const svg = container.querySelector('svg.radial-svg') as SVGSVGElement;
    stubSvgGeometry(svg);

    // Conditions wedge sits at mid 60° (index 1, SLICE=60). Pick a point inside
    // the active radius band (INNER_R+4 .. RING_R). Radius 90 lies inside that.
    await fireEvent.pointerDown(svg, pointAt(GEOMETRY.SLICE, 90));

    expect(onOpenModal).toHaveBeenCalledTimes(1);
    expect(onOpenModal).toHaveBeenCalledWith('conditions');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('pointerdown outside the active radius band does nothing', async () => {
    const onOpenModal = vi.fn();
    const onClose = vi.fn();
    const { container } = render(RadialConditionMenu, {
      props: baseProps({ onOpenModal, onClose })
    });
    const svg = container.querySelector('svg.radial-svg') as SVGSVGElement;
    stubSvgGeometry(svg);

    // 30px below the centre is inside the inner hub (radius 30 < INNER_R+4=60).
    await fireEvent.pointerDown(svg, { clientX: GEOMETRY.CX, clientY: GEOMETRY.CY + 30 });

    expect(onOpenModal).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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
    stubSvgGeometry(svg);

    // Open the Recent sub-arc via keyboard: hub → ArrowRight to wedge 0 (Recent) → Enter.
    await fireEvent.keyDown(svg, { key: 'ArrowRight' });
    await fireEvent.keyDown(svg, { key: 'Enter' });

    // Sub-arc layout (recent wedge at 0°): the items fan out across a span.
    const RECENT_MID_DEG = 0;
    const count = recentOptions.length;
    const span = Math.min(240, Math.max(110, 9 * (count - 1)));
    const step = span / (count - 1);

    function pointForItem(index: number) {
      return pointAt(RECENT_MID_DEG - span / 2 + index * step, GEOMETRY.SUB_LABEL_R);
    }

    // Hover item 0 (leftmost): expect bubble around the R0 label, NOT around R4.
    const targetIdx = 0;
    await fireEvent.pointerMove(svg, pointForItem(targetIdx));

    const bubble = container.querySelector('g.subitem-hover');
    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute('aria-label')).toBe(`R${targetIdx}`);
    expect(bubble?.getAttribute('aria-label')).not.toBe(`R${count - 1 - targetIdx}`);
  });
});
