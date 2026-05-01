<script lang="ts">
  import { onMount } from 'svelte';
  import type { Command, CombatantState, Creature, PromptResolution } from '../domain';
  import TopBar from '../components/TopBar.svelte';
  import FeedbackPanel from '../components/FeedbackPanel.svelte';
  import CombatantCard from '../components/CombatantCard.svelte';
  import CombatantDetailsPanel from '../components/CombatantDetailsPanel.svelte';
  import PromptResolutionPanel from '../components/PromptResolutionPanel.svelte';
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
  import {
    emptySelection,
    followActive,
    pickCombatant,
    reconcileWithCombatants,
    type Selection
  } from '$lib/selection-state';
  import {
    clearActiveEncounter,
    loadActiveEncounter,
    saveActiveEncounter
  } from '$lib/storage/active-encounter';
  import { createPersistenceController } from '$lib/storage/persistence-controller';
  import { creatureLibrary } from '$lib/creature-library';
  import { importCreatureYaml } from '$lib/yaml';

  const conditionOptions = listConditionOptions();

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;
  let selection: Selection = emptySelection;
  let importedCreatures: Creature[] = [];

  $: availableCreatures = [...creatureLibrary, ...importedCreatures];

  $: orderedCombatants = encounter.initiative.order
    .map((id) => encounter.combatants[id])
    .filter((combatant): combatant is CombatantState => Boolean(combatant));
  $: unorderedCombatants = Object.values(encounter.combatants).filter((combatant) => !encounter.initiative.order.includes(combatant.id));
  $: activeCombatant = currentCombatant(encounter);
  $: canStart = encounter.phase === 'PREPARING' && encounter.initiative.order.length >= 2;
  $: combatantIdSet = new Set(Object.keys(encounter.combatants));
  $: selection = reconcileWithCombatants(selection, combatantIdSet);
  $: selection = followActive(selection, activeCombatant?.id);
  $: selectedCombatant = selection.id ? encounter.combatants[selection.id] : undefined;

  function appendFeedback(id: string, message: string, severity: 'info' | 'warn' = 'warn') {
    feedback = [
      ...feedback,
      { id, commandId: id, severity, message }
    ];
  }

  const persistence = createPersistenceController({
    load: loadActiveEncounter,
    save: saveActiveEncounter,
    clear: clearActiveEncounter,
    onRestoreFailed: () =>
      appendFeedback(
        `restore-fail-${Date.now()}`,
        'Could not restore the previous encounter from storage. If you have this app open in another tab, close it and reload.'
      ),
    onPersistFailed: () =>
      appendFeedback(
        `persist-fail-${Date.now()}`,
        'Auto-save is unavailable. Your encounter will not survive a reload. (Common causes: private-browsing mode, full storage, or another tab using a newer version.)'
      )
  });

  function runCommand(command: Command) {
    const result = dispatchEncounterCommand(encounter, feedback, command);
    encounter = result.state;
    feedback = result.feedback;
    persistence.persist(result.state);
  }

  onMount(async () => {
    const restored = await persistence.restore();
    if (restored) {
      encounter = restored;
    }
  });

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

  async function handleImportYamlFiles(files: File[]) {
    for (const file of files) {
      let text: string;
      try {
        text = await file.text();
      } catch (err) {
        appendFeedback(
          `import-read-fail-${Date.now()}-${file.name}`,
          `Could not read "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      const { creatures, issues } = importCreatureYaml(text);

      const existingIds = new Set(availableCreatures.map((c) => c.id));
      const accepted: Creature[] = [];
      for (const creature of creatures) {
        if (existingIds.has(creature.id)) {
          appendFeedback(
            `import-dup-${Date.now()}-${creature.id}`,
            `Skipped "${creature.name}" from "${file.name}": id "${creature.id}" already exists.`
          );
          continue;
        }
        existingIds.add(creature.id);
        accepted.push(creature);
      }

      if (accepted.length > 0) {
        importedCreatures = [...importedCreatures, ...accepted];
        appendFeedback(
          `import-ok-${Date.now()}-${file.name}`,
          `Imported ${accepted.length} creature${accepted.length === 1 ? '' : 's'} from "${file.name}".`,
          'info'
        );
      }

      for (const issue of issues) {
        appendFeedback(
          `import-issue-${Date.now()}-${file.name}-${issue.documentIndex}-${issue.path || 'root'}`,
          `"${file.name}" doc ${issue.documentIndex + 1}${issue.path ? ` at "${issue.path}"` : ''}: ${issue.message}`
        );
      }

      if (accepted.length === 0 && issues.length === 0 && creatures.length === 0) {
        appendFeedback(
          `import-empty-${Date.now()}-${file.name}`,
          `"${file.name}" contained no creature documents.`
        );
      }
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

  function setNote(combatantId: string, note: string | null) {
    runCommand(toCommand('SET_NOTE', { combatantId, note }, nextCommandId()));
  }

  function resolvePrompt(promptId: string, resolution: PromptResolution) {
    runCommand(toCommand('RESOLVE_PROMPT', { promptId, resolution }, nextCommandId()));
  }

  function selectCombatant(id: string) {
    selection = pickCombatant(selection, id);
  }

  function resetLocal() {
    encounter = newEncounterState();
    feedback = [];
    commandCounter = 1;
    combatantCounter = 1;
    selection = emptySelection;
    importedCreatures = [];
    persistence.reset();
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

  <PromptResolutionPanel
    prompts={encounter.pendingPrompts}
    combatantsById={encounter.combatants}
    phase={encounter.phase}
    onResolve={resolvePrompt}
  />

  <section class="workspace">
    <SetupPanel
      {canStart}
      creatures={availableCreatures}
      onAddCreatures={handleAddCreatures}
      onAddManual={handleAddManual}
      onImportYamlFiles={handleImportYamlFiles}
      onStart={startEncounter}
      onReset={resetLocal}
    />

    <section class="combat-column" aria-label="Combatants">
      {#if unorderedCombatants.length > 0}
        <div class="not-yet-rolled" aria-label="Not yet rolled">
          <h3>Not yet rolled</h3>
          <ul>
            {#each unorderedCombatants as combatant (combatant.id)}
              <li>{combatant.name}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="cards">
        {#each orderedCombatants as combatant, index (combatant.id)}
          <CombatantCard
            {combatant}
            isCurrent={combatant.id === activeCombatant?.id}
            isSelected={combatant.id === selection.id}
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
            onMove={moveCombatant}
            onSelect={selectCombatant}
            isFirst={index === 0}
            isLast={index === orderedCombatants.length - 1}
          />
        {/each}
      </div>
    </section>

    <CombatantDetailsPanel combatant={selectedCombatant} onSetNote={setNote} />

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
    grid-template-columns: minmax(260px, 320px) minmax(420px, 1fr) minmax(300px, 380px) minmax(260px, 340px);
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

  .not-yet-rolled {
    border: 1px solid #cfd6d1;
    border-radius: 8px;
    background: #fbfcfa;
    padding: 12px 14px;
  }

  .not-yet-rolled h3 {
    margin: 0 0 6px;
    color: #627171;
    font-size: 13px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .not-yet-rolled ul {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .not-yet-rolled li {
    color: #263235;
    font-size: 14px;
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
