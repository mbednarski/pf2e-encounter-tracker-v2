<script lang="ts">
  import type { Creature } from '../domain';
  import IconButton from './ui/IconButton.svelte';
  import Input from './ui/Input.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let creatures: Creature[];
  export let onAddCreature: (creature: Creature) => void;
  export let onRemoveCreature: ((id: string) => void) | undefined = undefined;

  let query = '';

  $: needle = query.trim().toLowerCase();
  $: filtered = needle
    ? creatures.filter((creature) => {
        if (creature.name.toLowerCase().includes(needle)) return true;
        return creature.traits.some((t) => t.toLowerCase().includes(needle));
      })
    : creatures;
</script>

<section class="bestiary" aria-labelledby="bestiary-label">
  <header class="bestiary__header">
    <SectionLabel as="h3" id="bestiary-label">Bestiary</SectionLabel>
    <span class="count">{creatures.length}</span>
  </header>

  <div class="bestiary__search">
    <Input
      ariaLabel="Search bestiary"
      type="search"
      placeholder="Search…"
      bind:value={query}
    >
      <span slot="leading" aria-hidden="true">⌕</span>
    </Input>
  </div>

  {#if creatures.length === 0}
    <p class="empty">Import a YAML file to add creatures.</p>
  {:else if filtered.length === 0}
    <p class="empty">No matching creatures.</p>
  {:else}
    <ul class="rows">
      {#each filtered as creature (creature.id)}
        <li class="row">
          <span class="row__level" aria-label="Level {creature.level}">{creature.level}</span>
          <span class="row__body">
            <span class="row__name">{creature.name}</span>
            <span class="row__traits">{creature.traits.join(' · ')}</span>
          </span>
          {#if onRemoveCreature}
            <span class="row__remove">
              <IconButton
                ariaLabel="Remove {creature.name}"
                title="Remove from library"
                variant="destructive"
                size={22}
                onclick={() => onRemoveCreature?.(creature.id)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M2 6h8" />
                </svg>
              </IconButton>
            </span>
          {/if}
          <IconButton
            ariaLabel="Add {creature.name}"
            title="Add to encounter"
            variant="primary"
            size={26}
            onclick={() => onAddCreature(creature)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M7 2v10M2 7h10" />
            </svg>
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .bestiary {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }

  .bestiary__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink-mute);
  }

  .empty {
    margin: var(--space-2) 0 0;
    color: var(--color-ink-mute);
    font-size: var(--text-base);
    font-style: italic;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    max-height: 320px;
    overflow: auto;
    border-top: var(--border-thin);
  }

  .row {
    display: grid;
    grid-template-columns: 32px 1fr auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px dashed var(--color-rule);
  }

  .row:last-child {
    border-bottom: none;
  }

  /*
   * Hide the destructive remove control by default and reveal it on row
   * hover or when anything inside the row gains keyboard focus. The button
   * is still in the tab order and reachable; it just gets out of the way of
   * the dominant quick-add affordance until the user expresses intent.
   */
  .row__remove {
    opacity: 0;
    transition: opacity 0.12s;
  }

  .row:hover .row__remove,
  .row:focus-within .row__remove {
    opacity: 1;
  }

  .row__level {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--color-ink);
  }

  .row__body {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .row__name {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row__traits {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-mute);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
