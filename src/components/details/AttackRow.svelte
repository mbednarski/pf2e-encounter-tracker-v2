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
    <span class="tag">{attack.type}</span>
    {#each attack.traits as trait (trait)}
      <span class="tag">{trait}</span>
    {/each}
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
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 700;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border: var(--border-thin);
    background: var(--color-panel-2);
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
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
    font: inherit;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  .btn--attack {
    background: var(--roll-atk-soft);
    border: 1px solid var(--roll-atk);
    color: var(--roll-atk);
  }

  .btn--attack:hover {
    background: var(--color-panel);
  }

  .btn--damage {
    background: var(--roll-dmg-soft);
    border: 1px solid var(--roll-dmg);
    color: var(--roll-dmg);
  }

  .btn--damage:hover {
    background: var(--color-panel);
  }

  .btn__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    opacity: 0.8;
  }

  .btn__mod {
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .btn--attack .btn__mod {
    font-size: var(--text-base);
  }

  .btn--damage .btn__mod {
    font-size: var(--text-sm);
  }
</style>
