<script lang="ts">
  import type { SpellListEntry } from '../../domain';
  import { ensureSpellIndex, resolveAtLevel } from '$lib/spell-index';
  import type { SpellIndexEntry, SpellIndexState } from '$lib/spell-index';

  export let entry: SpellListEntry;
  export let dc: number;
  export let attackModifier: number | undefined = undefined;

  let expanded = false;
  let indexState: SpellIndexState = { status: 'idle' };

  $: countSuffix = entry.count && entry.count > 1 ? ` ×${entry.count}` : '';

  async function toggleExpand() {
    if (!expanded && indexState.status === 'idle') {
      indexState = { status: 'loading' };
      indexState = await ensureSpellIndex();
    }
    expanded = !expanded;
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

  function formatActionCost(cost: SpellIndexEntry['actionCost']): string {
    if (cost === 1) return '◆';
    if (cost === 2) return '◆◆';
    if (cost === 3) return '◆◆◆';
    if (cost === 'reaction') return '↺';
    if (cost === 'free') return '◇';
    return '—';
  }
</script>

<li class="spell-row" class:expanded>
  <button
    type="button"
    class="spell-row__toggle"
    aria-expanded={expanded}
    onclick={toggleExpand}
  >
    <span class="spell-row__caret">{expanded ? '▾' : '▸'}</span>
    <span class="spell-row__name">{entry.name}{countSuffix}</span>
  </button>

  {#if expanded}
    {#if indexState.status === 'loading'}
      <div class="spell-row__panel">Loading…</div>
    {:else if indexState.status === 'ready'}
      {@const spell = resolvedEntry(indexState)}
      {#if spell}
        {@const resolved = resolveAtLevel(spell, entry.level)}
        <div class="spell-row__panel">
          <div class="spell-row__line">
            <span>{formatActionCost(spell.actionCost)}</span>
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
            href={`https://2e.aonprd.com/Search.aspx?Query=${encodeURIComponent(entry.name)}&type=spell`}
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
          href={`https://2e.aonprd.com/Search.aspx?Query=${encodeURIComponent(entry.name)}&type=spell`}
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
