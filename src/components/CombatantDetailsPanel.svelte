<script lang="ts">
  import type { Ability, Attack, CombatantState } from '../domain';
  import { templateLabel } from '$lib/template-label';
  import { formatModifier } from '$lib/abilities/format-damage';
  import type { MapVariant } from '$lib/dice/map';
  import Chip from './ui/Chip.svelte';
  import NotesEditor from './NotesEditor.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';
  import AbilityCard from './details/AbilityCard.svelte';
  import AttackRow from './details/AttackRow.svelte';
  import SpellcastingBlockView from './details/SpellcastingBlockView.svelte';

  export let combatant: CombatantState | undefined;
  export let onSetNote: (combatantId: string, note: string | null) => void;
  export let onRollAttack: (combatantId: string, attack: Attack, variant: MapVariant) => void = () => {};
  export let onRollDamage: (combatantId: string, attack: Attack) => void = () => {};
  export let onUseSpellSlot: (combatantId: string, blockId: string, rank: number) => void = () => {};
  export let onRestoreSpellSlot: (combatantId: string, blockId: string, rank: number) => void = () => {};
  export let onUseFocusPoint: (combatantId: string, blockId: string) => void = () => {};
  export let onRestoreFocusPoint: (combatantId: string, blockId: string) => void = () => {};
  export let onUseInnateSpell: (combatantId: string, blockId: string, spellSlug: string) => void = () => {};
  export let onRestoreInnateSpell: (combatantId: string, blockId: string, spellSlug: string) => void = () => {};

  function templateChipVariant(adjustment: 'elite' | 'weak' | undefined) {
    if (adjustment === 'elite') return 'warning';
    if (adjustment === 'weak') return 'pc';
    return 'default';
  }

  $: badgeLabel = combatant ? templateLabel(combatant.templateAdjustment) : '';
  $: subtitle = combatant
    ? [
        combatant.level !== undefined ? `Level ${combatant.level}` : null,
        ...(combatant.traits ?? [])
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
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
      {#if subtitle}
        <div class="details__subtitle">{subtitle}</div>
      {/if}
    </header>

    <section class="details__section" aria-label="Defenses">
      <SectionLabel as="h3">Defenses</SectionLabel>
      <dl class="defenses-grid">
        <div class="stat">
          <SectionLabel>AC</SectionLabel>
          <dd>{combatant.baseStats.ac}</dd>
        </div>
        <div class="stat">
          <SectionLabel>HP</SectionLabel>
          <dd>
            {combatant.currentHp}<span class="muted">/{combatant.baseStats.hp}</span>
            {#if combatant.tempHp > 0}<span class="temp">+{combatant.tempHp} temp</span>{/if}
          </dd>
        </div>
        <div class="stat">
          <SectionLabel>Perception</SectionLabel>
          <dd>{formatModifier(combatant.baseStats.perception)}</dd>
        </div>
        <div class="stat">
          <SectionLabel>Speed</SectionLabel>
          <dd>{combatant.baseStats.speed} ft</dd>
        </div>
      </dl>
      <dl class="saves-grid">
        <div class="stat stat--small">
          <SectionLabel>Fort</SectionLabel>
          <dd>{formatModifier(combatant.baseStats.fortitude)}</dd>
        </div>
        <div class="stat stat--small">
          <SectionLabel>Ref</SectionLabel>
          <dd>{formatModifier(combatant.baseStats.reflex)}</dd>
        </div>
        <div class="stat stat--small">
          <SectionLabel>Will</SectionLabel>
          <dd>{formatModifier(combatant.baseStats.will)}</dd>
        </div>
      </dl>
    </section>

    {#if combatant.passiveAbilities.length > 0}
      <section class="details__section" aria-label="Passive Abilities">
        <SectionLabel as="h3">Passive Abilities</SectionLabel>
        <ul class="entry-list">
          {#each combatant.passiveAbilities as ability, i (i)}
            <li><AbilityCard ability={ability as Ability} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if combatant.reactiveAbilities.length > 0}
      <section class="details__section" aria-label="Reactive Abilities">
        <SectionLabel as="h3">Reactive Abilities</SectionLabel>
        <ul class="entry-list">
          {#each combatant.reactiveAbilities as ability, i (i)}
            <li><AbilityCard ability={ability as Ability} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if combatant.attacks.length > 0}
      <section class="details__section" aria-label="Attacks">
        <SectionLabel as="h3">Attacks</SectionLabel>
        <ul class="entry-list">
          {#each combatant.attacks as attack, i (i)}
            <li>
              <AttackRow
                attack={attack as Attack}
                onRollAttack={(a, v) => onRollAttack(combatant.id, a, v)}
                onRollDamage={(a) => onRollDamage(combatant.id, a)}
              />
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if combatant.activeAbilities.length > 0}
      <section class="details__section" aria-label="Active Abilities">
        <SectionLabel as="h3">Active Abilities</SectionLabel>
        <ul class="entry-list">
          {#each combatant.activeAbilities as ability, i (i)}
            <li><AbilityCard ability={ability as Ability} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if combatant.spellcasting && combatant.spellcasting.length > 0}
      <section class="details__section" aria-label="Spellcasting">
        <SectionLabel as="h3">Spellcasting</SectionLabel>
        <div class="spellcasting-stack">
          {#each combatant.spellcasting as block (block.blockId)}
            <SpellcastingBlockView
              {block}
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

    <section class="details__section" aria-label="Notes">
      <SectionLabel as="h3">GM Notes</SectionLabel>
      <NotesEditor
        value={combatant.notes ?? ''}
        onCommit={(note) => onSetNote(combatant.id, note)}
      />
    </section>
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
    margin-top: 4px;
    color: var(--color-ink-soft);
    font-size: var(--text-base);
    font-style: italic;
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

  .stat--small dd {
    font-size: var(--text-lg);
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
</style>
