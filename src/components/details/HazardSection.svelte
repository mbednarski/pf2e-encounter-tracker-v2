<script lang="ts">
  import type { CombatantState, HazardBaseStats, HazardData } from '../../domain';
  import Chip from '../ui/Chip.svelte';
  import SectionLabel from '../ui/SectionLabel.svelte';

  export let combatant: CombatantState & { hazardData: HazardData; baseStats: HazardBaseStats };
  export let onRecordDisableProgress: (
    combatantId: string,
    checkIndex: number,
    delta: number
  ) => void = () => {};

  $: data = combatant.hazardData;
  $: fullyDisabled = data.disableProgress.every((p) => p.successesRemaining === 0);
  $: immunities = combatant.baseStats.immunities ?? [];

  function titleCase(value: string): string {
    return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
  }
</script>

<section class="details__section" aria-label="Hazard">
  <SectionLabel as="h3">Hazard</SectionLabel>

  <div class="hazard-routine" role="note" aria-label="Routine">
    <span class="hazard-routine__label">Routine · {data.routine.actions} action{data.routine.actions === 1 ? '' : 's'}</span>
    <span class="hazard-routine__body">{data.routine.description}</span>
  </div>

  <div class="hazard-disable">
    <div class="hazard-disable__head">
      <SectionLabel>Disable checks</SectionLabel>
      {#if fullyDisabled}
        <Chip variant="success">Fully disabled</Chip>
      {/if}
    </div>
    <ul class="hazard-checks">
      {#each data.disableChecks as check, i (i)}
        {@const progress = data.disableProgress[i]?.successesRemaining ?? check.requiredSuccesses}
        {@const done = progress === 0}
        <li class="hazard-check" class:hazard-check--done={done}>
          <div class="hazard-check__head">
            <span class="hazard-check__skill">{titleCase(check.skill)}</span>
            <span class="hazard-check__dc">DC {check.dc}</span>
            <span class="hazard-check__count">{check.requiredSuccesses - progress}/{check.requiredSuccesses}</span>
          </div>
          {#if check.note}
            <div class="hazard-check__note">{check.note}</div>
          {/if}
          <div class="hazard-check__actions">
            <button
              type="button"
              class="hazard-btn hazard-btn--success"
              disabled={done}
              aria-label={`Record success on ${titleCase(check.skill)} disable check`}
              onclick={() => onRecordDisableProgress(combatant.id, i, -1)}
            >+ Success</button>
            <button
              type="button"
              class="hazard-btn hazard-btn--undo"
              disabled={progress === check.requiredSuccesses}
              aria-label={`Undo a success on ${titleCase(check.skill)} disable check`}
              onclick={() => onRecordDisableProgress(combatant.id, i, 1)}
            >Undo</button>
          </div>
        </li>
      {/each}
    </ul>
  </div>

  {#if immunities.length > 0}
    <div class="hazard-immunities">
      <SectionLabel>Immunities</SectionLabel>
      <div class="immunity-list">
        {#each immunities as imm (imm)}
          <Chip>{imm}</Chip>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .hazard-routine {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: var(--space-2) 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: 4px;
    border: 1px solid var(--effect-cond);
    background: var(--effect-cond-soft);
    color: var(--color-ink);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    white-space: pre-line;
  }

  .hazard-routine__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--effect-cond);
  }

  .hazard-disable {
    display: grid;
    gap: var(--space-2);
  }

  .hazard-disable__head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .hazard-checks {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-2);
  }

  .hazard-check {
    border-top: 1px dashed var(--color-rule);
    padding-top: var(--space-2);
    display: grid;
    gap: 4px;
  }

  .hazard-check:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .hazard-check__head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .hazard-check__skill {
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 600;
  }

  .hazard-check__dc {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
  }

  .hazard-check__count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-mute);
  }

  .hazard-check__note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .hazard-check__actions {
    display: flex;
    gap: var(--space-2);
  }

  .hazard-btn {
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid var(--color-rule);
    background: var(--color-panel-2);
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .hazard-btn:hover:not(:disabled) {
    background: var(--color-panel);
    border-color: var(--color-ink);
  }

  .hazard-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .hazard-btn--success {
    color: var(--roll-sav);
    border-color: var(--roll-sav);
  }

  .hazard-check--done .hazard-check__skill,
  .hazard-check--done .hazard-check__dc {
    color: var(--color-ink-mute);
    text-decoration: line-through;
  }

  .hazard-immunities {
    margin-top: var(--space-3);
    display: grid;
    gap: var(--space-1);
  }

  .immunity-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
</style>
