<script lang="ts">
  import type { Ability } from '../../domain';
  import { parseDegrees, type Degree } from '$lib/abilities/parse-degrees';
  import { formatDamage } from '$lib/abilities/format-damage';
  import ActionGlyph from './ActionGlyph.svelte';

  export let ability: Ability;

  $: parsed = parseDegrees(ability.description);

  const labelMap: Record<Degree, string> = {
    critSuccess: 'Critical Success',
    success: 'Success',
    failure: 'Failure',
    critFailure: 'Critical Failure'
  };

  const defenseLabel: Record<'fortitude' | 'reflex' | 'will', string> = {
    fortitude: 'Fort',
    reflex: 'Ref',
    will: 'Will'
  };
</script>

<article class="ability">
  <header class="ability__head">
    <span class="ability__name">{ability.name}</span>
    {#if ability.actions !== undefined}
      <ActionGlyph cost={ability.actions} />
    {/if}
  </header>
  {#if ability.frequency}
    <div class="ability__meta"><strong>Frequency:</strong> {ability.frequency}</div>
  {/if}
  {#if ability.trigger}
    <div class="ability__meta"><strong>Trigger:</strong> {ability.trigger}</div>
  {/if}
  {#if ability.requirements}
    <div class="ability__meta"><strong>Requirements:</strong> {ability.requirements}</div>
  {/if}

  {#if ability.save || (ability.damage && ability.damage.length > 0)}
    <div class="ability__structured">
      {#if ability.save}
        <span class="ability__save">
          DC {ability.save.dc} {defenseLabel[ability.save.defense]}{ability.save.basic ? ' (basic)' : ''}
        </span>
      {/if}
      {#if ability.damage && ability.damage.length > 0}
        <span class="ability__damage">{formatDamage(ability.damage)}</span>
      {/if}
    </div>
  {/if}
  {#if parsed.preface}
    <p class="ability__desc">{parsed.preface}</p>
  {/if}
  {#if parsed.outcomes.length > 0}
    <dl class="dos">
      {#each parsed.outcomes as outcome (outcome.degree)}
        <div class="dos__row dos__row--{outcome.degree}">
          <dt>{labelMap[outcome.degree]}</dt>
          <dd>{outcome.text}</dd>
        </div>
      {/each}
    </dl>
  {/if}
</article>

<style>
  .ability {
    display: block;
  }

  .ability__head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .ability__name {
    color: var(--color-ink);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .ability__meta {
    margin-top: 2px;
    color: var(--color-ink-soft);
    font-size: var(--text-base);
  }

  .ability__structured {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink);
  }

  .ability__save {
    background: var(--color-panel-2);
    border: var(--border-thin);
    border-radius: 4px;
    padding: 1px 6px;
  }

  .ability__damage {
    color: var(--color-red);
    font-weight: 600;
  }

  .ability__desc {
    margin: var(--space-1) 0 0;
    color: var(--color-ink);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
  }

  .dos {
    display: grid;
    gap: 4px;
    margin: var(--space-2) 0 0;
  }

  .dos__row {
    display: grid;
    grid-template-columns: minmax(120px, max-content) 1fr;
    gap: var(--space-2);
    padding: 4px 8px;
    border-left: 3px solid var(--color-rule);
    background: rgba(255, 255, 255, 0.4);
    border-radius: 0 4px 4px 0;
  }

  .dos__row dt {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .dos__row dd {
    margin: 0;
    color: var(--color-ink);
    font-size: var(--text-base);
    line-height: var(--leading-snug);
  }

  .dos__row--critSuccess { border-left-color: var(--color-green); }
  .dos__row--critSuccess dt { color: var(--color-green); }

  .dos__row--success { border-left-color: var(--color-blue); }
  .dos__row--success dt { color: var(--color-blue); }

  .dos__row--failure { border-left-color: var(--color-amber); }
  .dos__row--failure dt { color: var(--color-amber); }

  .dos__row--critFailure { border-left-color: var(--color-red); }
  .dos__row--critFailure dt { color: var(--color-red); }
</style>
