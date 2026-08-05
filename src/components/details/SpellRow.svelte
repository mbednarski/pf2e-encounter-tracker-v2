<script lang="ts">
  import type { EffectDefinition, SpellListEntry } from '../../domain';
  import { ensureSpellIndex, resolveAtLevel } from '$lib/spell-index';
  import type { SpellIndexEntry, SpellIndexState } from '$lib/spell-index';
  import ActionGlyph from '../ui/ActionGlyph.svelte';

  export let entry: SpellListEntry;
  export let dc: number;
  export let attackModifier: number | undefined = undefined;
  export let castableEffects: EffectDefinition[] = [];
  export let onCastEffect: ((effects: EffectDefinition[]) => void) | undefined = undefined;

  let expanded = false;
  let indexState: SpellIndexState = { status: 'idle' };

  $: countSuffix = entry.count && entry.count > 1 ? ` ×${entry.count}` : '';

  // Expand first so the user sees immediate feedback (the "Loading…" panel)
  // even on slow networks; the fetch resolves into the populated panel.
  async function toggleExpand() {
    expanded = !expanded;
    if (expanded && indexState.status === 'idle') {
      indexState = { status: 'loading' };
      indexState = await ensureSpellIndex();
    }
  }

  function resolvedEntry(state: SpellIndexState): SpellIndexEntry | undefined {
    if (state.status !== 'ready') return undefined;
    return state.lookup(entry.spellSlug);
  }

  function defenseLine(spell: SpellIndexEntry): string {
    if (!spell.defense) return '';
    if (spell.defense.kind === 'attack') {
      const sign = (attackModifier ?? 0) >= 0 ? '+' : '';
      return `Spell attack ${sign}${attackModifier ?? 0}`;
    }
    const save = spell.defense.save ? capitalize(spell.defense.save) : 'Save';
    const basic = spell.defense.basic ? ' (basic)' : '';
    return `${save} DC ${dc}${basic}`;
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
</script>

<li class="spell-row" class:expanded>
  <div class="spell-row__head">
    <button
      type="button"
      class="spell-row__toggle"
      aria-expanded={expanded}
      onclick={toggleExpand}
    >
      <span class="spell-row__caret">{expanded ? '▾' : '▸'}</span>
      <span class="spell-row__name">{entry.name}{countSuffix}</span>
    </button>
    {#if castableEffects.length > 0 && onCastEffect}
      <button
        type="button"
        class="spell-row__effect"
        aria-label="Apply {entry.name} effect to combatants"
        title="Apply this spell's effect to combatants"
        onclick={() => onCastEffect?.(castableEffects)}
      >✦ Effect</button>
    {/if}
  </div>

  {#if expanded}
    {#if indexState.status === 'loading'}
      <div class="spell-row__panel">Loading…</div>
    {:else if indexState.status === 'ready'}
      {@const spell = resolvedEntry(indexState)}
      {#if spell}
        {@const resolved = resolveAtLevel(spell, entry.level)}
        <div class="spell-row__panel">
          <div class="spell-row__line">
            {#if spell.actionCost === 'varies'}
              <span aria-label="Variable action cost">—</span>
            {:else}
              <ActionGlyph cost={spell.actionCost} />
            {/if}
            {#if spell.range}<span>· Range {spell.range}</span>{/if}
            {#if spell.area}<span>· Area {spell.area}</span>{/if}
            {#if spell.targets}<span>· Targets {spell.targets}</span>{/if}
          </div>
          {#if spell.defense}
            <div class="spell-row__line">{defenseLine(spell)}</div>
          {/if}
          {#if resolved.damage}
            <div class="spell-row__line">
              <strong>{resolved.damage}</strong>
              {#if entry.level > spell.baseLevel}
                <span class="spell-row__heightened">heightened from rank {spell.baseLevel}</span>
              {/if}
            </div>
          {/if}
          {#if spell.traits.length > 0}
            <div class="spell-row__traits">
              {#each spell.traits.slice(0, 6) as t (t)}
                <span class="spell-row__trait">{t}</span>
              {/each}
            </div>
          {/if}
          {#if spell.effectSummary}
            <div class="spell-row__summary">{spell.effectSummary}</div>
          {/if}
          <a class="spell-row__aon" href={spell.aonUrl} target="_blank" rel="noopener">
            View on Archives of Nethys ↗
          </a>
        </div>
      {:else}
        <div class="spell-row__panel">
          <a
            class="spell-row__aon"
            href={`https://2e.aonprd.com/Search.aspx?q=${encodeURIComponent(entry.name)}`}
            target="_blank"
            rel="noopener"
          >
            Search Archives of Nethys ↗
          </a>
        </div>
      {/if}
    {:else}
      <div class="spell-row__panel">
        <a
          class="spell-row__aon"
          href={`https://2e.aonprd.com/Search.aspx?q=${encodeURIComponent(entry.name)}`}
          target="_blank"
          rel="noopener"
        >
          Search Archives of Nethys ↗
        </a>
      </div>
    {/if}
  {/if}
</li>

<style>
  .spell-row { display: flex; flex-direction: column; }
  .spell-row__head { display: flex; align-items: baseline; gap: 0.5rem; }
  .spell-row__effect {
    border: 1px solid var(--color-rule-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--color-amber, currentColor);
    font: inherit;
    font-size: 0.75em;
    font-weight: 600;
    padding: 0 0.5em;
    cursor: pointer;
    white-space: nowrap;
  }
  .spell-row__effect:hover,
  .spell-row__effect:focus-visible {
    background: var(--color-panel-2, rgb(0 0 0 / 6%));
  }
  .spell-row__toggle {
    display: flex; gap: 0.25rem; align-items: baseline;
    background: none; border: 0; padding: 0; color: inherit;
    cursor: pointer; text-align: left; font: inherit;
  }
  .spell-row__caret { display: inline-block; width: 0.75rem; opacity: 0.7; }
  .spell-row__panel {
    padding: 0.25rem 0 0.5rem 1rem;
    font-size: 0.9em;
    display: flex; flex-direction: column; gap: 0.2rem;
  }
  .spell-row__line { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .spell-row__heightened { opacity: 0.7; font-size: 0.85em; font-style: italic; }
  .spell-row__traits { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .spell-row__trait {
    border: 1px solid currentColor; border-radius: 3px;
    padding: 0 0.3em; font-size: 0.8em; opacity: 0.8;
  }
  .spell-row__summary { opacity: 0.9; }
  .spell-row__aon { margin-top: 0.25rem; }
</style>
