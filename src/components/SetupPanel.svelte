<script lang="ts">
  import { type ManualCombatantInput } from '$lib/encounter-app';
  import DiscardEncounterButton from './DiscardEncounterButton.svelte';

  export let canStart: boolean;
  export let onAddManual: (input: Omit<ManualCombatantInput, 'id'>) => void;
  export let onStart: () => void;
  export let onReset: () => Promise<boolean>;

  let manualName = 'Goblin Warrior';
  let manualHp = 18;
  let manualAc = 16;
  let manualFortitude = 6;
  let manualReflex = 8;
  let manualWill = 5;
  let manualPerception = 7;
  let manualSpeed = 25;

  function numberOrDefault(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }

  function submitManual() {
    onAddManual({
      name: manualName.trim() || 'Combatant',
      maxHp: numberOrDefault(manualHp, 1),
      ac: numberOrDefault(manualAc, 10),
      fortitude: numberOrDefault(manualFortitude, 0),
      reflex: numberOrDefault(manualReflex, 0),
      will: numberOrDefault(manualWill, 0),
      perception: numberOrDefault(manualPerception, 0),
      speed: numberOrDefault(manualSpeed, 25)
    });
  }

</script>

<aside class="panel setup-panel" aria-labelledby="setup-title">
  <div class="panel-heading">
    <h2 id="setup-title">Encounter Controls</h2>
  </div>

  <details class="custom-combatant">
    <summary>Custom Combatant</summary>
    <form class="manual-form" onsubmit={(event) => { event.preventDefault(); submitManual(); }}>
      <label>Name<input bind:value={manualName} autocomplete="off" /></label>
      <div class="stat-grid">
        <label>HP<input type="number" min="1" bind:value={manualHp} /></label>
        <label>AC<input type="number" bind:value={manualAc} /></label>
        <label>Fort<input type="number" bind:value={manualFortitude} /></label>
        <label>Ref<input type="number" bind:value={manualReflex} /></label>
        <label>Will<input type="number" bind:value={manualWill} /></label>
        <label>Per<input type="number" bind:value={manualPerception} /></label>
      </div>
      <label>Speed<input type="number" min="0" bind:value={manualSpeed} /></label>
      <button type="submit">Add Custom</button>
    </form>
  </details>

  <div class="control-row">
    <button type="button" disabled={!canStart} onclick={onStart}>Start Encounter</button>
    <DiscardEncounterButton {onReset} />
  </div>
</aside>

<style>
  .panel {
    border: var(--border-strong);
    border-radius: var(--radius-card);
    background: var(--color-panel);
    box-shadow: var(--shadow-soft);
    padding: var(--space-3);
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-md);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .manual-form {
    display: grid;
    gap: var(--space-2);
  }

  label {
    display: grid;
    gap: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  input {
    min-width: 0;
    border: var(--border-strong);
    border-radius: var(--radius-chip);
    background: var(--color-panel-up);
    color: var(--color-ink);
    padding: var(--space-2);
    font: inherit;
  }

  input:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  button {
    min-height: 38px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-card);
    background: var(--accent);
    color: var(--accent-ink);
    cursor: pointer;
    font-weight: 700;
    padding: var(--space-2) var(--space-3);
    font: inherit;
  }

  button:hover:not(:disabled) {
    background: var(--color-ink);
    border-color: var(--color-ink);
  }

  button:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .custom-combatant {
    border-top: var(--border-thin);
    margin-top: var(--space-1);
    padding-top: var(--space-3);
  }

  .custom-combatant summary {
    cursor: pointer;
    font-weight: 700;
    margin-bottom: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-base);
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  @media (max-width: 760px) {
    .panel-heading,
    .control-row {
      align-items: stretch;
      flex-direction: column;
    }

    .control-row button {
      width: 100%;
    }
  }
</style>
