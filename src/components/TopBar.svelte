<script lang="ts">
  import type { EncounterState } from '../domain';

  export let name: string;
  export let phase: EncounterState['phase'];
  export let round: number;
  export let activeName: string | undefined;
</script>

<header class="topbar">
  <div>
    <p class="eyebrow">PF2e Encounter Tracker v2</p>
    <h1>{name}</h1>
  </div>
  <div class="status-strip" aria-label="Encounter status">
    <span class="status">{phase}</span>
    <span>Round {round}</span>
    <span>{activeName ? `${activeName}'s turn` : 'No active turn'}</span>
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin: 0 auto 18px;
    max-width: 1440px;
  }

  .eyebrow,
  h1 {
    margin: 0;
  }

  .eyebrow {
    color: #697170;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
  }

  h1 {
    font-size: 32px;
    line-height: 1.1;
  }

  .status-strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    color: #415052;
    font-size: 14px;
  }

  .status-strip span,
  .status {
    border: 1px solid #c5ccc8;
    border-radius: 6px;
    background: #ffffff;
    padding: 8px 10px;
  }

  .status {
    color: #f3f6f5;
    background: #28494c;
    border-color: #28494c;
  }

  @media (max-width: 760px) {
    .topbar {
      display: grid;
      grid-template-columns: 1fr;
    }

    .status-strip {
      justify-content: start;
    }
  }
</style>
