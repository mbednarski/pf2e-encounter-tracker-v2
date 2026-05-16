<script lang="ts">
  import { onMount } from 'svelte';
  import type { Command, CombatantState, Creature, Duration, LogEntry, PartyMember, PromptResolution } from '../domain';
  import { computeEncounterXP, getAdjustedView } from '../domain';
  import EncounterDifficultyMeter from '../components/EncounterDifficultyMeter.svelte';
  import TopBar from '../components/TopBar.svelte';
  import CombatLogDrawer from '../components/CombatLogDrawer.svelte';
  import CombatantCard from '../components/CombatantCard.svelte';
  import CombatantDetailsPanel from '../components/CombatantDetailsPanel.svelte';
  import LibraryPane from '../components/LibraryPane.svelte';
  import RadialConditionMenu from '../components/RadialConditionMenu.svelte';
  import EffectModal from '../components/EffectModal.svelte';
  import RollBubble from '../components/RollBubble.svelte';
  import {
    appendInfoLog,
    combatantCardActions,
    computeCombatantStats,
    currentCombatant,
    dispatchEncounterCommand,
    formatModifierBreakdown,
    groupConditionsByCategory,
    listAfflictionOptions,
    listConditionOptions,
    listConditionWedgeCounts,
    listPersistentDamageOptions,
    listRecentConditionOptions,
    listRemovableEffects,
    listSpellEffectOptions,
    makeCombatant,
    makeCreatureCombatant,
    makePartyMemberCombatant,
    newEncounterState,
    toCommand,
    viewAppliedEffects,
    type ApplyConditionChoice,
    type EffectModalTab,
    type FeedbackEntry,
    type ManualCombatantInput,
    type TemplateAdjustmentChoice
  } from '$lib/encounter-app';
  import { rollAttack as rollAttackDice, rollDamage as rollDamageDice } from '$lib/dice/roll';
  import type { MapVariant } from '$lib/dice/map';
  import { formatModifier } from '$lib/abilities/format-damage';
  import type { Attack } from '../domain';
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
  import {
    addPartyMembers,
    loadPartyMembers,
    removePartyMember,
    savePartyMember
  } from '$lib/storage/party-members';
  import { createPersistenceController } from '$lib/storage/persistence-controller';
  import { importCreatureYaml, importPartyMemberYaml } from '$lib/yaml';
  import { importCreatureFoundryJson } from '$lib/foundry';
  import {
    COMMAND_ID_PREFIX,
    computeEncounterCounts,
    dedupeLogById,
    nextCombatantCounterFor,
    nextCommandCounterFor
  } from '$lib/page-helpers';

  const conditionOptions = listConditionOptions();
  const conditionGroups = groupConditionsByCategory();
  const persistentOptions = listPersistentDamageOptions();
  const afflictionOptions = listAfflictionOptions();
  const spellOptions = listSpellEffectOptions();
  const wedgeCounts = listConditionWedgeCounts();

  let radialOpen = false;
  let radialAnchor = { x: 0, y: 0 };
  let radialCombatantId: string | null = null;

  let effectModal: { combatantId: string; tab: EffectModalTab } | null = null;

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;
  let feedbackCounter = 1;
  let selection: Selection = emptySelection;
  let storedCreatures: Creature[] = [];
  let storedPartyMembers: PartyMember[] = [];

  $: availableCreatures = storedCreatures;

  $: encounterCounts = computeEncounterCounts(encounter.combatants);

  $: xpSummary = computeEncounterXP(encounter);

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

  $: radialCombatant = radialCombatantId ? encounter.combatants[radialCombatantId] : undefined;
  $: radialRecentOptions = radialCombatant ? listRecentConditionOptions(encounter) : [];
  $: radialRemovable = radialCombatant ? listRemovableEffects(radialCombatant, encounter) : [];
  $: if (radialOpen && !radialCombatant) closeRadial();

  $: effectModalCombatant = effectModal ? encounter.combatants[effectModal.combatantId] : undefined;
  $: effectModalApplied = effectModalCombatant ? viewAppliedEffects(effectModalCombatant, encounter) : [];
  $: otherCombatantsForDuration = effectModalCombatant
    ? Object.values(encounter.combatants).map((c) => ({ id: c.id, name: c.name }))
    : [];
  $: if (effectModal && !effectModalCombatant) closeEffectModal();

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
    const result = dispatchEncounterCommand(encounter, command);
    encounter = result.state;
    persistence.persist(result.state);
  }

  $: drawerEntries = mergeDrawerEntries(encounter.combatLog, feedback);

  function mergeDrawerEntries(log: LogEntry[], notices: FeedbackEntry[]): LogEntry[] {
    if (notices.length === 0) return log;
    const mapped: LogEntry[] = notices.map((notice) => ({
      id: `notice-${notice.id}`,
      message: notice.message,
      tone: notice.severity === 'warn' ? 'danger' : notice.severity
    }));
    return [...log, ...mapped];
  }

  onMount(async () => {
    const [restored, loadResult, partyResult] = await Promise.all([
      persistence.restore(),
      loadCreatures(),
      loadPartyMembers()
    ]);
    if (restored) {
      encounter = { ...restored, combatLog: dedupeLogById(restored.combatLog) };
      commandCounter = nextCommandCounterFor(encounter.combatLog);
      combatantCounter = nextCombatantCounterFor(encounter.combatants);
    }
    if (loadResult.ok) {
      storedCreatures = loadResult.creatures;
      if (loadResult.droppedLegacy > 0) {
        const n = loadResult.droppedLegacy;
        appendFeedback(
          nextFeedbackId('legacy-drop'),
          `Dropped ${n} creature${n === 1 ? '' : 's'} from a previous version of the schema. Re-import the YAML or JSON to recover ${n === 1 ? 'it' : 'them'}.`,
          'info'
        );
      }
    } else {
      appendFeedback(
        nextFeedbackId('library-load-fail'),
        loadResult.reason === 'unavailable'
          ? 'Could not load your creature library: storage is unavailable. Imports this session will not survive a reload.'
          : 'Could not load your creature library from storage. Try reloading the page; if it persists, your saved data may be inaccessible (another tab on a newer version, full storage, or browser policy).'
      );
    }
    if (partyResult.ok) {
      storedPartyMembers = partyResult.partyMembers;
    } else {
      appendFeedback(
        nextFeedbackId('party-load-fail'),
        partyResult.reason === 'unavailable'
          ? 'Could not load your party members: storage is unavailable. Imports this session will not survive a reload.'
          : 'Could not load your party members from storage. Try reloading the page; if it persists, your saved data may be inaccessible.'
      );
    }
  });

  function nextCommandId() {
    return `${COMMAND_ID_PREFIX}${commandCounter++}`;
  }

  function addCombatant(combatant: CombatantState) {
    runCommand(toCommand('ADD_COMBATANT', { combatant }, nextCommandId()));
    const nextOrder = [...encounter.initiative.order, combatant.id];
    runCommand(toCommand('SET_INITIATIVE_ORDER', { order: nextOrder }, nextCommandId()));
  }

  function handleAddOneFromBestiary(creature: Creature, adjustment: TemplateAdjustmentChoice) {
    const existing = encounterCounts[creature.id] ?? 0;
    const name = existing > 0 ? `${creature.name} ${existing + 1}` : creature.name;
    const combatant = makeCreatureCombatant({
      creature,
      combatantId: `${creature.id}-${combatantCounter++}`,
      name,
      adjustment
    });
    addCombatant(combatant);
  }

  function handleRemoveOneFromBestiaryCount(creatureId: string) {
    let target: CombatantState | undefined;
    for (const id of [...encounter.initiative.order].reverse()) {
      const c = encounter.combatants[id];
      if (c && c.sourceType === 'creature' && c.sourceId === creatureId) {
        target = c;
        break;
      }
    }
    if (!target) {
      for (const c of Object.values(encounter.combatants)) {
        if (c.sourceType === 'creature' && c.sourceId === creatureId) {
          target = c;
          break;
        }
      }
    }
    if (!target) return;
    runCommand(toCommand('REMOVE_COMBATANT', { combatantId: target.id }, nextCommandId()));
  }

  async function handleImportCreatureFiles(files: File[]) {
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

      const lower = file.name.toLowerCase();
      const isJson = lower.endsWith('.json');
      const isYaml = lower.endsWith('.yaml') || lower.endsWith('.yml');
      if (!isJson && !isYaml) {
        appendFeedback(
          nextFeedbackId('import-bad-ext'),
          `"${file.name}": unsupported file type. Use .yaml, .yml, or .json.`
        );
        continue;
      }

      let creatures: Creature[];
      let issues: ReturnType<typeof importCreatureYaml>['issues'];
      let skipped: ReturnType<typeof importCreatureYaml>['skipped'];
      try {
        ({ creatures, issues, skipped } = isJson
          ? importCreatureFoundryJson(text)
          : importCreatureYaml(text));
      } catch (err) {
        appendFeedback(
          nextFeedbackId('import-fail'),
          `Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      const persistResult = await addCreatures(creatures);

      if (!persistResult.ok) {
        appendFeedback(
          nextFeedbackId('import-persist-fail'),
          persistResult.reason === 'unavailable'
            ? `Could not save creatures from "${file.name}": storage is unavailable (common causes: private-browsing mode or browser policy).`
            : `Could not save creatures from "${file.name}": storage write failed. Common causes: full storage, or another tab using a newer version.`
        );
        continue;
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
    const result = await removeCreature(id);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('remove-fail'),
        result.reason === 'unavailable'
          ? 'Could not remove creature: storage is unavailable.'
          : 'Could not remove creature: storage write failed.'
      );
      return;
    }
    storedCreatures = storedCreatures.filter((c) => c.id !== id);
  }

  async function handleImportPartyMemberYamlFiles(files: File[]) {
    for (const file of files) {
      let text: string;
      try {
        text = await file.text();
      } catch (err) {
        appendFeedback(
          nextFeedbackId('pm-import-read-fail'),
          `Could not read "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      let partyMembers: PartyMember[];
      let issues: ReturnType<typeof importPartyMemberYaml>['issues'];
      let skipped: ReturnType<typeof importPartyMemberYaml>['skipped'];
      try {
        ({ partyMembers, issues, skipped } = importPartyMemberYaml(text));
      } catch (err) {
        appendFeedback(
          nextFeedbackId('pm-import-fail'),
          `Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      const persistResult = await addPartyMembers(partyMembers);

      if (!persistResult.ok) {
        appendFeedback(
          nextFeedbackId('pm-import-persist-fail'),
          persistResult.reason === 'unavailable'
            ? `Could not save party members from "${file.name}": storage is unavailable.`
            : `Could not save party members from "${file.name}": storage write failed.`
        );
        continue;
      }

      for (const member of persistResult.rejected) {
        appendFeedback(
          nextFeedbackId('pm-import-dup'),
          `Skipped "${member.name}" from "${file.name}": id "${member.id}" is already in your party library.`
        );
      }

      if (persistResult.added.length > 0) {
        storedPartyMembers = [...storedPartyMembers, ...persistResult.added];
        appendFeedback(
          nextFeedbackId('pm-import-ok'),
          `Imported ${persistResult.added.length} party member${persistResult.added.length === 1 ? '' : 's'} from "${file.name}".`,
          'success'
        );
      }

      for (const skip of skipped) {
        appendFeedback(
          nextFeedbackId('pm-import-skip'),
          `"${file.name}" doc ${skip.documentIndex + 1}: skipped — kind "${skip.kind}" is not handled by the party-member importer.`,
          'info'
        );
      }

      for (const issue of issues) {
        const where = issue.path ? ` at "${issue.path}"` : '';
        const lineHint = issue.line !== undefined ? ` (line ${issue.line})` : '';
        appendFeedback(
          nextFeedbackId('pm-import-issue'),
          `"${file.name}" doc ${issue.documentIndex + 1}${where}${lineHint}: ${issue.message}`
        );
      }

      if (
        persistResult.added.length === 0 &&
        persistResult.rejected.length === 0 &&
        issues.length === 0 &&
        skipped.length === 0 &&
        partyMembers.length === 0
      ) {
        appendFeedback(
          nextFeedbackId('pm-import-empty'),
          `"${file.name}" contained no party-member documents.`
        );
      }
    }
  }

  function handleAddPartyMemberToEncounter(partyMember: PartyMember) {
    const combatant = makePartyMemberCombatant({
      partyMember,
      combatantId: `${partyMember.id}-${combatantCounter++}`
    });
    addCombatant(combatant);
  }

  async function handleRemovePartyMember(id: string) {
    const result = await removePartyMember(id);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('pm-remove-fail'),
        result.reason === 'unavailable'
          ? 'Could not remove party member: storage is unavailable.'
          : 'Could not remove party member: storage write failed.'
      );
      return;
    }
    storedPartyMembers = storedPartyMembers.filter((m) => m.id !== id);
  }

  async function handleSavePartyMember(member: PartyMember) {
    const result = await savePartyMember(member);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('pm-save-fail'),
        result.reason === 'unavailable'
          ? 'Could not save party member: storage is unavailable.'
          : 'Could not save party member: storage write failed.'
      );
      return;
    }
    const exists = storedPartyMembers.some((m) => m.id === member.id);
    storedPartyMembers = exists
      ? storedPartyMembers.map((m) => (m.id === member.id ? member : m))
      : [...storedPartyMembers, member];
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

  function setInitiativeScore(combatantId: string, value: number | null) {
    runCommand(
      toCommand('SET_INITIATIVE_SCORES', { scores: { [combatantId]: value } }, nextCommandId())
    );
  }

  function rollAllInitiative() {
    const patch: Record<string, number> = {};
    for (const id of encounter.initiative.order) {
      if (encounter.initiative.scores[id] !== undefined) continue;
      const c = encounter.combatants[id];
      if (!c) continue;
      const die = Math.floor(Math.random() * 20) + 1;
      patch[id] = die + computeCombatantStats(c).perception.final;
    }
    if (Object.keys(patch).length === 0) return;
    runCommand(toCommand('SET_INITIATIVE_SCORES', { scores: patch }, nextCommandId()));
  }

  function applyHpEdit(combatantId: string, field: HpEditField, parsed: CommittableEdit) {
    const combatant = encounter.combatants[combatantId];
    if (!combatant) return;
    const intent = resolveHpEdit(field, parsed, {
      hp: combatant.currentHp,
      maxHp: getAdjustedView(combatant).hp,
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
          duration: { type: 'unlimited' },
          note: choice.note
        },
        nextCommandId()
      )
    );
  }

  function setConditionDuration(
    combatantId: string,
    instanceId: string,
    newDuration: Duration
  ) {
    runCommand(
      toCommand(
        'SET_EFFECT_DURATION',
        { targetId: combatantId, instanceId, newDuration },
        nextCommandId()
      )
    );
  }

  function removeCondition(combatantId: string, instanceId: string) {
    runCommand(toCommand('REMOVE_EFFECT', { targetId: combatantId, instanceId }, nextCommandId()));
  }

  function openRadial(id: string, anchor: { x: number; y: number }) {
    radialCombatantId = id;
    radialAnchor = anchor;
    radialOpen = true;
  }

  function closeRadial() {
    radialOpen = false;
    radialCombatantId = null;
  }

  function openEffectModal(combatantId: string, tab: EffectModalTab) {
    effectModal = { combatantId, tab };
  }

  function closeEffectModal() {
    effectModal = null;
  }

  function radialOpenModal(tab: EffectModalTab) {
    const id = radialCombatantId;
    closeRadial();
    if (id) openEffectModal(id, tab);
  }

  function modalApply(choice: ApplyConditionChoice) {
    if (!effectModal) return;
    applyCondition(effectModal.combatantId, choice);
  }

  function modalRemove(instanceId: string) {
    if (!effectModal) return;
    removeCondition(effectModal.combatantId, instanceId);
  }

  function modalModifyValue(instanceId: string, delta: number) {
    if (!effectModal) return;
    modifyConditionValue(effectModal.combatantId, instanceId, delta);
  }

  function modalSetDuration(instanceId: string, newDuration: Duration) {
    if (!effectModal) return;
    setConditionDuration(effectModal.combatantId, instanceId, newDuration);
  }

  function radialApply(choice: ApplyConditionChoice) {
    if (!radialCombatantId) return;
    applyCondition(radialCombatantId, choice);
    closeRadial();
  }

  function radialRemoveCombatant() {
    const id = radialCombatantId;
    if (!id) return;
    const name = encounter.combatants[id]?.name ?? 'combatant';
    runCommand(toCommand('REMOVE_COMBATANT', { combatantId: id }, nextCommandId()));
    appendFeedback(nextFeedbackId('radial-remove'), `Removed ${name} from the encounter.`, 'success');
    closeRadial();
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

  let rollCounter = 1;
  function nextRollId() {
    return `local-roll-${rollCounter++}`;
  }

  type BubbleTone = 'normal' | 'crit' | 'fumble' | 'damage';
  interface RollBubbleEntry {
    id: string;
    x: number;
    y: number;
    total: string;
    detail: string;
    tone: BubbleTone;
    badge: string;
  }
  let bubbles: RollBubbleEntry[] = [];
  const BUBBLE_LIFETIME_MS = 1800;

  function showBubble(entry: Omit<RollBubbleEntry, 'id'>) {
    const id = nextRollId();
    bubbles = [...bubbles, { ...entry, id }];
    setTimeout(() => {
      bubbles = bubbles.filter((b) => b.id !== id);
    }, BUBBLE_LIFETIME_MS);
  }

  function rollAttackFor(combatantId: string, attack: Attack, variant: MapVariant, origin: { x: number; y: number }) {
    const c = encounter.combatants[combatantId];
    if (!c) return;
    const result = rollAttackDice(variant.modifier);
    const isCrit = result.d20 === 20;
    const isFumble = result.d20 === 1;
    const logTone = isCrit ? 'success' : isFumble ? 'danger' : 'info';
    const bubbleTone: BubbleTone = isCrit ? 'crit' : isFumble ? 'fumble' : 'normal';
    const badge = isCrit ? 'NAT 20' : isFumble ? 'NAT 1' : `${attack.name} · ${variant.label}`;

    const stats = computeCombatantStats(c);
    const breakdown = formatModifierBreakdown(stats.attackRolls.modifiers);
    const breakdownSuffix = breakdown ? ` (${breakdown})` : '';

    encounter = appendInfoLog(
      encounter,
      nextRollId(),
      `${c.name} ${attack.name} ${variant.label}: 1d20(${result.d20}) ${formatModifier(variant.modifier)} = ${result.total}${breakdownSuffix}`,
      logTone
    );
    persistence.persist(encounter);

    showBubble({
      x: origin.x,
      y: origin.y,
      total: String(result.total),
      detail: `1d20(${result.d20}) ${formatModifier(variant.modifier)}`,
      tone: bubbleTone,
      badge
    });
  }

  type SaveKey = 'fortitude' | 'reflex' | 'will';
  const SAVE_LABELS: Record<SaveKey, string> = {
    fortitude: 'Fort',
    reflex: 'Reflex',
    will: 'Will'
  };

  function rollSaveFor(combatantId: string, save: SaveKey, origin: { x: number; y: number }) {
    const c = encounter.combatants[combatantId];
    if (!c) return;
    const stats = computeCombatantStats(c);
    const stat = stats[save];
    const mod = stat.final;
    const result = rollAttackDice(mod);
    const isCrit = result.d20 === 20;
    const isFumble = result.d20 === 1;
    const logTone = isCrit ? 'success' : isFumble ? 'danger' : 'info';
    const bubbleTone: BubbleTone = isCrit ? 'crit' : isFumble ? 'fumble' : 'normal';
    const label = SAVE_LABELS[save];
    const badge = isCrit ? 'NAT 20' : isFumble ? 'NAT 1' : `${label} save`;

    const breakdown = formatModifierBreakdown(stat.modifiers);
    const breakdownSuffix = breakdown ? ` (base ${formatModifier(stat.base)}, ${breakdown})` : '';

    encounter = appendInfoLog(
      encounter,
      nextRollId(),
      `${c.name} ${label} save: 1d20(${result.d20}) ${formatModifier(mod)} = ${result.total}${breakdownSuffix}`,
      logTone
    );
    persistence.persist(encounter);

    showBubble({
      x: origin.x,
      y: origin.y,
      total: String(result.total),
      detail: `1d20(${result.d20}) ${formatModifier(mod)}`,
      tone: bubbleTone,
      badge
    });
  }

  function rollDamageFor(combatantId: string, attack: Attack, origin: { x: number; y: number }) {
    const c = encounter.combatants[combatantId];
    if (!c || attack.damage.length === 0) return;
    const stats = computeCombatantStats(c);
    const flatBonus = stats.damageRolls.total;
    const result = rollDamageDice(attack.damage, { flatBonus, flatBonusLabel: 'status' });
    const breakdown = formatModifierBreakdown(stats.damageRolls.modifiers);
    const breakdownSuffix = breakdown ? ` (${breakdown})` : '';
    encounter = appendInfoLog(
      encounter,
      nextRollId(),
      `${c.name} ${attack.name} damage: ${result.breakdown} = ${result.total}${breakdownSuffix}`,
      'danger'
    );
    persistence.persist(encounter);

    showBubble({
      x: origin.x,
      y: origin.y,
      total: `${result.total} dmg`,
      detail: result.breakdown,
      tone: 'damage',
      badge: `${attack.name}`
    });
  }

  function useSpellSlot(combatantId: string, blockId: string, rank: number) {
    runCommand(toCommand('USE_SPELL_SLOT', { combatantId, blockId, rank }, nextCommandId()));
  }
  function restoreSpellSlot(combatantId: string, blockId: string, rank: number) {
    runCommand(toCommand('RESTORE_SPELL_SLOT', { combatantId, blockId, rank }, nextCommandId()));
  }
  function useFocusPoint(combatantId: string, blockId: string) {
    runCommand(toCommand('USE_FOCUS_POINT', { combatantId, blockId }, nextCommandId()));
  }
  function restoreFocusPoint(combatantId: string, blockId: string) {
    runCommand(toCommand('RESTORE_FOCUS_POINT', { combatantId, blockId }, nextCommandId()));
  }
  function useInnateSpell(combatantId: string, blockId: string, spellSlug: string) {
    runCommand(toCommand('USE_INNATE_SPELL', { combatantId, blockId, spellSlug }, nextCommandId()));
  }
  function restoreInnateSpell(combatantId: string, blockId: string, spellSlug: string) {
    runCommand(toCommand('RESTORE_INNATE_SPELL', { combatantId, blockId, spellSlug }, nextCommandId()));
  }

  function resolvePrompt(promptId: string, resolution: PromptResolution) {
    runCommand(toCommand('RESOLVE_PROMPT', { promptId, resolution }, nextCommandId()));
  }

  function applyPersistentDamageFromPrompt(combatantId: string, amount: number, damageType: string) {
    runCommand(toCommand('APPLY_DAMAGE', { combatantId, amount, damageType }, nextCommandId()));
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

  <EncounterDifficultyMeter summary={xpSummary} />

  <section class="workspace">
    <div class="workspace__library">
      <LibraryPane
        {canStart}
        creatures={availableCreatures}
        partyMembers={storedPartyMembers}
        {conditionOptions}
        {encounterCounts}
        onAddOneFromBestiary={handleAddOneFromBestiary}
        onRemoveOneFromBestiaryCount={handleRemoveOneFromBestiaryCount}
        onAddManual={handleAddManual}
        onImportCreatureFiles={handleImportCreatureFiles}
        onRemoveCreature={handleRemoveCreature}
        onAddPartyMemberToEncounter={handleAddPartyMemberToEncounter}
        onRemovePartyMember={handleRemovePartyMember}
        onSavePartyMember={handleSavePartyMember}
        onImportPartyMemberYamlFiles={handleImportPartyMemberYamlFiles}
        onStart={startEncounter}
        onReset={resetLocal}
      />
    </div>

    <section class="workspace__track" aria-label="Combatants">
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
      {#if encounter.phase === 'PREPARING' && orderedCombatants.length > 0}
        <div class="initiative-bar" aria-label="Initiative actions">
          <button type="button" class="initiative-bar__roll" onclick={rollAllInitiative}>
            Roll all initiative
          </button>
          <span class="initiative-bar__hint">Rolls only blanks. Click a combatant's Roll button to re-roll one.</span>
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
            onRequestRadial={openRadial}
            initiativeScore={encounter.initiative.scores[combatant.id]}
            onSetInitiative={setInitiativeScore}
            isFirst={index === 0}
            isLast={index === orderedCombatants.length - 1}
            pendingPrompts={encounter.pendingPrompts}
            combatantsById={encounter.combatants}
            onResolvePrompt={resolvePrompt}
            onApplyPersistentDamage={applyPersistentDamageFromPrompt}
            onRollSave={rollSaveFor}
          />
        {/each}
      </div>
    </section>

    <aside class="workspace__details">
      <CombatantDetailsPanel
        combatant={selectedCombatant}
        onSetNote={setNote}
        onRollAttack={rollAttackFor}
        onRollDamage={rollDamageFor}
        onRollSave={rollSaveFor}
        onUseSpellSlot={useSpellSlot}
        onRestoreSpellSlot={restoreSpellSlot}
        onUseFocusPoint={useFocusPoint}
        onRestoreFocusPoint={restoreFocusPoint}
        onUseInnateSpell={useInnateSpell}
        onRestoreInnateSpell={restoreInnateSpell}
        onSetAdjustment={(combatantId, adjustment) =>
          runCommand(
            toCommand('SET_TEMPLATE_ADJUSTMENT', { combatantId, adjustment }, nextCommandId())
          )}
      />
    </aside>

    <section class="workspace__log">
      <CombatLogDrawer entries={drawerEntries} />
    </section>
  </section>
</main>

{#if radialOpen && radialCombatant}
  <RadialConditionMenu
    combatantId={radialCombatant.id}
    combatantName={radialCombatant.name}
    combatantHpLabel={`${radialCombatant.currentHp}/${getAdjustedView(radialCombatant).hp} HP`}
    anchor={radialAnchor}
    recentOptions={radialRecentOptions}
    appliedCount={radialRemovable.length}
    {wedgeCounts}
    onApply={radialApply}
    onOpenModal={radialOpenModal}
    onRemove={radialRemoveCombatant}
    onClose={closeRadial}
  />
{/if}

{#each bubbles as bubble (bubble.id)}
  <RollBubble
    x={bubble.x}
    y={bubble.y}
    total={bubble.total}
    detail={bubble.detail}
    tone={bubble.tone}
    badge={bubble.badge}
  />
{/each}

{#if effectModal && effectModalCombatant}
  <EffectModal
    combatantName={effectModalCombatant.name}
    combatantHpLabel={`${effectModalCombatant.currentHp}/${getAdjustedView(effectModalCombatant).hp} HP`}
    initialTab={effectModal.tab}
    appliedEffects={effectModalApplied}
    {conditionGroups}
    {persistentOptions}
    {afflictionOptions}
    effectOptions={spellOptions}
    otherCombatants={otherCombatantsForDuration}
    onApply={modalApply}
    onModifyValue={modalModifyValue}
    onSetDuration={modalSetDuration}
    onRemove={modalRemove}
    onClose={closeEffectModal}
  />
{/if}

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
    position: sticky;
    top: 12px;
    align-self: start;
    max-height: calc(100vh - 24px);
    overflow-y: auto;
  }

  .workspace__log {
    grid-area: log;
  }

  .cards {
    display: grid;
    gap: 10px;
  }

  .initiative-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--color-panel, #fbfcfa);
    border: 1px solid var(--color-rule, #cfd6d1);
    border-radius: 8px;
  }

  .initiative-bar__roll {
    background: var(--color-ink, #263235);
    color: var(--color-bg, #fff);
    border: 0;
    border-radius: 4px;
    padding: 6px 14px;
    font: inherit;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }

  .initiative-bar__roll:focus-visible {
    outline: 2px solid var(--color-blue, var(--color-amber, #b88a2c));
    outline-offset: 2px;
  }

  .initiative-bar__hint {
    color: var(--color-ink-mute, #627171);
    font-size: 12px;
  }

  .not-yet-rolled {
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    background: var(--color-panel);
    padding: 12px 14px;
  }

  .not-yet-rolled h3 {
    margin: 0 0 6px;
    color: var(--color-ink-soft);
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
    color: var(--color-ink);
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

    .workspace__details {
      position: static;
      max-height: none;
      overflow: visible;
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
