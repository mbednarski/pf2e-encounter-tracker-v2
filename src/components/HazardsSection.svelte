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
  export let onImportYamlFiles: ((files: File[]) => void) | undefined = undefined;
  export let onRemoveHazard: ((id: string) => void) | undefined = undefined;

  let query = '';
  let fileInput: HTMLInputElement | undefined;

  $: needle = query.trim().toLowerCase();
  $: filtered = needle
    ? hazards.filter((h) => {
        if (h.name.toLowerCase().includes(needle)) return true;
        return h.traits.some((t) => t.toLowerCase().includes(needle));
      })
    : hazards;

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onImportYamlFiles?.(files);
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
    {#if onImportYamlFiles}
      <Button variant="secondary" size="sm" onclick={() => fileInput?.click()}>Import YAML…</Button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".yaml,.yml,application/yaml,text/yaml"
        multiple
        hidden
        onchange={handleFileChange}
      />
    {/if}
  </div>

  <div class="hazards__search">
    <Input
      ariaLabel="Search hazards"
      type="search"
      placeholder="Search…"
      bind:value={query}
    >
      <span slot="leading" aria-hidden="true">⌕</span>
    </Input>
  </div>

  {#if filtered.length === 0}
    <p class="hazards__empty">{hazards.length === 0 ? 'No hazards in library. Import a YAML.' : 'No matches.'}</p>
  {:else}
    <ul class="hazards__list" role="list">
      {#each filtered as hazard (hazard.id)}
        {@const count = encounterCounts[hazard.id] ?? 0}
        <li class="hazards__row">
          <div class="hazards__main">
            <span class="hazards__name">{hazard.name}</span>
            <span class="hazards__meta">L{hazard.level} · {hazard.traits.join(', ')}</span>
          </div>
          <div class="hazards__controls">
            {#if count > 0}
              <span class="hazards__count" aria-label={`${count} in encounter`}>×{count}</span>
              <IconButton
                ariaLabel={`Remove one ${hazard.name} from encounter`}
                title="Remove one from encounter"
                size={22}
                onclick={() => onRemoveOneFromEncounter(hazard.id)}
              >−</IconButton>
            {/if}
            <Button size="sm" onclick={() => onAddToEncounter(hazard)}>Add</Button>
            {#if onRemoveHazard}
              <IconButton
                ariaLabel={`Delete ${hazard.name} from library`}
                title="Delete from library"
                size={22}
                onclick={() => onRemoveHazard?.(hazard.id)}
              >🗑</IconButton>
            {/if}
          </div>
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
    gap: var(--space-2);
  }

  .count {
    color: var(--color-ink-mute);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .hazards__actions {
    display: flex;
    gap: var(--space-2);
  }

  .hazards__empty {
    margin: 0;
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .hazards__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-1);
    max-height: 280px;
    overflow-y: auto;
  }

  .hazards__row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 4px 6px;
    border-radius: 4px;
  }

  .hazards__row:hover {
    background: var(--color-panel-2);
  }

  .hazards__main {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
  }

  .hazards__name {
    font-family: var(--font-serif);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hazards__meta {
    color: var(--color-ink-soft);
    font-size: var(--text-xs);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hazards__controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hazards__count {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-mute);
  }
</style>
