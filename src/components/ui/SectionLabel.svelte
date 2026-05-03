<script lang="ts">
  export let as: 'span' | 'div' | 'h2' | 'h3' | 'h4' = 'span';
</script>

<svelte:element this={as} class="label">
  <slot />
</svelte:element>

<style>
  .label {
    display: inline-block;
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-ink-mute);
  }
</style>
