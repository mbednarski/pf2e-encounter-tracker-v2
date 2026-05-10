<script lang="ts">
  import type { CombatantState, EncounterState, Prompt, PromptResolution } from '../domain';
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
  import { templateLabel } from '$lib/template-label';
  import { persistentEffectIdToDamageType } from '$lib/effects/damage-type-glyph';
  import InlineNumberEdit from './InlineNumberEdit.svelte';
  import Button from './ui/Button.svelte';
  import Chip from './ui/Chip.svelte';
  import IconButton from './ui/IconButton.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';
  import DamageTypeGlyph from './ui/DamageTypeGlyph.svelte';
  import CombatantPromptResolution from './CombatantPromptResolution.svelte';

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
  export let isSelected: boolean = false;
  export let onSelect: ((id: string) => void) | undefined = undefined;
  export let onRequestRadial:
    | ((id: string, anchor: { x: number; y: number }) => void)
    | undefined = undefined;
  export let initiativeScore: number | undefined = undefined;
  export let onSetInitiative: ((id: string, value: number | null) => void) | undefined = undefined;
  export let pendingPrompts: Prompt[] = [];
  export let combatantsById: Record<string, CombatantState> = {};
  export let onResolvePrompt: (promptId: string, resolution: PromptResolution) => void = () => {};
  export let onApplyPersistentDamage: (
    combatantId: string,
    amount: number,
    damageType: string
  ) => void = () => {};

  $: cardPrompts = pendingPrompts.filter((p) => p.targetId === combatant.id);

  const LONG_PRESS_MS = 400;
  const LONG_PRESS_TOLERANCE_PX = 6;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressStart: { x: number; y: number } | null = null;
  let longPressFired = false;

  function clearLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressStart = null;
  }

  function handleContextMenu(event: MouseEvent) {
    if (!onRequestRadial) return;
    event.preventDefault();
    onRequestRadial(combatant.id, { x: event.clientX, y: event.clientY });
  }

  function handleArticlePointerDown(event: PointerEvent) {
    if (!onRequestRadial) return;
    if (event.pointerType !== 'touch') return;
    if (event.target !== event.currentTarget) return;
    longPressFired = false;
    longPressStart = { x: event.clientX, y: event.clientY };
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      longPressTimer = null;
      if (longPressStart) {
        onRequestRadial?.(combatant.id, { x: longPressStart.x, y: longPressStart.y });
      }
    }, LONG_PRESS_MS);
  }

  function handleArticlePointerMove(event: PointerEvent) {
    if (longPressTimer === null || longPressStart === null) return;
    const dx = event.clientX - longPressStart.x;
    const dy = event.clientY - longPressStart.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX) {
      clearLongPress();
    }
  }

  function handleArticlePointerEnd() {
    clearLongPress();
  }

  function isInnerInteractive(target: EventTarget | null, card: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    const hit = target.closest(
      'button, a, input, select, textarea, [role="button"], [contenteditable="true"]'
    );
    return hit !== null && hit !== card;
  }

  function handleArticleClick(event: MouseEvent) {
    if (!onSelect) return;
    if (isInnerInteractive(event.target, event.currentTarget)) return;
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    onSelect(combatant.id);
  }

  function handleArticleKeyDown(event: KeyboardEvent) {
    if (!onSelect) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isInnerInteractive(event.target, event.currentTarget)) return;
    event.preventDefault();
    onSelect(combatant.id);
  }

  let initiativeDraft: number | null = null;
  let lastSyncedScore: number | undefined = undefined;
  $: if (initiativeScore !== lastSyncedScore) {
    initiativeDraft = initiativeScore ?? null;
    lastSyncedScore = initiativeScore;
  }

  function commitInitiativeDraft() {
    if (!onSetInitiative) return;
    if (initiativeDraft === null) {
      if (initiativeScore !== undefined) onSetInitiative(combatant.id, null);
      return;
    }
    if (!Number.isFinite(initiativeDraft)) {
      initiativeDraft = initiativeScore ?? null;
      return;
    }
    if (initiativeDraft === initiativeScore) return;
    onSetInitiative(combatant.id, initiativeDraft);
  }

  function handleInitiativeKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      initiativeDraft = initiativeScore ?? null;
      (event.target as HTMLInputElement).blur();
    }
  }

  function rollInitiative() {
    if (!onSetInitiative) return;
    const die = Math.floor(Math.random() * 20) + 1;
    onSetInitiative(combatant.id, die + combatant.baseStats.perception);
  }

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

  $: hpPercent = Math.max(
    0,
    Math.min(100, (combatant.currentHp / combatant.baseStats.hp) * 100)
  );

  $: hpTone =
    hpPercent >= 60 ? 'healthy' : hpPercent >= 30 ? 'wounded' : 'critical';

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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
  class:current-card={isCurrent}
  class:selected-card={isSelected}
  class:selectable={Boolean(onSelect)}
  class:dimmed={visualState !== 'alive'}
  data-visual-state={visualState}
  data-hp-tone={hpTone}
  class="combatant-card"
  role={onSelect ? 'button' : undefined}
  tabindex={onSelect ? 0 : -1}
  aria-label={onSelect ? `Select ${combatant.name}` : undefined}
  oncontextmenu={handleContextMenu}
  onpointerdown={handleArticlePointerDown}
  onpointermove={handleArticlePointerMove}
  onpointerup={handleArticlePointerEnd}
  onpointercancel={handleArticlePointerEnd}
  onclick={handleArticleClick}
  onkeydown={handleArticleKeyDown}
>
  <div class="card-heading">
    <div class="card-heading__main">
      <div class="card-title">
        <h2>
          <button
            type="button"
            class="card-name-button"
            aria-pressed={isSelected}
            title={isSelected ? `${combatant.name} is selected` : `Show details for ${combatant.name}`}
            onclick={() => onSelect?.(combatant.id)}
          >{combatant.name}</button>
        </h2>
        {#if combatant.templateAdjustment}
          <Chip variant={combatant.templateAdjustment === 'elite' ? 'warning' : 'default'}>
            {templateLabel(combatant.templateAdjustment)}
          </Chip>
        {/if}
        {#if visualState === 'dead'}
          <Chip variant="danger">Dead</Chip>
        {:else if visualState === 'unconscious'}
          <Chip variant="warning">Unconscious</Chip>
        {/if}
      </div>
    </div>
    <div class="card-aside">
      <Chip variant={isCurrent ? 'success' : 'default'}>
        {isCurrent ? 'Turn' : phase}
      </Chip>
      {#if phase === 'PREPARING' && onSetInitiative}
        <div class="card-initiative" aria-label="Initiative">
          <SectionLabel>Init</SectionLabel>
          <input
            type="number"
            class="card-initiative__input"
            aria-label={`Initiative for ${combatant.name}`}
            placeholder="—"
            bind:value={initiativeDraft}
            onblur={commitInitiativeDraft}
            onkeydown={handleInitiativeKey}
          />
          <Button
            size="sm"
            variant="secondary"
            ariaLabel={`Roll initiative for ${combatant.name}`}
            onclick={rollInitiative}
          >Roll</Button>
          <span
            class="card-initiative__hint"
            aria-label={`Perception modifier ${combatant.baseStats.perception >= 0 ? '+' : ''}${combatant.baseStats.perception}`}
          >({combatant.baseStats.perception >= 0 ? '+' : ''}{combatant.baseStats.perception} Perception)</span>
        </div>
      {/if}
      <div class="card-reorder" aria-label="Reorder">
        <IconButton
          ariaLabel={`Move ${combatant.name} up`}
          title="Move up"
          size={22}
          disabled={isFirst}
          onclick={() => onMove(combatant.id, -1)}
        >↑</IconButton>
        <IconButton
          ariaLabel={`Move ${combatant.name} down`}
          title="Move down"
          size={22}
          disabled={isLast}
          onclick={() => onMove(combatant.id, 1)}
        >↓</IconButton>
      </div>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-cell stat-cell--ac">
      <SectionLabel>AC</SectionLabel>
      <span class="stat-cell__value">{combatant.baseStats.ac}</span>
    </div>
    <div class="stat-cell stat-cell--hp">
      <SectionLabel>HP</SectionLabel>
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
          <span class="hp-max">/ {combatant.baseStats.hp}</span>
        </div>
        <div class="hp-cell hp-cell--temp">
          <InlineNumberEdit
            value={combatant.tempHp}
            ariaLabel="Edit temp HP. Type 5 to set, +3 to add, minus 2 to remove."
            displayAriaLabel={combatant.tempHp === 0
              ? 'Add temporary HP'
              : `Temp HP ${combatant.tempHp}, click to edit`}
            placeholder="+3, 5, −2"
            displayClass="temp-hp-value"
            emptyDisplay="+ temp"
            onCommit={(parsed) => onHpEdit(combatant.id, 'tempHp', parsed)}
          />
          {#if combatant.tempHp > 0}
            <span class="hp-temp-label">temp</span>
          {/if}
        </div>
      </div>
      <div class="hp-track" aria-label={`${combatant.name} HP`}>
        <div class="hp-fill" style={`width: ${hpPercent}%`}></div>
      </div>
    </div>
    <div class="stat-cell stat-cell--saves">
      <div class="save">
        <SectionLabel>Fort</SectionLabel>
        <span class="save__value">+{combatant.baseStats.fortitude}</span>
      </div>
      <div class="save">
        <SectionLabel>Ref</SectionLabel>
        <span class="save__value">+{combatant.baseStats.reflex}</span>
      </div>
      <div class="save">
        <SectionLabel>Will</SectionLabel>
        <span class="save__value">+{combatant.baseStats.will}</span>
      </div>
    </div>
  </div>

  <div class="conditions" aria-label={`${combatant.name} conditions`}>
    {#if appliedEffectsView.length === 0 && !pickerOpen}
      <span class="conditions-empty">No conditions.</span>
    {/if}

    {#each appliedEffectsView as view (view.instanceId)}
      {@const isPersistent = view.effectId.startsWith('persistent-')}
      {@const damageType = isPersistent ? persistentEffectIdToDamageType(view.effectId) : null}
      <span
        class="condition-chip"
        class:condition-chip--implied={view.source.kind === 'implied'}
        class:condition-chip--persistent={isPersistent}
      >
        {#if isPersistent && damageType}
          <DamageTypeGlyph type={damageType} />
        {/if}
        <span class="condition-name">{isPersistent ? (damageType ?? view.name) : view.name}</span>
        {#if isPersistent && view.note}
          <span class="condition-dice">{view.note}</span>
        {/if}
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
            <Button size="sm" variant="primary" onclick={() => commitEdit(view)}>Set</Button>
            <Button size="sm" variant="secondary" onclick={cancelEdit}>Cancel</Button>
          {:else}
            <IconButton
              size={22}
              ariaLabel={`Decrease ${view.name}`}
              onclick={() => onModifyConditionValue(combatant.id, view.instanceId, -1)}
            >−</IconButton>
            <button
              type="button"
              class="condition-value"
              onclick={() => startEdit(view)}
              title="Click to edit"
              aria-label={`${view.name} value ${view.value.current}, click to edit`}
            >{view.value.current}</button>
            <IconButton
              size={22}
              ariaLabel={`Increase ${view.name}`}
              onclick={() => onModifyConditionValue(combatant.id, view.instanceId, 1)}
            >+</IconButton>
          {/if}
        {/if}
        <span class="condition-duration">{view.durationLabel}</span>
        {#if view.source.kind === 'implied'}
          <span class="condition-parent">via {view.source.parentName}</span>
        {/if}
        <IconButton
          size={22}
          variant="destructive"
          ariaLabel={`Remove ${view.name}`}
          title="Remove"
          onclick={() => onRemoveCondition(combatant.id, view.instanceId)}
        >✕</IconButton>
      </span>
    {/each}

    {#if !pickerOpen}
      <Button
        size="sm"
        variant="ghost"
        ariaLabel="Add condition"
        disabled={conditionOptions.length === 0}
        onclick={openPicker}
      >+ Condition</Button>
    {:else}
      <div class="condition-picker" role="group" aria-label="Apply condition">
        <select bind:value={pickerEffectId} aria-label="Condition" class="condition-picker__select">
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
        <Button size="sm" variant="primary" onclick={applyFromPicker}>Apply</Button>
        <Button size="sm" variant="secondary" onclick={cancelPicker}>Cancel</Button>
      </div>
    {/if}
  </div>

  {#if cardPrompts.length > 0}
    <div class="card-prompt-resolution">
      <CombatantPromptResolution
        prompts={cardPrompts}
        {combatantsById}
        {phase}
        onResolve={onResolvePrompt}
        {onApplyPersistentDamage}
      />
    </div>
  {/if}

  <div class="card-turn-actions" aria-label="Turn and lifecycle controls">
    <Button
      size="sm"
      variant="primary"
      ariaLabel="End turn"
      title={endTurnTitle}
      disabled={!actions.canEndTurn}
      onclick={() => onEndTurn(combatant.id)}
    >End Turn</Button>
    <Button
      size="sm"
      variant="secondary"
      ariaLabel="Reaction used"
      title={reactionTitle}
      disabled={!actions.canMarkReactionUsed}
      onclick={() => onMarkReactionUsed(combatant.id)}
    >Reaction Used</Button>
    <Button
      size="sm"
      variant="secondary"
      ariaLabel="Mark dead"
      title={markDeadTitle}
      disabled={!actions.canMarkDead}
      onclick={() => onMarkDead(combatant.id)}
    >Mark Dead</Button>
    <Button
      size="sm"
      variant="secondary"
      ariaLabel="Revive"
      title={reviveTitle}
      disabled={!actions.canRevive}
      onclick={() => onRevive(combatant.id)}
    >Revive</Button>
  </div>
</article>

<style>
  .combatant-card {
    position: relative;
    background: var(--color-panel-2);
    border: var(--border-thin);
    border-left: 3px solid var(--color-rule-strong);
    padding: var(--space-3) var(--space-4);
    transition: background 0.12s, border-color 0.12s;
  }

  .current-card {
    background: var(--color-panel);
    border-color: var(--color-ink);
    border-left-color: var(--color-ink);
    box-shadow: var(--shadow-soft);
  }

  .selected-card {
    box-shadow: inset 0 0 0 2px var(--color-blue), 0 1px 2px rgba(31, 26, 20, 0.08);
  }

  .selected-card.current-card {
    box-shadow: inset 0 0 0 2px var(--color-blue), var(--shadow-soft);
  }

  .combatant-card.selectable {
    cursor: pointer;
  }

  .combatant-card:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  .combatant-card.dimmed {
    background: var(--color-rule);
    opacity: 0.72;
  }

  .combatant-card.dimmed .hp-fill {
    background: var(--color-ink-mute);
  }

  .card-name-button {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .card-name-button:hover,
  .card-name-button:focus-visible {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    outline: none;
  }

  .card-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .card-heading__main {
    min-width: 0;
    flex: 1;
  }

  .card-title {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 600;
    line-height: var(--leading-tight);
    color: var(--color-ink);
  }

  .card-aside {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .card-reorder {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-initiative {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    background: var(--color-panel);
    border: var(--border-thin);
    border-radius: var(--radius-card, 4px);
  }

  .card-initiative__input {
    width: 56px;
    padding: 2px 6px;
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-align: right;
    border: 1px solid var(--color-rule-strong);
    border-radius: 3px;
    background: var(--color-bg);
    color: inherit;
  }

  .card-initiative__input:focus-visible {
    outline: 2px solid var(--color-blue, var(--color-amber));
    outline-offset: 1px;
  }

  .card-initiative__hint {
    font-size: 11px;
    color: var(--color-ink-mute);
    white-space: nowrap;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    gap: var(--space-3);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px dashed var(--color-rule);
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-cell--ac {
    align-items: center;
  }

  .stat-cell--ac .stat-cell__value {
    font-family: var(--font-serif);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-ink);
    line-height: var(--leading-tight);
  }

  .stat-cell--hp {
    min-width: 0;
  }

  .hp-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .hp-cell {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    font-family: var(--font-mono);
  }

  .stat-cell--hp :global(.hp-value) {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-ink);
    font-family: var(--font-mono);
  }

  .stat-cell--hp :global(.temp-hp-value) {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-blue);
    font-family: var(--font-mono);
  }

  [data-hp-tone='wounded'] .stat-cell--hp :global(.hp-value) {
    color: var(--color-amber);
  }

  [data-hp-tone='critical'] .stat-cell--hp :global(.hp-value) {
    color: var(--color-red);
  }

  .hp-max {
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
  }

  .hp-temp-label {
    color: var(--color-blue);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .hp-track {
    height: 6px;
    overflow: hidden;
    background: var(--color-hp-bg);
    border: 1px solid var(--color-rule);
    margin-top: var(--space-1);
  }

  .hp-fill {
    height: 100%;
    background: var(--color-green);
    transition: width 0.18s ease, background 0.18s ease;
  }

  [data-hp-tone='wounded'] .hp-fill {
    background: var(--color-amber);
  }

  [data-hp-tone='critical'] .hp-fill {
    background: var(--color-red);
  }

  .stat-cell--saves {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    text-align: center;
  }

  .save {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .save__value {
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-ink);
  }

  .conditions {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-3);
  }

  .conditions-empty {
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .condition-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: var(--border-thin);
    background: var(--color-panel);
    color: var(--color-ink);
    font-size: var(--text-sm);
    font-weight: 600;
    padding: 2px var(--space-2);
  }

  .condition-chip--implied {
    background: transparent;
    border-style: dashed;
    opacity: 0.78;
  }

  .condition-chip--persistent {
    background: #fff3f0;
    border-color: var(--color-red);
    border-left: 3px solid var(--color-red);
    color: var(--color-red);
  }

  .condition-chip--persistent .condition-name {
    text-transform: capitalize;
  }

  .condition-name {
    font-weight: 700;
  }

  .condition-dice {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-red);
    background: #fff;
    padding: 0 4px;
    border: var(--border-thin);
    border-color: var(--color-red);
    border-radius: 2px;
  }

  .condition-duration {
    color: var(--color-ink-mute);
    font-weight: 500;
    font-size: var(--text-xs);
  }

  .card-prompt-resolution {
    margin-top: var(--space-2);
  }

  .condition-parent {
    color: var(--color-ink-mute);
    font-size: var(--text-xs);
    font-style: italic;
  }

  .condition-value {
    border: var(--border-thin);
    background: var(--color-panel);
    color: var(--color-ink);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1;
    min-width: 22px;
    padding: 2px 6px;
  }

  .condition-value-input {
    border: var(--border-thin);
    background: var(--color-panel);
    color: var(--color-ink);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    padding: 2px 4px;
    width: 48px;
  }

  .condition-picker {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: var(--border-strong);
    background: var(--color-panel);
    padding: 4px var(--space-2);
  }

  .condition-picker__select {
    border: var(--border-thin);
    background: var(--color-panel);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-base);
    padding: 3px 6px;
    max-width: 160px;
  }

  .card-turn-actions {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px dashed var(--color-rule);
  }

  @media (max-width: 760px) {
    .card-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .stat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
