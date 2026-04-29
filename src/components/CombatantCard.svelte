<script lang="ts">
  import type { CombatantState, EncounterState } from '../domain';

  export let combatant: CombatantState;
  export let isCurrent: boolean;
  export let phase: EncounterState['phase'];
  export let onDamage: (id: string) => void;
  export let onHeal: (id: string) => void;
  export let onSetTemp: (id: string) => void;
  export let onSetZero: (id: string) => void;

  function templateLabel(adjustment: CombatantState['templateAdjustment']) {
    if (adjustment === 'elite') return 'Elite';
    if (adjustment === 'weak') return 'Weak';
    return '';
  }

  $: hpPercent = Math.max(
    0,
    Math.min(100, (combatant.currentHp / combatant.baseStats.hp) * 100)
  );
</script>

<article class:current-card={isCurrent} class="combatant-card">
  <div class="card-heading">
    <div>
      <div class="card-title">
        <h2>{combatant.name}</h2>
        {#if combatant.templateAdjustment}
          <span class="template-badge {combatant.templateAdjustment}">{templateLabel(combatant.templateAdjustment)}</span>
        {/if}
      </div>
      <p>AC {combatant.baseStats.ac} · Fort +{combatant.baseStats.fortitude} · Ref +{combatant.baseStats.reflex} · Will +{combatant.baseStats.will}</p>
    </div>
    <span>{isCurrent ? 'Turn' : phase}</span>
  </div>

  <div class="hp-row">
    <div>
      <strong>{combatant.currentHp}</strong>
      <span>/ {combatant.baseStats.hp} HP</span>
    </div>
    <div>
      <strong>{combatant.tempHp}</strong>
      <span>temp</span>
    </div>
  </div>
  <div class="hp-track" aria-label={`${combatant.name} HP`}>
    <div class="hp-fill" style={`width: ${hpPercent}%`}></div>
  </div>

  <div class="card-actions">
    <button type="button" onclick={() => onDamage(combatant.id)}>Damage</button>
    <button type="button" onclick={() => onHeal(combatant.id)}>Heal</button>
    <button type="button" onclick={() => onSetTemp(combatant.id)}>Set Temp</button>
    <button type="button" class="secondary" onclick={() => onSetZero(combatant.id)}>Set 0</button>
  </div>
</article>

<style>
  .combatant-card {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 16px;
  }

  .current-card {
    border-color: #a53f2b;
  }

  .card-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 10px;
  }

  .card-title {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 8px;
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
  }

  .card-heading p {
    margin: 5px 0 0;
    color: #526061;
    font-size: 13px;
  }

  .card-heading > span {
    border-radius: 999px;
    background: #eef1ee;
    padding: 5px 8px;
    color: #627171;
    font-size: 13px;
    white-space: nowrap;
  }

  .template-badge {
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

  .hp-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 18px;
  }

  .hp-row > div {
    border-radius: 7px;
    background: #eef1ee;
    padding: 10px;
  }

  .hp-row strong {
    font-size: 24px;
  }

  .hp-row span {
    color: #526061;
    font-size: 13px;
  }

  .hp-track {
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: #d9dfdb;
    margin: 12px 0;
  }

  .hp-fill {
    height: 100%;
    border-radius: inherit;
    background: #3f7f64;
  }

  .card-actions {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 10px;
    flex-wrap: wrap;
  }

  .card-actions button {
    min-height: 38px;
    border: 1px solid #28494c;
    border-radius: 6px;
    background: #28494c;
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 8px 12px;
  }

  .card-actions button.secondary {
    border-color: #9aa7a3;
    color: #263235;
    background: #ffffff;
  }

  @media (max-width: 760px) {
    .card-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .card-actions button {
      width: 100%;
    }
  }
</style>
