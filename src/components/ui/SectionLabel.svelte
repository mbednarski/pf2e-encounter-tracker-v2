<script lang="ts">
  export let as: 'span' | 'div' | 'h2' | 'h3' | 'h4' = 'span';
  export let id: string | undefined = undefined;
  export let rule = false;
</script>

<svelte:element this={as} {id} class="label" class:label--rule={rule}>
  <slot />
</svelte:element>

<style>
  .label {
    display: inline-block;
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  /* Statblock section rule — tapered crimson hairline after the label. */
  .label--rule {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .label--rule::after {
    content: '';
    flex: 1;
    height: 2px;
    background: var(--rule-accent);
  }
</style>
