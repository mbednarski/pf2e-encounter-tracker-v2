<script lang="ts">
  import type { Command, CombatantState } from '../domain';
  import {
    currentCombatant,
    dispatchEncounterCommand,
    makeCombatant,
    newEncounterState,
    toCommand,
    type FeedbackEntry,
    type ManualCombatantInput
  } from '$lib/encounter-app';

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;

  let manualName = 'Goblin Warrior';
  let manualHp = 18;
  let manualAc = 16;
  let manualFortitude = 6;
  let manualReflex = 8;
  let manualWill = 5;
  let manualPerception = 7;
  let manualSpeed = 25;
  let hpAmount = 5;
  let tempHpAmount = 0;

  const sampleCombatants: ManualCombatantInput[] = [
    {
      id: 'goblin-warrior',
      name: 'Goblin Warrior',
      maxHp: 18,
      ac: 16,
      fortitude: 6,
      reflex: 8,
      will: 5,
      perception: 7,
      speed: 25
    },
    {
      id: 'skeleton-guard',
      name: 'Skeleton Guard',
      maxHp: 20,
      ac: 17,
      fortitude: 7,
      reflex: 8,
      will: 5,
      perception: 6,
      speed: 25
    },
    {
      id: 'fighter',
      name: 'Fighter',
      maxHp: 26,
      ac: 18,
      fortitude: 9,
      reflex: 7,
      will: 6,
      perception: 8,
      speed: 25
    }
  ];

  $: orderedCombatants = encounter.initiative.order
    .map((id) => encounter.combatants[id])
    .filter((combatant): combatant is CombatantState => Boolean(combatant));
  $: unorderedCombatants = Object.values(encounter.combatants).filter((combatant) => !encounter.initiative.order.includes(combatant.id));
  $: activeCombatant = currentCombatant(encounter);
  $: canStart = encounter.phase === 'PREPARING' && encounter.initiative.order.length >= 2;

  function runCommand(command: Command) {
    const result = dispatchEncounterCommand(encounter, feedback, command);
    encounter = result.state;
    feedback = result.feedback;
  }

  function nextCommandId() {
    return `cmd-${commandCounter++}`;
  }

  function addManualCombatant() {
    const id = `${slugify(manualName)}-${combatantCounter++}`;
    addCombatant({
      id,
      name: manualName.trim() || `Combatant ${combatantCounter}`,
      maxHp: numberOrDefault(manualHp, 1),
      ac: numberOrDefault(manualAc, 10),
      fortitude: numberOrDefault(manualFortitude, 0),
      reflex: numberOrDefault(manualReflex, 0),
      will: numberOrDefault(manualWill, 0),
      perception: numberOrDefault(manualPerception, 0),
      speed: numberOrDefault(manualSpeed, 25)
    });
  }

  function addSamples() {
    for (const sample of sampleCombatants) {
      if (!encounter.combatants[sample.id]) {
        addCombatant(sample);
      }
    }
  }

  function addCombatant(input: ManualCombatantInput) {
    const combatant = makeCombatant(input);
    runCommand(toCommand('ADD_COMBATANT', { combatant }, nextCommandId()));
    const nextOrder = [...encounter.initiative.order, combatant.id];
    runCommand(toCommand('SET_INITIATIVE_ORDER', { order: nextOrder }, nextCommandId()));
  }

  function moveCombatant(combatantId: string, direction: -1 | 1) {
    const currentIndex = encounter.initiative.order.indexOf(combatantId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= encounter.initiative.order.length) {
      return;
    }

    const nextOrder = [...encounter.initiative.order];
    const [combatant] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, combatant);
    runCommand(toCommand('SET_INITIATIVE_ORDER', { order: nextOrder }, nextCommandId()));
  }

  function startEncounter() {
    runCommand(toCommand('START_ENCOUNTER', undefined, nextCommandId()));
  }

  function applyDamage(combatantId: string) {
    runCommand(toCommand('APPLY_DAMAGE', { combatantId, amount: numberOrDefault(hpAmount, 1) }, nextCommandId()));
  }

  function applyHealing(combatantId: string) {
    runCommand(toCommand('APPLY_HEALING', { combatantId, amount: numberOrDefault(hpAmount, 1) }, nextCommandId()));
  }

  function setTempHp(combatantId: string) {
    runCommand(toCommand('SET_TEMP_HP', { combatantId, amount: numberOrDefault(tempHpAmount, 0) }, nextCommandId()));
  }

  function setHp(combatantId: string, amount: number) {
    runCommand(toCommand('SET_HP', { combatantId, amount }, nextCommandId()));
  }

  function resetLocal() {
    encounter = newEncounterState();
    feedback = [];
    commandCounter = 1;
    combatantCounter = 1;
  }

  function hpPercent(combatant: CombatantState) {
    return Math.max(0, Math.min(100, (combatant.currentHp / combatant.baseStats.hp) * 100));
  }

  function numberOrDefault(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }

  function slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || 'combatant';
  }
</script>

<svelte:head>
  <title>PF2e Encounter Tracker v2</title>
</svelte:head>

<main class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">PF2e Encounter Tracker v2</p>
      <h1>{encounter.name}</h1>
    </div>
    <div class="status-strip" aria-label="Encounter status">
      <span class="status">{encounter.phase}</span>
      <span>Round {encounter.round}</span>
      <span>{activeCombatant ? `${activeCombatant.name}'s turn` : 'No active turn'}</span>
    </div>
  </header>

  <section class="workspace">
    <aside class="panel setup-panel" aria-labelledby="setup-title">
      <div class="panel-heading">
        <h2 id="setup-title">Encounter Setup</h2>
        <button type="button" class="secondary" onclick={addSamples}>Add Samples</button>
      </div>

      <form class="manual-form" onsubmit={(event) => {
        event.preventDefault();
        addManualCombatant();
      }}>
        <label>
          Name
          <input bind:value={manualName} autocomplete="off" />
        </label>
        <div class="stat-grid">
          <label>
            HP
            <input type="number" min="1" bind:value={manualHp} />
          </label>
          <label>
            AC
            <input type="number" bind:value={manualAc} />
          </label>
          <label>
            Fort
            <input type="number" bind:value={manualFortitude} />
          </label>
          <label>
            Ref
            <input type="number" bind:value={manualReflex} />
          </label>
          <label>
            Will
            <input type="number" bind:value={manualWill} />
          </label>
          <label>
            Per
            <input type="number" bind:value={manualPerception} />
          </label>
        </div>
        <label>
          Speed
          <input type="number" min="0" bind:value={manualSpeed} />
        </label>
        <button type="submit">Add Combatant</button>
      </form>

      <div class="control-row">
        <button type="button" disabled={!canStart} onclick={startEncounter}>Start Encounter</button>
        <button type="button" class="secondary" onclick={resetLocal}>Reset Local</button>
      </div>
    </aside>

    <section class="panel initiative-panel" aria-labelledby="initiative-title">
      <div class="panel-heading">
        <h2 id="initiative-title">Initiative</h2>
        <span>{encounter.initiative.order.length} ordered</span>
      </div>

      {#if orderedCombatants.length === 0}
        <p class="empty">Add combatants to begin.</p>
      {:else}
        <ol class="initiative-list">
          {#each orderedCombatants as combatant, index (combatant.id)}
            <li class:current={combatant.id === activeCombatant?.id}>
              <div>
                <strong>{combatant.name}</strong>
                <span>HP {combatant.currentHp}/{combatant.baseStats.hp}</span>
              </div>
              <div class="icon-actions">
                <button type="button" title="Move up" disabled={index === 0} onclick={() => moveCombatant(combatant.id, -1)}>↑</button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === orderedCombatants.length - 1}
                  onclick={() => moveCombatant(combatant.id, 1)}
                >
                  ↓
                </button>
              </div>
            </li>
          {/each}
        </ol>
      {/if}

      {#if unorderedCombatants.length > 0}
        <div class="queue">
          <h3>Unordered</h3>
          {#each unorderedCombatants as combatant (combatant.id)}
            <p>{combatant.name}</p>
          {/each}
        </div>
      {/if}
    </section>

    <section class="combat-column" aria-label="Combatants">
      <div class="quick-controls panel">
        <label>
          HP Amount
          <input type="number" min="1" bind:value={hpAmount} />
        </label>
        <label>
          Temp HP
          <input type="number" min="0" bind:value={tempHpAmount} />
        </label>
      </div>

      <div class="cards">
        {#each orderedCombatants as combatant (combatant.id)}
          <article class:current-card={combatant.id === activeCombatant?.id} class="combatant-card">
            <div class="card-heading">
              <div>
                <h2>{combatant.name}</h2>
                <p>AC {combatant.baseStats.ac} · Fort +{combatant.baseStats.fortitude} · Ref +{combatant.baseStats.reflex} · Will +{combatant.baseStats.will}</p>
              </div>
              <span>{combatant.id === activeCombatant?.id ? 'Turn' : encounter.phase}</span>
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
              <div class="hp-fill" style={`width: ${hpPercent(combatant)}%`}></div>
            </div>

            <div class="card-actions">
              <button type="button" onclick={() => applyDamage(combatant.id)}>Damage</button>
              <button type="button" onclick={() => applyHealing(combatant.id)}>Heal</button>
              <button type="button" onclick={() => setTempHp(combatant.id)}>Set Temp</button>
              <button type="button" class="secondary" onclick={() => setHp(combatant.id, 0)}>Set 0</button>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <aside class="panel feedback-panel" aria-labelledby="feedback-title">
      <div class="panel-heading">
        <h2 id="feedback-title">Event Feedback</h2>
        <span>{feedback.length}</span>
      </div>
      {#if feedback.length === 0}
        <p class="empty">Domain events will appear here.</p>
      {:else}
        <ol class="feedback-list">
          {#each feedback as entry (entry.id)}
            <li class:warn={entry.severity === 'warn'}>{entry.message}</li>
          {/each}
        </ol>
      {/if}
    </aside>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    color: #1d2528;
    background: #edf0ec;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  :global(button),
  :global(input) {
    font: inherit;
  }

  .shell {
    min-height: 100vh;
    padding: 24px;
  }

  .topbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin: 0 auto 18px;
    max-width: 1440px;
  }

  .eyebrow,
  .topbar h1,
  .panel h2,
  .panel h3,
  .combatant-card h2,
  .combatant-card p,
  .empty {
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

  .workspace {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(250px, 320px) minmax(420px, 1fr) minmax(260px, 340px);
    gap: 14px;
    max-width: 1440px;
    margin: 0 auto;
    align-items: start;
  }

  .panel,
  .combatant-card {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
  }

  .panel {
    padding: 14px;
  }

  .panel-heading,
  .card-heading,
  .control-row,
  .card-actions,
  .quick-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .panel-heading {
    margin-bottom: 14px;
  }

  .panel h2,
  .combatant-card h2 {
    font-size: 17px;
    line-height: 1.2;
  }

  .panel h3 {
    margin-top: 16px;
    font-size: 14px;
  }

  .manual-form,
  .cards,
  .feedback-list,
  .initiative-list {
    display: grid;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 5px;
    color: #526061;
    font-size: 12px;
    font-weight: 700;
  }

  input {
    min-width: 0;
    border: 1px solid #b8c3be;
    border-radius: 6px;
    background: #ffffff;
    color: #1d2528;
    padding: 9px 10px;
  }

  button {
    min-height: 38px;
    border: 1px solid #28494c;
    border-radius: 6px;
    background: #28494c;
    color: #ffffff;
    cursor: pointer;
    font-weight: 700;
    padding: 8px 12px;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  button.secondary {
    border-color: #9aa7a3;
    color: #263235;
    background: #ffffff;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .control-row {
    margin-top: 12px;
  }

  .initiative-list,
  .feedback-list {
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
  .initiative-list span {
    display: block;
  }

  .initiative-list span,
  .card-heading span,
  .queue,
  .empty {
    color: #627171;
    font-size: 13px;
  }

  .icon-actions {
    display: flex;
    gap: 6px;
  }

  .icon-actions button {
    width: 36px;
    padding: 0;
  }

  .combat-column {
    display: grid;
    gap: 14px;
  }

  .quick-controls {
    justify-content: start;
  }

  .quick-controls label {
    max-width: 140px;
  }

  .combatant-card {
    padding: 16px;
  }

  .current-card {
    border-color: #a53f2b;
  }

  .card-heading {
    align-items: start;
  }

  .card-heading p {
    margin-top: 5px;
    color: #526061;
    font-size: 13px;
  }

  .card-heading span {
    border-radius: 999px;
    background: #eef1ee;
    padding: 5px 8px;
    white-space: nowrap;
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
    justify-content: start;
    flex-wrap: wrap;
  }

  .feedback-list li {
    border-left: 4px solid #3f7f64;
    border-radius: 6px;
    background: #ffffff;
    padding: 10px;
    font-size: 13px;
  }

  .feedback-list li.warn {
    border-left-color: #b6652e;
    background: #fff7ee;
  }

  @media (max-width: 1180px) {
    .workspace {
      grid-template-columns: minmax(260px, 320px) 1fr;
    }

    .combat-column,
    .feedback-panel {
      grid-column: span 2;
    }
  }

  @media (max-width: 760px) {
    .shell {
      padding: 14px;
    }

    .topbar,
    .workspace {
      display: grid;
      grid-template-columns: 1fr;
    }

    .status-strip {
      justify-content: start;
    }

    .combat-column,
    .feedback-panel {
      grid-column: auto;
    }

    .card-heading,
    .panel-heading,
    .control-row,
    .quick-controls {
      align-items: stretch;
      flex-direction: column;
    }

    .card-actions button,
    .control-row button {
      width: 100%;
    }
  }
</style>
