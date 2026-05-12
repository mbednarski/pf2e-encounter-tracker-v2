<script lang="ts">
  import { formatModifier } from '$lib/abilities/format-damage';

  type Tone = 'default' | 'pc' | 'attack' | 'damage' | 'save';

  export let label: string;
  export let modifier: number;
  export let disabled = false;
  export let title: string | undefined = undefined;
  export let breakdownTitle: string | undefined = undefined;
  export let modified = false;
  export let ariaLabel: string | undefined = undefined;
  export let tone: Tone = 'default';
  export let onRoll: (origin: { x: number; y: number }) => void = () => {};

  $: signedModifier = formatModifier(modifier);
  $: computedAriaLabel = ariaLabel ?? `Roll ${label} (${signedModifier})`;
  $: effectiveTitle = breakdownTitle ?? title;

  function handleClick(event: MouseEvent) {
    onRoll({ x: event.clientX, y: event.clientY });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    onRoll({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }
</script>

<button
  type="button"
  {disabled}
  title={effectiveTitle}
  aria-label={computedAriaLabel}
  class="stat-roll stat-roll--{tone}"
  class:stat-roll--modified={modified}
  onclick={handleClick}
  onkeydown={handleKeyDown}
>
  <span class="stat-roll__label">{label}</span>
  <span class="stat-roll__mod">{signedModifier}</span>
</button>

<style>
  .stat-roll {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--color-panel-2);
    color: var(--color-ink);
    border: 1px solid var(--color-rule);
    font: inherit;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }

  .stat-roll:hover:not(:disabled) {
    background: var(--color-panel);
    border-color: var(--color-ink);
  }

  .stat-roll:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  .stat-roll:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .stat-roll__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .stat-roll__mod {
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-ink);
  }

  /* PC tone — kept for backwards compatibility */
  .stat-roll--pc .stat-roll__mod {
    color: var(--faction-pc);
  }

  /* Roll-type tones — color-mode the whole pill so a glance tells you
     what kind of roll it is. Soft tinted bg + border + label/value. */
  .stat-roll--attack {
    background: var(--roll-atk-soft);
    border-color: var(--roll-atk);
  }
  .stat-roll--attack .stat-roll__label,
  .stat-roll--attack .stat-roll__mod {
    color: var(--roll-atk);
  }
  .stat-roll--attack:hover:not(:disabled) {
    background: var(--color-panel);
    border-color: var(--roll-atk);
  }

  .stat-roll--damage {
    background: var(--roll-dmg-soft);
    border-color: var(--roll-dmg);
  }
  .stat-roll--damage .stat-roll__label,
  .stat-roll--damage .stat-roll__mod {
    color: var(--roll-dmg);
  }
  .stat-roll--damage:hover:not(:disabled) {
    background: var(--color-panel);
    border-color: var(--roll-dmg);
  }

  .stat-roll--save {
    background: var(--roll-sav-soft);
    border-color: var(--roll-sav);
  }
  .stat-roll--save .stat-roll__label,
  .stat-roll--save .stat-roll__mod {
    color: var(--roll-sav);
  }
  .stat-roll--save:hover:not(:disabled) {
    background: var(--color-panel);
    border-color: var(--roll-sav);
  }

  .stat-roll--modified .stat-roll__mod {
    color: var(--effect-cond);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
</style>
