<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    resolveApplyChoice,
    type ApplyConditionChoice,
    type ConditionOption,
    type ConditionWedgeCounts,
    type RemovableEffectOption
  } from '$lib/encounter-app';

  export let combatantId: string;
  export let combatantName: string;
  export let combatantHpLabel: string;
  export let combatantSubtitle: string | undefined = undefined;
  export let anchor: { x: number; y: number };
  export let conditionOptions: ConditionOption[];
  export let recentOptions: ConditionOption[];
  export let removableEffects: RemovableEffectOption[];
  export let wedgeCounts: ConditionWedgeCounts;
  export let onApply: (choice: ApplyConditionChoice) => void;
  export let onRemove: (instanceId: string) => void;
  export let onClose: () => void;

  // Geometry — ported verbatim from design/radial-menu.jsx.
  const CX = 220;
  const CY = 220;
  const INNER_R = 56;
  const RING_R = 130;
  const SUB_RING_R = 200;
  const LABEL_R = 95;
  const SUB_LABEL_R = 165;
  const WEDGE_COUNT = 6;
  const SLICE = 360 / WEDGE_COUNT;
  const SCRUB_DEG_PER_TICK = 5;
  const RADIAL_DIAMETER = 440;
  const HALF = RADIAL_DIAMETER / 2;
  const PADDING = 8;

  type WedgeId = 'recent' | 'conditions' | 'persistent' | 'remove' | 'buffs' | 'afflict';
  type ActiveWedgeId = 'recent' | 'conditions' | 'remove';
  interface WedgeDef {
    id: WedgeId;
    icon: string;
    label: string;
    active: boolean;
    danger: boolean;
  }

  const WEDGES: readonly WedgeDef[] = [
    { id: 'recent', icon: '↺', label: 'Recent', active: true, danger: false },
    { id: 'conditions', icon: '✦', label: 'Conditions', active: true, danger: false },
    { id: 'persistent', icon: '✷', label: 'Persistent', active: false, danger: false },
    { id: 'remove', icon: '✕', label: 'Remove', active: true, danger: true },
    { id: 'buffs', icon: '✚', label: 'Buffs', active: false, danger: false },
    { id: 'afflict', icon: '☣', label: 'Afflictions', active: false, danger: false }
  ];

  type Phase =
    | { kind: 'hub' }
    | { kind: 'subarc'; wedge: ActiveWedgeId }
    | { kind: 'scrub'; wedge: ActiveWedgeId; option: ConditionOption; value: number };

  let phase: Phase = { kind: 'hub' };
  let hoveredWedgeId: WedgeId | null = null;
  let hoveredItemIndex: number | null = null;
  let svgEl: SVGSVGElement | null = null;
  let returnFocusTo: HTMLElement | null = null;

  function polar(deg: number, r: number): { x: number; y: number } {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
  }

  function wedgePath(a0: number, a1: number, r0: number, r1: number): string {
    const p0 = polar(a0, r1);
    const p1 = polar(a1, r1);
    const p2 = polar(a1, r0);
    const p3 = polar(a0, r0);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
  }

  function wedgeAngles(i: number): { a0: number; a1: number; mid: number } {
    return { a0: i * SLICE - SLICE / 2, a1: i * SLICE + SLICE / 2, mid: i * SLICE };
  }

  function wedgeIndexFor(id: WedgeId): number {
    return WEDGES.findIndex((w) => w.id === id);
  }

  function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const mapped = pt.matrixTransform(ctm.inverse());
    return { x: mapped.x, y: mapped.y };
  }

  function angleOf(x: number, y: number): number {
    // Returns 0..360 with 0 at 12 o'clock, clockwise.
    const dx = x - CX;
    const dy = y - CY;
    const rad = Math.atan2(dy, dx);
    const deg = (rad * 180) / Math.PI + 90;
    return ((deg % 360) + 360) % 360;
  }

  function radiusOf(x: number, y: number): number {
    const dx = x - CX;
    const dy = y - CY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function wedgeIdAtAngle(deg: number): WedgeId | null {
    // Each wedge spans i*SLICE - SLICE/2 .. i*SLICE + SLICE/2.
    // Wedge 0 is centered at 0° (top); a click slightly to the left of top
    // (e.g. 350°) should map to wedge 0.
    const adjusted = ((deg + SLICE / 2) % 360 + 360) % 360;
    const i = Math.floor(adjusted / SLICE);
    return WEDGES[i]?.id ?? null;
  }

  $: subItems = currentSubItems(phase, recentOptions, conditionOptions, removableEffects);

  function currentSubItems(
    p: Phase,
    recent: ConditionOption[],
    conditions: ConditionOption[],
    removable: RemovableEffectOption[]
  ): readonly { id: string; name: string; valueLabel?: string }[] {
    if (p.kind === 'hub') return [];
    const wedge = p.wedge;
    if (wedge === 'recent') return recent.map((o) => ({ id: o.id, name: o.name }));
    if (wedge === 'conditions') return conditions.map((o) => ({ id: o.id, name: o.name }));
    return removable.map((o) => ({
      id: o.instanceId,
      name: o.valueLabel ? `${o.name} ${o.valueLabel}` : o.name
    }));
  }

  $: subSpan = computeSubSpan(subItems.length);

  function computeSubSpan(count: number): number {
    if (count <= 1) return 0;
    return Math.min(240, Math.max(110, 9 * (count - 1)));
  }

  function subItemAngle(index: number, count: number, wedge: ActiveWedgeId): number {
    const wedgeIdx = wedgeIndexFor(wedge);
    const mid = wedgeAngles(wedgeIdx).mid;
    if (count === 1) return mid;
    const span = computeSubSpan(count);
    const step = span / (count - 1);
    return mid - span / 2 + index * step;
  }

  function commitOption(option: ConditionOption, rawValue: number) {
    onApply(resolveApplyChoice(option, rawValue));
  }

  function selectActiveWedge(wedgeId: WedgeId) {
    const wedge = WEDGES.find((w) => w.id === wedgeId);
    if (!wedge || !wedge.active) return;
    phase = { kind: 'subarc', wedge: wedgeId as ActiveWedgeId };
    hoveredItemIndex = null;
  }

  function handleSubItemActivate(index: number) {
    if (phase.kind !== 'subarc') return;
    const wedge = phase.wedge;

    if (wedge === 'remove') {
      const target = removableEffects[index];
      if (target) onRemove(target.instanceId);
      return;
    }

    const list = wedge === 'recent' ? recentOptions : conditionOptions;
    const option = list[index];
    if (!option) return;

    if (option.value.kind === 'unvalued') {
      commitOption(option, 1);
      return;
    }

    phase = { kind: 'scrub', wedge, option, value: 1 };
  }

  function handleHubKey(event: KeyboardEvent) {
    const activeIds = WEDGES.filter((w) => w.active).map((w) => w.id);
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (hoveredWedgeId) {
        event.preventDefault();
        selectActiveWedge(hoveredWedgeId);
      }
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const current = hoveredWedgeId && activeIds.includes(hoveredWedgeId)
        ? activeIds.indexOf(hoveredWedgeId)
        : -1;
      hoveredWedgeId = activeIds[(current + 1) % activeIds.length];
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const current = hoveredWedgeId && activeIds.includes(hoveredWedgeId)
        ? activeIds.indexOf(hoveredWedgeId)
        : 0;
      hoveredWedgeId = activeIds[(current - 1 + activeIds.length) % activeIds.length];
      return;
    }
  }

  function handleSubarcKey(event: KeyboardEvent) {
    if (phase.kind !== 'subarc') return;
    const count = subItems.length;
    if (event.key === 'Escape') {
      event.preventDefault();
      phase = { kind: 'hub' };
      hoveredItemIndex = null;
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (hoveredItemIndex !== null) {
        event.preventDefault();
        handleSubItemActivate(hoveredItemIndex);
      }
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      hoveredItemIndex = hoveredItemIndex === null ? 0 : (hoveredItemIndex + 1) % count;
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      hoveredItemIndex = hoveredItemIndex === null ? 0 : (hoveredItemIndex - 1 + count) % count;
      return;
    }
  }

  function handleScrubKey(event: KeyboardEvent) {
    if (phase.kind !== 'scrub') return;
    const max = phase.option.value.kind === 'valued' ? phase.option.value.maxValue ?? 99 : 1;
    if (event.key === 'Escape') {
      event.preventDefault();
      phase = { kind: 'subarc', wedge: phase.wedge };
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitOption(phase.option, phase.value);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      phase = { ...phase, value: Math.min(max, phase.value + 1) };
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      phase = { ...phase, value: Math.max(1, phase.value - 1) };
      return;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (phase.kind === 'hub') handleHubKey(event);
    else if (phase.kind === 'subarc') handleSubarcKey(event);
    else handleScrubKey(event);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!svgEl) return;
    const { x, y } = clientToSvg(svgEl, event.clientX, event.clientY);
    const r = radiusOf(x, y);
    const ang = angleOf(x, y);

    if (phase.kind === 'hub') {
      if (r >= INNER_R + 4 && r <= RING_R) {
        hoveredWedgeId = wedgeIdAtAngle(ang);
      } else {
        hoveredWedgeId = null;
      }
      return;
    }

    if (phase.kind === 'subarc') {
      const count = subItems.length;
      if (count === 0) return;
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < count; i++) {
        const target = subItemAngle(i, count, phase.wedge);
        let diff = Math.abs(((ang - target + 540) % 360) - 180);
        diff = 180 - diff;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      hoveredItemIndex = bestIdx;
      return;
    }

    // scrub
    const scrubPhase = phase;
    if (scrubPhase.kind !== 'scrub') return;
    if (scrubPhase.option.value.kind !== 'valued') return;
    const list = scrubPhase.wedge === 'recent' ? recentOptions : conditionOptions;
    const idx = list.findIndex((o) => o.id === scrubPhase.option.id);
    if (idx === -1) return;
    const baseAngle = subItemAngle(idx, list.length, scrubPhase.wedge);
    let delta = ang - baseAngle;
    delta = ((delta + 540) % 360) - 180;
    const max = scrubPhase.option.value.maxValue ?? 99;
    const next = Math.round(1 + delta / SCRUB_DEG_PER_TICK);
    const clamped = Math.max(1, Math.min(max, next));
    if (clamped !== scrubPhase.value) {
      phase = { ...scrubPhase, value: clamped };
    }
  }

  function handlePointerUp() {
    if (phase.kind !== 'scrub') return;
    commitOption(phase.option, phase.value);
  }

  function handleHubPointerDown(event: PointerEvent) {
    if (phase.kind !== 'hub') return;
    if (!svgEl) return;
    const { x, y } = clientToSvg(svgEl, event.clientX, event.clientY);
    const r = radiusOf(x, y);
    if (r < INNER_R + 4 || r > RING_R) return;
    const id = wedgeIdAtAngle(angleOf(x, y));
    if (!id) return;
    selectActiveWedge(id);
  }

  function handleSubarcPointerDown(event: PointerEvent, index: number) {
    event.stopPropagation();
    if (phase.kind !== 'subarc') return;
    const wedge = phase.wedge;

    if (wedge === 'remove') {
      handleSubItemActivate(index);
      return;
    }

    const list = wedge === 'recent' ? recentOptions : conditionOptions;
    const option = list[index];
    if (!option) return;

    if (option.value.kind === 'unvalued') {
      commitOption(option, 1);
      return;
    }

    // Enter scrub mode and capture pointer for the drag gesture.
    phase = { kind: 'scrub', wedge, option, value: 1 };
    if (svgEl && event.pointerId !== undefined) {
      try {
        svgEl.setPointerCapture(event.pointerId);
      } catch {
        // setPointerCapture may throw if pointer is no longer active; safe to ignore.
      }
    }
  }

  let hostStyle = '';
  function recomputeHostStyle() {
    if (typeof window === 'undefined') {
      hostStyle = `left: ${PADDING}px; top: ${PADDING}px;`;
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(anchor.x - HALF, PADDING), Math.max(PADDING, vw - RADIAL_DIAMETER - PADDING));
    const top = Math.min(Math.max(anchor.y - HALF, PADDING), Math.max(PADDING, vh - RADIAL_DIAMETER - PADDING));
    hostStyle = `left: ${left}px; top: ${top}px;`;
  }
  $: anchor, recomputeHostStyle();

  onMount(() => {
    returnFocusTo = (document.activeElement as HTMLElement) ?? null;
    void tick().then(() => svgEl?.focus());
    return () => {
      returnFocusTo?.focus?.();
    };
  });

  function wedgeCount(id: WedgeId): number {
    if (id === 'recent') return recentOptions.length;
    if (id === 'conditions') return wedgeCounts.conditions;
    if (id === 'persistent') return wedgeCounts.persistent;
    if (id === 'remove') return removableEffects.length;
    if (id === 'buffs') return wedgeCounts.buffs;
    return wedgeCounts.afflictions;
  }

  function combatantInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  $: hubInitials = combatantInitials(combatantName);

  $: scrubView =
    phase.kind === 'scrub' && phase.option.value.kind === 'valued'
      ? {
          option: phase.option,
          value: phase.value,
          maxValue: phase.option.value.maxValue ?? 4,
          list: phase.wedge === 'recent' ? recentOptions : conditionOptions,
          wedge: phase.wedge
        }
      : null;
</script>

<div class="radial-host" style={hostStyle}>
  <button type="button" class="radial-backdrop" aria-label="Close radial menu" onclick={onClose} tabindex="-1"></button>
  <svg
    bind:this={svgEl}
    class="radial-svg"
    width={RADIAL_DIAMETER}
    height={RADIAL_DIAMETER}
    viewBox="0 0 {RADIAL_DIAMETER} {RADIAL_DIAMETER}"
    role="dialog"
    aria-modal="true"
    aria-label={`Apply effect to ${combatantName}`}
    tabindex="-1"
    data-combatant-id={combatantId}
    onkeydown={handleKeyDown}
    onpointermove={handlePointerMove}
    onpointerdown={handleHubPointerDown}
    onpointerup={handlePointerUp}
  >
    <defs>
      <filter id="radialShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#1f1a14" flood-opacity="0.18" />
      </filter>
    </defs>

    {#if phase.kind === 'subarc' || phase.kind === 'scrub'}
      <circle
        class="guide-ring"
        cx={CX}
        cy={CY}
        r={SUB_RING_R + 2}
        fill="none"
        stroke-dasharray="2 4"
      />
    {/if}

    {#each WEDGES as w, i (w.id)}
      {@const angles = wedgeAngles(i)}
      {@const labelPos = polar(angles.mid, LABEL_R)}
      {@const isActiveWedge = (phase.kind === 'subarc' || phase.kind === 'scrub') && phase.wedge === w.id}
      {@const isDimmed = (phase.kind === 'subarc' || phase.kind === 'scrub') && phase.wedge !== w.id}
      {@const isHover = phase.kind === 'hub' && hoveredWedgeId === w.id && w.active}
      <g
        class="wedge"
        class:wedge-active={w.active}
        class:wedge-disabled={!w.active}
        class:wedge-danger={w.danger}
        class:wedge-hover={isHover}
        class:wedge-selected={isActiveWedge}
        class:wedge-dim={isDimmed}
        role="menuitem"
        tabindex="-1"
        aria-label={`${w.label}${w.active ? '' : ' (coming soon)'} ${wedgeCount(w.id)}`}
        aria-disabled={!w.active}
      >
        <path
          class="wedge-fill"
          d={wedgePath(angles.a0 + 1.5, angles.a1 - 1.5, INNER_R + 4, RING_R)}
        />
        <text class="wedge-icon" x={labelPos.x} y={labelPos.y - 4} text-anchor="middle">{w.icon}</text>
        <text class="wedge-label" x={labelPos.x} y={labelPos.y + 14} text-anchor="middle">{w.label.toUpperCase()}</text>
        <text class="wedge-count" x={labelPos.x} y={labelPos.y + 26} text-anchor="middle">{wedgeCount(w.id)}</text>
      </g>
    {/each}

    {#if phase.kind === 'subarc' || phase.kind === 'scrub'}
      {@const wedgeIdx = wedgeIndexFor(phase.wedge)}
      {@const wedgeMid = wedgeAngles(wedgeIdx).mid}
      {@const span = computeSubSpan(subItems.length)}
      <path
        class="subarc-track"
        d={wedgePath(wedgeMid - span / 2 - 6, wedgeMid + span / 2 + 6, RING_R + 8, SUB_RING_R)}
      />
      {#each subItems as item, idx (item.id)}
        {@const ang = subItemAngle(idx, subItems.length, phase.wedge)}
        {@const labelPos = polar(ang, SUB_LABEL_R)}
        {@const isHover = phase.kind === 'subarc' && hoveredItemIndex === idx}
        {@const isSelected = phase.kind === 'scrub' && phase.option.id === item.id}
        <g
          class="subitem"
          class:subitem-hover={isHover}
          class:subitem-selected={isSelected}
          role="menuitem"
          tabindex="-1"
          aria-label={item.name}
          onpointerdown={(e) => handleSubarcPointerDown(e, idx)}
        >
          {#if isHover || isSelected}
            <circle class="subitem-bubble" cx={labelPos.x} cy={labelPos.y} r="22" />
          {/if}
          <text class="subitem-label" x={labelPos.x} y={labelPos.y + 4} text-anchor="middle">{item.name}</text>
        </g>
      {/each}
    {/if}

    {#if scrubView}
      {@const itemIdx = scrubView.list.findIndex((o) => o.id === scrubView.option.id)}
      {@const baseAngle = itemIdx >= 0 ? subItemAngle(itemIdx, scrubView.list.length, scrubView.wedge) : 0}
      {@const tickCount = Math.min(scrubView.maxValue, 10)}
      {#each Array.from({ length: tickCount }, (_, i) => i + 1) as v (v)}
        {@const ang = baseAngle + (v - 1) * SCRUB_DEG_PER_TICK - ((tickCount - 1) * SCRUB_DEG_PER_TICK) / 2}
        {@const pos = polar(ang, SUB_RING_R + 18)}
        {@const active = v === scrubView.value}
        <g class="scrub-tick" class:scrub-tick-active={active}>
          <circle cx={pos.x} cy={pos.y} r={active ? 13 : 10} />
          <text x={pos.x} y={pos.y + 4} text-anchor="middle">{v}</text>
        </g>
      {/each}
      <text class="scrub-hint" x={CX} y={CY + SUB_RING_R + 50} text-anchor="middle">DRAG TO SET VALUE</text>
    {/if}

    <g class="hub" filter="url(#radialShadow)">
      <circle class="hub-bg" cx={CX} cy={CY} r={INNER_R} />
      <circle class="hub-portrait" cx={CX} cy={CY - 18} r="14" />
      <text class="hub-initials" x={CX} y={CY - 14} text-anchor="middle">{hubInitials}</text>
      <text class="hub-name" x={CX} y={CY + 8} text-anchor="middle">{combatantName}</text>
      <text class="hub-hp" x={CX} y={CY + 22} text-anchor="middle">{combatantHpLabel}</text>
      {#if combatantSubtitle}
        <text class="hub-subtitle" x={CX} y={CY + 34} text-anchor="middle">{combatantSubtitle}</text>
      {/if}
    </g>
  </svg>
</div>

<style>
  .radial-host {
    position: fixed;
    width: 440px;
    height: 440px;
    z-index: 100;
    pointer-events: none;
  }

  .radial-backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(31, 26, 20, 0.04);
    border: 0;
    margin: 0;
    padding: 0;
    cursor: default;
    pointer-events: auto;
  }

  .radial-svg {
    position: relative;
    pointer-events: auto;
    outline: none;
    user-select: none;
  }

  .guide-ring {
    stroke: var(--color-rule);
  }

  .wedge-fill {
    fill: var(--color-bg);
    stroke: var(--color-ink);
    stroke-width: 1;
    transition: fill 0.1s;
  }

  .wedge-icon {
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 600;
    fill: var(--color-ink);
  }

  .wedge-icon,
  .wedge-label,
  .wedge-count {
    pointer-events: none;
  }

  .wedge-label {
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    fill: var(--color-ink-soft);
  }

  .wedge-count {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--color-ink-mute);
  }

  .wedge-active {
    cursor: pointer;
  }

  .wedge-disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .wedge-danger .wedge-icon,
  .wedge-danger .wedge-label {
    fill: var(--color-red);
  }

  .wedge-hover .wedge-fill,
  .wedge-selected .wedge-fill {
    fill: var(--color-ink);
    filter: url(#radialShadow);
  }

  .wedge-hover .wedge-icon,
  .wedge-hover .wedge-label,
  .wedge-hover .wedge-count,
  .wedge-selected .wedge-icon,
  .wedge-selected .wedge-label,
  .wedge-selected .wedge-count {
    fill: var(--color-bg);
  }

  .wedge-dim {
    opacity: 0.35;
  }

  .subarc-track {
    fill: var(--color-panel);
    stroke: var(--color-rule);
    stroke-width: 1;
  }

  .subitem {
    cursor: pointer;
  }

  .subitem-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    fill: var(--color-ink-soft);
    pointer-events: none;
  }

  .subitem-hover .subitem-label {
    fill: var(--color-ink);
    font-weight: 700;
    font-size: 11px;
  }

  .subitem-selected .subitem-label {
    fill: var(--color-amber);
    font-weight: 700;
    font-size: 11px;
  }

  .subitem-bubble {
    fill: var(--color-ink);
    opacity: 0.1;
    pointer-events: none;
  }

  .subitem-selected .subitem-bubble {
    fill: var(--color-amber);
    opacity: 0.18;
  }

  .scrub-tick circle {
    fill: var(--color-bg);
    stroke: var(--color-ink);
    stroke-width: 1;
  }

  .scrub-tick text {
    font-family: var(--font-serif);
    font-size: 11px;
    font-weight: 700;
    fill: var(--color-ink);
  }

  .scrub-tick-active circle {
    fill: var(--color-amber);
    stroke-width: 1.5;
  }

  .scrub-tick-active text {
    fill: var(--color-bg);
    font-size: 14px;
  }

  .scrub-hint {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    fill: var(--color-amber);
  }

  .hub-bg {
    fill: var(--color-bg);
    stroke: var(--color-ink);
    stroke-width: 1.5;
  }

  .hub-portrait {
    fill: var(--color-panel-2);
    stroke: var(--color-rule-strong);
    stroke-width: 1;
  }

  .hub-initials {
    font-family: var(--font-serif);
    font-size: 14px;
    font-weight: 700;
    fill: var(--color-ink);
  }

  .hub-name {
    font-family: var(--font-serif);
    font-size: 11px;
    font-weight: 600;
    fill: var(--color-ink);
  }

  .hub-hp {
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    fill: var(--color-ink-mute);
    letter-spacing: 0.05em;
  }

  .hub-subtitle {
    font-family: var(--font-sans);
    font-size: 8px;
    font-weight: 700;
    fill: var(--color-amber);
    letter-spacing: 0.08em;
  }
</style>
