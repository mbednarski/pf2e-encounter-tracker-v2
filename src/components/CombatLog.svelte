<script lang="ts">
  import type { FeedbackEntry } from '$lib/encounter-app';

  export let entries: FeedbackEntry[];

  $: ordered = [...entries].reverse();
</script>

<div class="log" role="log" aria-live="polite">
  {#if ordered.length === 0}
    <p class="empty">Combat events will appear here.</p>
  {:else}
    <ol class="entries">
      {#each ordered as entry (entry.id)}
        <li class="entry entry--{entry.severity}">
          <span class="entry__message">{entry.message}</span>
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

  .entry:last-child {
    border-bottom: none;
  }

  .entry__message {
    color: var(--color-ink);
  }

  .entry--warn .entry__message {
    color: var(--color-amber);
  }

  .entry--success .entry__message {
    color: var(--color-green);
    font-weight: 600;
  }
</style>
