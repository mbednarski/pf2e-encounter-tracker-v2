<script lang="ts">
  import { getAdjustedView } from '../domain';
  import type { CombatantState, EncounterState, Prompt, PromptResolution } from '../domain';
  import {
    clampValue,
    combatantFaction,
    combatantVisualState,
    computeCombatantStats,
    formatStatTooltip,
    resolveApplyChoice,
    type AppliedEffectView,
    type ApplyConditionChoice,
    type CombatantCardActionAvailability,
    type CombatantFaction,
    type ConditionOption
  } from '$lib/encounter-app';
  import type { CommittableEdit, HpEditField } from '$lib/hp-input';
  import { formatModifier } from '$lib/abilities/format-damage';
  import { templateLabel } from '$lib/template-label';
  import { persistentEffectIdToDamageType } from '$lib/effects/damage-type-glyph';
  import InlineNumberEdit from './InlineNumberEdit.svelte';
  import Button from './ui/Button.svelte';
  import Chip from './ui/Chip.svelte';
  import IconButton from './ui/IconButton.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';
  import StatRollButton from './ui/StatRollButton.svelte';
  import DamageTypeGlyph from './ui/DamageTypeGlyph.svelte';
  import CombatantPromptResolution from './CombatantPromptResolution.svelte';

  type SaveKey = 'fortitude' | 'reflex' | 'will';

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
  export let onRollSave: (
    combatantId: string,
    save: SaveKey,
    origin: { x: number; y: number }
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
      'button, a, input, select, textarea, summary, [role="button"], [contenteditable="true"]'
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
    onSetInitiative(combatant.id, die + computed.perception.final);
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

  $: adjustedView = getAdjustedView(combatant);
  $: hpPercent = Math.max(
    0,
    Math.min(100, (combatant.currentHp / adjustedView.hp) * 100)
  );

  $: hpTone =
    hpPercent >= 60 ? 'healthy' : hpPercent >= 30 ? 'wounded' : 'critical';

  $: visualState = combatantVisualState(combatant);

  $: faction = combatantFaction(combatant);
  $: factionLabel = factionDisplayLabel(faction);

  function factionDisplayLabel(f: CombatantFaction): string {
    switch (f) {
      case 'pc':
        return 'PC';
      case 'ally':
        return 'Ally';
      case 'hazard':
        return 'Hazard';
      case 'enemy':
      default:
        return 'Enemy';
    }
  }

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

  $: computed = computeCombatantStats(combatant);
  $: acTooltip = formatStatTooltip(computed.ac.base, computed.ac.final, computed.ac.modifiers);
  $: fortTooltip = formatStatTooltip(
    computed.fortitude.base,
    computed.fortitude.final,
    computed.fortitude.modifiers
  );
  $: refTooltip = formatStatTooltip(
    computed.reflex.base,
    computed.reflex.final,
    computed.reflex.modifiers
  );
  $: willTooltip = formatStatTooltip(
    computed.will.base,
    computed.will.final,
    computed.will.modifiers
  );

  $: fortAriaLabel = `Roll ${combatant.name} Fortitude save (${formatModifier(computed.fortitude.final)})`;
  $: refAriaLabel = `Roll ${combatant.name} Reflex save (${formatModifier(computed.reflex.final)})`;
  $: willAriaLabel = `Roll ${combatant.name} Will save (${formatModifier(computed.will.final)})`;
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
  class:current-card={isCurrent}
  class:selected-card={isSelected}
  class:selectable={Boolean(onSelect)}
  class:dimmed={visualState !== 'alive'}
  data-visual-state={visualState}
  data-hp-tone={hpTone}
  data-faction={faction}
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
    <div class="card-title">
      <span
        class="faction-tag"
        data-faction={faction}
        aria-label={`${factionLabel}`}
      >{factionLabel}</span>
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
    <div class="card-aside">
      <Chip variant={isCurrent ? 'success' : 'default'}>
        {isCurrent ? 'Turn' : phase}
      </Chip>
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

  {#if phase === 'PREPARING' && onSetInitiative}
    <div class="card-initiative-row" aria-label="Initiative">
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
        class:modified={computed.perception.final !== computed.perception.base}
        title={formatStatTooltip(
          computed.perception.base,
          computed.perception.final,
          computed.perception.modifiers
        )}
        aria-label={`Perception modifier ${computed.perception.final >= 0 ? '+' : ''}${computed.perception.final}`}
      >({computed.perception.final >= 0 ? '+' : ''}{computed.perception.final} Perception)</span>
    </div>
  {/if}

  <div class="stat-strip">
    <div class="stat-cell stat-cell--hp">
      <SectionLabel>HP</SectionLabel>
      <div class="hp-row">
        <div class="hp-cell">
          <InlineNumberEdit
            value={combatant.currentHp}
            ariaLabel="Edit HP. Type 42 to set, +3 to heal, minus 5 to damage."
            displayAriaLabel={`HP ${combatant.currentHp} of ${adjustedView.hp}, click to edit`}
            placeholder="−5, +3, 42"
            displayClass="hp-value"
            onCommit={(parsed) => onHpEdit(combatant.id, 'hp', parsed)}
          />
          <span class="hp-max">/ {adjustedView.hp}</span>
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
    </div>
    <div class="stat-cell stat-cell--defenses" aria-label="Defenses">
      <div
        class="stat-readout"
        title={acTooltip}
        aria-label={`Armor Class ${computed.ac.final}${computed.ac.final !== computed.ac.base ? ` (base ${computed.ac.base})` : ''}`}
      >
        <span class="stat-readout__label">AC</span>
        <span
          class="stat-readout__value"
          class:modified={computed.ac.final !== computed.ac.base}
        >{computed.ac.final}</span>
      </div>
      <StatRollButton
        label="Fort"
        modifier={computed.fortitude.final}
        tone="save"
        ariaLabel={fortAriaLabel}
        breakdownTitle={fortTooltip}
        modified={computed.fortitude.final !== computed.fortitude.base}
        onRoll={(origin) => onRollSave(combatant.id, 'fortitude', origin)}
      />
      <StatRollButton
        label="Ref"
        modifier={computed.reflex.final}
        tone="save"
        ariaLabel={refAriaLabel}
        breakdownTitle={refTooltip}
        modified={computed.reflex.final !== computed.reflex.base}
        onRoll={(origin) => onRollSave(combatant.id, 'reflex', origin)}
      />
      <StatRollButton
        label="Will"
        modifier={computed.will.final}
        tone="save"
        ariaLabel={willAriaLabel}
        breakdownTitle={willTooltip}
        modified={computed.will.final !== computed.will.base}
        onRoll={(origin) => onRollSave(combatant.id, 'will', origin)}
      />
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
    <details class="card-overflow">
      <summary
        class="card-overflow__toggle"
        aria-label={`More actions for ${combatant.name}`}
        title="More actions"
      >⋯</summary>
      <div class="card-overflow__menu" role="menu">
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
    </details>
  </div>
</article>

<style>
  .combatant-card {
    position: relative;
    background: var(--color-panel-2);
    border: var(--border-thin);
    border-left: 3px solid var(--color-rule-strong);
    padding: var(--space-2) var(--space-3);
    transition: background 0.12s, border-color 0.12s;
  }

  .combatant-card[data-faction='pc'] {
    border-left-color: var(--faction-pc);
  }

  .combatant-card[data-faction='ally'] {
    border-left-color: var(--faction-pc);
  }

  .combatant-card[data-faction='enemy'] {
    border-left-color: var(--faction-enemy);
  }

  .combatant-card[data-faction='hazard'] {
    border-left-color: var(--faction-hazard);
  }

  /* Active card — lifted to eggshell paper, with a soft halo around it.
     Halo uses --color-blue-soft so the eye is drawn without a bulb-bright
     surface. The card resting state stays calm. */
  .current-card {
    background: var(--color-panel-up);
    border-color: var(--color-rule-strong);
    box-shadow:
      0 0 0 3px var(--color-blue-soft),
      var(--shadow-soft);
  }

  .selected-card {
    box-shadow:
      inset 0 0 0 2px var(--color-blue),
      0 1px 2px rgba(20, 20, 14, 0.08);
  }

  .selected-card.current-card {
    box-shadow:
      inset 0 0 0 2px var(--color-blue),
      0 0 0 4px var(--color-blue-soft),
      var(--shadow-soft);
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
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }

  .faction-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 1px 5px;
    border: 1px solid currentColor;
    border-radius: 2px;
    flex: 0 0 auto;
    line-height: 1.2;
  }

  .faction-tag[data-faction='pc'],
  .faction-tag[data-faction='ally'] {
    color: var(--faction-pc);
  }

  .faction-tag[data-faction='enemy'] {
    color: var(--faction-enemy);
  }

  .faction-tag[data-faction='hazard'] {
    color: var(--faction-hazard);
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
    align-items: center;
    gap: var(--space-2);
    flex: 0 0 auto;
  }

  .card-reorder {
    display: flex;
    flex-direction: row;
    gap: 2px;
  }

  .card-initiative-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: var(--space-2);
    padding: 4px 8px;
    background: var(--color-panel);
    border: var(--border-thin);
    border-radius: var(--radius-card, 4px);
    flex-wrap: wrap;
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

  .stat-strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px dashed var(--color-rule);
    flex-wrap: wrap;
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-cell--hp {
    flex: 1 1 auto;
    min-width: 0;
  }

  .stat-cell--defenses {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
    flex-wrap: wrap;
  }

  .stat-readout {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--color-panel-2);
    border: 1px solid var(--color-rule);
    cursor: default;
  }

  .stat-readout__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .stat-readout__value {
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-ink);
  }

  .stat-readout__value.modified {
    color: var(--effect-cond);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }

  .card-initiative__hint.modified {
    color: var(--effect-cond);
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
    color: var(--hp-warn);
  }

  [data-hp-tone='critical'] .stat-cell--hp :global(.hp-value) {
    color: var(--hp-crit);
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
    margin-top: var(--space-2);
    width: 100%;
  }

  .hp-fill {
    height: 100%;
    background: var(--hp-ok);
    transition: width 0.18s ease, background 0.18s ease;
  }

  [data-hp-tone='wounded'] .hp-fill {
    background: var(--hp-warn);
  }

  [data-hp-tone='critical'] .hp-fill {
    background: var(--hp-crit);
  }

  .conditions {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-2);
  }

  .conditions-empty {
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
    font-style: italic;
  }

  /* Default condition chip — bronze/amber. A *condition* is a status
     effect on the creature (Frightened, Sickened, Off-Guard...). */
  .condition-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--effect-cond);
    background: var(--effect-cond-soft);
    color: var(--effect-cond);
    font-size: var(--text-sm);
    font-weight: 600;
    padding: 2px var(--space-2);
  }

  .condition-chip--implied {
    background: transparent;
    border-style: dashed;
    opacity: 0.85;
  }

  /* Persistent damage — distinct from a regular condition. Filled red
     because it ticks at end of turn and the player needs to see it. */
  .condition-chip--persistent {
    background: var(--effect-pers-soft);
    border-color: var(--effect-pers);
    border-left: 3px solid var(--effect-pers);
    color: var(--effect-pers);
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
    color: var(--effect-pers);
    background: var(--color-panel-up);
    padding: 0 4px;
    border: 1px solid var(--effect-pers);
    border-radius: 2px;
  }

  .condition-duration {
    color: currentColor;
    opacity: 0.7;
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
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px dashed var(--color-rule);
  }

  .card-overflow {
    position: relative;
  }

  .card-overflow__toggle {
    list-style: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
    padding: 0;
    border: var(--border-thin);
    border-radius: var(--radius-card, 4px);
    background: transparent;
    color: var(--color-ink-mute);
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
  }

  .card-overflow__toggle::-webkit-details-marker {
    display: none;
  }

  .card-overflow__toggle:hover {
    border-color: var(--color-ink);
    color: var(--color-ink);
  }

  .card-overflow__toggle:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  .card-overflow[open] .card-overflow__toggle {
    border-color: var(--color-ink);
    color: var(--color-ink);
  }

  .card-overflow__menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card, 4px);
    box-shadow: var(--shadow-soft);
    z-index: 5;
    white-space: nowrap;
  }

  @media (max-width: 760px) {
    .card-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .card-aside {
      justify-content: space-between;
    }

    .stat-strip {
      align-items: stretch;
    }

    .stat-cell--defenses {
      flex-wrap: wrap;
    }
  }
</style>
