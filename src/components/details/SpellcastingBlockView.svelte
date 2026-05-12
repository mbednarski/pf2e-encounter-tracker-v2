<script lang="ts">
  import type { CombatantSpellcasting } from '../../domain';
  import { buildSpellcastingView } from '$lib/spellcasting/view';
  import { formatModifier } from '$lib/abilities/format-damage';

  export let block: CombatantSpellcasting;
  export let dcBonus: number = 0;
  export let attackBonus: number = 0;
  export let dcTooltip: string = '';
  export let attackTooltip: string = '';
  export let onUseSlot: (blockId: string, rank: number) => void;
  export let onRestoreSlot: (blockId: string, rank: number) => void;
  export let onUseFocus: (blockId: string) => void;
  export let onRestoreFocus: (blockId: string) => void;
  export let onUseInnate: (blockId: string, spellSlug: string) => void;
  export let onRestoreInnate: (blockId: string, spellSlug: string) => void;

  $: view = buildSpellcastingView(block);

  function ordinal(n: number): string {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n}st`;
    if (m10 === 2 && m100 !== 12) return `${n}nd`;
    if (m10 === 3 && m100 !== 13) return `${n}rd`;
    return `${n}th`;
  }

  function pipState(used: number, total: number): ('full' | 'empty')[] {
    return Array.from({ length: total }, (_, i) => (i < total - used ? 'full' : 'empty'));
  }

  function suppressContext(e: Event) {
    e.preventDefault();
  }
</script>

<section class="block">
  <header class="block__head">
    <div class="block__title">{view.header.name}</div>
    <div class="block__meta">
      <span>{view.header.tradition}</span>
      <span>·</span>
      <span>{view.header.type}</span>
      <span>·</span>
      <span class:modified={dcBonus !== 0} title={dcTooltip}>DC {view.header.dc + dcBonus}</span>
      {#if view.header.attackModifier !== undefined}
        <span>·</span>
        <span class:modified={attackBonus !== 0} title={attackTooltip}>attack {formatModifier(view.header.attackModifier + attackBonus)}</span>
      {/if}
    </div>
  </header>

  {#if view.type === 'prepared'}
    <div class="ranks">
      {#each view.ranks as rank (rank.rank)}
        <div class="rank">
          <div class="rank__head">
            <span class="rank__label">{ordinal(rank.rank)}</span>
            <span
              class="rank__pips"
              role="group"
              aria-label="{ordinal(rank.rank)}-rank slots, {rank.total - rank.used}/{rank.total} remaining"
            >
              {#each pipState(rank.used, rank.total) as state, i (i)}
                {#if state === 'full'}
                  <button
                    type="button"
                    class="pip pip--full"
                    aria-label="Use a {ordinal(rank.rank)}-rank slot"
                    title="Click to use · right-click to restore"
                    oncontextmenu={(e) => {
                      e.preventDefault();
                      onRestoreSlot(view.header.blockId, rank.rank);
                    }}
                    onclick={() => onUseSlot(view.header.blockId, rank.rank)}
                  >●</button>
                {:else}
                  <button
                    type="button"
                    class="pip pip--empty"
                    aria-label="Restore a {ordinal(rank.rank)}-rank slot"
                    title="Click to restore"
                    oncontextmenu={suppressContext}
                    onclick={() => onRestoreSlot(view.header.blockId, rank.rank)}
                  >○</button>
                {/if}
              {/each}
            </span>
            <span class="rank__count">{rank.total - rank.used}/{rank.total}</span>
          </div>
          {#if rank.entries.length > 0}
            <ul class="spell-list">
              {#each rank.entries as entry (entry.spellSlug)}
                <li>{entry.name}{entry.count > 1 ? ` (×${entry.count})` : ''}</li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {:else if view.type === 'spontaneous'}
    <div class="ranks">
      {#each view.ranks as rank (rank.rank)}
        <div class="rank">
          <div class="rank__head">
            <span class="rank__label">{ordinal(rank.rank)}</span>
            <span class="rank__pips">
              {#each pipState(rank.used, rank.total) as state, i (i)}
                {#if state === 'full'}
                  <button
                    type="button"
                    class="pip pip--full"
                    aria-label="Use a {ordinal(rank.rank)}-rank slot"
                    title="Click to use · right-click to restore"
                    oncontextmenu={(e) => { e.preventDefault(); onRestoreSlot(view.header.blockId, rank.rank); }}
                    onclick={() => onUseSlot(view.header.blockId, rank.rank)}
                  >●</button>
                {:else}
                  <button
                    type="button"
                    class="pip pip--empty"
                    aria-label="Restore a {ordinal(rank.rank)}-rank slot"
                    title="Click to restore"
                    onclick={() => onRestoreSlot(view.header.blockId, rank.rank)}
                  >○</button>
                {/if}
              {/each}
            </span>
            <span class="rank__count">{rank.total - rank.used}/{rank.total}</span>
          </div>
          {#if rank.entries.length > 0}
            <ul class="spell-list">
              {#each rank.entries as entry (entry.spellSlug)}
                <li>{entry.name}</li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {:else if view.type === 'focus'}
    <div class="focus">
      <div class="rank__head">
        <span class="rank__label">Focus</span>
        <span class="rank__pips">
          {#each pipState(view.focus.used, view.focus.total) as state, i (i)}
            {#if state === 'full'}
              <button
                type="button"
                class="pip pip--full"
                aria-label="Spend a focus point"
                title="Click to spend · right-click to restore"
                oncontextmenu={(e) => { e.preventDefault(); onRestoreFocus(view.header.blockId); }}
                onclick={() => onUseFocus(view.header.blockId)}
              >●</button>
            {:else}
              <button
                type="button"
                class="pip pip--empty"
                aria-label="Restore a focus point"
                title="Click to restore"
                onclick={() => onRestoreFocus(view.header.blockId)}
              >○</button>
            {/if}
          {/each}
        </span>
        <span class="rank__count">{view.focus.total - view.focus.used}/{view.focus.total}</span>
      </div>
      {#if view.entries.length > 0}
        <ul class="spell-list">
          {#each view.entries as entry (entry.spellSlug)}
            <li>{entry.name} <span class="muted">({ordinal(entry.level)})</span></li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    {#if view.entries.length > 0}
      <ul class="innate-list">
        {#each view.entries as entry (entry.spellSlug)}
          <li class="innate-row">
            <span class="innate-name">{entry.name} <span class="muted">({ordinal(entry.level)})</span></span>
            {#if entry.interactive && entry.max !== undefined}
              <span class="innate-uses">
                {#each pipState(entry.used, entry.max) as state, i (i)}
                  {#if state === 'full'}
                    <button
                      type="button"
                      class="pip pip--full"
                      aria-label="Use {entry.name}"
                      title="Click to use · right-click to restore"
                      oncontextmenu={(e) => { e.preventDefault(); onRestoreInnate(view.header.blockId, entry.spellSlug); }}
                      onclick={() => onUseInnate(view.header.blockId, entry.spellSlug)}
                    >●</button>
                  {:else}
                    <button
                      type="button"
                      class="pip pip--empty"
                      aria-label="Restore use of {entry.name}"
                      title="Click to restore"
                      onclick={() => onRestoreInnate(view.header.blockId, entry.spellSlug)}
                    >○</button>
                  {/if}
                {/each}
                <span class="rank__count">{entry.max - entry.used}/{entry.max}</span>
              </span>
            {:else}
              <span class="innate-marker">{entry.marker}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  {#if view.cantrips.length > 0}
    <div class="cantrips">
      <span class="cantrips__label">Cantrips ({ordinal(view.cantrips[0].level)})</span>
      <ul class="spell-list">
        {#each view.cantrips as c (c.spellSlug)}
          <li>{c.name}</li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .block {
    display: grid;
    gap: var(--space-2);
  }

  .block__head {
    display: grid;
    gap: 2px;
  }

  .block__title {
    color: var(--color-ink);
    font-family: var(--font-serif);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .block__meta {
    display: flex;
    gap: 6px;
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    text-transform: lowercase;
  }

  .ranks {
    display: grid;
    gap: var(--space-2);
  }

  .rank {
    display: grid;
    gap: 2px;
  }

  .rank__head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .rank__label {
    min-width: 36px;
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .rank__pips {
    display: inline-flex;
    gap: 2px;
    align-items: center;
  }

  .rank__count {
    color: var(--color-ink-mute);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .pip {
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    width: 18px;
    height: 18px;
    line-height: 1;
    font-size: 16px;
    cursor: pointer;
    color: var(--color-blue);
  }

  .pip--empty {
    color: var(--color-ink-mute);
  }

  .pip:hover {
    transform: scale(1.15);
  }

  .pip:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
    border-radius: 4px;
  }

  .spell-list {
    list-style: none;
    margin: 0;
    padding: 0 0 0 36px;
    display: grid;
    gap: 2px;
    color: var(--color-ink);
    font-size: var(--text-base);
  }

  .innate-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }

  .innate-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .innate-uses {
    display: inline-flex;
    gap: 2px;
    align-items: center;
  }

  .innate-marker {
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .cantrips {
    display: grid;
    gap: 4px;
  }

  .cantrips__label {
    color: var(--color-ink-soft);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  .muted {
    color: var(--color-ink-mute);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .block__meta .modified {
    color: var(--effect-cond);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
</style>
