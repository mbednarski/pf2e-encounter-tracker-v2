<script lang="ts">
  import { onMount } from 'svelte';
  import type { Command, CombatantState, Creature, PromptResolution } from '../domain';
  import TopBar from '../components/TopBar.svelte';
  import CombatLogDrawer from '../components/CombatLogDrawer.svelte';
  import CombatantCard from '../components/CombatantCard.svelte';
  import CombatantDetailsPanel from '../components/CombatantDetailsPanel.svelte';
  import LibraryPane from '../components/LibraryPane.svelte';
  import PromptResolutionPanel from '../components/PromptResolutionPanel.svelte';
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
  import {
    addCreatures,
    loadCreatures,
    removeCreature
  } from '$lib/storage/creature-library';
  import { createPersistenceController } from '$lib/storage/persistence-controller';
  import { importCreatureYaml } from '$lib/yaml';

  const conditionOptions = listConditionOptions();

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;
  let feedbackCounter = 1;
  let selection: Selection = emptySelection;
  let storedCreatures: Creature[] = [];

  $: availableCreatures = storedCreatures;

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

  function appendFeedback(
    id: string,
    message: string,
    severity: 'info' | 'warn' | 'success' = 'warn'
  ) {
    feedback = [
      ...feedback,
      { id, commandId: id, severity, message }
    ];
  }

  function nextFeedbackId(scope: string) {
    return `${scope}-${feedbackCounter++}`;
  }

  const persistence = createPersistenceController({
    load: loadActiveEncounter,
    save: saveActiveEncounter,
    clear: clearActiveEncounter,
    onRestoreFailed: () =>
      appendFeedback(
        nextFeedbackId('restore-fail'),
        'Could not restore the previous encounter from storage. If you have this app open in another tab, close it and reload.'
      ),
    onPersistFailed: () =>
      appendFeedback(
        nextFeedbackId('persist-fail'),
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
    const [restored, creatures] = await Promise.all([
      persistence.restore(),
      loadCreatures()
    ]);
    if (restored) {
      encounter = restored;
    }
    storedCreatures = creatures;
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
          nextFeedbackId('import-read-fail'),
          `Could not read "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      let creatures: Creature[];
      let issues: ReturnType<typeof importCreatureYaml>['issues'];
      let skipped: ReturnType<typeof importCreatureYaml>['skipped'];
      try {
        ({ creatures, issues, skipped } = importCreatureYaml(text));
      } catch (err) {
        appendFeedback(
          nextFeedbackId('import-fail'),
          `Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      const persistResult = await addCreatures(creatures);

      if (!persistResult.persisted) {
        appendFeedback(
          nextFeedbackId('import-persist-fail'),
          `Could not save creatures from "${file.name}". Storage is unavailable (common causes: private-browsing mode, full storage, or another tab using a newer version).`
        );
      }

      for (const creature of persistResult.rejected) {
        appendFeedback(
          nextFeedbackId('import-dup'),
          `Skipped "${creature.name}" from "${file.name}": id "${creature.id}" is already in your library.`
        );
      }

      if (persistResult.added.length > 0) {
        storedCreatures = [...storedCreatures, ...persistResult.added];
        appendFeedback(
          nextFeedbackId('import-ok'),
          `Imported ${persistResult.added.length} creature${persistResult.added.length === 1 ? '' : 's'} from "${file.name}".`,
          'success'
        );
      }

      for (const skip of skipped) {
        appendFeedback(
          nextFeedbackId('import-skip'),
          `"${file.name}" doc ${skip.documentIndex + 1}: skipped — kind "${skip.kind}" is not yet imported by this build.`,
          'info'
        );
      }

      for (const issue of issues) {
        const where = issue.path ? ` at "${issue.path}"` : '';
        const lineHint = issue.line !== undefined ? ` (line ${issue.line})` : '';
        appendFeedback(
          nextFeedbackId('import-issue'),
          `"${file.name}" doc ${issue.documentIndex + 1}${where}${lineHint}: ${issue.message}`
        );
      }

      if (
        persistResult.added.length === 0 &&
        persistResult.rejected.length === 0 &&
        issues.length === 0 &&
        skipped.length === 0 &&
        creatures.length === 0
      ) {
        appendFeedback(
          nextFeedbackId('import-empty'),
          `"${file.name}" contained no creature documents.`
        );
      }
    }
  }

  async function handleRemoveCreature(id: string) {
    const removed = await removeCreature(id);
    if (!removed) {
      appendFeedback(
        nextFeedbackId('remove-fail'),
        'Could not remove creature: storage is unavailable.'
      );
      return;
    }
    storedCreatures = storedCreatures.filter((c) => c.id !== id);
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
    feedbackCounter = 1;
    selection = emptySelection;
    persistence.reset();
  }
</script>

<main class="shell">
  <TopBar
    name={encounter.name}
    phase={encounter.phase}
    round={encounter.round}
    activeName={activeCombatant?.name}
  />

  <section class="workspace">
    <div class="workspace__library">
      <LibraryPane
        {canStart}
        creatures={availableCreatures}
        onAddCreatures={handleAddCreatures}
        onAddManual={handleAddManual}
        onImportYamlFiles={handleImportYamlFiles}
        onRemoveCreature={handleRemoveCreature}
        onStart={startEncounter}
        onReset={resetLocal}
      />
    </div>

    <section class="workspace__track" aria-label="Combatants">
      <PromptResolutionPanel
        prompts={encounter.pendingPrompts}
        combatantsById={encounter.combatants}
        phase={encounter.phase}
        onResolve={resolvePrompt}
      />
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

    <aside class="workspace__details">
      <CombatantDetailsPanel combatant={selectedCombatant} onSetNote={setNote} />
    </aside>

    <section class="workspace__log">
      <CombatLogDrawer entries={feedback} />
    </section>
  </section>
</main>

<style>
  .shell {
    min-height: 100vh;
    padding: 24px;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(420px, 1fr) minmax(300px, 380px);
    grid-template-areas:
      'library track details'
      'log     log   log';
    gap: 14px;
    max-width: 1440px;
    margin: 0 auto;
    align-items: start;
  }

  .workspace__library {
    grid-area: library;
  }

  .workspace__track {
    grid-area: track;
    display: grid;
    gap: 14px;
  }

  .workspace__details {
    grid-area: details;
  }

  .workspace__log {
    grid-area: log;
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
      grid-template-areas:
        'library track'
        'details details'
        'log     log';
    }
  }

  @media (max-width: 760px) {
    .shell {
      padding: 14px;
    }

    .workspace {
      grid-template-columns: 1fr;
      grid-template-areas:
        'library'
        'track'
        'details'
        'log';
    }
  }
</style>
