<script lang="ts">
  import type { Creature } from '../domain';
  import {
    makeCreatureCombatant,
    type ManualCombatantInput,
    type TemplateAdjustmentChoice
  } from '$lib/encounter-app';
  import { templateLabel } from '$lib/template-label';

  export let canStart: boolean;
  export let creatures: Creature[];
  export let onAddCreatures: (input: {
    creature: Creature;
    adjustment: TemplateAdjustmentChoice;
    quantity: number;
    namePrefix: string;
  }) => void;
  export let onAddManual: (input: Omit<ManualCombatantInput, 'id'>) => void;
  export let onImportYamlFiles: (files: File[]) => void;
  export let onStart: () => void;
  export let onReset: () => void;

  let selectedCreatureId = creatures[0]?.id ?? '';
  let selectedAdjustment: TemplateAdjustmentChoice = 'normal';
  let creatureQuantity = 1;
  let creatureNamePrefix = '';
  let fileInput: HTMLInputElement | undefined;

  $: if (!creatures.some((c) => c.id === selectedCreatureId) && creatures.length > 0) {
    selectedCreatureId = creatures[0].id;
  }

  let manualName = 'Goblin Warrior';
  let manualHp = 18;
  let manualAc = 16;
  let manualFortitude = 6;
  let manualReflex = 8;
  let manualWill = 5;
  let manualPerception = 7;
  let manualSpeed = 25;

  $: selectedCreature = creatures.find((c) => c.id === selectedCreatureId) ?? creatures[0];
  $: previewCombatant = selectedCreature
    ? makeCreatureCombatant({
        creature: selectedCreature,
        combatantId: 'preview',
        adjustment: selectedAdjustment
      })
    : undefined;

  function formatTraits(creature: Creature) {
    return [creature.rarity, creature.size, ...creature.traits].join(' · ');
  }

  function numberOrDefault(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }

  function submitCreatures() {
    if (!selectedCreature) return;
    onAddCreatures({
      creature: selectedCreature,
      adjustment: selectedAdjustment,
      quantity: Math.max(1, numberOrDefault(creatureQuantity, 1)),
      namePrefix: creatureNamePrefix
    });
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

  function reset() {
    selectedAdjustment = 'normal';
    creatureQuantity = 1;
    creatureNamePrefix = '';
    onReset();
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onImportYamlFiles(files);
    }
    // <input type="file"> only fires 'change' on a new selection; reset so
    // the same file can be re-imported after fixing it.
    input.value = '';
  }
</script>

<aside class="panel setup-panel" aria-labelledby="setup-title">
  <div class="panel-heading">
    <h2 id="setup-title">Encounter Setup</h2>
    <span>{creatures.length} creature{creatures.length === 1 ? '' : 's'}</span>
  </div>

  <div class="import-row">
    <button type="button" class="secondary" onclick={() => fileInput?.click()}>
      Import YAML…
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept=".yaml,.yml,application/yaml,text/yaml"
      multiple
      hidden
      onchange={handleFileChange}
    />
    <span class="import-hint">Personal monster YAMLs (kept on your machine).</span>
  </div>

  <form class="creature-form" onsubmit={(event) => { event.preventDefault(); submitCreatures(); }}>
    <label>
      Creature
      <select bind:value={selectedCreatureId}>
        {#each creatures as creature (creature.id)}
          <option value={creature.id}>{creature.name}</option>
        {/each}
      </select>
    </label>

    {#if selectedCreature && previewCombatant}
      <section class="creature-preview" aria-label="Selected creature preview">
        <div class="preview-heading">
          <div>
            <strong>{selectedCreature.name}</strong>
            <span>Level {selectedCreature.level} · {formatTraits(selectedCreature)}</span>
          </div>
          <span class:adjusted={selectedAdjustment !== 'normal'}>{templateLabel(selectedAdjustment)}</span>
        </div>
        <dl class="preview-stats">
          <div><dt>HP</dt><dd>{previewCombatant.baseStats.hp}</dd></div>
          <div><dt>AC</dt><dd>{previewCombatant.baseStats.ac}</dd></div>
          <div><dt>Fort</dt><dd>+{previewCombatant.baseStats.fortitude}</dd></div>
          <div><dt>Ref</dt><dd>+{previewCombatant.baseStats.reflex}</dd></div>
          <div><dt>Will</dt><dd>+{previewCombatant.baseStats.will}</dd></div>
          <div><dt>Per</dt><dd>+{previewCombatant.baseStats.perception}</dd></div>
        </dl>
        <p class="preview-line">
          {selectedCreature.attacks.length} attack{selectedCreature.attacks.length === 1 ? '' : 's'}
          {selectedCreature.spellcasting ? ` · ${selectedCreature.spellcasting.length} spell block${selectedCreature.spellcasting.length === 1 ? '' : 's'}` : ''}
        </p>
      </section>
    {/if}

    <fieldset class="template-picker">
      <legend>Template</legend>
      <div class="segmented">
        <button type="button" class:active={selectedAdjustment === 'normal'} aria-pressed={selectedAdjustment === 'normal'} onclick={() => (selectedAdjustment = 'normal')}>Normal</button>
        <button type="button" class:active={selectedAdjustment === 'weak'} aria-pressed={selectedAdjustment === 'weak'} onclick={() => (selectedAdjustment = 'weak')}>Weak</button>
        <button type="button" class:active={selectedAdjustment === 'elite'} aria-pressed={selectedAdjustment === 'elite'} onclick={() => (selectedAdjustment = 'elite')}>Elite</button>
      </div>
    </fieldset>

    {#if selectedAdjustment !== 'normal'}
      <p class="template-warning">
        {templateLabel(selectedAdjustment)} adjusts structured stats, attacks, spell DCs, and HP. DCs or damage written only inside ability text are not adjusted automatically.
      </p>
    {/if}

    <div class="add-grid">
      <label>
        Quantity
        <input type="number" min="1" max="12" bind:value={creatureQuantity} />
      </label>
      <label>
        Name prefix
        <input bind:value={creatureNamePrefix} autocomplete="off" placeholder={selectedCreature?.name ?? 'Combatant'} />
      </label>
    </div>
    <button type="submit">Add Creature</button>
  </form>

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
    <button type="button" class="secondary" onclick={reset}>Reset Local</button>
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

  .panel-heading > span {
    color: #627171;
    font-size: 13px;
  }

  .creature-form,
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

  input,
  select {
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

  .add-grid {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 8px;
  }

  .creature-preview {
    display: grid;
    gap: 10px;
    border: 1px solid #d8ddd9;
    border-radius: 7px;
    background: #ffffff;
    padding: 12px;
  }

  .preview-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .preview-heading strong,
  .preview-heading span {
    display: block;
  }

  .preview-heading span,
  .preview-line,
  .custom-combatant summary {
    color: #627171;
    font-size: 13px;
  }

  .preview-heading > span {
    border-radius: 999px;
    background: #eef1ee;
    color: #334143;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    padding: 5px 7px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .preview-heading > span.adjusted {
    background: #f4e6d7;
    color: #7c3d1f;
  }

  .preview-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
  }

  .preview-stats div {
    border-radius: 6px;
    background: #eef1ee;
    padding: 8px;
  }

  .preview-stats dt,
  .preview-stats dd,
  .preview-line {
    margin: 0;
  }

  .preview-stats dt {
    color: #627171;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .preview-stats dd {
    color: #1d2528;
    font-size: 18px;
    font-weight: 800;
  }

  .template-picker {
    display: grid;
    gap: 6px;
    border: 0;
    margin: 0;
    padding: 0;
  }

  .template-picker legend {
    color: #526061;
    font-size: 12px;
    font-weight: 700;
    padding: 0;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid #b8c3be;
    border-radius: 7px;
    overflow: hidden;
  }

  .segmented button {
    min-height: 36px;
    border: 0;
    border-radius: 0;
    background: #ffffff;
    color: #334143;
  }

  .segmented button + button {
    border-left: 1px solid #d8ddd9;
  }

  .segmented button.active {
    background: #28494c;
    color: #ffffff;
  }

  .template-warning {
    border-left: 4px solid #b6652e;
    border-radius: 6px;
    background: #fff7ee;
    color: #5f3c23;
    font-size: 13px;
    line-height: 1.4;
    margin: 0;
    padding: 10px;
  }

  .custom-combatant {
    border-top: 1px solid #d8ddd9;
    margin-top: 14px;
    padding-top: 12px;
  }

  .custom-combatant summary {
    cursor: pointer;
    font-weight: 800;
    margin-bottom: 10px;
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
  }

  .import-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .import-hint {
    color: #627171;
    font-size: 12px;
    line-height: 1.3;
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
