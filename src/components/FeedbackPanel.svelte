<script lang="ts">
  import type { FeedbackEntry } from '$lib/encounter-app';

  export let entries: FeedbackEntry[];
</script>

<aside class="panel feedback-panel" aria-labelledby="feedback-title">
  <div class="panel-heading">
    <h2 id="feedback-title">Event Feedback</h2>
    <span>{entries.length}</span>
  </div>
  {#if entries.length === 0}
    <p class="empty">Domain events will appear here.</p>
  {:else}
    <ol class="feedback-list">
      {#each entries as entry (entry.id)}
        <li class:warn={entry.severity === 'warn'}>{entry.message}</li>
      {/each}
    </ol>
  {/if}
</aside>

<style>
  .panel {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 14px;
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
  }

  .panel-heading > span,
  .empty {
    color: #627171;
    font-size: 13px;
  }

  .empty {
    margin: 0;
  }

  .feedback-list {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .feedback-list li {
    border-left: 4px solid #3f7f64;
    border-radius: 6px;
    background: #ffffff;
    padding: 10px;
    font-size: 13px;
  }

  .feedback-list li.warn {
    border-left-color: #b6652e;
    background: #fff7ee;
  }
</style>
