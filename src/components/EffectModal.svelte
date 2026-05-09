<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    resolveApplyChoice,
    type ApplyConditionChoice,
    type AppliedEffectView,
    type ConditionGroup,
    type ConditionOption,
    type EffectModalTab
  } from '$lib/encounter-app';
  import type { Duration } from '../domain';

  export let combatantName: string;
  export let combatantHpLabel: string;
  export let initialTab: EffectModalTab = 'applied';
  export let appliedEffects: AppliedEffectView[];
  export let conditionGroups: ConditionGroup[];
  export let persistentOptions: ConditionOption[];
  export let afflictionOptions: ConditionOption[];
  export let effectOptions: ConditionOption[];
  export let otherCombatants: Array<{ id: string; name: string }> = [];
  export let onApply: (choice: ApplyConditionChoice) => void;
  export let onModifyValue: (instanceId: string, delta: number) => void;
  export let onSetDuration: (instanceId: string, newDuration: Duration) => void;
  export let onRemove: (instanceId: string) => void;
  export let onClose: () => void;

  type DurationKind = Duration['type'];

  const TABS: ReadonlyArray<{ id: EffectModalTab; label: string }> = [
    { id: 'applied', label: 'Applied' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'persistent', label: 'Persistent' },
    { id: 'afflictions', label: 'Afflictions' },
    { id: 'effects', label: 'Effects' }
  ];

  const PERSISTENT_DAMAGE_QUICK_PICKS = [
    '1d4',
    '1d6',
    '1d8',
    '1d10',
    '1d12',
    '2d4',
    '2d6',
    '2d8'
  ] as const;
  const DEFAULT_PERSISTENT_FORMULA = '1d6';

  let activeTab: EffectModalTab = initialTab;
  let conditionSearch = '';
  let valuePickerForId: string | null = null;
  let valuePickerValue = 1;
  let valuePickerSource: 'conditions' | 'afflictions' = 'conditions';
  let persistentFormulaForId: string | null = null;
  let persistentFormula = DEFAULT_PERSISTENT_FORMULA;
  let durationEditorForId: string | null = null;
  let durationKindBuf: DurationKind = 'unlimited';
  let durationCountBuf = 1;
  let durationCombatantBuf = '';
  let durationDescriptionBuf = '';
  let cardEl: HTMLDivElement | null = null;
  let returnFocusTo: HTMLElement | null = null;

  $: filteredConditionGroups = filterGroups(conditionGroups, conditionSearch);

  function filterGroups(groups: ConditionGroup[], search: string): ConditionGroup[] {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return groups;
    return groups
      .map((group) => ({
        label: group.label,
        options: group.options.filter((option) => option.name.toLowerCase().includes(trimmed))
      }))
      .filter((group) => group.options.length > 0);
  }

  function applyFromList(option: ConditionOption, source: 'conditions' | 'afflictions' | 'effects') {
    if (option.value.kind === 'unvalued') {
      onApply(resolveApplyChoice(option, 1));
      return;
    }
    valuePickerSource = source === 'effects' ? 'conditions' : source;
    valuePickerForId = option.id;
    valuePickerValue = option.value.defaultValue ?? 1;
  }

  function commitValuePicker(option: ConditionOption) {
    onApply(resolveApplyChoice(option, valuePickerValue));
    valuePickerForId = null;
  }

  function startPersistent(option: ConditionOption) {
    persistentFormulaForId = option.id;
    persistentFormula = DEFAULT_PERSISTENT_FORMULA;
  }

  function selectQuickPick(formula: string) {
    persistentFormula = formula;
  }

  function commitPersistent(option: ConditionOption) {
    onApply(resolveApplyChoice(option, 1, persistentFormula.trim() || undefined));
    persistentFormulaForId = null;
  }

  function startDurationEdit(view: AppliedEffectView) {
    durationEditorForId = view.instanceId;
    durationKindBuf = view.duration.type;
    durationCountBuf = view.duration.type === 'rounds' ? view.duration.count : 1;
    durationCombatantBuf =
      view.duration.type === 'untilTurnEnd' || view.duration.type === 'untilTurnStart'
        ? view.duration.combatantId
        : (otherCombatants[0]?.id ?? '');
    durationDescriptionBuf = view.duration.type === 'conditional' ? view.duration.description : '';
  }

  function commitDuration(view: AppliedEffectView) {
    let next: Duration | null = null;
    switch (durationKindBuf) {
      case 'unlimited':
        next = { type: 'unlimited' };
        break;
      case 'rounds': {
        const count = Math.max(1, Math.trunc(durationCountBuf));
        next = { type: 'rounds', count };
        break;
      }
      case 'untilTurnEnd':
      case 'untilTurnStart': {
        const combatantId = durationCombatantBuf;
        if (!combatantId) return;
        next = { type: durationKindBuf, combatantId };
        break;
      }
      case 'conditional':
        next = { type: 'conditional', description: durationDescriptionBuf.trim() || 'conditional' };
        break;
    }
    if (next) onSetDuration(view.instanceId, next);
    durationEditorForId = null;
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  function handleBackdrop() {
    onClose();
  }

  onMount(() => {
    returnFocusTo = (document.activeElement as HTMLElement) ?? null;
    void tick().then(() => cardEl?.focus());
    return () => {
      returnFocusTo?.focus?.();
    };
  });
</script>

<div class="modal-host">
  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close effect modal"
    onclick={handleBackdrop}
    tabindex="-1"
  ></button>
  <div
    bind:this={cardEl}
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-label={`Manage effects on ${combatantName}`}
    tabindex="-1"
    onkeydown={handleKey}
  >
    <header class="modal-header">
      <div>
        <h2>{combatantName}</h2>
        <p class="hp">{combatantHpLabel}</p>
      </div>
      <button type="button" class="close" aria-label="Close" onclick={onClose}>×</button>
    </header>

    <div class="tabs" role="tablist">
      {#each TABS as tab (tab.id)}
        <button
          type="button"
          class="tab"
          class:tab-active={activeTab === tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          data-tab={tab.id}
          onclick={() => {
            activeTab = tab.id;
            valuePickerForId = null;
            persistentFormulaForId = null;
            durationEditorForId = null;
          }}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="body">
      {#if activeTab === 'applied'}
        {#if appliedEffects.length === 0}
          <p class="empty">No effects applied to this combatant yet.</p>
        {:else}
          <ul class="applied-list">
            {#each appliedEffects as effect (effect.instanceId)}
              <li class="applied-row">
                <div class="applied-main">
                  <span class="applied-name">{effect.name}</span>
                  {#if effect.value.kind === 'valued'}
                    <span class="value-controls" aria-label="Value controls">
                      <button
                        type="button"
                        class="step"
                        aria-label={`Decrease ${effect.name}`}
                        disabled={effect.value.current <= 1}
                        onclick={() => onModifyValue(effect.instanceId, -1)}
                      >−</button>
                      <span class="value" aria-label={`${effect.name} value`}>{effect.value.current}</span>
                      <button
                        type="button"
                        class="step"
                        aria-label={`Increase ${effect.name}`}
                        disabled={
                          effect.value.maxValue !== undefined &&
                          effect.value.current >= effect.value.maxValue
                        }
                        onclick={() => onModifyValue(effect.instanceId, 1)}
                      >+</button>
                    </span>
                  {/if}
                  {#if effect.source.kind === 'implied'}
                    <span class="implied">from {effect.source.parentName}</span>
                  {/if}
                </div>
                <div class="applied-meta">
                  <span class="duration-label">{effect.durationLabel}</span>
                  {#if effect.source.kind === 'direct'}
                    <button
                      type="button"
                      class="meta-edit"
                      aria-label={`Edit duration for ${effect.name}`}
                      onclick={() => startDurationEdit(effect)}
                    >edit</button>
                  {/if}
                  {#if effect.note}
                    <span class="note">{effect.note}</span>
                  {/if}
                  {#if effect.source.kind === 'direct'}
                    <button
                      type="button"
                      class="remove"
                      aria-label={`Remove ${effect.name}`}
                      onclick={() => onRemove(effect.instanceId)}
                    >×</button>
                  {/if}
                </div>
                {#if durationEditorForId === effect.instanceId}
                  <div class="duration-editor">
                    <label>
                      Type
                      <select bind:value={durationKindBuf}>
                        <option value="unlimited">Unlimited</option>
                        <option value="rounds">Rounds</option>
                        <option value="untilTurnEnd">Until end of turn</option>
                        <option value="untilTurnStart">Until start of turn</option>
                        <option value="conditional">Conditional</option>
                      </select>
                    </label>
                    {#if durationKindBuf === 'rounds'}
                      <label>
                        Count
                        <input
                          type="number"
                          min="1"
                          bind:value={durationCountBuf}
                          aria-label="Round count"
                        />
                      </label>
                    {:else if durationKindBuf === 'untilTurnEnd' || durationKindBuf === 'untilTurnStart'}
                      <label>
                        Combatant
                        <select bind:value={durationCombatantBuf} aria-label="Combatant whose turn anchors the duration">
                          {#each otherCombatants as c (c.id)}
                            <option value={c.id}>{c.name}</option>
                          {/each}
                        </select>
                      </label>
                    {:else if durationKindBuf === 'conditional'}
                      <label class="full">
                        Description
                        <input type="text" bind:value={durationDescriptionBuf} aria-label="Conditional description" />
                      </label>
                    {/if}
                    <div class="duration-actions">
                      <button type="button" class="ghost" onclick={() => (durationEditorForId = null)}>Cancel</button>
                      <button type="button" class="primary" onclick={() => commitDuration(effect)}>Save</button>
                    </div>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      {:else if activeTab === 'conditions'}
        <div class="search-row">
          <input
            type="search"
            class="search"
            placeholder="Type to filter conditions…"
            aria-label="Filter conditions"
            bind:value={conditionSearch}
          />
        </div>
        {#if filteredConditionGroups.length === 0}
          <p class="empty">No conditions match your search.</p>
        {:else}
          {#each filteredConditionGroups as group (group.label)}
            <section class="group">
              <h3 class="group-label">{group.label}</h3>
              <div class="chip-row">
                {#each group.options as option (option.id)}
                  <div class="chip-wrap">
                    <button
                      type="button"
                      class="chip"
                      class:chip-active={valuePickerForId === option.id && valuePickerSource === 'conditions'}
                      data-option-id={option.id}
                      onclick={() => applyFromList(option, 'conditions')}
                    >
                      {option.name}
                    </button>
                    {#if valuePickerForId === option.id && valuePickerSource === 'conditions' && option.value.kind === 'valued'}
                      <div class="value-picker">
                        <input
                          type="number"
                          min="1"
                          max={option.value.maxValue ?? undefined}
                          bind:value={valuePickerValue}
                          aria-label={`Value for ${option.name}`}
                        />
                        <button type="button" class="primary" onclick={() => commitValuePicker(option)}>Apply</button>
                        <button type="button" class="ghost" onclick={() => (valuePickerForId = null)}>Cancel</button>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        {/if}
      {:else if activeTab === 'persistent'}
        {#if persistentOptions.length === 0}
          <p class="empty">No persistent damage types defined.</p>
        {:else}
          <p class="hint">Pick a damage type, then click a formula (or type a custom one).</p>
          <div class="chip-row">
            {#each persistentOptions as option (option.id)}
              <div class="chip-wrap">
                <button
                  type="button"
                  class="chip"
                  class:chip-active={persistentFormulaForId === option.id}
                  data-option-id={option.id}
                  onclick={() => startPersistent(option)}
                >
                  {option.name}
                </button>
                {#if persistentFormulaForId === option.id}
                  <div class="formula-picker" data-formula-picker>
                    <div class="formula-chips" role="group" aria-label="Quick formulas">
                      {#each PERSISTENT_DAMAGE_QUICK_PICKS as formula (formula)}
                        <button
                          type="button"
                          class="chip formula-chip"
                          class:chip-active={persistentFormula.trim() === formula}
                          data-formula={formula}
                          onclick={() => selectQuickPick(formula)}
                        >
                          {formula}
                        </button>
                      {/each}
                    </div>
                    <label class="custom-formula">
                      <span>Custom</span>
                      <input
                        type="text"
                        bind:value={persistentFormula}
                        aria-label={`${option.name} damage formula`}
                        placeholder="e.g. 2d6+3"
                      />
                    </label>
                    <div class="formula-actions">
                      <button type="button" class="primary" onclick={() => commitPersistent(option)}>Apply</button>
                      <button type="button" class="ghost" onclick={() => (persistentFormulaForId = null)}>Cancel</button>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {:else if activeTab === 'afflictions'}
        {#if afflictionOptions.length === 0}
          <p class="empty">No afflictions defined yet.</p>
        {:else}
          <div class="chip-row">
            {#each afflictionOptions as option (option.id)}
              <div class="chip-wrap">
                <button
                  type="button"
                  class="chip"
                  class:chip-active={valuePickerForId === option.id && valuePickerSource === 'afflictions'}
                  data-option-id={option.id}
                  onclick={() => applyFromList(option, 'afflictions')}
                >
                  {option.name}
                </button>
                {#if valuePickerForId === option.id && valuePickerSource === 'afflictions' && option.value.kind === 'valued'}
                  <div class="value-picker">
                    <input
                      type="number"
                      min="1"
                      max={option.value.maxValue ?? undefined}
                      bind:value={valuePickerValue}
                      aria-label={`Stage for ${option.name}`}
                    />
                    <button type="button" class="primary" onclick={() => commitValuePicker(option)}>Apply</button>
                    <button type="button" class="ghost" onclick={() => (valuePickerForId = null)}>Cancel</button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {:else if activeTab === 'effects'}
        {#if effectOptions.length === 0}
          <p class="empty">No spell effects defined yet.</p>
        {:else}
          <div class="chip-row">
            {#each effectOptions as option (option.id)}
              <button
                type="button"
                class="chip"
                data-option-id={option.id}
                onclick={() => applyFromList(option, 'effects')}
              >
                {option.name}
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    <footer class="actions">
      <button type="button" class="primary" onclick={onClose}>Done</button>
    </footer>
  </div>
</div>

<style>
  .modal-host {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(31, 26, 20, 0.42);
    border: 0;
    padding: 0;
    cursor: default;
    pointer-events: auto;
  }

  .modal-card {
    position: relative;
    pointer-events: auto;
    width: min(720px, 92vw);
    max-height: min(82vh, 720px);
    background: var(--color-bg);
    color: var(--color-ink);
    border: 1px solid var(--color-rule-strong);
    border-radius: 6px;
    box-shadow: 0 12px 32px rgba(31, 26, 20, 0.28);
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-rule);
  }

  .modal-header h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 700;
  }

  .hp {
    margin: 2px 0 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-ink-mute);
  }

  .close {
    background: transparent;
    border: 0;
    color: var(--color-ink-soft);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3) 0;
    border-bottom: 1px solid var(--color-rule);
  }

  .tab {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-mute);
    cursor: pointer;
  }

  .tab-active {
    color: var(--color-ink);
    border-bottom-color: var(--color-amber);
  }

  .body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-3) var(--space-4);
  }

  .empty {
    color: var(--color-ink-mute);
    font-size: 13px;
  }

  .hint {
    color: var(--color-ink-mute);
    font-size: 12px;
    margin: 0 0 var(--space-2);
  }

  .applied-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .applied-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-rule);
    border-radius: 4px;
    background: var(--color-panel);
  }

  .applied-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .applied-name {
    font-weight: 600;
  }

  .value-controls {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .step {
    width: 24px;
    height: 24px;
    border: 1px solid var(--color-rule-strong);
    background: var(--color-bg);
    border-radius: 4px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .value {
    min-width: 1.5em;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .implied {
    color: var(--color-ink-mute);
    font-size: 11px;
    font-style: italic;
  }

  .applied-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 12px;
    color: var(--color-ink-soft);
  }

  .duration-label {
    font-variant-numeric: tabular-nums;
  }

  .meta-edit {
    background: transparent;
    border: 0;
    color: var(--color-amber);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }

  .note {
    color: var(--color-ink-mute);
    font-style: italic;
  }

  .remove {
    background: transparent;
    border: 0;
    color: var(--color-red);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
  }

  .duration-editor {
    flex-basis: 100%;
    margin-top: var(--space-2);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: flex-end;
    background: var(--color-bg);
    border: 1px dashed var(--color-rule);
    border-radius: 4px;
    padding: var(--space-2);
  }

  .duration-editor label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    color: var(--color-ink-mute);
  }

  .duration-editor label.full {
    flex-basis: 100%;
  }

  .duration-editor input,
  .duration-editor select {
    font: inherit;
    padding: 4px 6px;
    border: 1px solid var(--color-rule-strong);
    border-radius: 3px;
    background: var(--color-bg);
    color: inherit;
  }

  .duration-actions {
    margin-left: auto;
    display: flex;
    gap: var(--space-2);
  }

  .search-row {
    margin-bottom: var(--space-3);
  }

  .search {
    width: 100%;
    padding: 6px 8px;
    font: inherit;
    border: 1px solid var(--color-rule-strong);
    border-radius: 4px;
    background: var(--color-bg);
    color: inherit;
  }

  .group {
    margin-bottom: var(--space-3);
  }

  .group-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-mute);
    margin: 0 0 var(--space-2);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chip {
    background: var(--color-bg);
    border: 1px solid var(--color-rule-strong);
    border-radius: 999px;
    padding: 4px 12px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    color: var(--color-ink);
  }

  .chip:hover,
  .chip:focus-visible {
    background: var(--color-panel);
  }

  .chip-active {
    background: var(--color-ink);
    color: var(--color-bg);
    border-color: var(--color-ink);
  }

  .value-picker {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background: var(--color-panel);
    border: 1px solid var(--color-rule);
    border-radius: 4px;
  }

  .value-picker input {
    width: 5ch;
    padding: 2px 4px;
    font: inherit;
    text-align: right;
    border: 1px solid var(--color-rule-strong);
    border-radius: 3px;
    background: var(--color-bg);
    color: inherit;
  }

  .primary {
    background: var(--color-ink);
    color: var(--color-bg);
    border: 0;
    border-radius: 4px;
    padding: 4px 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .ghost {
    background: transparent;
    color: var(--color-ink-mute);
    border: 0;
    border-radius: 4px;
    padding: 4px 10px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-rule);
  }

  .formula-picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-panel);
    border: 1px solid var(--color-rule);
    border-radius: 4px;
  }

  .formula-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .formula-chip {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 3px 10px;
  }

  .custom-formula {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 11px;
    color: var(--color-ink-mute);
  }

  .custom-formula input {
    flex: 1;
    padding: 2px 6px;
    font: inherit;
    font-family: var(--font-mono);
    border: 1px solid var(--color-rule-strong);
    border-radius: 3px;
    background: var(--color-bg);
    color: inherit;
  }

  .formula-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }
</style>
