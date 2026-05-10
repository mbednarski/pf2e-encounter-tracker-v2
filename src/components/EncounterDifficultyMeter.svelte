<script lang="ts">
  import type { EncounterDifficulty, EncounterXPSummary } from '../domain';

  export let summary: EncounterXPSummary;

  type Band = { key: EncounterDifficulty; label: string; min: number; max: number };

  $: bands = buildBands(summary);
  $: barMax = bands.length > 0 ? bands[bands.length - 1].max : 0;
  $: clampedTotal = Math.min(summary.totalXP, barMax);
  $: positionPct = barMax > 0 ? (clampedTotal / barMax) * 100 : 0;
  $: overflow = summary.totalXP > barMax;

  function buildBands(s: EncounterXPSummary): Band[] {
    if (!s.thresholds) return [];
    const t = s.thresholds;
    // Bar runs from 0 to extreme + 25% buffer, so the Extreme zone has visible width.
    const ceiling = Math.round(t.extreme * 1.25);
    return [
      { key: 'Trivial', label: 'Trivial', min: 0, max: t.low },
      { key: 'Low', label: 'Low', min: t.low, max: t.moderate },
      { key: 'Moderate', label: 'Moderate', min: t.moderate, max: t.severe },
      { key: 'Severe', label: 'Severe', min: t.severe, max: t.extreme },
      { key: 'Extreme', label: 'Extreme', min: t.extreme, max: ceiling }
    ];
  }

  function bandWidthPct(band: Band): number {
    return barMax > 0 ? ((band.max - band.min) / barMax) * 100 : 0;
  }

  function tickPositionPct(value: number): number {
    return barMax > 0 ? (value / barMax) * 100 : 0;
  }
</script>

{#if summary.thresholds && summary.partyLevel != null && summary.enemyCount > 0 && summary.difficulty}
  <section class="meter" aria-label="Encounter difficulty">
    <div class="meter__numbers">
      <div class="meter__number">
        <span class="meter__label">Budget</span>
        <span class="meter__value">{summary.totalXP}<span class="meter__unit">XP</span></span>
      </div>
      <div class="meter__divider" aria-hidden="true"></div>
      <div class="meter__difficulty meter__difficulty--{summary.difficulty.toLowerCase()}">
        {summary.difficulty}{summary.hasOutOfRange ? '*' : ''}
      </div>
      <div class="meter__divider" aria-hidden="true"></div>
      <div class="meter__number">
        <span class="meter__label">Players earn</span>
        <span class="meter__value">
          {summary.xpPerPlayer}<span class="meter__unit">XP each</span>
        </span>
      </div>
      <div class="meter__party">
        <span class="meter__party-line">Party L{summary.partyLevel}</span>
        <span class="meter__party-line">{summary.partySize} PC</span>
      </div>
    </div>

    <div class="meter__bar" role="img"
         aria-label={`Encounter total ${summary.totalXP} XP, difficulty ${summary.difficulty}`}>
      <div class="meter__zones">
        {#each bands as band (band.key)}
          <div
            class="meter__zone meter__zone--{band.key.toLowerCase()}"
            style="width: {bandWidthPct(band)}%"
            class:meter__zone--current={band.key === summary.difficulty}
          >
            <span class="meter__zone-label">{band.label}</span>
          </div>
        {/each}
      </div>

      <div class="meter__ticks" aria-hidden="true">
        {#each [summary.thresholds.trivial, summary.thresholds.low, summary.thresholds.moderate, summary.thresholds.severe, summary.thresholds.extreme] as v}
          <div class="meter__tick" style="left: {tickPositionPct(v)}%">
            <div class="meter__tick-mark"></div>
            <div class="meter__tick-value">{v}</div>
          </div>
        {/each}
      </div>

      <div
        class="meter__cursor"
        class:meter__cursor--overflow={overflow}
        style="left: {positionPct}%"
        title={`${summary.totalXP} XP`}
      >
        <div class="meter__cursor-line"></div>
        <div class="meter__cursor-bubble">{summary.totalXP}{overflow ? '+' : ''}</div>
      </div>
    </div>

    {#if summary.hasOutOfRange}
      <p class="meter__note">
        * One or more creatures are more than 4 levels above the party — XP clamped to 160 each.
      </p>
    {/if}
  </section>
{:else if summary.enemyCount > 0 && summary.partyLevel == null}
  <section class="meter meter--empty" aria-label="Encounter difficulty">
    <p class="meter__hint">Add party members to compute encounter difficulty.</p>
  </section>
{/if}

<style>
  .meter {
    margin: 0 auto var(--space-4);
    max-width: 1440px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .meter--empty {
    padding: var(--space-2) var(--space-4);
  }

  .meter__hint {
    margin: 0;
    color: var(--color-ink-soft);
    font-style: italic;
    font-size: var(--text-sm);
  }

  .meter__numbers {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .meter__number {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .meter__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .meter__value {
    font-family: var(--font-mono);
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-ink);
    line-height: 1;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  .meter__unit {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-soft);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
  }

  .meter__difficulty {
    font-family: var(--font-sans);
    font-size: var(--text-xl);
    font-weight: 800;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: var(--radius-chip);
    border: 2px solid;
  }

  .meter__difficulty--trivial,
  .meter__difficulty--low {
    color: var(--color-ink-soft);
    border-color: var(--color-ink-soft);
    background: transparent;
  }

  .meter__difficulty--moderate {
    color: var(--color-amber);
    border-color: var(--color-amber);
    background: transparent;
  }

  .meter__difficulty--severe {
    color: var(--color-red);
    border-color: var(--color-red);
    background: transparent;
  }

  .meter__difficulty--extreme {
    color: var(--color-panel);
    border-color: var(--color-red);
    background: var(--color-red);
  }

  .meter__divider {
    width: 1px;
    align-self: stretch;
    background: var(--color-ink-soft);
    opacity: 0.25;
  }

  .meter__party {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    font-weight: 600;
  }

  .meter__bar {
    position: relative;
    padding-bottom: 28px; /* room for tick value labels */
  }

  .meter__zones {
    display: flex;
    height: 18px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--color-ink-soft);
  }

  .meter__zone {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: filter 0.12s;
  }

  .meter__zone--trivial {
    background: color-mix(in srgb, var(--color-ink-soft) 12%, transparent);
  }
  .meter__zone--low {
    background: color-mix(in srgb, var(--color-ink-soft) 22%, transparent);
  }
  .meter__zone--moderate {
    background: color-mix(in srgb, var(--color-amber) 30%, transparent);
  }
  .meter__zone--severe {
    background: color-mix(in srgb, var(--color-red) 30%, transparent);
  }
  .meter__zone--extreme {
    background: color-mix(in srgb, var(--color-red) 65%, transparent);
  }

  .meter__zone--current {
    filter: brightness(1.05) saturate(1.2);
    box-shadow: inset 0 0 0 2px var(--color-ink);
  }

  .meter__zone-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-ink);
    opacity: 0.7;
    white-space: nowrap;
    padding: 0 4px;
    pointer-events: none;
  }

  .meter__ticks {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .meter__tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .meter__tick-mark {
    width: 1px;
    height: 22px;
    background: var(--color-ink-soft);
    opacity: 0.6;
  }

  .meter__tick-value {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-ink-soft);
    font-weight: 600;
  }

  .meter__cursor {
    position: absolute;
    top: -6px;
    bottom: 0;
    transform: translateX(-50%);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
  }

  .meter__cursor-line {
    width: 2px;
    height: 30px;
    background: var(--color-ink);
  }

  .meter__cursor-bubble {
    margin-top: 2px;
    background: var(--color-ink);
    color: var(--color-panel);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .meter__cursor--overflow .meter__cursor-bubble {
    background: var(--color-red);
  }

  .meter__note {
    margin: 0;
    color: var(--color-ink-soft);
    font-style: italic;
    font-size: var(--text-xs);
  }

  @media (max-width: 760px) {
    .meter__numbers {
      gap: var(--space-3);
    }

    .meter__divider {
      display: none;
    }

    .meter__party {
      margin-left: 0;
      align-items: flex-start;
    }

    .meter__zone-label {
      display: none;
    }
  }
</style>
