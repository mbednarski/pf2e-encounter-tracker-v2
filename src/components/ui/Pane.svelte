<script lang="ts">
  export let ariaLabel: string | undefined = undefined;
  export let scrollable = false;
</script>

<section class="pane" aria-label={ariaLabel}>
  {#if $$slots.header}
    <header class="pane__header">
      <slot name="header" />
    </header>
  {/if}
  <div class="pane__body" class:pane__body--scrollable={scrollable}>
    <slot />
  </div>
  {#if $$slots.footer}
    <footer class="pane__footer">
      <slot name="footer" />
    </footer>
  {/if}
</section>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
  }

  .pane__header {
    padding: var(--space-3) var(--space-4);
    background: var(--color-panel-2);
    border-bottom: var(--border-thin);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .pane__body {
    flex: 1;
    min-height: 0;
  }

  .pane__body--scrollable {
    overflow: auto;
  }

  .pane__footer {
    padding: var(--space-3) var(--space-4);
    background: var(--color-panel-2);
    border-top: var(--border-thin);
  }
</style>
