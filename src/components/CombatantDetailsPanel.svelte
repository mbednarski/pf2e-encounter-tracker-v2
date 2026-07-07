<script lang="ts">
  import type { Ability, Attack, CombatantState, ComputedStats, TemplateAdjustment } from '../domain';
  import { adjustedAbility, adjustedAttack, adjustedSpellBlock, getAdjustedView } from '../domain';
  import { templateLabel } from '$lib/template-label';
  import { formatModifier } from '$lib/abilities/format-damage';
  import {
    computeCombatantStats,
    formatModifierBreakdown,
    formatStatTooltip,
    type AppliedEffectView
  } from '$lib/encounter-app';
  import type { MapVariant } from '$lib/dice/map';
  import Button from './ui/Button.svelte';
  import Chip from './ui/Chip.svelte';
  import IconButton from './ui/IconButton.svelte';
  import NotesEditor from './NotesEditor.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';
  import StatRollButton from './ui/StatRollButton.svelte';
  import AbilityCard from './details/AbilityCard.svelte';
  import AttackRow from './details/AttackRow.svelte';
  import HazardStatBlock from './details/HazardStatBlock.svelte';
  import SpellcastingBlockView from './details/SpellcastingBlockView.svelte';

  type SaveKey = 'fortitude' | 'reflex' | 'will';

  export let combatant: CombatantState | undefined;
  export let onSetNote: (combatantId: string, note: string | null) => void;
  export let onRollAttack: (
    combatantId: string,
    attack: Attack,
    variant: MapVariant,
    origin: { x: number; y: number }
  ) => void = () => {};
  export let onRollDamage: (
    combatantId: string,
    attack: Attack,
    origin: { x: number; y: number }
  ) => void = () => {};
  export let onRollSave: (
    combatantId: string,
    save: SaveKey,
    origin: { x: number; y: number }
  ) => void = () => {};
  export let onUseSpellSlot: (combatantId: string, blockId: string, rank: number) => void = () => {};
  export let onRestoreSpellSlot: (combatantId: string, blockId: string, rank: number) => void = () => {};
  export let onUseFocusPoint: (combatantId: string, blockId: string) => void = () => {};
  export let onRestoreFocusPoint: (combatantId: string, blockId: string) => void = () => {};
  export let onUseInnateSpell: (combatantId: string, blockId: string, spellSlug: string) => void = () => {};
  export let onRestoreInnateSpell: (combatantId: string, blockId: string, spellSlug: string) => void = () => {};
  export let onSetAdjustment: (combatantId: string, adjustment: TemplateAdjustment) => void = () => {};
  export let appliedEffectsView: AppliedEffectView[] = [];
  export let onModifyConditionValue: (
    combatantId: string,
    instanceId: string,
    delta: number
  ) => void = () => {};
  export let onRemoveCondition: (combatantId: string, instanceId: string) => void = () => {};
  export let onManageEffects: (combatantId: string) => void = () => {};

  type DetailsTab = 'statblock' | 'conditions' | 'notes';

  const TABS: ReadonlyArray<{ id: DetailsTab; label: string }> = [
    { id: 'statblock', label: 'Statblock' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'notes', label: 'Notes' }
  ];

  let activeTab: DetailsTab = 'statblock';
  let lastCombatantId: string | undefined = undefined;

  // Selecting a different combatant always lands on the statblock.
  $: if (combatant?.id !== lastCombatantId) {
    activeTab = 'statblock';
    lastCombatantId = combatant?.id;
  }

  const ADJUSTMENT_OPTIONS: TemplateAdjustment[] = ['weak', 'normal', 'elite'];
  const ADJUSTMENT_LABEL: Record<TemplateAdjustment, string> = {
    weak: 'Weak',
    normal: 'Normal',
    elite: 'Elite'
  };

  function templateChipVariant(adjustment: TemplateAdjustment | undefined) {
    if (adjustment === 'elite') return 'warning';
    if (adjustment === 'weak') return 'pc';
    return 'default';
  }

  $: badgeLabel = combatant ? templateLabel(combatant.templateAdjustment) : '';
  $: adjustedView = combatant ? getAdjustedView(combatant) : null;
  $: traits = combatant?.traits ?? [];

  $: computed = combatant ? computeCombatantStats(combatant) : null;
  $: isHazard = combatant?.sourceType === 'hazard';
  $: adjustment = combatant?.templateAdjustment ?? 'normal';
  $: adjustedAttacks = combatant ? combatant.attacks.map((a) => adjustedAttack(a, adjustment)) : [];
  $: adjustedPassive = combatant
    ? combatant.passiveAbilities.map((a) => adjustedAbility(a, adjustment))
    : [];
  $: adjustedReactive = combatant
    ? combatant.reactiveAbilities.map((a) => adjustedAbility(a, adjustment))
    : [];
  $: adjustedActive = combatant
    ? combatant.activeAbilities.map((a) => adjustedAbility(a, adjustment))
    : [];
  $: adjustedSpellcasting = combatant?.spellcasting
    ? combatant.spellcasting.map((block) => {
        const view = adjustedSpellBlock(block, adjustment);
        return {
          ...view,
          usedSlots: block.usedSlots,
          usedFocusPoints: block.usedFocusPoints,
          usedEntries: block.usedEntries
        };
      })
    : undefined;

  function statTooltip(stat: ComputedStats['ac']): string {
    return formatStatTooltip(stat.base, stat.final, stat.modifiers);
  }

  function bucketTooltip(label: string, total: number, mods: ComputedStats['attackRolls']['modifiers']): string {
    if (total === 0) return '';
    const breakdown = formatModifierBreakdown(mods);
    const sign = total >= 0 ? '+' : '';
    return breakdown ? `${label} ${sign}${total} (${breakdown})` : `${label} ${sign}${total}`;
  }
</script>

<aside class="details" aria-label="Combatant details">
  {#if !combatant}
    <p class="empty-state">Select a combatant to see details.</p>
  {:else}
    <header class="details__header">
      <div class="details__title">
        <h2>{combatant.name}</h2>
        {#if badgeLabel}
          <Chip variant={templateChipVariant(combatant.templateAdjustment)}>{badgeLabel}</Chip>
        {/if}
      </div>
      {#if adjustedView || traits.length > 0}
        <div class="details__subtitle">
          {#if adjustedView}<span class="details__level">Level {adjustedView.level}</span>{/if}
          {#each traits as trait (trait)}
            <Chip variant="trait">{trait}</Chip>
          {/each}
        </div>
      {/if}
      {#if combatant.sourceType === 'creature'}
        <div
          class="details__adjustment"
          role="group"
          aria-label="Template adjustment"
        >
          {#each ADJUSTMENT_OPTIONS as opt (opt)}
            <button
              type="button"
              class="details__adjustment-opt"
              class:details__adjustment-opt--active={adjustment === opt}
              aria-pressed={adjustment === opt}
              onclick={() => onSetAdjustment(combatant.id, opt)}
            >{ADJUSTMENT_LABEL[opt]}</button>
          {/each}
        </div>
      {/if}
    </header>

    <div class="details__tabs" role="tablist" aria-label="Combatant detail sections">
      {#each TABS as tab (tab.id)}
        <button
          type="button"
          class="details__tab"
          class:details__tab--active={activeTab === tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onclick={() => (activeTab = tab.id)}
        >
          {tab.label}{#if tab.id === 'conditions' && appliedEffectsView.length > 0}&nbsp;({appliedEffectsView.length}){/if}
        </button>
      {/each}
    </div>

    {#if activeTab === 'statblock'}
    <section class="details__section" aria-label="Defenses">
      <SectionLabel as="h3">Defenses</SectionLabel>
      <dl class="defenses-grid">
        <div class="stat">
          <SectionLabel>AC</SectionLabel>
          <dd
            title={computed ? statTooltip(computed.ac) : ''}
            class:modified={computed && computed.ac.final !== computed.ac.base}
          >{computed ? computed.ac.final : adjustedView!.ac}</dd>
        </div>
        <div class="stat">
          <SectionLabel>HP</SectionLabel>
          <dd>
            {combatant.currentHp}<span class="muted">/{adjustedView!.hp}</span>
            {#if combatant.tempHp > 0}<span class="temp">+{combatant.tempHp} temp</span>{/if}
          </dd>
        </div>
        <div class="stat">
          <SectionLabel>{isHazard ? 'Stealth' : 'Perception'}</SectionLabel>
          <dd
            title={computed ? statTooltip(computed.perception) : ''}
            class:modified={computed && computed.perception.final !== computed.perception.base}
          >{formatModifier(computed ? computed.perception.final : adjustedView!.perception)}</dd>
        </div>
        <div class="stat">
          <SectionLabel>{isHazard ? 'Hardness' : 'Speed'}</SectionLabel>
          <dd>
            {#if isHazard}
              {combatant.hazardData?.hardness ?? '—'}
            {:else}
              {adjustedView!.speed} ft
            {/if}
          </dd>
        </div>
      </dl>
      <div class="saves-grid">
        <StatRollButton
          label="Fort"
          modifier={computed ? computed.fortitude.final : adjustedView!.fortitude}
          tone="save"
          ariaLabel={`Roll ${combatant.name} Fortitude save (${formatModifier(computed ? computed.fortitude.final : adjustedView!.fortitude)})`}
          breakdownTitle={computed ? statTooltip(computed.fortitude) : undefined}
          modified={!!computed && computed.fortitude.final !== computed.fortitude.base}
          onRoll={(origin) => onRollSave(combatant.id, 'fortitude', origin)}
        />
        <StatRollButton
          label="Ref"
          modifier={computed ? computed.reflex.final : adjustedView!.reflex}
          tone="save"
          ariaLabel={`Roll ${combatant.name} Reflex save (${formatModifier(computed ? computed.reflex.final : adjustedView!.reflex)})`}
          breakdownTitle={computed ? statTooltip(computed.reflex) : undefined}
          modified={!!computed && computed.reflex.final !== computed.reflex.base}
          onRoll={(origin) => onRollSave(combatant.id, 'reflex', origin)}
        />
        <StatRollButton
          label="Will"
          modifier={computed ? computed.will.final : adjustedView!.will}
          tone="save"
          ariaLabel={`Roll ${combatant.name} Will save (${formatModifier(computed ? computed.will.final : adjustedView!.will)})`}
          breakdownTitle={computed ? statTooltip(computed.will) : undefined}
          modified={!!computed && computed.will.final !== computed.will.base}
          onRoll={(origin) => onRollSave(combatant.id, 'will', origin)}
        />
      </div>
    </section>

    {#if isHazard && combatant.hazardData}
      <section class="details__section" aria-label="Hazard">
        <SectionLabel as="h3">Hazard</SectionLabel>
        <HazardStatBlock data={combatant.hazardData} />
      </section>
    {/if}

    {#if adjustedPassive.length > 0}
      <section class="details__section" aria-label="Passive Abilities">
        <SectionLabel as="h3">Passive Abilities</SectionLabel>
        <ul class="entry-list">
          {#each adjustedPassive as ability, i (i)}
            <li><AbilityCard ability={ability as Ability} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if adjustedReactive.length > 0}
      <section class="details__section" aria-label="Reactive Abilities">
        <SectionLabel as="h3">Reactive Abilities</SectionLabel>
        <ul class="entry-list">
          {#each adjustedReactive as ability, i (i)}
            <li><AbilityCard ability={ability as Ability} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if adjustedAttacks.length > 0}
      <section class="details__section" aria-label="Attacks">
        <SectionLabel as="h3">Attacks</SectionLabel>
        <ul class="entry-list">
          {#each adjustedAttacks as attack, i (i)}
            <li>
              <AttackRow
                attack={attack as Attack}
                attackBonus={computed ? computed.attackRolls.total : 0}
                damageBonus={computed ? computed.damageRolls.total : 0}
                attackTooltip={computed
                  ? bucketTooltip('attack', computed.attackRolls.total, computed.attackRolls.modifiers)
                  : ''}
                damageTooltip={computed
                  ? bucketTooltip('damage', computed.damageRolls.total, computed.damageRolls.modifiers)
                  : ''}
                onRollAttack={(a, v, origin) => onRollAttack(combatant.id, a, v, origin)}
                onRollDamage={(a, origin) => onRollDamage(combatant.id, a, origin)}
              />
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if adjustedActive.length > 0}
      <section class="details__section" aria-label="Active Abilities">
        <SectionLabel as="h3">Active Abilities</SectionLabel>
        <ul class="entry-list">
          {#each adjustedActive as ability, i (i)}
            <li><AbilityCard ability={ability as Ability} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if adjustedSpellcasting && adjustedSpellcasting.length > 0}
      <section class="details__section" aria-label="Spellcasting">
        <SectionLabel as="h3">Spellcasting</SectionLabel>
        <div class="spellcasting-stack">
          {#each adjustedSpellcasting as block, i (i)}
            <SpellcastingBlockView
              {block}
              dcBonus={computed ? computed.spellDcs.total : 0}
              attackBonus={computed ? computed.spellAttacks.total : 0}
              dcTooltip={computed
                ? bucketTooltip('DC', computed.spellDcs.total, computed.spellDcs.modifiers)
                : ''}
              attackTooltip={computed
                ? bucketTooltip('attack', computed.spellAttacks.total, computed.spellAttacks.modifiers)
                : ''}
              onUseSlot={(blockId, rank) => onUseSpellSlot(combatant.id, blockId, rank)}
              onRestoreSlot={(blockId, rank) => onRestoreSpellSlot(combatant.id, blockId, rank)}
              onUseFocus={(blockId) => onUseFocusPoint(combatant.id, blockId)}
              onRestoreFocus={(blockId) => onRestoreFocusPoint(combatant.id, blockId)}
              onUseInnate={(blockId, slug) => onUseInnateSpell(combatant.id, blockId, slug)}
              onRestoreInnate={(blockId, slug) => onRestoreInnateSpell(combatant.id, blockId, slug)}
            />
          {/each}
        </div>
      </section>
    {/if}
    {/if}

    {#if activeTab === 'conditions'}
      <section class="details__section" aria-label="Conditions">
        {#if appliedEffectsView.length === 0}
          <p class="conditions-empty">No effects applied.</p>
        {:else}
          <ul class="applied-list">
            {#each appliedEffectsView as view (view.instanceId)}
              <li class="applied-row">
                <div class="applied-main">
                  <span class="applied-name">{view.name}</span>
                  {#if view.value.kind === 'valued'}
                    <span class="value-controls" aria-label={`${view.name} value controls`}>
                      <IconButton
                        size={22}
                        ariaLabel={`Decrease ${view.name}`}
                        disabled={view.value.current <= 1}
                        onclick={() => onModifyConditionValue(combatant.id, view.instanceId, -1)}
                      >−</IconButton>
                      <span class="applied-value" aria-label={`${view.name} value`}>{view.value.current}</span>
                      <IconButton
                        size={22}
                        ariaLabel={`Increase ${view.name}`}
                        disabled={view.value.maxValue !== undefined &&
                          view.value.current >= view.value.maxValue}
                        onclick={() => onModifyConditionValue(combatant.id, view.instanceId, 1)}
                      >+</IconButton>
                    </span>
                  {/if}
                  {#if view.source.kind === 'implied'}
                    <span class="applied-implied">from {view.source.parentName}</span>
                  {/if}
                </div>
                <div class="applied-meta">
                  <span class="applied-duration">{view.durationLabel}</span>
                  {#if view.note}
                    <span class="applied-note">{view.note}</span>
                  {/if}
                  {#if view.source.kind === 'direct'}
                    <IconButton
                      size={22}
                      variant="destructive"
                      ariaLabel={`Remove ${view.name}`}
                      title="Remove"
                      onclick={() => onRemoveCondition(combatant.id, view.instanceId)}
                    >✕</IconButton>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="conditions-manage">
          <Button
            variant="secondary"
            size="sm"
            ariaLabel="Manage effects"
            onclick={() => onManageEffects(combatant.id)}
          >Manage effects…</Button>
        </div>
      </section>
    {/if}

    {#if activeTab === 'notes'}
      <section class="details__section" aria-label="Notes">
        <SectionLabel as="h3">GM Notes</SectionLabel>
        <NotesEditor
          value={combatant.notes ?? ''}
          onCommit={(note) => onSetNote(combatant.id, note)}
        />
      </section>
    {/if}
  {/if}
</aside>

<style>
  .details {
    display: flex;
    flex-direction: column;
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--leading-snug);
  }

  .empty-state {
    margin: 0;
    padding: var(--space-4);
    color: var(--color-ink-mute);
    font-size: var(--text-base);
    font-style: italic;
  }

  .details__header {
    padding: var(--space-4);
    background: var(--color-panel-2);
    border-bottom: var(--border-thin);
  }

  .details__adjustment {
    margin-top: var(--space-2);
    display: inline-flex;
    border: var(--border-thin);
    border-radius: var(--radius-card);
    overflow: hidden;
  }

  .details__adjustment-opt {
    background: transparent;
    color: var(--color-ink-mute);
    border: 0;
    border-left: var(--border-thin);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    padding: 4px 10px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .details__adjustment-opt:first-child {
    border-left: 0;
  }

  .details__adjustment-opt:hover {
    color: var(--color-ink);
  }

  .details__adjustment-opt--active {
    background: var(--color-ink);
    color: var(--color-panel);
  }

  .details__adjustment-opt:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: -2px;
  }

  .details__title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-2xl);
    font-weight: 600;
    line-height: var(--leading-tight);
    color: var(--color-ink);
    letter-spacing: -0.2px;
  }

  .details__subtitle {
    margin-top: var(--space-1);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-base);
  }

  .details__level {
    font-style: italic;
    margin-right: var(--space-1);
  }

  /* Tab strip — pinned while the pane scrolls. */
  .details__tabs {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3) 0;
    background: var(--color-panel);
    border-bottom: var(--border-thin);
  }

  .details__tab {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-serif);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    color: var(--color-ink-soft);
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
  }

  .details__tab:hover {
    color: var(--color-ink);
  }

  .details__tab--active {
    color: var(--color-ink);
    border-bottom-color: var(--accent);
  }

  .details__tab:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: -2px;
  }

  @media (pointer: coarse) {
    .details__tab {
      min-height: 44px;
    }
  }

  .details__section {
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-thin);
  }

  .details__section :global(h3) {
    margin: 0 0 var(--space-2);
    display: block;
  }

  .defenses-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
  }

  .saves-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin: var(--space-3) 0 0;
    padding-top: var(--space-3);
    border-top: 1px dashed var(--color-rule);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat dd {
    margin: 0;
    color: var(--color-ink);
    font-family: var(--font-serif);
    font-size: var(--text-xl);
    font-weight: 600;
    line-height: var(--leading-tight);
  }

  .stat dd.modified {
    color: var(--effect-cond);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }

  .muted {
    color: var(--color-ink-mute);
    font-weight: 400;
    font-family: var(--font-mono);
    font-size: var(--text-base);
  }

  .temp {
    margin-left: var(--space-1);
    color: var(--color-blue);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .entry-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-3);
  }

  .entry-list li {
    border-top: 1px dashed var(--color-rule);
    padding-top: var(--space-2);
  }

  .entry-list li:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .spellcasting-stack {
    display: grid;
    gap: var(--space-3);
  }

  /* Conditions tab — read-mostly applied-effects list. Full management
     (pickers, durations) lives in the effect modal behind Manage. */
  .conditions-empty {
    margin: 0;
    color: var(--color-ink-mute);
    font-size: var(--text-base);
    font-style: italic;
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
    border: var(--border-thin);
    border-radius: var(--radius-card);
    background: var(--color-panel-2);
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

  .applied-value {
    min-width: 1.5em;
    text-align: center;
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .applied-implied {
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .applied-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
  }

  .applied-duration {
    font-variant-numeric: tabular-nums;
  }

  .applied-note {
    color: var(--color-ink-mute);
    font-style: italic;
  }

  .conditions-manage {
    margin-top: var(--space-3);
  }
</style>
