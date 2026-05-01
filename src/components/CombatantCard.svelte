<script lang="ts">
  import type { CombatantState, EncounterState } from '../domain';
  import {
    clampValue,
    combatantVisualState,
    resolveApplyChoice,
    type AppliedEffectView,
    type ApplyConditionChoice,
    type CombatantCardActionAvailability,
    type ConditionOption
  } from '$lib/encounter-app';
  import type { CommittableEdit, HpEditField } from '$lib/hp-input';
  import InlineNumberEdit from './InlineNumberEdit.svelte';

  export let combatant: CombatantState;
  export let isCurrent: boolean;
  export let phase: EncounterState['phase'];
  export let actions: CombatantCardActionAvailability;
  export let appliedEffectsView: AppliedEffectView[];
  export let conditionOptions: ConditionOption[];
  export let onHpEdit: (id: string, field: HpEditField, parsed: CommittableEdit) => void;
  export let onEndTurn: (id: string) => void;
  export let onMarkReactionUsed: (id: string) => void;
  export let onMarkDead: (id: string) => void;
  export let onRevive: (id: string) => void;
  export let onApplyCondition: (id: string, choice: ApplyConditionChoice) => void;
  export let onRemoveCondition: (id: string, instanceId: string) => void;
  export let onModifyConditionValue: (id: string, instanceId: string, delta: number) => void;
  export let onSetConditionValue: (id: string, instanceId: string, newValue: number) => void;
  export let onMove: (id: string, direction: -1 | 1) => void;
  export let isFirst: boolean = false;
  export let isLast: boolean = false;

  let pickerOpen = false;
  let pickerEffectId = '';
  let pickerValue = 1;
  let editingInstanceId: string | null = null;
  let editingValue = 1;

  $: pickerSelected = conditionOptions.find((option) => option.id === pickerEffectId);

  function openPicker() {
    pickerEffectId = conditionOptions[0]?.id ?? '';
    pickerValue = 1;
    pickerOpen = true;
  }

  function cancelPicker() {
    pickerOpen = false;
  }

  function applyFromPicker() {
    if (!pickerSelected) return;
    onApplyCondition(combatant.id, resolveApplyChoice(pickerSelected, pickerValue));
    pickerOpen = false;
  }

  function startEdit(view: AppliedEffectView) {
    editingInstanceId = view.instanceId;
    editingValue = view.value.kind === 'valued' ? view.value.current : 1;
  }

  function commitEdit(view: AppliedEffectView) {
    if (view.value.kind !== 'valued') {
      editingInstanceId = null;
      return;
    }
    const next = clampValue(editingValue, view.value.maxValue);
    onSetConditionValue(combatant.id, view.instanceId, next);
    editingInstanceId = null;
  }

  function cancelEdit() {
    editingInstanceId = null;
  }

  function clampPickerValue() {
    if (pickerSelected?.value.kind === 'valued') {
      pickerValue = clampValue(pickerValue, pickerSelected.value.maxValue);
    }
  }

  function clampEditingValue(view: AppliedEffectView) {
    if (view.value.kind === 'valued') {
      editingValue = clampValue(editingValue, view.value.maxValue);
    }
  }

  function templateLabel(adjustment: CombatantState['templateAdjustment']) {
    if (adjustment === 'elite') return 'Elite';
    if (adjustment === 'weak') return 'Weak';
    return '';
  }

  $: hpPercent = Math.max(
    0,
    Math.min(100, (combatant.currentHp / combatant.baseStats.hp) * 100)
  );

  $: visualState = combatantVisualState(combatant);

  $: endTurnTitle = actions.canEndTurn
    ? 'End this combatant’s turn'
    : isCurrent
      ? 'End Turn is only available during the active phase'
      : 'Only the current combatant can end their turn';

  $: reactionTitle = actions.canMarkReactionUsed
    ? 'Mark reaction used this round'
    : combatant.reactionUsedThisRound
      ? 'Reaction already used this round'
      : !combatant.isAlive
        ? 'Combatant is dead'
        : 'Reactions are only tracked during combat';

  $: markDeadTitle = actions.canMarkDead
    ? 'Mark this combatant dead'
    : !combatant.isAlive
      ? 'Combatant is already dead'
      : 'Mark Dead is unavailable in this phase';

  $: reviveTitle = actions.canRevive
    ? 'Revive this combatant'
    : combatant.isAlive
      ? 'Combatant is already alive'
      : 'Revive is unavailable in this phase';
</script>

<article
  class:current-card={isCurrent}
  class:dimmed={visualState !== 'alive'}
  data-visual-state={visualState}
  class="combatant-card"
>
  <div class="card-heading">
    <div>
      <div class="card-title">
        <h2>{combatant.name}</h2>
        {#if combatant.templateAdjustment}
          <span class="template-badge {combatant.templateAdjustment}">{templateLabel(combatant.templateAdjustment)}</span>
        {/if}
        {#if visualState === 'dead'}
          <span class="status-badge dead" aria-label="Combatant is dead">Dead</span>
        {:else if visualState === 'unconscious'}
          <span class="status-badge unconscious" aria-label="Combatant is unconscious">Unconscious</span>
        {/if}
      </div>
      <p>AC {combatant.baseStats.ac} · Fort +{combatant.baseStats.fortitude} · Ref +{combatant.baseStats.reflex} · Will +{combatant.baseStats.will}</p>
    </div>
    <div class="card-aside">
      <span class="phase-pill">{isCurrent ? 'Turn' : phase}</span>
      <div class="card-reorder" aria-label="Reorder">
        <button
          type="button"
          title="Move up"
          aria-label={`Move ${combatant.name} up`}
          disabled={isFirst}
          onclick={() => onMove(combatant.id, -1)}
        >↑</button>
        <button
          type="button"
          title="Move down"
          aria-label={`Move ${combatant.name} down`}
          disabled={isLast}
          onclick={() => onMove(combatant.id, 1)}
        >↓</button>
      </div>
    </div>
  </div>

  <div class="hp-row">
    <div class="hp-cell">
      <InlineNumberEdit
        value={combatant.currentHp}
        ariaLabel="Edit HP. Type 42 to set, +3 to heal, minus 5 to damage."
        displayAriaLabel={`HP ${combatant.currentHp} of ${combatant.baseStats.hp}, click to edit`}
        placeholder="−5, +3, 42"
        displayClass="hp-value"
        onCommit={(parsed) => onHpEdit(combatant.id, 'hp', parsed)}
      />
      <span>/ {combatant.baseStats.hp} HP</span>
    </div>
    <div class="hp-cell">
      <InlineNumberEdit
        value={combatant.tempHp}
        ariaLabel="Edit temp HP. Type 5 to set, +3 to add, minus 2 to remove."
        displayAriaLabel={combatant.tempHp === 0
          ? 'Add temporary HP'
          : `Temp HP ${combatant.tempHp}, click to edit`}
        placeholder="+3, 5, −2"
        displayClass="hp-value"
        emptyDisplay="+ Add temp"
        onCommit={(parsed) => onHpEdit(combatant.id, 'tempHp', parsed)}
      />
      {#if combatant.tempHp > 0}
        <span>temp</span>
      {/if}
    </div>
  </div>
  <div class="hp-track" aria-label={`${combatant.name} HP`}>
    <div class="hp-fill" style={`width: ${hpPercent}%`}></div>
  </div>

  <div class="conditions" aria-label={`${combatant.name} conditions`}>
    {#if appliedEffectsView.length === 0 && !pickerOpen}
      <span class="conditions-empty">No conditions.</span>
    {/if}

    {#each appliedEffectsView as view (view.instanceId)}
      <span class="condition-chip" class:implied={view.source.kind === 'implied'}>
        <span class="condition-name">{view.name}</span>
        {#if view.value.kind === 'valued'}
          {#if editingInstanceId === view.instanceId}
            <input
              class="condition-value-input"
              type="number"
              min="1"
              max={view.value.maxValue ?? 99}
              bind:value={editingValue}
              onblur={() => clampEditingValue(view)}
              aria-label={`${view.name} value`}
            />
            <button type="button" class="condition-mini" onclick={() => commitEdit(view)}>Set</button>
            <button type="button" class="condition-mini secondary" onclick={cancelEdit}>Cancel</button>
          {:else}
            <button
              type="button"
              class="condition-mini"
              onclick={() => onModifyConditionValue(combatant.id, view.instanceId, -1)}
              aria-label={`Decrease ${view.name}`}
            >−</button>
            <button
              type="button"
              class="condition-value"
              onclick={() => startEdit(view)}
              title="Click to edit"
              aria-label={`${view.name} value ${view.value.current}, click to edit`}
            >{view.value.current}</button>
            <button
              type="button"
              class="condition-mini"
              onclick={() => onModifyConditionValue(combatant.id, view.instanceId, 1)}
              aria-label={`Increase ${view.name}`}
            >+</button>
          {/if}
        {/if}
        <span class="condition-duration">{view.durationLabel}</span>
        {#if view.source.kind === 'implied'}
          <span class="condition-parent">via {view.source.parentName}</span>
        {/if}
        <button
          type="button"
          class="condition-remove"
          onclick={() => onRemoveCondition(combatant.id, view.instanceId)}
          aria-label={`Remove ${view.name}`}
          title="Remove"
        >✕</button>
      </span>
    {/each}

    {#if !pickerOpen}
      <button
        type="button"
        class="condition-add"
        onclick={openPicker}
        disabled={conditionOptions.length === 0}
      >+ Condition</button>
    {:else}
      <div class="condition-picker" role="group" aria-label="Apply condition">
        <select bind:value={pickerEffectId} aria-label="Condition">
          {#each conditionOptions as option (option.id)}
            <option value={option.id}>{option.name}</option>
          {/each}
        </select>
        {#if pickerSelected?.value.kind === 'valued'}
          <input
            class="condition-value-input"
            type="number"
            min="1"
            max={pickerSelected.value.maxValue ?? 99}
            bind:value={pickerValue}
            onblur={clampPickerValue}
            aria-label="Initial value"
          />
        {/if}
        <button type="button" class="condition-apply" onclick={applyFromPicker}>Apply</button>
        <button type="button" class="condition-apply secondary" onclick={cancelPicker}>Cancel</button>
      </div>
    {/if}
  </div>

  <div class="card-turn-actions" aria-label="Turn and lifecycle controls">
    <button
      type="button"
      class="turn"
      disabled={!actions.canEndTurn}
      title={endTurnTitle}
      onclick={() => onEndTurn(combatant.id)}
    >
      End Turn
    </button>
    <button
      type="button"
      class="turn secondary"
      disabled={!actions.canMarkReactionUsed}
      title={reactionTitle}
      onclick={() => onMarkReactionUsed(combatant.id)}
    >
      Reaction Used
    </button>
    <button
      type="button"
      class="turn secondary"
      disabled={!actions.canMarkDead}
      title={markDeadTitle}
      onclick={() => onMarkDead(combatant.id)}
    >
      Mark Dead
    </button>
    <button
      type="button"
      class="turn secondary"
      disabled={!actions.canRevive}
      title={reviveTitle}
      onclick={() => onRevive(combatant.id)}
    >
      Revive
    </button>
  </div>
</article>

<style>
  .combatant-card {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 16px;
  }

  .current-card {
    border-color: #a53f2b;
  }

  .card-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 10px;
  }

  .card-title {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 8px;
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
  }

  .card-heading p {
    margin: 5px 0 0;
    color: #526061;
    font-size: 13px;
  }

  .phase-pill {
    border-radius: 999px;
    background: #eef1ee;
    padding: 5px 8px;
    color: #627171;
    font-size: 13px;
    white-space: nowrap;
  }

  .card-aside {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .card-reorder {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-reorder button {
    width: 24px;
    height: 22px;
    padding: 0;
    border: 1px solid #b8c3be;
    border-radius: 4px;
    background: #ffffff;
    color: #263235;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .card-reorder button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .template-badge {
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

  .template-badge.elite {
    background: #f4e6d7;
    color: #7c3d1f;
  }

  .template-badge.weak {
    background: #e6eef6;
    color: #275171;
  }

  .status-badge {
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    padding: 5px 7px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-badge.dead {
    background: #f4d7d7;
    color: #7a1f1f;
  }

  .status-badge.unconscious {
    background: #f4ead7;
    color: #7a5a1f;
  }

  .combatant-card.dimmed {
    background: #f1f2ef;
    opacity: 0.72;
  }

  .combatant-card.dimmed .hp-fill {
    background: #8a9a92;
  }

  .hp-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 18px;
  }

  .hp-row > div {
    border-radius: 7px;
    background: #eef1ee;
    padding: 10px;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .hp-row :global(.hp-value) {
    font-size: 24px;
    font-weight: 700;
    color: inherit;
  }

  .hp-row span {
    color: #526061;
    font-size: 13px;
  }

  .hp-track {
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: #d9dfdb;
    margin: 12px 0;
  }

  .hp-fill {
    height: 100%;
    border-radius: inherit;
    background: #3f7f64;
  }

  .conditions {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .conditions-empty {
    color: #8a9690;
    font-size: 12px;
    font-style: italic;
  }

  .condition-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid #cfd6d1;
    border-radius: 999px;
    background: #eef1ee;
    color: #263235;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 5px 3px 10px;
  }

  .condition-chip.implied {
    background: #f5f6f3;
    border-style: dashed;
    opacity: 0.78;
  }

  .condition-name {
    font-weight: 700;
  }

  .condition-duration {
    color: #627171;
    font-weight: 500;
    font-size: 11px;
  }

  .condition-parent {
    color: #8a9690;
    font-size: 11px;
    font-style: italic;
  }

  .condition-mini {
    border: 1px solid #b8c3be;
    border-radius: 4px;
    background: #ffffff;
    color: #263235;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    min-width: 22px;
    padding: 2px 6px;
  }

  .condition-mini.secondary {
    color: #627171;
  }

  .condition-value {
    border: 1px solid #b8c3be;
    border-radius: 4px;
    background: #ffffff;
    color: #263235;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    min-width: 22px;
    padding: 2px 6px;
  }

  .condition-value-input {
    border: 1px solid #b8c3be;
    border-radius: 4px;
    background: #ffffff;
    color: #1d2528;
    font: inherit;
    font-size: 12px;
    padding: 2px 4px;
    width: 48px;
  }

  .condition-remove {
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #7a1f1f;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    padding: 2px 6px;
  }

  .condition-remove:hover {
    background: #f4d7d7;
  }

  .condition-add {
    border: 1px dashed #9aa7a3;
    border-radius: 999px;
    background: transparent;
    color: #28494c;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 11px;
  }

  .condition-add:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .condition-picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #b8c3be;
    border-radius: 8px;
    background: #ffffff;
    padding: 5px 7px;
  }

  .condition-picker select {
    border: 1px solid #b8c3be;
    border-radius: 4px;
    background: #ffffff;
    color: #1d2528;
    font: inherit;
    font-size: 13px;
    padding: 3px 6px;
    max-width: 160px;
  }

  .condition-apply {
    border: 1px solid #28494c;
    border-radius: 4px;
    background: #28494c;
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
  }

  .condition-apply.secondary {
    border-color: #9aa7a3;
    color: #263235;
    background: #ffffff;
  }

  .card-turn-actions {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #cfd6d1;
  }

  .card-turn-actions button.turn {
    min-height: 36px;
    border: 1px solid #28494c;
    border-radius: 6px;
    background: #28494c;
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 7px 11px;
  }

  .card-turn-actions button.turn.secondary {
    border-color: #9aa7a3;
    color: #263235;
    background: #ffffff;
  }

  .card-turn-actions button.turn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (max-width: 760px) {
    .card-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .card-turn-actions button.turn {
      width: 100%;
    }
  }
</style>
