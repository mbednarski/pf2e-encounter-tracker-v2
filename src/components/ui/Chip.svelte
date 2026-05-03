<script lang="ts">
  type Variant = 'default' | 'pc' | 'enemy' | 'success' | 'warning' | 'danger';

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
    color: var(--color-blue);
    border: 1px solid var(--color-blue);
    background: transparent;
  }

  .chip--enemy {
    color: var(--color-red);
    border: 1px solid var(--color-red);
    background: transparent;
  }

  .chip--success {
    color: var(--color-green);
    border: 1px solid var(--color-green);
    background: transparent;
  }

  .chip--warning {
    color: var(--color-amber);
    border: 1px solid var(--color-amber);
    background: transparent;
  }

  .chip--danger {
    color: var(--color-panel);
    border: 1px solid var(--color-red);
    background: var(--color-red);
  }

  .chip--selected {
    background: var(--color-ink);
    color: var(--color-panel);
    border-color: var(--color-ink);
  }
</style>
