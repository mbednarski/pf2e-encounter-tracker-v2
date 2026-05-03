<script lang="ts">
  import type { FeedbackEntry } from '$lib/encounter-app';
  import CombatLog from './CombatLog.svelte';

  export let entries: FeedbackEntry[];

  let open = true;

  function toggle() {
    open = !open;
  }
</script>

<section class="drawer" class:drawer--open={open} aria-label="Combat log">
  <button
    type="button"
    class="drawer__header"
    aria-expanded={open}
    aria-controls="combat-log-body"
    onclick={toggle}
  >
    <span class="caret" aria-hidden="true">{open ? '▼' : '▲'}</span>
    <span class="title">Combat Log</span>
    <span class="count">{entries.length} entries</span>
  </button>
  {#if open}
    <div id="combat-log-body" class="drawer__body">
      <CombatLog {entries} />
    </div>
  {/if}
</section>

<style>
  .drawer {
    display: flex;
    flex-direction: column;
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    overflow: hidden;
    min-width: 0;
  }

  .drawer__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    height: 40px;
    background: var(--color-panel-2);
    border: none;
    border-bottom: 1px solid transparent;
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    text-align: left;
    cursor: pointer;
    width: 100%;
  }

  .drawer--open .drawer__header {
    border-bottom-color: var(--color-rule);
  }

  .drawer__header:hover {
    background: var(--color-panel);
  }

  .drawer__header:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: -2px;
  }

  .caret {
    color: var(--color-ink-mute);
    font-size: var(--text-xs);
  }

  .title {
    color: var(--color-ink);
  }

  .count {
    margin-left: auto;
    color: var(--color-ink-mute);
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .drawer__body {
    max-height: 240px;
    overflow: auto;
    padding: var(--space-3) var(--space-4);
  }
</style>
