<script lang="ts">
  import { type ManualCombatantInput } from '$lib/encounter-app';

  export let canStart: boolean;
  export let onAddManual: (input: Omit<ManualCombatantInput, 'id'>) => void;
  export let onStart: () => void;
  export let onReset: () => void;

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
    <button type="button" class="secondary" onclick={onReset}>Reset Local</button>
  </div>
</aside>

<style>
  .panel {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 14px;
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
  }

  .manual-form {
    display: grid;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 5px;
    color: #526061;
    font-size: 12px;
    font-weight: 700;
  }

  input {
    min-width: 0;
    border: 1px solid #b8c3be;
    border-radius: 6px;
    background: #ffffff;
    color: #1d2528;
    padding: 9px 10px;
    font: inherit;
  }

  button {
    min-height: 38px;
    border: 1px solid #28494c;
    border-radius: 6px;
    background: #28494c;
    color: #ffffff;
    cursor: pointer;
    font-weight: 700;
    padding: 8px 12px;
    font: inherit;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  button.secondary {
    border-color: #9aa7a3;
    color: #263235;
    background: #ffffff;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .custom-combatant {
    border-top: 1px solid #d8ddd9;
    margin-top: 4px;
    padding-top: 12px;
  }

  .custom-combatant summary {
    cursor: pointer;
    font-weight: 800;
    margin-bottom: 10px;
    color: #627171;
    font-size: 13px;
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
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
