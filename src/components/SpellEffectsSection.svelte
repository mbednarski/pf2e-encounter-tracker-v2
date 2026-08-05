<script lang="ts">
  import type { EffectDefinition } from '../domain';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let effects: EffectDefinition[];
  export let onImportEffectFiles: ((files: File[]) => void) | undefined = undefined;
  export let onLoadSamples: (() => void) | undefined = undefined;
  export let onOpenManageLibrary: (() => void) | undefined = undefined;

  let query = '';
  let fileInput: HTMLInputElement | undefined;

  $: needle = query.trim().toLowerCase();
  $: filtered = needle
    ? effects.filter((effect) => {
        if (effect.name.toLowerCase().includes(needle)) return true;
        return (effect.traits ?? []).some((t) => t.toLowerCase().includes(needle));
      })
    : effects;

  function durationLabel(effect: EffectDefinition): string {
    const spec = effect.defaultDuration;
    if (!spec || spec.unit === 'unlimited') return 'unlimited';
    const value = spec.value ?? 1;
    const unit = value === 1 ? spec.unit.replace(/s$/, '') : spec.unit;
    return `${value} ${unit}${spec.sustained ? ' · sustained' : ''}`;
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onImportEffectFiles?.(files);
    }
    input.value = '';
  }
</script>

<section class="effects" aria-labelledby="spell-effects-label">
  <header class="effects__header">
    <SectionLabel as="h3" id="spell-effects-label">Spell Effects</SectionLabel>
    <span class="count">{effects.length}</span>
  </header>

  <div class="effects__actions">
    {#if onImportEffectFiles}
      <Button variant="secondary" size="sm" onclick={() => fileInput?.click()}>Import…</Button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onchange={handleFileChange}
      />
    {/if}
    {#if onLoadSamples}
      <Button variant="secondary" size="sm" onclick={onLoadSamples}>Add starter effects</Button>
    {/if}
    {#if onOpenManageLibrary}
      <Button variant="secondary" size="sm" onclick={onOpenManageLibrary}>Manage…</Button>
    {/if}
  </div>

  {#if effects.length > 3}
    <div class="effects__search">
      <Input ariaLabel="Search spell effects" type="search" placeholder="Search…" bind:value={query}>
        <span slot="leading" aria-hidden="true">⌕</span>
      </Input>
    </div>
  {/if}

  {#if effects.length === 0}
    <p class="empty">
      Import Foundry spell-effect JSON (or add the starter pack) to apply spell buffs like bard
      compositions with one tap during combat.
    </p>
  {:else if filtered.length === 0}
    <p class="empty">No matching spell effects.</p>
  {:else}
    <ul class="rows">
      {#each filtered as effect (effect.id)}
        <li class="row" title={effect.description ?? effect.name}>
          <span class="row__glyph" aria-hidden="true">✦</span>
          <span class="row__body">
            <span class="row__name">{effect.name}</span>
            <span class="row__meta">
              {#if effect.level !== undefined}rank {effect.level} · {/if}{durationLabel(effect)}
            </span>
          </span>
        </li>
      {/each}
    </ul>
    <p class="hint">Cast from a combatant's spell list (✦ Effect) or the effects menu on a card.</p>
  {/if}
</section>

<style>
  .effects {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-thin);
  }

  .effects__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .effects__actions {
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

  .hint {
    margin: 0;
    color: var(--color-ink-mute);
    font-size: var(--text-xs);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    max-height: 240px;
    overflow: auto;
    border-top: var(--border-thin);
  }

  .row {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-1) var(--space-1);
    border-bottom: 1px dashed var(--color-rule);
  }

  .row:last-child {
    border-bottom: none;
  }

  .row__glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-amber);
  }

  .row__body {
    display: grid;
    gap: 1px;
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

  .row__meta {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
