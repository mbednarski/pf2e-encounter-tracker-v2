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
    type ApplyConditionChoice,
    type FeedbackEntry,
    type ManualCombatantInput,
    type TemplateAdjustmentChoice
  } from '$lib/encounter-app';
  import {
    resolveHpEdit,
    type CommittableEdit,
    type HpEditField
  } from '$lib/hp-input';

  const conditionOptions = listConditionOptions();

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;

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

  function applyHpEdit(combatantId: string, field: HpEditField, parsed: CommittableEdit) {
    const combatant = encounter.combatants[combatantId];
    if (!combatant) return;
    const intent = resolveHpEdit(field, parsed, {
      hp: combatant.currentHp,
      maxHp: combatant.baseStats.hp,
      tempHp: combatant.tempHp
    });
    if (!intent) return;
    runCommand(
      toCommand(intent.type, { combatantId, amount: intent.amount }, nextCommandId())
    );
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

  function applyCondition(combatantId: string, choice: ApplyConditionChoice) {
    runCommand(
      toCommand(
        'APPLY_EFFECT',
        {
          effectId: choice.effectId,
          targetId: combatantId,
          value: choice.kind === 'valued' ? choice.value : undefined,
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
      <div class="cards">
        {#each orderedCombatants as combatant (combatant.id)}
          <CombatantCard
            {combatant}
            isCurrent={combatant.id === activeCombatant?.id}
            phase={encounter.phase}
            actions={combatantCardActions(encounter, combatant.id)}
            appliedEffectsView={viewAppliedEffects(combatant, encounter)}
            {conditionOptions}
            onHpEdit={applyHpEdit}
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
  }
</style>
