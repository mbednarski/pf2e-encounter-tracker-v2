<script lang="ts">
  import type { Ability, ActionCost, Attack, CombatantState, DamageComponent } from '../domain';
  import { templateLabel } from '$lib/template-label';
  import Chip from './ui/Chip.svelte';
  import NotesEditor from './NotesEditor.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let combatant: CombatantState | undefined;
  export let onSetNote: (combatantId: string, note: string | null) => void;

  function formatDamage(damage: DamageComponent[]): string {
    return damage
      .map((d) => {
        const dice = d.dice && d.dieSize ? `${d.dice}d${d.dieSize}` : '';
        const bonus = d.bonus ? (d.bonus > 0 ? `+${d.bonus}` : `${d.bonus}`) : '';
        const persistent = d.persistent ? ' persistent' : '';
        const head = `${dice}${bonus}` || (d.bonus === 0 ? '0' : '');
        const tail = `${d.type}${persistent}`;
        return head ? `${head} ${tail}` : tail;
      })
      .join(' + ');
  }

  function formatActionCost(cost: ActionCost | undefined): string {
    if (cost === undefined) return '';
    if (cost === 'free') return 'Free action';
    if (cost === 'reaction') return 'Reaction';
    if (cost === 1) return '1 action';
    return `${cost} actions`;
  }

  function formatModifier(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

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

    {#if combatant.attacks.length > 0}
      <section class="details__section" aria-label="Attacks">
        <SectionLabel as="h3">Attacks</SectionLabel>
        <ul class="entry-list">
          {#each combatant.attacks as attack, attackIndex (attackIndex)}
            {@const a = attack as Attack}
            <li>
              <div class="entry-head">
                <span class="entry-name">{a.name}</span>
                <span class="muted">({a.type})</span>
                <span class="entry-modifier">{formatModifier(a.modifier)}</span>
              </div>
              {#if a.damage.length > 0}
                <div class="entry-meta entry-meta--mono">{formatDamage(a.damage)}</div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#each [
      { title: 'Passive Abilities', list: combatant.passiveAbilities },
      { title: 'Reactive Abilities', list: combatant.reactiveAbilities },
      { title: 'Active Abilities', list: combatant.activeAbilities }
    ] as group (group.title)}
      {#if group.list.length > 0}
        <section class="details__section" aria-label={group.title}>
          <SectionLabel as="h3">{group.title}</SectionLabel>
          <ul class="entry-list">
            {#each group.list as ability, abilityIndex (abilityIndex)}
              {@const ab = ability as Ability}
              <li>
                <div class="entry-head">
                  <span class="entry-name">{ab.name}</span>
                  {#if ab.actions !== undefined}
                    <span class="entry-cost">{formatActionCost(ab.actions)}</span>
                  {/if}
                </div>
                {#if ab.frequency}<div class="entry-meta"><strong>Frequency:</strong> {ab.frequency}</div>{/if}
                {#if ab.trigger}<div class="entry-meta"><strong>Trigger:</strong> {ab.trigger}</div>{/if}
                {#if ab.requirements}<div class="entry-meta"><strong>Requirements:</strong> {ab.requirements}</div>{/if}
                <p class="entry-desc">{ab.description}</p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}

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

  .entry-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .entry-name {
    color: var(--color-ink);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .entry-modifier {
    margin-left: auto;
    color: var(--color-red);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
    border-bottom: 2px solid var(--color-red);
    padding: 0 4px;
  }

  .entry-meta {
    margin-top: 2px;
    color: var(--color-ink-soft);
    font-size: var(--text-base);
  }

  .entry-meta--mono {
    font-family: var(--font-mono);
  }

  .entry-cost {
    color: var(--color-ink-mute);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .entry-desc {
    margin: var(--space-1) 0 0;
    color: var(--color-ink);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
  }
</style>
