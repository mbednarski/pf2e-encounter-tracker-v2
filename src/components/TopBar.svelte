<script lang="ts">
  import type { EncounterState } from '../domain';
  import Chip from './ui/Chip.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let name: string;
  export let phase: EncounterState['phase'];
  export let round: number;
  export let activeName: string | undefined;
</script>

<header class="topbar">
  <div class="topbar__title">
    <SectionLabel>PF2e Encounter Tracker v2</SectionLabel>
    <h1>{name}</h1>
  </div>
  <div class="topbar__status" aria-label="Encounter status">
    <Chip variant={phase === 'ACTIVE' ? 'success' : 'default'}>{phase}</Chip>
    <div class="topbar__round">
      <SectionLabel>Round</SectionLabel>
      <span class="topbar__round-value">{round}</span>
    </div>
    <span class="topbar__turn">
      {activeName ? `${activeName}'s turn` : 'No active turn'}
    </span>
    <a class="topbar__settings" href="/settings">Settings</a>
  </div>
</header>

<style>
  .topbar {
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
  }

  .topbar__title {
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

  .topbar__status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-base);
  }

  .topbar__round {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }

  .topbar__round-value {
    font-family: var(--font-mono);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-red);
    line-height: var(--leading-tight);
  }

  .topbar__turn {
    color: var(--color-ink-soft);
    font-size: var(--text-base);
    font-style: italic;
  }

  .topbar__settings {
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

  .topbar__settings:hover {
    background: var(--color-panel-2);
    border-color: var(--color-ink);
  }

  .topbar__settings:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  @media (max-width: 760px) {
    .topbar {
      display: grid;
      grid-template-columns: 1fr;
    }

    .topbar__status {
      justify-content: start;
    }
  }
</style>
