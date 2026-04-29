<script lang="ts">
  import type { CombatantState } from '../domain';

  export let ordered: CombatantState[];
  export let unordered: CombatantState[];
  export let activeId: string | undefined;
  export let onMove: (id: string, direction: -1 | 1) => void;

  function templateLabel(adjustment: CombatantState['templateAdjustment']) {
    if (adjustment === 'elite') return 'Elite';
    if (adjustment === 'weak') return 'Weak';
    return '';
  }
</script>

<section class="panel initiative-panel" aria-labelledby="initiative-title">
  <div class="panel-heading">
    <h2 id="initiative-title">Initiative</h2>
    <span>{ordered.length} ordered</span>
  </div>

  {#if ordered.length === 0}
    <p class="empty">Add combatants to begin.</p>
  {:else}
    <ol class="initiative-list">
      {#each ordered as combatant, index (combatant.id)}
        <li class:current={combatant.id === activeId}>
          <div>
            <strong>{combatant.name}</strong>
            {#if combatant.templateAdjustment}
              <span class="template-badge {combatant.templateAdjustment}">{templateLabel(combatant.templateAdjustment)}</span>
            {/if}
            <span>HP {combatant.currentHp}/{combatant.baseStats.hp}</span>
          </div>
          <div class="icon-actions">
            <button type="button" title="Move up" disabled={index === 0} onclick={() => onMove(combatant.id, -1)}>↑</button>
            <button
              type="button"
              title="Move down"
              disabled={index === ordered.length - 1}
              onclick={() => onMove(combatant.id, 1)}
            >
              ↓
            </button>
          </div>
        </li>
      {/each}
    </ol>
  {/if}

  {#if unordered.length > 0}
    <div class="queue">
      <h3>Unordered</h3>
      {#each unordered as combatant (combatant.id)}
        <p>{combatant.name}</p>
      {/each}
    </div>
  {/if}
</section>

<style>
  .panel {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 14px;
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
  }

  h3 {
    margin: 16px 0 0;
    font-size: 14px;
  }

  .panel-heading > span,
  .queue,
  .empty {
    color: #627171;
    font-size: 13px;
  }

  .empty,
  .queue p {
    margin: 0;
  }

  .initiative-list {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .initiative-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: 1px solid #d8ddd9;
    border-radius: 7px;
    background: #ffffff;
    padding: 10px;
  }

  .initiative-list li.current {
    border-color: #a53f2b;
    box-shadow: inset 4px 0 0 #a53f2b;
  }

  .initiative-list strong,
  .initiative-list > li > div > span {
    display: block;
  }

  .initiative-list span {
    color: #627171;
    font-size: 13px;
  }

  .template-badge {
    display: inline-block;
    margin: 5px 0 1px;
    border-radius: 999px;
    background: #eef1ee;
    color: #334143;
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    padding: 5px 7px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .template-badge.elite {
    background: #f4e6d7;
    color: #7c3d1f;
  }

  .template-badge.weak {
    background: #e6eef6;
    color: #275171;
  }

  .icon-actions {
    display: flex;
    gap: 6px;
  }

  .icon-actions button {
    min-height: 38px;
    width: 36px;
    padding: 0;
    border: 1px solid #28494c;
    border-radius: 6px;
    background: #28494c;
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .icon-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (max-width: 760px) {
    .panel-heading {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
