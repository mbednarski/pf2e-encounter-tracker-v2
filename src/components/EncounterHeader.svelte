<script lang="ts">
  import type { EncounterState } from '../domain';
  import Button from './ui/Button.svelte';
  import Chip from './ui/Chip.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let name: string;
  export let phase: EncounterState['phase'];
  export let round: number;
  export let activeName: string | undefined;
  export let canRollAll = false;
  export let canEndTurn = false;
  export let onRollAllInitiative: () => void = () => {};
  export let onEndTurn: () => void = () => {};
</script>

<header class="header">
  <div class="header__title">
    <SectionLabel>PF2e Encounter Tracker v2</SectionLabel>
    <h1>{name}</h1>
  </div>
  <div class="header__status" aria-label="Encounter status">
    <Chip variant={phase === 'ACTIVE' ? 'success' : 'default'}>{phase}</Chip>
    <div class="header__round">
      <SectionLabel>Round</SectionLabel>
      <span class="header__round-value">{round}</span>
    </div>
    <span class="header__turn">
      {activeName ? `${activeName}'s turn` : 'No active turn'}
    </span>
    {#if phase === 'PREPARING' && canRollAll}
      <div class="header__action">
        <Button variant="primary" size="sm" ariaLabel="Roll all initiative" onclick={onRollAllInitiative}>
          Roll all initiative
        </Button>
        <span class="header__hint">Rolls only blanks — use a card's Roll button to re-roll one.</span>
      </div>
    {/if}
    {#if phase === 'ACTIVE'}
      <Button
        variant="primary"
        ariaLabel="End turn"
        disabled={!canEndTurn}
        onclick={onEndTurn}
      >End Turn</Button>
    {/if}
    <a class="header__settings" href="/settings">Settings</a>
  </div>
</header>

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-5);
    margin: 0 auto var(--space-4);
    max-width: 1440px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-soft);
  }

  .header__title {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-2xl);
    font-weight: 600;
    line-height: var(--leading-tight);
    color: var(--color-ink);
    letter-spacing: -0.2px;
  }

  .header__status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-base);
  }

  .header__round {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }

  .header__round-value {
    font-family: var(--font-mono);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--accent);
    line-height: var(--leading-tight);
  }

  .header__turn {
    color: var(--color-ink-soft);
    font-size: var(--text-base);
    font-style: italic;
  }

  .header__action {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .header__hint {
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
  }

  .header__settings {
    color: var(--color-ink);
    text-decoration: none;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    border: var(--border-thin);
    background: transparent;
    padding: 6px var(--space-3);
    transition: background 0.12s, border-color 0.12s;
  }

  .header__settings:hover {
    background: var(--color-panel-2);
    border-color: var(--color-ink);
  }

  .header__settings:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  @media (max-width: 760px) {
    .header {
      display: grid;
      grid-template-columns: 1fr;
    }

    .header__status {
      justify-content: start;
    }
  }
</style>
