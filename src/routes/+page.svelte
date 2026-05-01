<script lang="ts">
  import type { Command, CombatantState, Creature } from '../domain';
  import TopBar from '../components/TopBar.svelte';
  import FeedbackPanel from '../components/FeedbackPanel.svelte';
  import InitiativeTrack from '../components/InitiativeTrack.svelte';
  import CombatantCard from '../components/CombatantCard.svelte';
  import SetupPanel from '../components/SetupPanel.svelte';
  import {
    combatantCardActions,
    currentCombatant,
    dispatchEncounterCommand,
    listConditionOptions,
    makeCombatant,
    makeCreatureCombatant,
    newEncounterState,
    toCommand,
    viewAppliedEffects,
    type FeedbackEntry,
    type ManualCombatantInput,
    type TemplateAdjustmentChoice
  } from '$lib/encounter-app';

  const conditionOptions = listConditionOptions();

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;
  let hpAmount = 5;
  let tempHpAmount = 0;

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

  function numberOrDefault(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }

  function addCombatant(combatant: CombatantState) {
    runCommand(toCommand('ADD_COMBATANT', { combatant }, nextCommandId()));
    const nextOrder = [...encounter.initiative.order, combatant.id];
    runCommand(toCommand('SET_INITIATIVE_ORDER', { order: nextOrder }, nextCommandId()));
  }

  function handleAddCreatures(input: {
    creature: Creature;
    adjustment: TemplateAdjustmentChoice;
    quantity: number;
    namePrefix: string;
  }) {
    const prefix = input.namePrefix.trim();
    for (let index = 1; index <= input.quantity; index += 1) {
      const name = prefix
        ? input.quantity > 1 ? `${prefix} ${index}` : prefix
        : input.quantity > 1 ? `${input.creature.name} ${index}` : input.creature.name;
      const combatant = makeCreatureCombatant({
        creature: input.creature,
        combatantId: `${input.creature.id}-${combatantCounter++}`,
        name,
        adjustment: input.adjustment
      });
      addCombatant(combatant);
    }
  }

  function handleAddManual(input: Omit<ManualCombatantInput, 'id'>) {
    const slug = input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'combatant';
    const combatant = makeCombatant({ ...input, id: `${slug}-${combatantCounter++}` });
    addCombatant(combatant);
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

  function endTurn(_combatantId: string) {
    runCommand(toCommand('END_TURN', undefined, nextCommandId()));
  }

  function markReactionUsed(combatantId: string) {
    runCommand(toCommand('MARK_REACTION_USED', { combatantId }, nextCommandId()));
  }

  function markDead(combatantId: string) {
    runCommand(toCommand('MARK_DEAD', { combatantId }, nextCommandId()));
  }

  function revive(combatantId: string) {
    runCommand(toCommand('REVIVE', { combatantId }, nextCommandId()));
  }

  function applyCondition(combatantId: string, choice: { effectId: string; value?: number }) {
    runCommand(
      toCommand(
        'APPLY_EFFECT',
        {
          effectId: choice.effectId,
          targetId: combatantId,
          value: choice.value,
          duration: { type: 'unlimited' }
        },
        nextCommandId()
      )
    );
  }

  function removeCondition(combatantId: string, instanceId: string) {
    runCommand(toCommand('REMOVE_EFFECT', { targetId: combatantId, instanceId }, nextCommandId()));
  }

  function modifyConditionValue(combatantId: string, instanceId: string, delta: number) {
    runCommand(
      toCommand('MODIFY_EFFECT_VALUE', { targetId: combatantId, instanceId, delta }, nextCommandId())
    );
  }

  function setConditionValue(combatantId: string, instanceId: string, newValue: number) {
    runCommand(
      toCommand('SET_EFFECT_VALUE', { targetId: combatantId, instanceId, newValue }, nextCommandId())
    );
  }

  function resetLocal() {
    encounter = newEncounterState();
    feedback = [];
    commandCounter = 1;
    combatantCounter = 1;
  }
</script>

<svelte:head>
  <title>PF2e Encounter Tracker v2</title>
</svelte:head>

<main class="shell">
  <TopBar
    name={encounter.name}
    phase={encounter.phase}
    round={encounter.round}
    activeName={activeCombatant?.name}
  />

  <section class="workspace">
    <SetupPanel
      {canStart}
      onAddCreatures={handleAddCreatures}
      onAddManual={handleAddManual}
      onStart={startEncounter}
      onReset={resetLocal}
    />

    <InitiativeTrack
      ordered={orderedCombatants}
      unordered={unorderedCombatants}
      activeId={activeCombatant?.id}
      onMove={moveCombatant}
    />

    <section class="combat-column" aria-label="Combatants">
      <div class="quick-controls">
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
          <CombatantCard
            {combatant}
            isCurrent={combatant.id === activeCombatant?.id}
            phase={encounter.phase}
            actions={combatantCardActions(encounter, combatant.id)}
            appliedEffectsView={viewAppliedEffects(combatant, encounter)}
            {conditionOptions}
            onDamage={applyDamage}
            onHeal={applyHealing}
            onSetTemp={setTempHp}
            onSetZero={(id) => setHp(id, 0)}
            onEndTurn={endTurn}
            onMarkReactionUsed={markReactionUsed}
            onMarkDead={markDead}
            onRevive={revive}
            onApplyCondition={applyCondition}
            onRemoveCondition={removeCondition}
            onModifyConditionValue={modifyConditionValue}
            onSetConditionValue={setConditionValue}
          />
        {/each}
      </div>
    </section>

    <FeedbackPanel entries={feedback} />
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

  .shell {
    min-height: 100vh;
    padding: 24px;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(250px, 320px) minmax(420px, 1fr) minmax(260px, 340px);
    gap: 14px;
    max-width: 1440px;
    margin: 0 auto;
    align-items: start;
  }

  .combat-column {
    display: grid;
    gap: 14px;
  }

  .quick-controls {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 10px;
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 14px;
  }

  .quick-controls label {
    display: grid;
    gap: 5px;
    color: #526061;
    font-size: 12px;
    font-weight: 700;
    max-width: 140px;
  }

  .quick-controls input {
    min-width: 0;
    border: 1px solid #b8c3be;
    border-radius: 6px;
    background: #ffffff;
    color: #1d2528;
    padding: 9px 10px;
    font: inherit;
  }

  .cards {
    display: grid;
    gap: 10px;
  }

  @media (max-width: 1180px) {
    .workspace {
      grid-template-columns: minmax(260px, 320px) 1fr;
    }

    .workspace > :nth-child(3),
    .workspace > :nth-child(4) {
      grid-column: span 2;
    }
  }

  @media (max-width: 760px) {
    .shell {
      padding: 14px;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .workspace > :nth-child(3),
    .workspace > :nth-child(4) {
      grid-column: auto;
    }

    .quick-controls {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
