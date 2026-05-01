<script lang="ts">
  import type { Ability, ActionCost, Attack, CombatantState, DamageComponent, EncounterState } from '../domain';
  import { templateLabel } from '$lib/template-label';

  export let combatant: CombatantState | undefined;
  export let phase: EncounterState['phase'];

  function formatDamage(damage: DamageComponent[]): string {
    return damage
      .map((d) => {
        const dice = d.dice && d.dieSize ? `${d.dice}d${d.dieSize}` : '';
        const bonus = d.bonus ? (d.bonus > 0 ? `+${d.bonus}` : `${d.bonus}`) : '';
        const persistent = d.persistent ? ' persistent' : '';
        const head = `${dice}${bonus}` || (d.bonus === 0 ? '0' : '');
        const tail = `${d.type}${persistent}`;
        return head ? `${head} ${tail}` : tail;
      })
      .join(' + ');
  }

  function formatActionCost(cost: ActionCost | undefined): string {
    if (cost === undefined) return '';
    if (cost === 'free') return 'Free action';
    if (cost === 'reaction') return 'Reaction';
    if (cost === 1) return '1 action';
    return `${cost} actions`;
  }

  function formatModifier(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  $: badgeLabel = combatant ? templateLabel(combatant.templateAdjustment) : '';
  // phase is currently used only to keep the prop wired for future copy/affordances
  $: void phase;
</script>

<aside class="details-panel" aria-label="Combatant details">
  {#if !combatant}
    <p class="empty-state">Select a combatant to see details.</p>
  {:else}
    <header class="panel-header">
      <h2>{combatant.name}</h2>
      {#if badgeLabel}
        <span class="template-badge {combatant.templateAdjustment}">{badgeLabel}</span>
      {/if}
    </header>

    <section class="defenses" aria-label="Defenses">
      <h3>Defenses</h3>
      <dl>
        <div>
          <dt>HP</dt>
          <dd>
            {combatant.currentHp}<span class="muted">/{combatant.baseStats.hp}</span>
            {#if combatant.tempHp > 0}<span class="temp">+{combatant.tempHp} temp</span>{/if}
          </dd>
        </div>
        <div>
          <dt>AC</dt>
          <dd>{combatant.baseStats.ac}</dd>
        </div>
        <div>
          <dt>Fort</dt>
          <dd>{formatModifier(combatant.baseStats.fortitude)}</dd>
        </div>
        <div>
          <dt>Ref</dt>
          <dd>{formatModifier(combatant.baseStats.reflex)}</dd>
        </div>
        <div>
          <dt>Will</dt>
          <dd>{formatModifier(combatant.baseStats.will)}</dd>
        </div>
        <div>
          <dt>Perception</dt>
          <dd>{formatModifier(combatant.baseStats.perception)}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{combatant.baseStats.speed} ft</dd>
        </div>
      </dl>
    </section>

    {#if combatant.attacks.length > 0}
      <section class="attacks" aria-label="Attacks">
        <h3>Attacks</h3>
        <ul>
          {#each combatant.attacks as attack, attackIndex (attackIndex)}
            {@const a = attack as Attack}
            <li>
              <div class="attack-line">
                <span class="attack-name">{a.name}</span>
                <span class="muted">({a.type})</span>
                <span class="attack-modifier">{formatModifier(a.modifier)}</span>
              </div>
              {#if a.damage.length > 0}
                <div class="attack-damage">{formatDamage(a.damage)}</div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#each [
      { title: 'Passive Abilities', list: combatant.passiveAbilities },
      { title: 'Reactive Abilities', list: combatant.reactiveAbilities },
      { title: 'Active Abilities', list: combatant.activeAbilities }
    ] as group (group.title)}
      {#if group.list.length > 0}
        <section class="abilities" aria-label={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {#each group.list as ability, abilityIndex (abilityIndex)}
              {@const ab = ability as Ability}
              <li>
                <div class="ability-head">
                  <span class="ability-name">{ab.name}</span>
                  {#if ab.actions !== undefined}
                    <span class="ability-cost">{formatActionCost(ab.actions)}</span>
                  {/if}
                </div>
                {#if ab.frequency}<div class="ability-meta"><strong>Frequency:</strong> {ab.frequency}</div>{/if}
                {#if ab.trigger}<div class="ability-meta"><strong>Trigger:</strong> {ab.trigger}</div>{/if}
                {#if ab.requirements}<div class="ability-meta"><strong>Requirements:</strong> {ab.requirements}</div>{/if}
                <p class="ability-desc">{ab.description}</p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  {/if}
</aside>

<style>
  .details-panel {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 14px;
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .empty-state {
    margin: 0;
    color: #8a9690;
    font-size: 13px;
    font-style: italic;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
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

  h3 {
    margin: 0 0 6px;
    color: #627171;
    font-size: 12px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .defenses dl {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(95px, 1fr));
    gap: 6px 10px;
    margin: 0;
  }

  .defenses dl div {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .defenses dt {
    color: #627171;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .defenses dd {
    margin: 0;
    color: #1d2528;
    font-size: 14px;
    font-weight: 600;
  }

  .muted {
    color: #8a9690;
    font-weight: 400;
  }

  .temp {
    margin-left: 4px;
    color: #2f6f8a;
    font-size: 12px;
    font-weight: 600;
  }

  .attacks ul,
  .abilities ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }

  .attacks li,
  .abilities li {
    border-top: 1px solid #ebeeea;
    padding-top: 6px;
  }

  .attacks li:first-child,
  .abilities li:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .attack-line,
  .ability-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }

  .attack-name,
  .ability-name {
    color: #1d2528;
    font-size: 14px;
    font-weight: 600;
  }

  .attack-modifier {
    color: #1d2528;
    font-weight: 700;
  }

  .attack-damage {
    margin-top: 2px;
    color: #334143;
    font-size: 13px;
  }

  .ability-cost {
    color: #627171;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ability-meta {
    margin-top: 2px;
    color: #334143;
    font-size: 13px;
  }

  .ability-desc {
    margin: 4px 0 0;
    color: #1d2528;
    font-size: 13px;
    line-height: 1.45;
  }
</style>
