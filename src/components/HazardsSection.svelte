<script lang="ts">
  import type { Hazard } from '../domain';
  import Button from './ui/Button.svelte';
  import IconButton from './ui/IconButton.svelte';
  import Input from './ui/Input.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let hazards: Hazard[];
  export let encounterCounts: Record<string, number> = {};
  export let onAddToEncounter: (hazard: Hazard) => void;
  export let onRemoveOneFromEncounter: (hazardId: string) => void;
  export let onImportHazardFiles: ((files: File[]) => void) | undefined = undefined;
  export let onOpenManageLibrary: (() => void) | undefined = undefined;

  let query = '';
  let fileInput: HTMLInputElement | undefined;

  $: needle = query.trim().toLowerCase();
  $: filtered = needle
    ? hazards.filter((hazard) => {
        if (hazard.name.toLowerCase().includes(needle)) return true;
        return hazard.traits.some((t) => t.toLowerCase().includes(needle));
      })
    : hazards;

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onImportHazardFiles?.(files);
    }
    input.value = '';
  }
</script>

<section class="hazards" aria-labelledby="hazards-label">
  <header class="hazards__header">
    <SectionLabel as="h3" id="hazards-label">Hazards</SectionLabel>
    <span class="count">{hazards.length}</span>
  </header>

  <div class="hazards__actions">
    {#if onImportHazardFiles}
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

  <div class="hazards__search">
    <Input ariaLabel="Search hazards" type="search" placeholder="Search…" bind:value={query}>
      <span slot="leading" aria-hidden="true">⌕</span>
    </Input>
  </div>

  {#if hazards.length === 0}
    <p class="empty">Import a Foundry hazard JSON or YAML file to add complex hazards.</p>
  {:else if filtered.length === 0}
    <p class="empty">No matching hazards.</p>
  {:else}
    <ul class="rows">
      {#each filtered as hazard (hazard.id)}
        {@const count = encounterCounts[hazard.id] ?? 0}
        <li class="row">
          <button
            type="button"
            class="row__add"
            aria-label="Add {hazard.name} to encounter"
            title="Add to encounter"
            onclick={() => onAddToEncounter(hazard)}
          >
            <span class="row__level" aria-label="Level {hazard.level}">{hazard.level}</span>
            <span class="row__body">
              <span class="row__name">{hazard.name}</span>
              <span class="row__traits">{hazard.traits.join(' · ')}</span>
            </span>
          </button>
          {#if count > 0}
            <span class="row__count" aria-label="{count} in encounter">×{count}</span>
            <IconButton
              ariaLabel="Remove one {hazard.name} from encounter"
              title="Remove one from encounter"
              variant="default"
              size={22}
              onclick={() => onRemoveOneFromEncounter(hazard.id)}
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
  .hazards {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-thin);
  }

  .hazards__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .hazards__actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
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
