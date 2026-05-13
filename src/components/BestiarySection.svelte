<script lang="ts">
  import { adjustedLevel, type Creature } from '../domain';
  import type { TemplateAdjustmentChoice } from '$lib/encounter-app';
  import Button from './ui/Button.svelte';
  import IconButton from './ui/IconButton.svelte';
  import Input from './ui/Input.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let creatures: Creature[];
  export let encounterCounts: Record<string, number> = {};
  export let onAddToEncounter: (creature: Creature, adjustment: TemplateAdjustmentChoice) => void;
  export let onRemoveOneFromEncounter: (creatureId: string) => void;
  export let onImportCreatureFiles: ((files: File[]) => void) | undefined = undefined;
  export let onOpenManageLibrary: (() => void) | undefined = undefined;

  let query = '';
  let adjustment: TemplateAdjustmentChoice = 'normal';
  let fileInput: HTMLInputElement | undefined;

  $: previewLevel = (level: number) =>
    adjustment === 'normal' ? level : adjustedLevel(level, adjustment);

  $: needle = query.trim().toLowerCase();
  $: filtered = needle
    ? creatures.filter((creature) => {
        if (creature.name.toLowerCase().includes(needle)) return true;
        return creature.traits.some((t) => t.toLowerCase().includes(needle));
      })
    : creatures;

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onImportCreatureFiles?.(files);
    }
    input.value = '';
  }
</script>

<section class="bestiary" aria-labelledby="bestiary-label">
  <header class="bestiary__header">
    <SectionLabel as="h3" id="bestiary-label">Bestiary</SectionLabel>
    <span class="count">{creatures.length}</span>
  </header>

  <div class="bestiary__actions">
    {#if onImportCreatureFiles}
      <Button variant="secondary" size="sm" onclick={() => fileInput?.click()}>Import…</Button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".yaml,.yml,.json,application/yaml,text/yaml,application/json"
        multiple
        hidden
        onchange={handleFileChange}
      />
    {/if}
    {#if onOpenManageLibrary}
      <Button variant="secondary" size="sm" onclick={onOpenManageLibrary}>Manage…</Button>
    {/if}
  </div>

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

  <fieldset class="adjustment" aria-label="Adjustment for added creatures">
    <legend class="adjustment__legend">Adjustment</legend>
    <div class="adjustment__group">
      <button
        type="button"
        class="adjustment__option"
        class:adjustment__option--active={adjustment === 'weak'}
        aria-pressed={adjustment === 'weak'}
        onclick={() => (adjustment = 'weak')}
      >Weak</button>
      <button
        type="button"
        class="adjustment__option"
        class:adjustment__option--active={adjustment === 'normal'}
        aria-pressed={adjustment === 'normal'}
        onclick={() => (adjustment = 'normal')}
      >Normal</button>
      <button
        type="button"
        class="adjustment__option"
        class:adjustment__option--active={adjustment === 'elite'}
        aria-pressed={adjustment === 'elite'}
        onclick={() => (adjustment = 'elite')}
      >Elite</button>
    </div>
  </fieldset>

  {#if creatures.length === 0}
    <p class="empty">Import a YAML or Foundry JSON file to add creatures.</p>
  {:else if filtered.length === 0}
    <p class="empty">No matching creatures.</p>
  {:else}
    <ul class="rows">
      {#each filtered as creature (creature.id)}
        {@const count = encounterCounts[creature.id] ?? 0}
        {@const displayedLevel = previewLevel(creature.level)}
        {@const levelDelta = displayedLevel - creature.level}
        <li class="row">
          <button
            type="button"
            class="row__add"
            aria-label="Add {creature.name} to encounter"
            title="Add to encounter"
            onclick={() => onAddToEncounter(creature, adjustment)}
          >
            <span class="row__level-wrap">
              <span
                class="row__level"
                aria-label={adjustment === 'normal'
                  ? `Level ${displayedLevel}`
                  : `Level ${displayedLevel} (${adjustment}, base ${creature.level})`}
              >{displayedLevel}</span>
              {#if levelDelta !== 0}
                <span class="row__level-delta" aria-hidden="true"
                  >{levelDelta > 0 ? `+${levelDelta}` : `${levelDelta}`}</span
                >
              {/if}
            </span>
            <span class="row__body">
              <span class="row__name">{creature.name}</span>
              <span class="row__traits">{creature.traits.join(' · ')}</span>
            </span>
          </button>
          {#if count > 0}
            <span class="row__count" aria-label="{count} in encounter">×{count}</span>
            <IconButton
              ariaLabel="Remove one {creature.name} from encounter"
              title="Remove one from encounter"
              variant="default"
              size={22}
              onclick={() => onRemoveOneFromEncounter(creature.id)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M2 6h8" />
              </svg>
            </IconButton>
          {/if}
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

  .bestiary__actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink-mute);
  }

  .adjustment {
    border: var(--border-thin);
    border-radius: var(--radius-card);
    padding: 4px 8px 6px;
    margin: 0;
    display: grid;
    gap: 4px;
  }

  .adjustment__legend {
    padding: 0 var(--space-2);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-ink-soft);
  }

  .adjustment__group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .adjustment__option {
    background: transparent;
    color: var(--color-ink-mute);
    border: var(--border-thin);
    border-radius: var(--radius-card);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    padding: 4px 6px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .adjustment__option:hover {
    color: var(--color-ink);
    border-color: var(--color-ink);
  }

  .adjustment__option--active {
    background: var(--color-ink);
    color: var(--color-panel);
    border-color: var(--color-ink);
  }

  .adjustment__option:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
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
    grid-template-columns: 1fr auto auto;
    gap: var(--space-2);
    align-items: center;
    padding: 0;
    border-bottom: 1px dashed var(--color-rule);
  }

  .row:last-child {
    border-bottom: none;
  }

  .row__add {
    all: unset;
    cursor: pointer;
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) var(--space-2);
    min-width: 0;
    transition: background 0.08s;
  }

  .row__add:hover {
    background: var(--color-panel-2);
  }

  .row__add:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: -2px;
  }

  .row__level-wrap {
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    gap: 3px;
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

  .row__level-delta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    line-height: 1;
    color: var(--color-blue);
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
    color: var(--color-ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row__count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-ink);
    padding: 0 6px;
  }
</style>
