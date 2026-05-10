<script lang="ts">
  import type { Attack } from '../../domain';
  import { mapVariants, type MapVariant } from '$lib/dice/map';
  import { formatDamage, formatModifier } from '$lib/abilities/format-damage';

  export let attack: Attack;
  export let onRollAttack: (attack: Attack, variant: MapVariant, origin: { x: number; y: number }) => void;
  export let onRollDamage: (attack: Attack, origin: { x: number; y: number }) => void;

  $: variants = mapVariants(attack.modifier, attack.traits);
  $: damageLabel = formatDamage(attack.damage);
</script>

<article class="row">
  <header class="row__head">
    <span class="row__name">{attack.name}</span>
    <span class="row__type">{attack.type}</span>
    {#if attack.traits.length > 0}
      <span class="row__traits">{attack.traits.join(', ')}</span>
    {/if}
  </header>
  <div class="row__rolls">
    <div class="row__attacks">
      {#each variants as variant (variant.step)}
        <button
          type="button"
          class="btn btn--attack"
          aria-label="Roll {attack.name} {variant.label} attack ({formatModifier(variant.modifier)})"
          onclick={(e) => onRollAttack(attack, variant, { x: e.clientX, y: e.clientY })}
        >
          <span class="btn__label">{variant.label}</span>
          <span class="btn__mod">{formatModifier(variant.modifier)}</span>
        </button>
      {/each}
    </div>
    {#if attack.damage.length > 0}
      <button
        type="button"
        class="btn btn--damage"
        aria-label="Roll {attack.name} damage ({damageLabel})"
        onclick={(e) => onRollDamage(attack, { x: e.clientX, y: e.clientY })}
      >
        <span class="btn__label">Dmg</span>
        <span class="btn__mod">{damageLabel}</span>
      </button>
    {/if}
  </div>
</article>

<style>
  .row {
    display: grid;
    gap: var(--space-2);
  }

  .row__head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .row__name {
    color: var(--color-ink);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .row__type {
    color: var(--color-ink-mute);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .row__traits {
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    text-transform: lowercase;
    letter-spacing: var(--tracking-wide);
  }

  .row__rolls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .row__attacks {
    display: flex;
    gap: 4px;
  }

  .btn {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--color-panel-2);
    color: var(--color-ink);
    border: 1px solid var(--color-rule);
    font: inherit;
    cursor: pointer;
  }

  .btn:hover {
    background: var(--color-panel);
    border-color: var(--color-ink);
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  .btn__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-mute);
  }

  .btn--attack .btn__mod {
    color: var(--color-red);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
  }

  .btn--damage .btn__mod {
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
  }
</style>
