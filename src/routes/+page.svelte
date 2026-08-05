<script lang="ts">
  import { onMount } from 'svelte';
  import type { Command, CombatantState, Companion, Creature, Duration, EffectDefinition, EncounterState, Hazard, LogEntry, Party, PartyMember, PromptResolution } from '../domain';
  import { computeEncounterXP, getAdjustedView } from '../domain';
  import EncounterDifficultyMeter from '../components/EncounterDifficultyMeter.svelte';
  import EncounterHeader from '../components/EncounterHeader.svelte';
  import TopBar from '../components/TopBar.svelte';
  import CombatLogDrawer from '../components/CombatLogDrawer.svelte';
  import CombatantCard from '../components/CombatantCard.svelte';
  import CombatantDetailsPanel from '../components/CombatantDetailsPanel.svelte';
  import LibraryPane from '../components/LibraryPane.svelte';
  import RadialConditionMenu from '../components/RadialConditionMenu.svelte';
  import EffectModal from '../components/EffectModal.svelte';
  import CastEffectModal from '../components/CastEffectModal.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import RollBubble from '../components/RollBubble.svelte';
  import {
    appendInfoLog,
    buildSpellEffectIndex,
    combatantCardActions,
    combatantFaction,
    computeCombatantStats,
    currentCombatant,
    defaultApplyDuration,
    dispatchEncounterCommand,
    formatModifierBreakdown,
    groupConditionsByCategory,
    listAfflictionOptions,
    listConditionOptions,
    activeEffectLibrary,
    listConditionWedgeCounts,
    listPersistentDamageOptions,
    listRecentConditionOptions,
    listRemovableEffects,
    listSpellEffectOptionsFrom,
    makeCombatant,
    makeCreatureCombatant,
    makeHazardCombatant,
    makeCompanionCombatant,
    makePartyMemberCombatant,
    newEncounterState,
    registerLibraryEffects,
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
    addHazards,
    loadHazards,
    removeHazard
  } from '$lib/storage/hazard-library';
  import {
    addSpellEffects,
    loadSpellEffects,
    removeSpellEffect
  } from '$lib/storage/spell-effect-library';
  import {
    addPartyMembers,
    loadPartyMembers,
    removePartyMember,
    savePartyMember
  } from '$lib/storage/party-members';
  import { addCompanions, loadCompanions, removeCompanion, saveCompanion } from '$lib/storage/companions';
  import { addParties, loadParties, removeParty, saveParty } from '$lib/storage/parties';
  import { createPersistenceController } from '$lib/storage/persistence-controller';
  import { syncCompanionsAfterEncounter, syncPartyMembersAfterEncounter } from '$lib/party-sync';
  import { loadGameClock, saveGameClock } from '$lib/storage/game-clock';
  import { clampClock } from '$lib/game-clock';
  import {
    encounterExportFilename,
    exportEncounterYaml,
    importCompanionYaml,
    importCreatureYaml,
    importPartyYaml,
    importEncounterYaml,
    importHazardYaml,
    importPartyMemberYaml
  } from '$lib/yaml';
  import {
    importCreatureFoundryJson,
    importHazardFoundryJson,
    importSpellEffectFoundryJson,
    type SpellEffectImportResult
  } from '$lib/foundry';
  import { sampleSpellEffects } from '$lib/foundry/sample-spell-effects';
  import {
    COMMAND_ID_PREFIX,
    computeEncounterCounts,
    dedupeLogById,
    nextCombatantCounterFor,
    nextCommandCounterFor
  } from '$lib/page-helpers';
  import { createEncounterHistory } from '$lib/history/encounter-history';

  const conditionOptions = listConditionOptions();
  const conditionGroups = groupConditionsByCategory();
  const persistentOptions = listPersistentDamageOptions();
  const afflictionOptions = listAfflictionOptions();
  const wedgeCounts = listConditionWedgeCounts();

  let radialOpen = false;
  let radialAnchor = { x: 0, y: 0 };
  let radialCombatantId: string | null = null;

  let effectModal: { combatantId: string; tab: EffectModalTab } | null = null;
  let removeConfirmation: { combatantId: string; name: string } | null = null;
  let libraryOpen = true;
  let logOpen = true;
  let encounterImportInput: HTMLInputElement | null = null;
  let pendingEncounterImport: { state: EncounterState; fileName: string } | null = null;
  let hydrated = false;

  let encounter = newEncounterState();
  let feedback: FeedbackEntry[] = [];
  let commandCounter = 1;
  let combatantCounter = 1;
  let feedbackCounter = 1;
  let selection: Selection = emptySelection;
  const encounterHistory = createEncounterHistory();
  let historyVersion = 0;
  let storedCreatures: Creature[] = [];
  let storedHazards: Hazard[] = [];
  let storedPartyMembers: PartyMember[] = [];
  let storedCompanions: Companion[] = [];
  let storedParties: Party[] = [];
  let clockMinutes = 0;

  function setClock(minutes: number) {
    clockMinutes = clampClock(minutes);
    void saveGameClock(clockMinutes);
  }

  let storedSpellEffects: EffectDefinition[] = [];
  let castModal: { casterId: string; effects: EffectDefinition[] } | null = null;

  $: spellOptions = listSpellEffectOptionsFrom(storedSpellEffects);
  $: spellEffectsBySlug = buildSpellEffectIndex(storedSpellEffects);
  $: castModalCaster = castModal ? encounter.combatants[castModal.casterId] : undefined;
  $: castTargets = castModal
    ? Object.values(encounter.combatants).map((c) => ({
        id: c.id,
        name: c.name,
        faction: combatantFaction(c),
        isAlive: c.isAlive
      }))
    : [];
  $: if (castModal && !castModalCaster) closeCastModal();

  $: availableCreatures = storedCreatures;

  $: encounterCounts = computeEncounterCounts(encounter.combatants);

  $: xpSummary = computeEncounterXP(encounter);

  $: orderedCombatants = encounter.initiative.order
    .map((id) => encounter.combatants[id])
    .filter((combatant): combatant is CombatantState => Boolean(combatant));
  // Minions never appear in initiative — they render nested under their
  // master's card, so exclude them from the "not yet rolled" bucket too.
  $: unorderedCombatants = Object.values(encounter.combatants).filter(
    (combatant) => !encounter.initiative.order.includes(combatant.id) && combatant.masterId === undefined
  );
  $: minionsByMaster = Object.values(encounter.combatants).reduce((map, combatant) => {
    if (combatant.masterId !== undefined) {
      const list = map.get(combatant.masterId);
      if (list) list.push(combatant);
      else map.set(combatant.masterId, [combatant]);
    }
    return map;
  }, new Map<string, CombatantState[]>());
  $: activeCombatant = currentCombatant(encounter);
  $: canStart = encounter.phase === 'PREPARING' && encounter.initiative.order.length >= 2;
  $: combatantIdSet = new Set(Object.keys(encounter.combatants));
  $: selection = reconcileWithCombatants(selection, combatantIdSet);
  $: selection = followActive(selection, activeCombatant?.id);
  $: selectedCombatant = selection.id ? encounter.combatants[selection.id] : undefined;
  $: canUndo = historyVersion >= 0 && encounterHistory.canUndo;
  $: canRedo = historyVersion >= 0 && encounterHistory.canRedo;
  $: undoLabel = historyVersion >= 0 ? encounterHistory.undoLabel : undefined;
  $: redoLabel = historyVersion >= 0 ? encounterHistory.redoLabel : undefined;

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

  async function loadEncounterState(): Promise<EncounterState | null> {
    const loaded = await loadActiveEncounter();
    if (!loaded) return null;
    if (loaded.migrations.some((migration) => migration.type === 'legacy-delayed-combatants')) {
      appendFeedback(
        nextFeedbackId('legacy-delay'),
        'A legacy encounter contained delayed combatants. They were restored at the end of initiative; reorder them manually.'
      );
    }
    return loaded.state;
  }

  const persistence = createPersistenceController({
    load: loadEncounterState,
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
      ),
    onClearFailed: () =>
      appendFeedback(
        nextFeedbackId('discard-fail'),
        'Could not discard the saved encounter. Your current encounter is still open; try again before reloading.'
      )
  });

  function runCommand(command: Command) {
    const before = encounter;
    const result = dispatchEncounterCommand(before, command);
    const rejected = result.events.some((event) => event.type === 'command-rejected');
    if (!rejected && result.state !== before) {
      encounterHistory.record(before, result.state, command);
      historyVersion += 1;
    }
    encounter = result.state;
    if (before.phase !== 'ACTIVE' && result.state.phase === 'ACTIVE') {
      libraryOpen = false;
      logOpen = false;
    }
    persistence.persist(result.state);
  }

  function undoEncounter() {
    const step = encounterHistory.undo(encounter);
    if (!step) return;
    encounter = step.state;
    historyVersion += 1;
    persistence.persist(encounter);
  }

  function redoEncounter() {
    const step = encounterHistory.redo(encounter);
    if (!step) return;
    encounter = step.state;
    historyVersion += 1;
    persistence.persist(encounter);
  }

  function isEditingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.matches('input, textarea, select') ||
      target.isContentEditable ||
      Boolean(target.closest('[contenteditable="true"]'))
    );
  }

  function handleHistoryShortcut(event: KeyboardEvent) {
    if (isEditingTarget(event.target) || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) redoEncounter();
    else undoEncounter();
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
    hydrated = true;
    const [restored, loadResult, hazardResult, partyResult, companionResult, partiesResult, spellEffectResult, clock] = await Promise.all([
      persistence.restore(),
      loadCreatures(),
      loadHazards(),
      loadPartyMembers(),
      loadCompanions(),
      loadParties(),
      loadSpellEffects(),
      loadGameClock()
    ]);
    if (clock !== null) {
      clockMinutes = clampClock(clock);
    }
    if (restored) {
      encounter = { ...restored, combatLog: dedupeLogById(restored.combatLog) };
      commandCounter = nextCommandCounterFor(encounter.combatLog);
      combatantCounter = nextCombatantCounterFor(encounter.combatants);
      if (encounter.phase === 'ACTIVE' || encounter.phase === 'RESOLVING') {
        libraryOpen = false;
      }
    }
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches
    ) {
      logOpen = false;
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
    if (hazardResult.ok) {
      storedHazards = hazardResult.hazards;
    } else {
      appendFeedback(
        nextFeedbackId('hazard-load-fail'),
        hazardResult.reason === 'unavailable'
          ? 'Could not load your hazard library: storage is unavailable. Imports this session will not survive a reload.'
          : 'Could not load your hazard library from storage. Try reloading the page; if it persists, your saved data may be inaccessible.'
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
    if (partiesResult.ok) {
      storedParties = partiesResult.parties;
    } else {
      appendFeedback(
        nextFeedbackId('parties-load-fail'),
        partiesResult.reason === 'unavailable'
          ? 'Could not load your parties: storage is unavailable. Imports this session will not survive a reload.'
          : 'Could not load your parties from storage. Try reloading the page; if it persists, your saved data may be inaccessible.'
      );
    }
    if (companionResult.ok) {
      storedCompanions = companionResult.companions;
    } else {
      appendFeedback(
        nextFeedbackId('companion-load-fail'),
        companionResult.reason === 'unavailable'
          ? 'Could not load your companions: storage is unavailable. Imports this session will not survive a reload.'
          : 'Could not load your companions from storage. Try reloading the page; if it persists, your saved data may be inaccessible.'
      );
    }
    if (spellEffectResult.ok) {
      storedSpellEffects = spellEffectResult.effects;
      registerLibraryEffects(spellEffectResult.effects);
    } else {
      appendFeedback(
        nextFeedbackId('spell-effect-load-fail'),
        spellEffectResult.reason === 'unavailable'
          ? 'Could not load your spell effects: storage is unavailable. Imports this session will not survive a reload.'
          : 'Could not load your spell effects from storage. Try reloading the page; if it persists, your saved data may be inaccessible.'
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

  /** Minions stay out of initiative (the reducer rejects them there). */
  function addMinionCombatant(combatant: CombatantState) {
    runCommand(toCommand('ADD_COMBATANT', { combatant }, nextCommandId()));
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

  /**
   * Persists imported creatures and surfaces per-file feedback. Skip notices
   * are emitted for document kinds this build doesn't import, except `hazard`
   * — a hazard document in the same file is handled by the hazard importer, so
   * reporting it as "skipped" would be misleading. Returns true if the file
   * produced any creature-related outcome.
   */
  async function persistImportedCreatures(
    file: File,
    result: ReturnType<typeof importCreatureYaml>
  ): Promise<boolean> {
    const { creatures, issues, skipped } = result;
    const persistResult = await addCreatures(creatures);
    if (!persistResult.ok) {
      appendFeedback(
        nextFeedbackId('import-persist-fail'),
        persistResult.reason === 'unavailable'
          ? `Could not save creatures from "${file.name}": storage is unavailable (common causes: private-browsing mode or browser policy).`
          : `Could not save creatures from "${file.name}": storage write failed. Common causes: full storage, or another tab using a newer version.`
      );
      return true;
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

    const reportableSkips = skipped.filter((skip) => skip.kind !== 'hazard');
    for (const skip of reportableSkips) {
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

    return (
      persistResult.added.length > 0 ||
      persistResult.rejected.length > 0 ||
      issues.length > 0 ||
      reportableSkips.length > 0
    );
  }

  /**
   * Persists imported hazards and surfaces per-file feedback. Skipped non-hazard
   * documents are left to persistImportedCreatures so a mixed YAML file reports
   * each skipped kind exactly once. Returns true if the file produced any
   * hazard-related outcome.
   */
  async function persistImportedHazards(
    file: File,
    result: ReturnType<typeof importHazardYaml>
  ): Promise<boolean> {
    const { hazards, issues } = result;
    const persistResult = await addHazards(hazards);
    if (!persistResult.ok) {
      appendFeedback(
        nextFeedbackId('hz-import-persist-fail'),
        persistResult.reason === 'unavailable'
          ? `Could not save hazards from "${file.name}": storage is unavailable (common causes: private-browsing mode or browser policy).`
          : `Could not save hazards from "${file.name}": storage write failed. Common causes: full storage, or another tab using a newer version.`
      );
      return true;
    }

    for (const hazard of persistResult.rejected) {
      appendFeedback(
        nextFeedbackId('hz-import-dup'),
        `Skipped "${hazard.name}" from "${file.name}": id "${hazard.id}" is already in your library.`
      );
    }

    if (persistResult.added.length > 0) {
      storedHazards = [...storedHazards, ...persistResult.added];
      appendFeedback(
        nextFeedbackId('hz-import-ok'),
        `Imported ${persistResult.added.length} hazard${persistResult.added.length === 1 ? '' : 's'} from "${file.name}".`,
        'success'
      );
    }

    for (const issue of issues) {
      const where = issue.path ? ` at "${issue.path}"` : '';
      const lineHint = issue.line !== undefined ? ` (line ${issue.line})` : '';
      appendFeedback(
        nextFeedbackId('hz-import-issue'),
        `"${file.name}" doc ${issue.documentIndex + 1}${where}${lineHint}: ${issue.message}`
      );
    }

    return (
      persistResult.added.length > 0 || persistResult.rejected.length > 0 || issues.length > 0
    );
  }

  /**
   * Imports creature and hazard library files. A Foundry actor JSON is routed
   * by its `type` field, so it lands in the right library regardless of which
   * "Import…" button was used. A YAML file may carry both creature and hazard
   * documents; both kinds are imported from a single file.
   */
  async function handleImportLibraryFiles(files: File[]) {
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

      if (isJson) {
        // Route a Foundry JSON by its declared `type`. Arrays only occur for
        // effect-pack exports, so they route to the spell-effect importer. A
        // parse failure falls through to the creature importer, which reports
        // it as an issue.
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(text);
        } catch {
          parsedJson = undefined;
        }
        const actorType = (parsedJson as { type?: unknown } | undefined)?.type;
        const isEffectJson = Array.isArray(parsedJson) || actorType === 'effect';
        const did = isEffectJson
          ? await persistImportedSpellEffects(file, importSpellEffectFoundryJson(text))
          : actorType === 'hazard'
            ? await persistImportedHazards(file, importHazardFoundryJson(text))
            : await persistImportedCreatures(file, importCreatureFoundryJson(text));
        if (!did) {
          appendFeedback(
            nextFeedbackId('import-empty'),
            `"${file.name}" contained no importable creature, hazard, or spell effect.`
          );
        }
        continue;
      }

      // A single YAML file may declare creature and/or hazard documents.
      let didCreatures: boolean;
      let didHazards: boolean;
      try {
        didCreatures = await persistImportedCreatures(file, importCreatureYaml(text));
        didHazards = await persistImportedHazards(file, importHazardYaml(text));
      } catch (err) {
        appendFeedback(
          nextFeedbackId('import-fail'),
          `Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }
      if (!didCreatures && !didHazards) {
        appendFeedback(
          nextFeedbackId('import-empty'),
          `"${file.name}" contained no creature or hazard documents.`
        );
      }
    }
  }

  /**
   * Persists imported spell effects and surfaces per-file feedback. Newly
   * added effects register into the session effect library immediately so
   * they can be applied without a reload.
   */
  async function persistImportedSpellEffects(
    file: File,
    result: SpellEffectImportResult
  ): Promise<boolean> {
    const { effects, issues } = result;
    const persistResult = await addSpellEffects(effects);
    if (!persistResult.ok) {
      appendFeedback(
        nextFeedbackId('se-import-persist-fail'),
        persistResult.reason === 'unavailable'
          ? `Could not save spell effects from "${file.name}": storage is unavailable (common causes: private-browsing mode or browser policy).`
          : `Could not save spell effects from "${file.name}": storage write failed. Common causes: full storage, or another tab using a newer version.`
      );
      return true;
    }

    for (const effect of persistResult.rejected) {
      appendFeedback(
        nextFeedbackId('se-import-dup'),
        `Skipped "${effect.name}" from "${file.name}": id "${effect.id}" is already in your spell-effect library.`
      );
    }

    if (persistResult.added.length > 0) {
      storedSpellEffects = [...storedSpellEffects, ...persistResult.added];
      registerLibraryEffects(persistResult.added);
      appendFeedback(
        nextFeedbackId('se-import-ok'),
        `Imported ${persistResult.added.length} spell effect${persistResult.added.length === 1 ? '' : 's'} from "${file.name}".`,
        'success'
      );
    }

    for (const issue of issues) {
      const where = issue.path ? ` at "${issue.path}"` : '';
      appendFeedback(
        nextFeedbackId('se-import-issue'),
        `"${file.name}" doc ${issue.documentIndex + 1}${where}: ${issue.message}`
      );
    }

    return persistResult.added.length > 0 || persistResult.rejected.length > 0 || issues.length > 0;
  }

  async function handleLoadSampleSpellEffects() {
    const persistResult = await addSpellEffects(sampleSpellEffects());
    if (!persistResult.ok) {
      appendFeedback(
        nextFeedbackId('se-sample-fail'),
        persistResult.reason === 'unavailable'
          ? 'Could not save starter spell effects: storage is unavailable.'
          : 'Could not save starter spell effects: storage write failed.'
      );
      return;
    }
    if (persistResult.added.length > 0) {
      storedSpellEffects = [...storedSpellEffects, ...persistResult.added];
      registerLibraryEffects(persistResult.added);
      appendFeedback(
        nextFeedbackId('se-sample-ok'),
        `Added ${persistResult.added.length} starter spell effect${persistResult.added.length === 1 ? '' : 's'}.`,
        'success'
      );
    } else {
      appendFeedback(
        nextFeedbackId('se-sample-dup'),
        'All starter spell effects are already in your library.',
        'info'
      );
    }
  }

  async function handleRemoveSpellEffect(id: string) {
    const inUseBy = Object.values(encounter.combatants).filter((c) =>
      c.appliedEffects.some((effect) => effect.effectId === id)
    );
    if (inUseBy.length > 0) {
      appendFeedback(
        nextFeedbackId('se-remove-in-use'),
        `Cannot remove this spell effect: it is applied to ${inUseBy.map((c) => c.name).join(', ')}. Remove it from those combatants first.`
      );
      return;
    }
    const result = await removeSpellEffect(id);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('se-remove-fail'),
        result.reason === 'unavailable'
          ? 'Could not remove spell effect: storage is unavailable.'
          : 'Could not remove spell effect: storage write failed.'
      );
      return;
    }
    storedSpellEffects = storedSpellEffects.filter((e) => e.id !== id);
  }

  function openCastEffectModal(casterId: string, effects: EffectDefinition[]) {
    if (effects.length === 0) return;
    castModal = { casterId, effects };
  }

  function closeCastModal() {
    castModal = null;
  }

  function castEffectToTargets(effectId: string, targetIds: string[], duration: Duration) {
    if (!castModal) return;
    const casterId = castModal.casterId;
    for (const targetId of targetIds) {
      runCommand(
        toCommand(
          'APPLY_EFFECT',
          { effectId, targetId, sourceId: casterId, duration },
          nextCommandId()
        )
      );
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

  function handleAddOneFromHazards(hazard: Hazard) {
    const existing = encounterCounts[hazard.id] ?? 0;
    const name = existing > 0 ? `${hazard.name} ${existing + 1}` : hazard.name;
    const combatant = makeHazardCombatant({
      hazard,
      combatantId: `${hazard.id}-${combatantCounter++}`,
      name
    });
    addCombatant(combatant);
  }

  function handleRemoveOneFromHazardsCount(hazardId: string) {
    let target: CombatantState | undefined;
    for (const id of [...encounter.initiative.order].reverse()) {
      const c = encounter.combatants[id];
      if (c && c.sourceType === 'hazard' && c.sourceId === hazardId) {
        target = c;
        break;
      }
    }
    if (!target) {
      for (const c of Object.values(encounter.combatants)) {
        if (c.sourceType === 'hazard' && c.sourceId === hazardId) {
          target = c;
          break;
        }
      }
    }
    if (!target) return;
    runCommand(toCommand('REMOVE_COMBATANT', { combatantId: target.id }, nextCommandId()));
  }

  async function handleRemoveHazard(id: string) {
    const result = await removeHazard(id);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('hz-remove-fail'),
        result.reason === 'unavailable'
          ? 'Could not remove hazard: storage is unavailable.'
          : 'Could not remove hazard: storage write failed.'
      );
      return;
    }
    storedHazards = storedHazards.filter((h) => h.id !== id);
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
      let companions: Companion[];
      let companionIssues: ReturnType<typeof importCompanionYaml>['issues'];
      let parties: Party[];
      let partyIssues: ReturnType<typeof importPartyYaml>['issues'];
      try {
        ({ partyMembers, issues, skipped } = importPartyMemberYaml(text));
        ({ companions, issues: companionIssues } = importCompanionYaml(text));
        ({ parties, issues: partyIssues } = importPartyYaml(text));
      } catch (err) {
        appendFeedback(
          nextFeedbackId('pm-import-fail'),
          `Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      // All three importers parse the same envelopes, so envelope-level issues
      // (broken YAML, unknown kind) appear in every list — keep one copy.
      const seenIssues = new Set(issues.map((i) => `${i.documentIndex}|${i.path}|${i.message}`));
      const unseen = (list: typeof issues) =>
        list.filter((i) => {
          const key = `${i.documentIndex}|${i.path}|${i.message}`;
          if (seenIssues.has(key)) return false;
          seenIssues.add(key);
          return true;
        });
      issues = [...issues, ...unseen(companionIssues), ...unseen(partyIssues)];
      // Companion and party docs are handled by their own importers — not "skipped".
      skipped = skipped.filter((skip) => skip.kind !== 'companion' && skip.kind !== 'party');

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

      const companionPersist = await addCompanions(companions);
      if (!companionPersist.ok) {
        appendFeedback(
          nextFeedbackId('companion-import-persist-fail'),
          companionPersist.reason === 'unavailable'
            ? `Could not save companions from "${file.name}": storage is unavailable.`
            : `Could not save companions from "${file.name}": storage write failed.`
        );
      } else {
        for (const companion of companionPersist.rejected) {
          appendFeedback(
            nextFeedbackId('companion-import-dup'),
            `Skipped "${companion.name}" from "${file.name}": id "${companion.id}" is already in your companion library.`
          );
        }
        if (companionPersist.added.length > 0) {
          storedCompanions = [...storedCompanions, ...companionPersist.added];
          appendFeedback(
            nextFeedbackId('companion-import-ok'),
            `Imported ${companionPersist.added.length} companion${companionPersist.added.length === 1 ? '' : 's'} from "${file.name}".`,
            'success'
          );
        }
      }

      const partyPersist = await addParties(parties);
      if (!partyPersist.ok) {
        appendFeedback(
          nextFeedbackId('party-import-persist-fail'),
          partyPersist.reason === 'unavailable'
            ? `Could not save parties from "${file.name}": storage is unavailable.`
            : `Could not save parties from "${file.name}": storage write failed.`
        );
      } else {
        for (const party of partyPersist.rejected) {
          appendFeedback(
            nextFeedbackId('party-import-dup'),
            `Skipped party "${party.name}" from "${file.name}": id "${party.id}" is already in your library.`
          );
        }
        if (partyPersist.added.length > 0) {
          storedParties = [...storedParties, ...partyPersist.added];
          appendFeedback(
            nextFeedbackId('party-import-ok'),
            `Imported ${partyPersist.added.length} part${partyPersist.added.length === 1 ? 'y' : 'ies'} from "${file.name}".`,
            'success'
          );
        }
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
        partyMembers.length === 0 &&
        companions.length === 0 &&
        parties.length === 0
      ) {
        appendFeedback(
          nextFeedbackId('pm-import-empty'),
          `"${file.name}" contained no party-member, companion, or party documents.`
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
    // Companions ride along as minions under the member's card (spec §4.2).
    // Unwanted ones can be removed during PREPARING.
    for (const companion of storedCompanions) {
      if (companion.masterId !== partyMember.id) continue;
      addMinionCombatant(
        makeCompanionCombatant({
          companion,
          combatantId: `${companion.id}-${combatantCounter++}`,
          masterCombatantId: combatant.id
        })
      );
    }
  }

  /**
   * "Add Party" convenience (spec §4.2): one click dispatches the whole
   * roster — each member plus its companions as minions. Members deleted
   * since the party was saved are reported, not silently skipped.
   */
  function handleAddPartyToEncounter(party: Party) {
    const membersById = new Map(storedPartyMembers.map((m) => [m.id, m]));
    const missing: string[] = [];
    for (const memberId of party.memberIds) {
      const member = membersById.get(memberId);
      if (!member) {
        missing.push(memberId);
        continue;
      }
      handleAddPartyMemberToEncounter(member);
    }
    if (missing.length > 0) {
      appendFeedback(
        nextFeedbackId('party-add-missing'),
        `Party "${party.name}": ${missing.length === 1 ? 'member' : 'members'} ${missing.join(', ')} no longer in the library — skipped.`
      );
    }
  }

  async function handleSaveParty(party: Party) {
    const result = await saveParty(party);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('party-save-fail'),
        result.reason === 'unavailable'
          ? 'Could not save party: storage is unavailable.'
          : 'Could not save party: storage write failed.'
      );
      return;
    }
    const exists = storedParties.some((p) => p.id === party.id);
    storedParties = exists
      ? storedParties.map((p) => (p.id === party.id ? party : p))
      : [...storedParties, party];
  }

  async function handleRemoveParty(id: string) {
    const result = await removeParty(id);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('party-remove-fail'),
        result.reason === 'unavailable'
          ? 'Could not remove party: storage is unavailable.'
          : 'Could not remove party: storage write failed.'
      );
      return;
    }
    storedParties = storedParties.filter((p) => p.id !== id);
  }

  async function handleRemoveCompanion(id: string) {
    const result = await removeCompanion(id);
    if (!result.ok) {
      appendFeedback(
        nextFeedbackId('companion-remove-fail'),
        result.reason === 'unavailable'
          ? 'Could not remove companion: storage is unavailable.'
          : 'Could not remove companion: storage write failed.'
      );
      return;
    }
    storedCompanions = storedCompanions.filter((c) => c.id !== id);
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

  function completeEncounter() {
    if (encounter.phase !== 'ACTIVE' || encounter.pendingPrompts.length > 0) return;
    runCommand(toCommand('COMPLETE_ENCOUNTER', undefined, nextCommandId()));
    void syncBackPartyMembers();
  }

  /**
   * Party-members spec §4.5: on completion, persist each party-member
   * combatant's surviving effects (Wounded, Doomed, afflictions, …) back to
   * its stored record so they carry into the next encounter.
   */
  async function syncBackPartyMembers() {
    if (encounter.phase !== 'COMPLETED') return;
    const library = activeEffectLibrary();
    const updatedMembers = syncPartyMembersAfterEncounter(
      encounter.combatants,
      storedPartyMembers,
      library
    );
    const updatedCompanions = syncCompanionsAfterEncounter(
      encounter.combatants,
      storedCompanions,
      library
    );
    if (updatedMembers.length === 0 && updatedCompanions.length === 0) return;

    const [memberResults, companionResults] = await Promise.all([
      Promise.all(
        updatedMembers.map(async (member) => ({ record: member, result: await savePartyMember(member) }))
      ),
      Promise.all(
        updatedCompanions.map(async (companion) => ({ record: companion, result: await saveCompanion(companion) }))
      )
    ]);

    const savedMembers = new Map(
      memberResults.filter(({ result }) => result.ok).map(({ record }) => [record.id, record])
    );
    if (savedMembers.size > 0) {
      storedPartyMembers = storedPartyMembers.map((member) => savedMembers.get(member.id) ?? member);
    }
    const savedCompanions = new Map(
      companionResults.filter(({ result }) => result.ok).map(({ record }) => [record.id, record])
    );
    if (savedCompanions.size > 0) {
      storedCompanions = storedCompanions.map((companion) => savedCompanions.get(companion.id) ?? companion);
    }

    const failed = [...memberResults, ...companionResults].filter(({ result }) => !result.ok);
    if (failed.length > 0) {
      appendFeedback(
        nextFeedbackId('pm-sync'),
        `Could not save conditions back to ${failed.map(({ record }) => record.name).join(', ')} — changes apply to this session only.`
      );
    }
  }

  function prepareRematch() {
    if (encounter.phase !== 'COMPLETED') return;
    const rosterOrder = [...encounter.initiative.order];
    runCommand(toCommand('RESET_ENCOUNTER', undefined, nextCommandId()));
    runCommand(toCommand('SET_INITIATIVE_ORDER', { order: rosterOrder }, nextCommandId()));
    libraryOpen = true;
  }

  function exportEncounter() {
    const yaml = exportEncounterYaml(encounter);
    const blob = new Blob([yaml], { type: 'application/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = encounterExportFilename(encounter.name);
    anchor.click();
    URL.revokeObjectURL(url);
    appendFeedback(nextFeedbackId('encounter-export'), `Exported ${encounter.name}.`, 'success');
  }

  function openEncounterImport() {
    encounterImportInput?.click();
  }

  async function handleEncounterImport(files: File[]) {
    const file = files[0];
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      appendFeedback(
        nextFeedbackId('encounter-import-read'),
        `Could not read "${file.name}": ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    const result = importEncounterYaml(text);
    if (!result.ok) {
      for (const issue of result.issues) {
        const path = issue.path ? ` at ${issue.path}` : '';
        appendFeedback(
          nextFeedbackId('encounter-import-invalid'),
          `"${file.name}"${path}: ${issue.message}`
        );
      }
      return;
    }
    const hasCurrentEncounter =
      Object.keys(encounter.combatants).length > 0 || encounter.combatLog.length > 0;
    if (hasCurrentEncounter) {
      pendingEncounterImport = { state: result.state, fileName: file.name };
      return;
    }
    acceptEncounterImport(result.state, file.name);
  }

  function acceptEncounterImport(state: EncounterState, fileName: string) {
    encounter = state;
    commandCounter = nextCommandCounterFor(encounter.combatLog);
    combatantCounter = nextCombatantCounterFor(encounter.combatants);
    selection = emptySelection;
    encounterHistory.clear();
    historyVersion += 1;
    libraryOpen = true;
    pendingEncounterImport = null;
    persistence.persist(encounter);
    appendFeedback(nextFeedbackId('encounter-import-ok'), `Imported encounter from "${fileName}".`, 'success');
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
          // Spell effects default to their own duration, anchored to the
          // target (there is no caster in this flow); everything else is
          // unlimited until the GM edits it.
          duration: defaultApplyDuration(choice.effectId, combatantId),
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
    requestRemoveCombatant(id);
    closeRadial();
  }

  function requestRemoveCombatant(combatantId: string) {
    const combatant = encounter.combatants[combatantId];
    if (!combatant) return;
    removeConfirmation = { combatantId, name: combatant.name };
  }

  function confirmRemoveCombatant() {
    if (!removeConfirmation) return;
    const { combatantId, name } = removeConfirmation;
    runCommand(toCommand('REMOVE_COMBATANT', { combatantId }, nextCommandId()));
    appendFeedback(nextFeedbackId('remove-combatant'), `Removed ${name} from the encounter.`, 'success');
    removeConfirmation = null;
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

  function followActiveDetails() {
    selection = { id: activeCombatant?.id, pinned: false };
  }

  function closeDetails() {
    selection = { id: undefined, pinned: true };
  }

  async function resetLocal(): Promise<boolean> {
    if (!(await persistence.reset())) return false;
    encounter = newEncounterState();
    feedback = [];
    commandCounter = 1;
    combatantCounter = 1;
    feedbackCounter = 1;
    selection = emptySelection;
    encounterHistory.clear();
    historyVersion += 1;
    return true;
  }
</script>

<svelte:window onkeydown={handleHistoryShortcut} />

<main class="shell" data-hydrated={hydrated}>
  <TopBar
    name={encounter.name}
    phase={encounter.phase}
    round={encounter.round}
    activeName={activeCombatant?.name}
    {clockMinutes}
    onClockChange={setClock}
  />

  <div class="shell__header">
    <EncounterHeader
      phase={encounter.phase}
      pendingPromptCount={encounter.pendingPrompts.length}
      onComplete={completeEncounter}
      onPrepareRematch={prepareRematch}
      onExport={exportEncounter}
      onImport={openEncounterImport}
      canExport={Object.keys(encounter.combatants).length > 0}
      onDiscard={resetLocal}
      {canUndo}
      {canRedo}
      {undoLabel}
      {redoLabel}
      onUndo={undoEncounter}
      onRedo={redoEncounter}
    />
  </div>

  <EncounterDifficultyMeter summary={xpSummary} />

  <section class="workspace" class:workspace--library-closed={!libraryOpen}>
    {#if !libraryOpen}
      <button
        type="button"
        class="library-reopen"
        onclick={() => (libraryOpen = true)}
      >Library / Add Reinforcement</button>
    {/if}
    {#if libraryOpen}
    <div class="workspace__library">
      {#if encounter.phase === 'ACTIVE' || encounter.phase === 'RESOLVING'}
        <button type="button" class="library-collapse" onclick={() => (libraryOpen = false)}>
          Collapse library
        </button>
      {/if}
      <LibraryPane
        {canStart}
        creatures={availableCreatures}
        hazards={storedHazards}
        partyMembers={storedPartyMembers}
        companions={storedCompanions}
        parties={storedParties}
        {conditionOptions}
        {encounterCounts}
        onAddOneFromBestiary={handleAddOneFromBestiary}
        onRemoveOneFromBestiaryCount={handleRemoveOneFromBestiaryCount}
        onAddManual={handleAddManual}
        onImportCreatureFiles={handleImportLibraryFiles}
        onRemoveCreature={handleRemoveCreature}
        onAddOneFromHazards={handleAddOneFromHazards}
        onRemoveOneFromHazardsCount={handleRemoveOneFromHazardsCount}
        onImportHazardFiles={handleImportLibraryFiles}
        onRemoveHazard={handleRemoveHazard}
        spellEffects={storedSpellEffects}
        onImportSpellEffectFiles={handleImportLibraryFiles}
        onLoadSampleSpellEffects={handleLoadSampleSpellEffects}
        onRemoveSpellEffect={handleRemoveSpellEffect}
        onAddPartyMemberToEncounter={handleAddPartyMemberToEncounter}
        onAddPartyToEncounter={handleAddPartyToEncounter}
        onRemovePartyMember={handleRemovePartyMember}
        onRemoveCompanion={handleRemoveCompanion}
        onRemoveParty={handleRemoveParty}
        onSavePartyMember={handleSavePartyMember}
        onSaveParty={handleSaveParty}
        onImportPartyMemberYamlFiles={handleImportPartyMemberYamlFiles}
        onStart={startEncounter}
        onReset={resetLocal}
      />
    </div>
    {/if}

    <section class="workspace__track" aria-label="Combatants">
      {#if encounter.phase === 'PREPARING' && orderedCombatants.length === 0 && unorderedCombatants.length === 0}
        <div class="first-run" aria-labelledby="first-run-title">
          <h2 id="first-run-title">Build your first encounter</h2>
          <p>Import prepared creatures from tracker YAML or Foundry actor JSON, create a quick custom combatant, or restore a complete encounter YAML file.</p>
          <div class="first-run__actions">
            <button type="button" onclick={() => (libraryOpen = true)}>Import Creatures</button>
            <button type="button" onclick={() => (libraryOpen = true)}>Create Custom Combatant</button>
            <button type="button" onclick={openEncounterImport}>Import Encounter</button>
          </div>
          <p class="first-run__note">Add party members for encounter-difficulty calculation. Library management remains available in the left pane.</p>
        </div>
      {/if}
      {#if encounter.phase === 'COMPLETED'}
        <div class="completed-notice" role="status">
          <strong>Encounter completed.</strong>
          This is a read-only review of the final table state. Prepare a rematch to reset combatants
          and return to setup.
        </div>
      {/if}
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
            onManageEffects={(id) => openEffectModal(id, 'applied')}
            onRequestRemove={requestRemoveCombatant}
            showShortcutHint={index === 0}
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
          {#each minionsByMaster.get(combatant.id) ?? [] as minion (minion.id)}
            <div class="minion-card" data-master={combatant.id}>
              <CombatantCard
                combatant={minion}
                isMinion={true}
                isCurrent={false}
                isSelected={minion.id === selection.id}
                phase={encounter.phase}
                actions={combatantCardActions(encounter, minion.id)}
                appliedEffectsView={viewAppliedEffects(minion, encounter)}
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
                onManageEffects={(id) => openEffectModal(id, 'applied')}
                onRequestRemove={requestRemoveCombatant}
                pendingPrompts={encounter.pendingPrompts}
                combatantsById={encounter.combatants}
                onResolvePrompt={resolvePrompt}
                onApplyPersistentDamage={applyPersistentDamageFromPrompt}
                onRollSave={rollSaveFor}
              />
            </div>
          {/each}
        {/each}
      </div>
    </section>

    <aside class="workspace__details">
      <CombatantDetailsPanel
        combatant={selectedCombatant}
        pinned={selection.pinned}
        readOnly={encounter.phase === 'COMPLETED'}
        onFollowActive={followActiveDetails}
        onClose={closeDetails}
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
        {spellEffectsBySlug}
        onCastSpellEffect={openCastEffectModal}
        onSetAdjustment={(combatantId, adjustment) =>
          runCommand(
            toCommand('SET_TEMPLATE_ADJUSTMENT', { combatantId, adjustment }, nextCommandId())
          )}
      />
    </aside>

    <section class="workspace__log">
      <CombatLogDrawer entries={drawerEntries} bind:open={logOpen} />
    </section>
  </section>
</main>

<input
  bind:this={encounterImportInput}
  class="visually-hidden"
  type="file"
  accept=".yaml,.yml,application/yaml,text/yaml"
  aria-label="Choose encounter YAML"
  onchange={(event) => {
    const input = event.currentTarget;
    void handleEncounterImport(Array.from(input.files ?? []));
    input.value = '';
  }}
/>

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

{#if removeConfirmation}
  <Modal
    title={`Remove ${removeConfirmation.name}?`}
    titleId="remove-combatant-title"
    descriptionId="remove-combatant-description"
    onClose={() => (removeConfirmation = null)}
  >
    <p id="remove-combatant-description">
      Remove this combatant from the encounter and initiative order? You can undo this action during
      this session.
    </p>
    <svelte:fragment slot="footer">
      <button type="button" data-modal-default onclick={() => (removeConfirmation = null)}>Keep Combatant</button>
      <button type="button" class="modal-destructive" onclick={confirmRemoveCombatant}>Remove Combatant</button>
    </svelte:fragment>
  </Modal>
{/if}

{#if pendingEncounterImport}
  <Modal
    title="Replace current encounter?"
    titleId="replace-encounter-title"
    descriptionId="replace-encounter-description"
    onClose={() => (pendingEncounterImport = null)}
  >
    <p id="replace-encounter-description">
      Importing “{pendingEncounterImport.fileName}” replaces the current encounter and combat log.
      Your creature, hazard, and party libraries remain.
    </p>
    <svelte:fragment slot="footer">
      <button type="button" data-modal-default onclick={() => (pendingEncounterImport = null)}>Keep Current</button>
      <button
        type="button"
        class="modal-destructive"
        onclick={() => acceptEncounterImport(pendingEncounterImport!.state, pendingEncounterImport!.fileName)}
      >Replace Encounter</button>
    </svelte:fragment>
  </Modal>
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

{#if castModal && castModalCaster}
  <CastEffectModal
    casterId={castModal.casterId}
    casterName={castModalCaster.name}
    effects={castModal.effects}
    combatants={castTargets}
    onCast={castEffectToTargets}
    onClose={closeCastModal}
  />
{/if}

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

  .shell__header {
    max-width: 1440px;
    margin: 0 auto var(--space-3);
  }

  .workspace__library {
    grid-area: library;
  }

  .workspace--library-closed {
    grid-template-columns: minmax(460px, 1fr) minmax(300px, 380px);
    grid-template-areas:
      'track details'
      'log   log';
  }

  .library-reopen {
    position: fixed;
    left: var(--space-2);
    top: 50%;
    z-index: 10;
    min-height: var(--tap-target-min);
    padding: var(--space-2);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
    font: inherit;
    font-weight: 700;
    writing-mode: vertical-rl;
    cursor: pointer;
  }

  .library-collapse {
    width: 100%;
    min-height: 38px;
    margin-bottom: var(--space-2);
    border: var(--border-strong);
    background: var(--color-panel);
    color: var(--color-ink);
    font: inherit;
    cursor: pointer;
  }

  :global(.modal-destructive) {
    border-color: var(--color-red);
    background: var(--color-red);
    color: var(--color-panel-up);
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

  /* Minion cards nest visually under their master's card. */
  .minion-card {
    margin-left: var(--space-6);
    border-left: 2px solid var(--color-rule);
    padding-left: var(--space-3);
  }

  .completed-notice {
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-green);
    background: var(--color-green-soft);
    color: var(--color-ink);
  }

  .first-run {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-6);
    border: 1px dashed var(--color-rule-strong);
    background: var(--color-panel);
    text-align: center;
  }

  .first-run h2,
  .first-run p {
    margin: 0;
  }

  .first-run h2 {
    font-family: var(--font-serif);
    font-size: var(--text-xl);
  }

  .first-run__actions {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .first-run__actions button {
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .first-run__note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .visually-hidden {
    position: fixed;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .initiative-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--color-panel);
    border: var(--border-thin);
    border-radius: var(--radius-card);
  }

  .initiative-bar__roll {
    background: var(--accent);
    color: var(--accent-ink);
    border: 0;
    border-radius: var(--radius-card);
    padding: 6px 14px;
    font: inherit;
    font-weight: 600;
    font-size: var(--text-base);
    cursor: pointer;
  }

  .initiative-bar__roll:hover {
    background: var(--color-ink);
  }

  .initiative-bar__roll:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  .initiative-bar__hint {
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
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

    .workspace--library-closed {
      grid-template-columns: 1fr;
      grid-template-areas:
        'track'
        'details'
        'log';
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
