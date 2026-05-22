<script lang="ts">
  import type { HazardData } from '../../domain';
  import SectionLabel from '../ui/SectionLabel.svelte';

  export let data: HazardData;

  // Routine and disable text is read aloud by the GM each turn — order the
  // blocks the way a printed statblock does: Routine first, then Disable.
  $: blocks = [
    { label: 'Detection', text: data.stealthNote },
    { label: 'Routine', text: data.routine },
    { label: 'Disable', text: data.disable },
    { label: 'Reset', text: data.reset },
    { label: 'Description', text: data.description }
  ].filter((b): b is { label: string; text: string } => Boolean(b.text));
</script>

{#if blocks.length > 0}
  <div class="hazard">
    {#each blocks as block (block.label)}
      <div class="hazard__block">
        <SectionLabel>{block.label}</SectionLabel>
        <p class="hazard__text">{block.text}</p>
      </div>
    {/each}
  </div>
{:else}
  <p class="hazard__empty">No routine or disable text was imported for this hazard.</p>
{/if}

<style>
  .hazard {
    display: grid;
    gap: var(--space-3);
  }

  .hazard__block {
    display: grid;
    gap: 2px;
  }

  .hazard__text {
    margin: 0;
    color: var(--color-ink);
    font-size: var(--text-base);
    line-height: var(--leading-snug);
    white-space: pre-line;
  }

  .hazard__empty {
    margin: 0;
    color: var(--color-ink-mute);
    font-size: var(--text-base);
    font-style: italic;
  }
</style>
