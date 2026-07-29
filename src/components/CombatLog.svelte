<script lang="ts">
  import type { LogEntry } from '../domain';

  export let entries: LogEntry[];

  $: ordered = [...entries].reverse();
</script>

<div class="log" role="log" aria-live="polite">
  {#if ordered.length === 0}
    <p class="empty">Combat events will appear here.</p>
  {:else}
    <ol class="entries">
      {#each ordered as entry (entry.id)}
        <li class="entry entry--{entry.tone}" class:entry--undone={entry.undone}>
          <span class="entry__message">{entry.message}</span>
          {#if entry.undone}<span class="entry__status">Undone</span>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .log {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--color-ink);
  }

  .empty {
    margin: 0;
    color: var(--color-ink-mute);
    font-style: italic;
  }

  .entries {
    display: grid;
    gap: var(--space-1);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .entry {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px dashed var(--color-rule);
    line-height: var(--leading-snug);
  }

  .entry--undone {
    opacity: 0.5;
  }

  .entry--undone .entry__message {
    text-decoration: line-through;
  }

  .entry__status {
    color: var(--color-ink-mute);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry__message {
    color: var(--color-ink);
  }

  .entry--danger .entry__message {
    color: var(--color-amber);
  }

  .entry--success .entry__message {
    color: var(--color-green);
    font-weight: 600;
  }
</style>
