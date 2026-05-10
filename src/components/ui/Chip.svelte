<script lang="ts">
  type Variant =
    | 'default'
    | 'pc'
    | 'enemy'
    | 'success'
    | 'warning'
    | 'danger'
    | 'attack'
    | 'damage'
    | 'save'
    | 'condition'
    | 'persistent';

  export let variant: Variant = 'default';
  export let selected = false;
  export let title: string | undefined = undefined;
</script>

<span
  {title}
  class="chip chip--{variant}"
  class:chip--selected={selected}
>
  <slot />
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: var(--radius-chip);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .chip--default {
    color: var(--color-ink-soft);
    border: var(--border-thin);
    background: transparent;
  }

  .chip--pc {
    color: var(--faction-pc);
    border: 1px solid var(--faction-pc);
    background: transparent;
  }

  .chip--enemy {
    color: var(--faction-enemy);
    border: 1px solid var(--faction-enemy);
    background: transparent;
  }

  .chip--success {
    color: var(--color-green);
    border: 1px solid var(--color-green);
    background: var(--color-green-soft);
  }

  .chip--warning {
    color: var(--color-amber);
    border: 1px solid var(--color-amber);
    background: var(--color-amber-soft);
  }

  .chip--danger {
    color: var(--color-panel-up);
    border: 1px solid var(--color-red);
    background: var(--color-red);
  }

  .chip--attack {
    color: var(--roll-atk);
    border: 1px solid var(--roll-atk);
    background: var(--roll-atk-soft);
  }

  .chip--damage {
    color: var(--roll-dmg);
    border: 1px solid var(--roll-dmg);
    background: var(--roll-dmg-soft);
  }

  .chip--save {
    color: var(--roll-sav);
    border: 1px solid var(--roll-sav);
    background: var(--roll-sav-soft);
  }

  .chip--condition {
    color: var(--effect-cond);
    border: 1px solid var(--effect-cond);
    background: var(--effect-cond-soft);
  }

  .chip--persistent {
    color: var(--effect-pers);
    border: 1px solid var(--effect-pers);
    background: var(--effect-pers-soft);
  }

  .chip--selected {
    background: var(--color-ink);
    color: var(--color-panel-up);
    border-color: var(--color-ink);
  }
</style>
