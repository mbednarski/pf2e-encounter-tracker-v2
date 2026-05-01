import type {
  AppliedEffect,
  CombatantId,
  CombatantState,
  Command,
  CommandResult,
  CommandType,
  DomainEvent,
  Duration,
  EffectDefinition,
  EffectLibrary,
  EncounterPhase,
  EncounterState,
  Prompt,
  PromptBoundary,
  PromptResolution,
  TurnBoundarySuggestion
} from './types';

const allowedPhases: Record<CommandType, EncounterPhase[]> = {
  START_ENCOUNTER: ['PREPARING'],
  COMPLETE_ENCOUNTER: ['ACTIVE'],
  RESET_ENCOUNTER: ['COMPLETED'],
  ADD_COMBATANT: ['PREPARING', 'ACTIVE'],
  REMOVE_COMBATANT: ['PREPARING', 'ACTIVE'],
  RENAME_COMBATANT: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_INITIATIVE_ORDER: ['PREPARING', 'ACTIVE'],
  REORDER_COMBATANT: ['PREPARING', 'ACTIVE'],
  END_TURN: ['ACTIVE'],
  DELAY: ['ACTIVE'],
  RESUME_FROM_DELAY: ['ACTIVE'],
  APPLY_DAMAGE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  APPLY_HEALING: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_TEMP_HP: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_HP: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  APPLY_EFFECT: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  REMOVE_EFFECT: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_EFFECT_VALUE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  MODIFY_EFFECT_VALUE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_EFFECT_DURATION: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  USE_SPELL_SLOT: ['ACTIVE', 'RESOLVING'],
  RESTORE_SPELL_SLOT: ['ACTIVE', 'RESOLVING'],
  USE_FOCUS_POINT: ['ACTIVE', 'RESOLVING'],
  RESTORE_FOCUS_POINT: ['ACTIVE', 'RESOLVING'],
  USE_INNATE_SPELL: ['ACTIVE', 'RESOLVING'],
  RESTORE_INNATE_SPELL: ['ACTIVE', 'RESOLVING'],
  SET_SPELL_SLOT_USAGE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_FOCUS_USAGE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  SET_INNATE_USAGE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  RESET_SPELL_BLOCK: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  RESOLVE_PROMPT: ['RESOLVING'],
  MARK_REACTION_USED: ['ACTIVE', 'RESOLVING'],
  RESET_REACTION: ['ACTIVE', 'RESOLVING'],
  SET_NOTE: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  MARK_DEAD: ['PREPARING', 'ACTIVE', 'RESOLVING'],
  REVIVE: ['PREPARING', 'ACTIVE', 'RESOLVING']
};

export function applyCommand(state: EncounterState, command: Command, effectLibrary: EffectLibrary): CommandResult {
  const phaseError = validatePhase(state, command.type);
  if (phaseError) {
    return reject(state, command.type, phaseError);
  }

  switch (command.type) {
    case 'ADD_COMBATANT':
      return addCombatant(state, command.payload.combatant);
    case 'SET_INITIATIVE_ORDER':
      return setInitiativeOrder(state, command.payload.order);
    case 'START_ENCOUNTER':
      return startEncounter(state, effectLibrary);
    case 'END_TURN':
      return endTurn(state, effectLibrary);
    case 'DELAY':
      return delayTurn(state, effectLibrary);
    case 'RESUME_FROM_DELAY':
      return resumeFromDelay(state, command.payload.combatantId, command.payload.insertIndex, effectLibrary);
    case 'COMPLETE_ENCOUNTER':
      return completeEncounter(state);
    case 'RESET_ENCOUNTER':
      return resetEncounter(state);
    case 'APPLY_DAMAGE':
      return applyDamage(state, command.payload.combatantId, command.payload.amount, command.payload.damageType);
    case 'APPLY_HEALING':
      return applyHealing(state, command.payload.combatantId, command.payload.amount);
    case 'SET_TEMP_HP':
      return setTempHp(state, command.payload.combatantId, command.payload.amount);
    case 'SET_HP':
      return setHp(state, command.payload.combatantId, command.payload.amount);
    case 'APPLY_EFFECT':
      return applyEffect(state, command, effectLibrary);
    case 'REMOVE_EFFECT':
      return removeEffect(state, command.payload.targetId, command.payload.instanceId, effectLibrary, 'removed');
    case 'SET_EFFECT_VALUE':
      return setEffectValue(state, command.payload.targetId, command.payload.instanceId, command.payload.newValue, effectLibrary);
    case 'MODIFY_EFFECT_VALUE':
      return modifyEffectValue(state, command.payload.targetId, command.payload.instanceId, command.payload.delta, effectLibrary);
    case 'SET_EFFECT_DURATION':
      return setEffectDuration(
        state,
        command.payload.targetId,
        command.payload.instanceId,
        command.payload.newDuration,
        effectLibrary
      );
    case 'RESOLVE_PROMPT':
      return resolvePrompt(state, command.payload.promptId, command.payload.resolution, effectLibrary);
    case 'MARK_REACTION_USED':
      return markReactionUsed(state, command.payload.combatantId);
    case 'RESET_REACTION':
      return resetReaction(state, command.payload.combatantId);
    case 'SET_NOTE':
      return setNote(state, command.payload.combatantId, command.payload.note);
    case 'MARK_DEAD':
      return markDead(state, command.payload.combatantId, effectLibrary);
    case 'REVIVE':
      return revive(state, command.payload.combatantId);
    default:
      return reject(state, command.type, `${command.type} is not implemented in the first domain slice`);
  }
}

function validatePhase(state: EncounterState, commandType: CommandType): string | undefined {
  if (allowedPhases[commandType].includes(state.phase)) {
    return undefined;
  }

  return `${commandType} is not legal during ${state.phase}`;
}

function reject(state: EncounterState, commandType: CommandType, reason: string): CommandResult {
  return {
    newState: state,
    events: [{ type: 'command-rejected', commandType, reason }]
  };
}

function addCombatant(state: EncounterState, combatant: CombatantState): CommandResult {
  if (state.combatants[combatant.id]) {
    return reject(state, 'ADD_COMBATANT', `Combatant ${combatant.id} already exists`);
  }

  const newState: EncounterState = {
    ...state,
    combatants: {
      ...state.combatants,
      [combatant.id]: combatant
    }
  };

  const event: DomainEvent = {
    type: 'combatant-added',
    combatantId: combatant.id,
    name: combatant.name,
    sourceType: combatant.sourceType
  };

  if (combatant.masterId) {
    return { newState, events: [{ ...event, masterId: combatant.masterId }] };
  }

  return { newState, events: [event] };
}

function setInitiativeOrder(state: EncounterState, order: CombatantId[]): CommandResult {
  const seen = new Set<CombatantId>();

  for (const combatantId of order) {
    if (seen.has(combatantId)) {
      return reject(state, 'SET_INITIATIVE_ORDER', `Initiative order contains duplicate combatant ${combatantId}`);
    }

    seen.add(combatantId);

    const combatant = state.combatants[combatantId];
    if (!combatant) {
      return reject(state, 'SET_INITIATIVE_ORDER', `Combatant ${combatantId} not found`);
    }

    if (!combatant.isAlive) {
      return reject(state, 'SET_INITIATIVE_ORDER', `Combatant ${combatantId} is not alive`);
    }
  }

  return {
    newState: {
      ...state,
      initiative: {
        ...state.initiative,
        order: [...order],
        currentIndex: state.phase === 'ACTIVE' && order.length > 0 ? Math.min(state.initiative.currentIndex, order.length - 1) : state.initiative.currentIndex
      }
    },
    events: [{ type: 'initiative-set', order: [...order] }]
  };
}

function startEncounter(state: EncounterState, effectLibrary: EffectLibrary): CommandResult {
  if (Object.keys(state.combatants).length < 2) {
    return reject(state, 'START_ENCOUNTER', 'START_ENCOUNTER requires at least 2 combatants');
  }

  if (state.initiative.order.length === 0) {
    return reject(state, 'START_ENCOUNTER', 'START_ENCOUNTER requires initiative order');
  }

  const firstCombatantId = state.initiative.order[0];
  if (!firstCombatantId || !state.combatants[firstCombatantId]) {
    return reject(state, 'START_ENCOUNTER', 'START_ENCOUNTER requires a valid first combatant');
  }

  const newState: EncounterState = {
    ...state,
    phase: 'ACTIVE',
    round: 1,
    initiative: {
      ...state.initiative,
      currentIndex: 0
    }
  };

  const startExpiry = expireEffectsForBoundary(newState, 'untilTurnStart', firstCombatantId, effectLibrary, 'START_ENCOUNTER');
  if (startExpiry.kind === 'rejected') {
    return startExpiry.result;
  }

  const events: DomainEvent[] = [
    { type: 'encounter-started' },
    { type: 'phase-changed', from: 'PREPARING', to: 'ACTIVE' },
    ...startExpiry.events,
    { type: 'turn-started', combatantId: firstCombatantId, round: 1 }
  ];

  return finishTurnStartBoundary(startExpiry.state, firstCombatantId, 'turnStart', effectLibrary, 'START_ENCOUNTER', events);
}

function completeEncounter(state: EncounterState): CommandResult {
  return {
    newState: { ...state, phase: 'COMPLETED' },
    events: [
      { type: 'encounter-completed' },
      { type: 'phase-changed', from: 'ACTIVE', to: 'COMPLETED' }
    ]
  };
}

function endTurn(state: EncounterState, effectLibrary: EffectLibrary): CommandResult {
  const currentCombatantId = state.initiative.order[state.initiative.currentIndex];
  if (!currentCombatantId || !state.combatants[currentCombatantId]) {
    return reject(state, 'END_TURN', 'END_TURN requires a valid current combatant');
  }

  return advanceTurn(state, currentCombatantId, effectLibrary, 'END_TURN');
}

function advanceTurn(
  state: EncounterState,
  currentCombatantId: CombatantId,
  effectLibrary: EffectLibrary,
  commandType: CommandType
): CommandResult {
  return advanceAfterTurnEnd(state, currentCombatantId, [{ type: 'turn-ended', combatantId: currentCombatantId }], effectLibrary, commandType);
}

function advanceAfterTurnEnd(
  state: EncounterState,
  currentCombatantId: CombatantId,
  initialEvents: DomainEvent[],
  effectLibrary: EffectLibrary,
  commandType: CommandType,
  startIndex = state.initiative.currentIndex + 1
): CommandResult {
  const endExpiry = expireEffectsForBoundary(state, 'untilTurnEnd', currentCombatantId, effectLibrary, commandType);
  if (endExpiry.kind === 'rejected') {
    return endExpiry.result;
  }

  const events: DomainEvent[] = [...initialEvents, ...endExpiry.events];
  const stateAfterEndExpiry = endExpiry.state;
  const endPrompts = generatePromptsForBoundary(
    stateAfterEndExpiry,
    { type: 'turnEnd', ownerId: currentCombatantId },
    effectLibrary,
    commandType
  );
  if (endPrompts.kind === 'rejected') {
    return appendRejectedEvents(stateAfterEndExpiry, events, endPrompts.result);
  }

  if (endPrompts.prompts.length > 0) {
    return {
      newState: {
        ...stateAfterEndExpiry,
        phase: 'RESOLVING',
        pendingPrompts: endPrompts.prompts,
        turnResolution: { type: 'advanceAfterTurnEnd', startIndex }
      },
      events: [
        ...events,
        ...endPrompts.events,
        ...(stateAfterEndExpiry.phase !== 'RESOLVING'
          ? [{ type: 'phase-changed', from: stateAfterEndExpiry.phase, to: 'RESOLVING' } as DomainEvent]
          : [])
      ]
    };
  }

  return advanceToNextTurn(stateAfterEndExpiry, startIndex, events, effectLibrary, commandType);
}

function advanceToNextTurn(
  state: EncounterState,
  startIndex: number,
  events: DomainEvent[],
  effectLibrary: EffectLibrary,
  commandType: CommandType
): CommandResult {
  const nextTurn = findNextLiveTurnFrom(state, startIndex);
  if (!nextTurn) {
    const nextState = clearTurnResolution({
      ...state,
      phase: 'ACTIVE',
      pendingPrompts: []
    });

    return {
      newState: nextState,
      events: [
        ...events,
        { type: 'all-combatants-dead' },
      ]
    };
  }

  const nextCombatant = state.combatants[nextTurn.combatantId];
  events.push({ type: 'reaction-reset', combatantId: nextTurn.combatantId, cause: 'auto' });

  if (nextTurn.round !== state.round) {
    events.push({ type: 'round-started', round: nextTurn.round });
  }

  const stateBeforeTurnStart: EncounterState = clearTurnResolution({
    ...state,
    round: nextTurn.round,
    initiative: {
      ...state.initiative,
      currentIndex: nextTurn.index
    },
    combatants: {
      ...state.combatants,
      [nextTurn.combatantId]: {
        ...nextCombatant,
        reactionUsedThisRound: false
      }
    }
  });
  const startExpiry = expireEffectsForBoundary(
    stateBeforeTurnStart,
    'untilTurnStart',
    nextTurn.combatantId,
    effectLibrary,
    commandType
  );
  if (startExpiry.kind === 'rejected') {
    return startExpiry.result;
  }

  events.push(...startExpiry.events);
  events.push({ type: 'turn-started', combatantId: nextTurn.combatantId, round: nextTurn.round });

  return finishTurnStartBoundary(startExpiry.state, nextTurn.combatantId, 'turnStart', effectLibrary, commandType, events);
}

type PromptGenerationResult =
  | { kind: 'generated'; prompts: Prompt[]; events: DomainEvent[] }
  | { kind: 'rejected'; result: CommandResult };

function finishTurnStartBoundary(
  state: EncounterState,
  combatantId: CombatantId,
  boundaryType: PromptBoundary['type'],
  effectLibrary: EffectLibrary,
  commandType: CommandType,
  events: DomainEvent[]
): CommandResult {
  const generated = generatePromptsForBoundary(state, { type: boundaryType, ownerId: combatantId }, effectLibrary, commandType);
  if (generated.kind === 'rejected') {
    return appendRejectedEvents(state, events, generated.result);
  }

  if (generated.prompts.length === 0) {
    return {
      newState: clearTurnResolution({
        ...state,
        phase: 'ACTIVE',
        pendingPrompts: []
      }),
      events: [
        ...events,
        ...(state.phase === 'RESOLVING'
          ? [{ type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' } as DomainEvent]
          : [])
      ]
    };
  }

  return {
    newState: {
      ...state,
      phase: 'RESOLVING',
      pendingPrompts: generated.prompts
    },
    events: [
      ...events,
      ...generated.events,
      ...(state.phase !== 'RESOLVING'
        ? [{ type: 'phase-changed', from: state.phase, to: 'RESOLVING' } as DomainEvent]
        : [])
    ]
  };
}

function clearTurnResolution(state: EncounterState): EncounterState {
  const { turnResolution: _turnResolution, ...stateWithoutContinuation } = state;
  return stateWithoutContinuation;
}

function appendRejectedEvents(state: EncounterState, priorEvents: DomainEvent[], rejected: CommandResult): CommandResult {
  return {
    newState: state,
    events: [...priorEvents, ...rejected.events]
  };
}

function generatePromptsForBoundary(
  state: EncounterState,
  boundary: PromptBoundary,
  effectLibrary: EffectLibrary,
  commandType: CommandType
): PromptGenerationResult {
  const target = state.combatants[boundary.ownerId];
  if (!target) {
    return { kind: 'rejected', result: reject(state, commandType, `Combatant ${boundary.ownerId} not found`) };
  }

  const prompts: Prompt[] = [];
  const events: DomainEvent[] = [];

  for (const effect of target.appliedEffects) {
    if (effect.duration.type === 'untilTurnEnd' || effect.duration.type === 'untilTurnStart') {
      continue;
    }

    const definition = effectLibrary[effect.effectId];
    if (!definition) {
      return { kind: 'rejected', result: reject(state, commandType, `Effect ${effect.effectId} not found`) };
    }

    const suggestion = boundary.type === 'turnStart' ? definition.turnStartSuggestion : definition.turnEndSuggestion;
    if (!suggestion) {
      continue;
    }

    const builtPrompt = buildPrompt(boundary, target.id, effect, definition, suggestion);
    if (builtPrompt.kind === 'rejected') {
      return { kind: 'rejected', result: reject(state, commandType, builtPrompt.reason) };
    }

    const { prompt } = builtPrompt;
    prompts.push(prompt);
    events.push({
      type: 'prompt-generated',
      promptId: prompt.id,
      boundary: prompt.boundary,
      targetId: prompt.targetId,
      effectInstanceId: prompt.effectInstanceId,
      effectName: prompt.effectName,
      suggestionType: prompt.suggestionType.type,
      description: prompt.description
    });
  }

  return { kind: 'generated', prompts, events };
}

function buildPrompt(
  boundary: PromptBoundary,
  targetId: CombatantId,
  effect: AppliedEffect,
  definition: EffectDefinition,
  suggestion: TurnBoundarySuggestion
): { kind: 'built'; prompt: Prompt } | { kind: 'rejected'; reason: string } {
  const clonedSuggestion = cloneTurnBoundarySuggestion(suggestion);
  if (clonedSuggestion.kind === 'rejected') {
    return clonedSuggestion;
  }

  const currentValue = effect.value;
  const suggestedValue =
    clonedSuggestion.suggestion.type === 'suggestDecrement' && currentValue !== undefined
      ? Math.max(currentValue - clonedSuggestion.suggestion.amount, 0)
      : undefined;
  const description = renderPromptDescription(definition, effect, clonedSuggestion.suggestion);

  return {
    kind: 'built',
    prompt: {
      id: `prompt:${boundary.type}:${boundary.ownerId}:${targetId}:${effect.instanceId}`,
      boundary,
      targetId,
      effectInstanceId: effect.instanceId,
      effectName: definition.name,
      description,
      suggestionType: clonedSuggestion.suggestion,
      ...(currentValue !== undefined ? { currentValue } : {}),
      ...(suggestedValue !== undefined ? { suggestedValue } : {})
    }
  };
}

function renderPromptDescription(
  definition: EffectDefinition,
  effect: AppliedEffect,
  suggestion: TurnBoundarySuggestion
): string {
  const template =
    'description' in suggestion && suggestion.description
      ? suggestion.description
      : `${definition.name}${effect.value !== undefined ? ` ${effect.value}` : ''}`;

  return template
    .replaceAll('{value}', String(effect.value ?? ''))
    .replaceAll('{note}', effect.note ?? '')
    .trim();
}

function cloneTurnBoundarySuggestion(
  suggestion: TurnBoundarySuggestion
): { kind: 'valid'; suggestion: TurnBoundarySuggestion } | { kind: 'rejected'; reason: string } {
  const candidate = suggestion as {
    type?: unknown;
    amount?: unknown;
    description?: unknown;
  };

  switch (candidate.type) {
    case 'suggestDecrement':
      if (typeof candidate.amount !== 'number' || !isPositive(candidate.amount)) {
        return { kind: 'rejected', reason: 'Turn boundary suggestion has an invalid decrement amount' };
      }

      if (candidate.description !== undefined && typeof candidate.description !== 'string') {
        return { kind: 'rejected', reason: 'Turn boundary suggestion has an invalid description' };
      }

      return {
        kind: 'valid',
        suggestion: {
          type: 'suggestDecrement',
          amount: candidate.amount,
          ...(candidate.description !== undefined ? { description: candidate.description } : {})
        }
      };
    case 'suggestRemove':
    case 'promptResolution':
    case 'reminder':
      if (!isNonEmptyString(candidate.description)) {
        return { kind: 'rejected', reason: 'Turn boundary suggestion has an invalid description' };
      }

      return {
        kind: 'valid',
        suggestion: {
          type: candidate.type,
          description: candidate.description
        }
      };
    case 'confirmSustained':
      if (candidate.description !== undefined && typeof candidate.description !== 'string') {
        return { kind: 'rejected', reason: 'Turn boundary suggestion has an invalid description' };
      }

      return {
        kind: 'valid',
        suggestion: {
          type: 'confirmSustained',
          ...(candidate.description !== undefined ? { description: candidate.description } : {})
        }
      };
    default:
      return { kind: 'rejected', reason: 'Turn boundary suggestion has an unknown type' };
  }
}

function findNextLiveTurnFrom(
  state: EncounterState,
  startIndex: number
): { combatantId: CombatantId; index: number; round: number } | undefined {
  const { order } = state.initiative;

  for (let offset = 0; offset < order.length; offset += 1) {
    const rawIndex = startIndex + offset;
    const index = rawIndex % order.length;
    const combatantId = order[index];
    const combatant = combatantId ? state.combatants[combatantId] : undefined;

    if (combatant?.isAlive) {
      return {
        combatantId,
        index,
        round: rawIndex >= order.length ? state.round + 1 : state.round
      };
    }
  }

  return undefined;
}

function delayTurn(state: EncounterState, effectLibrary: EffectLibrary): CommandResult {
  const currentCombatantId = state.initiative.order[state.initiative.currentIndex];
  if (!currentCombatantId || !state.combatants[currentCombatantId]) {
    return reject(state, 'DELAY', 'DELAY requires a valid current combatant');
  }

  const nextOrder = state.initiative.order.filter((combatantId) => combatantId !== currentCombatantId);
  const stateWithDelay: EncounterState = {
    ...state,
    initiative: {
      ...state.initiative,
      order: nextOrder,
      delaying: [...state.initiative.delaying, currentCombatantId]
    }
  };
  return advanceAfterTurnEnd(
    stateWithDelay,
    currentCombatantId,
    [
      { type: 'turn-ended', combatantId: currentCombatantId },
      { type: 'combatant-delayed', combatantId: currentCombatantId }
    ],
    effectLibrary,
    'DELAY',
    state.initiative.currentIndex
  );
}

function resumeFromDelay(
  state: EncounterState,
  combatantId: CombatantId,
  insertIndex: number,
  effectLibrary: EffectLibrary
): CommandResult {
  const currentCombatantId = state.initiative.order[state.initiative.currentIndex];
  if (!currentCombatantId || !state.combatants[currentCombatantId]) {
    return reject(state, 'RESUME_FROM_DELAY', 'RESUME_FROM_DELAY requires a valid current combatant');
  }

  const resumingCombatant = state.combatants[combatantId];
  if (!resumingCombatant) {
    return reject(state, 'RESUME_FROM_DELAY', `Combatant ${combatantId} not found`);
  }

  if (!state.initiative.delaying.includes(combatantId)) {
    return reject(state, 'RESUME_FROM_DELAY', `Combatant ${combatantId} is not delaying`);
  }

  if (!resumingCombatant.isAlive) {
    return reject(state, 'RESUME_FROM_DELAY', `Combatant ${combatantId} is not alive`);
  }

  if (!Number.isInteger(insertIndex) || insertIndex < 0 || insertIndex > state.initiative.order.length) {
    return reject(
      state,
      'RESUME_FROM_DELAY',
      `RESUME_FROM_DELAY insertIndex must be between 0 and ${state.initiative.order.length}`
    );
  }

  const nextOrder = [...state.initiative.order];
  nextOrder.splice(insertIndex, 0, combatantId);

  const stateWithResume: EncounterState = {
    ...state,
    initiative: {
      ...state.initiative,
      order: nextOrder,
      delaying: state.initiative.delaying.filter((delayingCombatantId) => delayingCombatantId !== combatantId)
    }
  };

  return advanceAfterTurnEnd(
    stateWithResume,
    currentCombatantId,
    [
      { type: 'turn-ended', combatantId: currentCombatantId },
      { type: 'combatant-resumed-from-delay', combatantId, insertIndex }
    ],
    effectLibrary,
    'RESUME_FROM_DELAY',
    insertIndex
  );
}

function resetEncounter(state: EncounterState): CommandResult {
  const resetCombatants = Object.fromEntries(
    Object.entries(state.combatants).map(([combatantId, combatant]) => [
      combatantId,
      {
        ...combatant,
        currentHp: combatant.baseStats.hp,
        tempHp: 0,
        appliedEffects: [],
        reactionUsedThisRound: false,
        isAlive: true
      }
    ])
  );

  return {
    newState: {
      ...state,
      phase: 'PREPARING',
      round: 0,
      initiative: { order: [], currentIndex: -1, delaying: [] },
      combatants: resetCombatants,
      pendingPrompts: [],
      combatLog: []
    },
    events: [
      { type: 'encounter-reset' },
      { type: 'phase-changed', from: 'COMPLETED', to: 'PREPARING' }
    ]
  };
}

function applyDamage(state: EncounterState, combatantId: CombatantId, amount: number, damageType?: string): CommandResult {
  if (!isPositive(amount)) {
    return reject(state, 'APPLY_DAMAGE', 'APPLY_DAMAGE amount must be > 0');
  }

  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'APPLY_DAMAGE', `Combatant ${combatantId} not found`);
  }

  const damageAfterTempHp = Math.max(amount - combatant.tempHp, 0);
  const nextTempHp = Math.max(combatant.tempHp - amount, 0);
  const nextHp = Math.max(combatant.currentHp - damageAfterTempHp, 0);

  return updateHp(state, combatant, nextHp, nextTempHp, {
    type: 'hp-changed',
    combatantId,
    hpFrom: combatant.currentHp,
    hpTo: nextHp,
    tempHpFrom: combatant.tempHp,
    tempHpTo: nextTempHp,
    cause: 'damage',
    ...(damageType ? { damageType } : {})
  });
}

function applyHealing(state: EncounterState, combatantId: CombatantId, amount: number): CommandResult {
  if (!isPositive(amount)) {
    return reject(state, 'APPLY_HEALING', 'APPLY_HEALING amount must be > 0');
  }

  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'APPLY_HEALING', `Combatant ${combatantId} not found`);
  }

  const nextHp = Math.min(combatant.currentHp + amount, combatant.baseStats.hp);

  return updateHp(state, combatant, nextHp, combatant.tempHp, {
    type: 'hp-changed',
    combatantId,
    hpFrom: combatant.currentHp,
    hpTo: nextHp,
    tempHpFrom: combatant.tempHp,
    tempHpTo: combatant.tempHp,
    cause: 'healing'
  });
}

function setTempHp(state: EncounterState, combatantId: CombatantId, amount: number): CommandResult {
  if (!isNonNegative(amount)) {
    return reject(state, 'SET_TEMP_HP', 'SET_TEMP_HP amount must be >= 0');
  }

  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'SET_TEMP_HP', `Combatant ${combatantId} not found`);
  }

  return updateHp(state, combatant, combatant.currentHp, amount, {
    type: 'hp-changed',
    combatantId,
    hpFrom: combatant.currentHp,
    hpTo: combatant.currentHp,
    tempHpFrom: combatant.tempHp,
    tempHpTo: amount,
    cause: 'set-temp'
  });
}

function setHp(state: EncounterState, combatantId: CombatantId, amount: number): CommandResult {
  if (!isNonNegative(amount)) {
    return reject(state, 'SET_HP', 'SET_HP amount must be >= 0');
  }

  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'SET_HP', `Combatant ${combatantId} not found`);
  }

  return updateHp(state, combatant, amount, combatant.tempHp, {
    type: 'hp-changed',
    combatantId,
    hpFrom: combatant.currentHp,
    hpTo: amount,
    tempHpFrom: combatant.tempHp,
    tempHpTo: combatant.tempHp,
    cause: 'set'
  });
}

function applyEffect(
  state: EncounterState,
  command: Extract<Command, { type: 'APPLY_EFFECT' }>,
  effectLibrary: EffectLibrary
): CommandResult {
  const target = state.combatants[command.payload.targetId];
  if (!target) {
    return reject(state, 'APPLY_EFFECT', `Combatant ${command.payload.targetId} not found`);
  }

  const source = command.payload.sourceId ? state.combatants[command.payload.sourceId] : undefined;
  if (command.payload.sourceId && !source) {
    return reject(state, 'APPLY_EFFECT', `Source combatant ${command.payload.sourceId} not found`);
  }

  const effect = effectLibrary[command.payload.effectId];
  if (!effect) {
    return reject(state, 'APPLY_EFFECT', `Effect ${command.payload.effectId} not found`);
  }

  const duration = command.payload.duration ?? { type: 'unlimited' };
  if (!isValidDuration(state, duration)) {
    return reject(state, 'APPLY_EFFECT', 'APPLY_EFFECT duration is invalid');
  }

  const appliedEffects = [...target.appliedEffects];
  const events: DomainEvent[] = [];
  const created = appendAppliedEffect({
    target,
    effectLibrary,
    appliedEffects,
    events,
    commandId: command.id,
    effect,
    sourceId: command.payload.sourceId,
    sourceLabel: source?.name,
    value: command.payload.value,
    duration,
    note: command.payload.note,
    seenEffectIds: new Set()
  });

  if (created.error) {
    return reject(state, 'APPLY_EFFECT', created.error);
  }

  return updateCombatant(state, { ...target, appliedEffects }, events);
}

interface AppendAppliedEffectInput {
  target: CombatantState;
  effectLibrary: EffectLibrary;
  appliedEffects: AppliedEffect[];
  events: DomainEvent[];
  commandId: string;
  effect: EffectDefinition;
  sourceId?: CombatantId;
  sourceLabel?: string;
  parentInstanceId?: string;
  value?: number;
  duration: Duration;
  note?: string;
  seenEffectIds: Set<string>;
}

function appendAppliedEffect(input: AppendAppliedEffectInput): { error?: string } {
  const {
    target,
    effectLibrary,
    appliedEffects,
    events,
    commandId,
    effect,
    sourceId,
    sourceLabel,
    parentInstanceId,
    value,
    duration,
    note,
    seenEffectIds
  } = input;

  if (seenEffectIds.has(effect.id)) {
    return { error: `Effect ${effect.id} implied effect cycle detected` };
  }

  let resolvedValue: number | undefined;
  if (effect.hasValue) {
    resolvedValue = value ?? 1;
    if (!isPositive(resolvedValue)) {
      return { error: `APPLY_EFFECT value must be >= 1 for ${effect.name}` };
    }
  } else if (value !== undefined) {
    return { error: `APPLY_EFFECT value is not allowed for ${effect.name}` };
  }

  const instanceId = nextEffectInstanceId(commandId, appliedEffects);
  const appliedEffect: AppliedEffect = {
    instanceId,
    effectId: effect.id,
    ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(parentInstanceId ? { parentInstanceId } : {}),
    duration: cloneDuration(duration),
    ...(note ? { note } : {})
  };

  appliedEffects.push(appliedEffect);
  events.push({
    type: 'effect-applied',
    combatantId: target.id,
    effectId: effect.id,
    effectName: effect.name,
    instanceId,
    ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
    ...(parentInstanceId ? { parentInstanceId } : {})
  });

  const childSeenEffectIds = new Set(seenEffectIds);
  childSeenEffectIds.add(effect.id);

  for (const impliedEffectId of effect.impliedEffects ?? []) {
    const impliedEffect = effectLibrary[impliedEffectId];
    if (!impliedEffect) {
      return { error: `Effect ${impliedEffectId} not found` };
    }

    const child = appendAppliedEffect({
      target,
      effectLibrary,
      appliedEffects,
      events,
      commandId,
      effect: impliedEffect,
      sourceId,
      sourceLabel,
      parentInstanceId: instanceId,
      duration: { type: 'unlimited' },
      seenEffectIds: childSeenEffectIds
    });

    if (child.error) {
      return child;
    }
  }

  return {};
}

function removeEffect(
  state: EncounterState,
  targetId: CombatantId,
  instanceId: string,
  effectLibrary: EffectLibrary,
  reason: Extract<DomainEvent, { type: 'effect-removed' }>['reason']
): CommandResult {
  const target = state.combatants[targetId];
  if (!target) {
    return reject(state, 'REMOVE_EFFECT', `Combatant ${targetId} not found`);
  }

  const effect = target.appliedEffects.find((appliedEffect) => appliedEffect.instanceId === instanceId);
  if (!effect) {
    return reject(state, 'REMOVE_EFFECT', `Effect instance ${instanceId} not found on ${targetId}`);
  }

  return removeExistingEffect(state, target, instanceId, effectLibrary, reason, 'REMOVE_EFFECT');
}

function removeExistingEffect(
  state: EncounterState,
  target: CombatantState,
  instanceId: string,
  effectLibrary: EffectLibrary,
  reason: Extract<DomainEvent, { type: 'effect-removed' }>['reason'],
  commandType: CommandType
): CommandResult {
  const removedIds = collectEffectRemovalIds(target.appliedEffects, instanceId);
  const removedIdSet = new Set(removedIds);
  const removedEffects = removedIds
    .map((removedId) => target.appliedEffects.find((effect) => effect.instanceId === removedId))
    .filter((effect): effect is AppliedEffect => effect !== undefined);
  const missingDefinitionEffect = removedEffects.find((effect) => !effectLibrary[effect.effectId]);
  if (missingDefinitionEffect) {
    return reject(state, commandType, `Effect ${missingDefinitionEffect.effectId} not found`);
  }

  const events = removedEffects.map((effect, index): DomainEvent => {
    const definition = effectLibrary[effect.effectId];
    return {
      type: 'effect-removed',
      combatantId: target.id,
      effectId: effect.effectId,
      effectName: definition.name,
      instanceId: effect.instanceId,
      reason: index === 0 ? reason : 'cascade',
      ...(effect.parentInstanceId ? { parentInstanceId: effect.parentInstanceId } : {})
    };
  });

  return updateCombatant(
    state,
    {
      ...target,
      appliedEffects: target.appliedEffects.filter((effect) => !removedIdSet.has(effect.instanceId))
    },
    events
  );
}

function collectEffectRemovalIds(effects: AppliedEffect[], rootInstanceId: string): string[] {
  const ids = [rootInstanceId];

  for (const child of effects.filter((effect) => effect.parentInstanceId === rootInstanceId)) {
    ids.push(...collectEffectRemovalIds(effects, child.instanceId));
  }

  return ids;
}

type HardClockDurationType = Extract<Duration, { type: 'untilTurnEnd' | 'untilTurnStart' }>['type'];

type BoundaryExpiryResult =
  | { kind: 'expired'; state: EncounterState; events: DomainEvent[] }
  | { kind: 'rejected'; result: CommandResult };

function expireEffectsForBoundary(
  state: EncounterState,
  durationType: HardClockDurationType,
  combatantId: CombatantId,
  effectLibrary: EffectLibrary,
  commandType: CommandType
): BoundaryExpiryResult {
  let combatants = state.combatants;
  const events: DomainEvent[] = [];

  for (const target of Object.values(state.combatants)) {
    const removedIds: string[] = [];
    const removedIdSet = new Set<string>();
    const rootIdSet = new Set<string>();

    for (const effect of target.appliedEffects) {
      if (removedIdSet.has(effect.instanceId)) {
        continue;
      }

      if (effect.duration.type !== durationType || effect.duration.combatantId !== combatantId) {
        continue;
      }

      rootIdSet.add(effect.instanceId);
      for (const removedId of collectEffectRemovalIds(target.appliedEffects, effect.instanceId)) {
        if (!removedIdSet.has(removedId)) {
          removedIdSet.add(removedId);
          removedIds.push(removedId);
        }
      }
    }

    if (removedIds.length === 0) {
      continue;
    }

    const removedEffects = removedIds
      .map((removedId) => target.appliedEffects.find((effect) => effect.instanceId === removedId))
      .filter((effect): effect is AppliedEffect => effect !== undefined);
    const missingDefinitionEffect = removedEffects.find((effect) => !effectLibrary[effect.effectId]);
    if (missingDefinitionEffect) {
      return { kind: 'rejected', result: reject(state, commandType, `Effect ${missingDefinitionEffect.effectId} not found`) };
    }

    combatants = {
      ...combatants,
      [target.id]: {
        ...target,
        appliedEffects: target.appliedEffects.filter((effect) => !removedIdSet.has(effect.instanceId))
      }
    };
    events.push(
      ...removedEffects.map((effect): DomainEvent => {
        const definition = effectLibrary[effect.effectId];
        return {
          type: 'effect-removed',
          combatantId: target.id,
          effectId: effect.effectId,
          effectName: definition.name,
          instanceId: effect.instanceId,
          reason: rootIdSet.has(effect.instanceId) ? 'expired' : 'cascade',
          ...(effect.parentInstanceId ? { parentInstanceId: effect.parentInstanceId } : {})
        };
      })
    );
  }

  return {
    kind: 'expired',
    state: events.length > 0 ? { ...state, combatants } : state,
    events
  };
}

type EffectInstanceLookup =
  | { kind: 'found'; target: CombatantState; effect: AppliedEffect; definition: EffectDefinition }
  | { kind: 'rejected'; result: CommandResult };

function setEffectValue(
  state: EncounterState,
  targetId: CombatantId,
  instanceId: string,
  newValue: number,
  effectLibrary: EffectLibrary
): CommandResult {
  const located = findEffectInstance(state, 'SET_EFFECT_VALUE', targetId, instanceId, effectLibrary);
  if (located.kind === 'rejected') {
    return located.result;
  }

  const { target, effect, definition } = located;
  if (!definition.hasValue) {
    return reject(state, 'SET_EFFECT_VALUE', 'SET_EFFECT_VALUE requires a value effect');
  }

  if (!isPositive(newValue)) {
    return reject(state, 'SET_EFFECT_VALUE', 'SET_EFFECT_VALUE newValue must be >= 1');
  }

  const from = effect.value ?? 1;
  const updatedEffect = { ...effect, value: newValue };

  return updateCombatant(
    state,
    replaceEffect(target, updatedEffect),
    [
      {
        type: 'effect-value-changed',
        combatantId: target.id,
        effectId: effect.effectId,
        effectName: definition.name,
        instanceId,
        from,
        to: newValue
      }
    ]
  );
}

function modifyEffectValue(
  state: EncounterState,
  targetId: CombatantId,
  instanceId: string,
  delta: number,
  effectLibrary: EffectLibrary
): CommandResult {
  const located = findEffectInstance(state, 'MODIFY_EFFECT_VALUE', targetId, instanceId, effectLibrary);
  if (located.kind === 'rejected') {
    return located.result;
  }

  const { target, effect, definition } = located;
  if (!definition.hasValue) {
    return reject(state, 'MODIFY_EFFECT_VALUE', 'MODIFY_EFFECT_VALUE requires a value effect');
  }

  if (!Number.isInteger(delta)) {
    return reject(state, 'MODIFY_EFFECT_VALUE', 'MODIFY_EFFECT_VALUE delta must be an integer');
  }

  const from = effect.value ?? 1;
  const to = from + delta;
  if (to <= 0) {
    return removeExistingEffect(state, target, instanceId, effectLibrary, 'auto-decremented', 'MODIFY_EFFECT_VALUE');
  }

  const updatedEffect = { ...effect, value: to };
  return updateCombatant(
    state,
    replaceEffect(target, updatedEffect),
    [
      {
        type: 'effect-value-changed',
        combatantId: target.id,
        effectId: effect.effectId,
        effectName: definition.name,
        instanceId,
        from,
        to
      }
    ]
  );
}

function setEffectDuration(
  state: EncounterState,
  targetId: CombatantId,
  instanceId: string,
  newDuration: Duration,
  effectLibrary: EffectLibrary
): CommandResult {
  const located = findEffectInstance(state, 'SET_EFFECT_DURATION', targetId, instanceId, effectLibrary);
  if (located.kind === 'rejected') {
    return located.result;
  }

  if (!isValidDuration(state, newDuration)) {
    return reject(state, 'SET_EFFECT_DURATION', 'SET_EFFECT_DURATION duration is invalid');
  }

  const { target, effect, definition } = located;
  return updateCombatant(
    state,
    replaceEffect(target, { ...effect, duration: cloneDuration(newDuration) }),
    [
      {
        type: 'effect-duration-changed',
        combatantId: targetId,
        effectId: effect.effectId,
        effectName: definition.name,
        instanceId
      }
    ]
  );
}

function resolvePrompt(
  state: EncounterState,
  promptId: string,
  resolution: PromptResolution,
  effectLibrary: EffectLibrary
): CommandResult {
  const pendingPrompt = state.pendingPrompts.find((prompt) => prompt.id === promptId);
  if (!pendingPrompt) {
    return reject(state, 'RESOLVE_PROMPT', `Prompt ${promptId} not found`);
  }

  const prompt = normalizePrompt(pendingPrompt);
  if (prompt.kind === 'rejected') {
    return reject(state, 'RESOLVE_PROMPT', prompt.reason);
  }

  const promptResolution = clonePromptResolution(resolution);
  if (promptResolution.kind === 'rejected') {
    return reject(state, 'RESOLVE_PROMPT', promptResolution.reason);
  }

  const pairValidation = validatePromptResolutionPair(prompt.prompt, promptResolution.resolution);
  if (pairValidation) {
    return reject(state, 'RESOLVE_PROMPT', pairValidation);
  }

  const resolutionResult = applyPromptResolution(state, prompt.prompt, promptResolution.resolution, effectLibrary);
  if (resolutionResult.events.some((event) => event.type === 'command-rejected')) {
    return retagRejectedResolution(resolutionResult);
  }

  const continuation = resolutionResult.newState.turnResolution;
  const pendingPrompts = resolutionResult.newState.pendingPrompts.filter((pendingPrompt) => pendingPrompt.id !== promptId);
  const stateAfterPrompt = clearTurnResolution({
    ...resolutionResult.newState,
    pendingPrompts
  });
  const events: DomainEvent[] = [
    ...resolutionResult.events,
    { type: 'prompt-resolved', promptId, resolution: promptResolution.resolution }
  ];

  if (pendingPrompts.length > 0) {
    return {
      newState: {
        ...stateAfterPrompt,
        phase: 'RESOLVING',
        ...(continuation ? { turnResolution: continuation } : {})
      },
      events
    };
  }

  if (continuation?.type === 'advanceAfterTurnEnd') {
    return advanceToNextTurn(
      {
        ...stateAfterPrompt,
        phase: 'RESOLVING',
        pendingPrompts: []
      },
      continuation.startIndex,
      events,
      effectLibrary,
      'RESOLVE_PROMPT'
    );
  }

  return {
    newState: {
      ...stateAfterPrompt,
      phase: 'ACTIVE',
      pendingPrompts: []
    },
    events: [...events, { type: 'phase-changed', from: 'RESOLVING', to: 'ACTIVE' }]
  };
}

function applyPromptResolution(
  state: EncounterState,
  prompt: Prompt,
  resolution: PromptResolution,
  effectLibrary: EffectLibrary
): CommandResult {
  if (resolution.type === 'dismiss') {
    return { newState: state, events: [] };
  }

  if (resolution.type === 'remove') {
    return removeEffect(state, prompt.targetId, prompt.effectInstanceId, effectLibrary, 'removed');
  }

  if (resolution.type === 'setValue') {
    return setEffectValue(state, prompt.targetId, prompt.effectInstanceId, resolution.value, effectLibrary);
  }

  switch (prompt.suggestionType.type) {
    case 'suggestDecrement':
      return modifyEffectValue(state, prompt.targetId, prompt.effectInstanceId, -prompt.suggestionType.amount, effectLibrary);
    case 'suggestRemove':
    case 'promptResolution':
      return removeEffect(state, prompt.targetId, prompt.effectInstanceId, effectLibrary, 'removed');
    case 'confirmSustained':
      {
        const effect = state.combatants[prompt.targetId]?.appliedEffects.find(
          (appliedEffect) => appliedEffect.instanceId === prompt.effectInstanceId
        );
        const ownerId = effect?.sourceId ?? prompt.boundary.ownerId;

        return setEffectDuration(
          state,
          prompt.targetId,
          prompt.effectInstanceId,
          { type: 'untilTurnEnd', combatantId: ownerId },
          effectLibrary
        );
      }
    default:
      return reject(state, 'RESOLVE_PROMPT', `Unsupported prompt suggestion ${JSON.stringify(prompt.suggestionType)}`);
  }
}

function clonePromptResolution(
  resolution: PromptResolution
): { kind: 'valid'; resolution: PromptResolution } | { kind: 'rejected'; reason: string } {
  const candidate = resolution as { type?: unknown; value?: unknown };

  switch (candidate.type) {
    case 'accept':
    case 'dismiss':
    case 'remove':
      return { kind: 'valid', resolution: { type: candidate.type } };
    case 'setValue':
      if (typeof candidate.value !== 'number') {
        return { kind: 'rejected', reason: 'RESOLVE_PROMPT setValue resolution requires a numeric value' };
      }

      return { kind: 'valid', resolution: { type: 'setValue', value: candidate.value } };
    default:
      return { kind: 'rejected', reason: 'RESOLVE_PROMPT resolution type is invalid' };
  }
}

function retagRejectedResolution(result: CommandResult): CommandResult {
  return {
    newState: result.newState,
    events: result.events.map((event) =>
      event.type === 'command-rejected' ? { ...event, commandType: 'RESOLVE_PROMPT' } : event
    )
  };
}

function normalizePrompt(prompt: Prompt): { kind: 'valid'; prompt: Prompt } | { kind: 'rejected'; reason: string } {
  const boundary = prompt.boundary as { type?: unknown; ownerId?: unknown };
  if ((boundary.type !== 'turnStart' && boundary.type !== 'turnEnd') || !isNonEmptyString(boundary.ownerId)) {
    return { kind: 'rejected', reason: `Prompt ${prompt.id} has an invalid boundary` };
  }

  if (!isNonEmptyString(prompt.targetId)) {
    return { kind: 'rejected', reason: `Prompt ${prompt.id} has an invalid target` };
  }

  if (!isNonEmptyString(prompt.effectInstanceId)) {
    return { kind: 'rejected', reason: `Prompt ${prompt.id} has an invalid effect instance` };
  }

  const suggestion = cloneTurnBoundarySuggestion(prompt.suggestionType);
  if (suggestion.kind === 'rejected') {
    return { kind: 'rejected', reason: `Prompt ${prompt.id} has an invalid suggestion` };
  }

  return {
    kind: 'valid',
    prompt: {
      ...prompt,
      boundary: { type: boundary.type, ownerId: boundary.ownerId },
      targetId: prompt.targetId,
      effectInstanceId: prompt.effectInstanceId,
      suggestionType: suggestion.suggestion
    }
  };
}

function validatePromptResolutionPair(prompt: Prompt, resolution: PromptResolution): string | undefined {
  const suggestionType = prompt.suggestionType.type;

  if (suggestionType === 'reminder') {
    return resolution.type === 'dismiss' ? undefined : `${resolution.type} does not match ${suggestionType}`;
  }

  if (suggestionType === 'confirmSustained') {
    return resolution.type === 'setValue' ? `${resolution.type} does not match ${suggestionType}` : undefined;
  }

  if (suggestionType === 'suggestRemove') {
    return resolution.type === 'setValue' ? `${resolution.type} does not match ${suggestionType}` : undefined;
  }

  return undefined;
}

function findEffectInstance(
  state: EncounterState,
  commandType: 'SET_EFFECT_VALUE' | 'MODIFY_EFFECT_VALUE' | 'SET_EFFECT_DURATION',
  combatantId: CombatantId,
  instanceId: string,
  effectLibrary: EffectLibrary
): EffectInstanceLookup {
  const target = state.combatants[combatantId];
  if (!target) {
    return { kind: 'rejected', result: reject(state, commandType, `Combatant ${combatantId} not found`) };
  }

  const effect = target.appliedEffects.find((appliedEffect) => appliedEffect.instanceId === instanceId);
  if (!effect) {
    return { kind: 'rejected', result: reject(state, commandType, `Effect instance ${instanceId} not found on ${combatantId}`) };
  }

  const definition = effectLibrary[effect.effectId];
  if (!definition) {
    return { kind: 'rejected', result: reject(state, commandType, `Effect ${effect.effectId} not found`) };
  }

  return { kind: 'found', target, effect, definition };
}

function replaceEffect(target: CombatantState, updatedEffect: AppliedEffect): CombatantState {
  return {
    ...target,
    appliedEffects: target.appliedEffects.map((effect) =>
      effect.instanceId === updatedEffect.instanceId ? updatedEffect : effect
    )
  };
}

function markReactionUsed(state: EncounterState, combatantId: CombatantId): CommandResult {
  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'MARK_REACTION_USED', `Combatant ${combatantId} not found`);
  }

  if (!combatant.isAlive) {
    return reject(state, 'MARK_REACTION_USED', `Combatant ${combatantId} is not alive`);
  }

  return updateCombatant(state, { ...combatant, reactionUsedThisRound: true }, [
    { type: 'reaction-used', combatantId }
  ]);
}

function resetReaction(state: EncounterState, combatantId: CombatantId): CommandResult {
  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'RESET_REACTION', `Combatant ${combatantId} not found`);
  }

  return updateCombatant(state, { ...combatant, reactionUsedThisRound: false }, [
    { type: 'reaction-reset', combatantId, cause: 'manual' }
  ]);
}

function setNote(state: EncounterState, combatantId: CombatantId, note: string | null): CommandResult {
  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'SET_NOTE', `Combatant ${combatantId} not found`);
  }

  const updatedCombatant = { ...combatant };
  if (note === null) {
    delete updatedCombatant.notes;
  } else {
    updatedCombatant.notes = note;
  }

  return updateCombatant(state, updatedCombatant, [{ type: 'note-changed', combatantId }]);
}

function markDead(state: EncounterState, combatantId: CombatantId, effectLibrary: EffectLibrary): CommandResult {
  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'MARK_DEAD', `Combatant ${combatantId} not found`);
  }

  if (!combatant.isAlive) {
    return reject(state, 'MARK_DEAD', `Combatant ${combatantId} is not alive`);
  }

  const stateWithDeadCombatant: EncounterState = {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: {
        ...combatant,
        isAlive: false
      }
    }
  };
  const events: DomainEvent[] = [{ type: 'combatant-died', combatantId, cause: 'marked-dead' }];

  if (state.phase !== 'ACTIVE' || state.initiative.order[state.initiative.currentIndex] !== combatantId) {
    return { newState: stateWithDeadCombatant, events };
  }

  const advancement = advanceTurn(stateWithDeadCombatant, combatantId, effectLibrary, 'MARK_DEAD');
  return {
    newState: advancement.newState,
    events: [...events, ...advancement.events]
  };
}

function revive(state: EncounterState, combatantId: CombatantId): CommandResult {
  const combatant = state.combatants[combatantId];
  if (!combatant) {
    return reject(state, 'REVIVE', `Combatant ${combatantId} not found`);
  }

  if (combatant.isAlive) {
    return reject(state, 'REVIVE', `Combatant ${combatantId} is already alive`);
  }

  return updateCombatant(state, { ...combatant, isAlive: true }, [{ type: 'combatant-revived', combatantId }]);
}

function updateHp(
  state: EncounterState,
  combatant: CombatantState,
  currentHp: number,
  tempHp: number,
  hpChangedEvent: Extract<DomainEvent, { type: 'hp-changed' }>
): CommandResult {
  const updatedCombatant = { ...combatant, currentHp, tempHp };
  const events: DomainEvent[] = [hpChangedEvent];

  if (combatant.currentHp > 0 && currentHp === 0) {
    events.push({ type: 'hp-reached-zero', combatantId: combatant.id });
  }

  return {
    newState: {
      ...state,
      combatants: {
        ...state.combatants,
        [combatant.id]: updatedCombatant
      }
    },
    events
  };
}

function updateCombatant(state: EncounterState, combatant: CombatantState, events: DomainEvent[]): CommandResult {
  return {
    newState: {
      ...state,
      combatants: {
        ...state.combatants,
        [combatant.id]: combatant
      }
    },
    events
  };
}

function isPositive(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegative(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nextEffectInstanceId(commandId: string, effects: AppliedEffect[]): string {
  const existing = new Set(effects.map((effect) => effect.instanceId));
  let index = effects.length + 1;
  let instanceId = `${commandId}:effect-${index}`;

  while (existing.has(instanceId)) {
    index += 1;
    instanceId = `${commandId}:effect-${index}`;
  }

  return instanceId;
}

function isValidDuration(state: EncounterState, duration: Duration): boolean {
  switch (duration.type) {
    case 'unlimited':
      return true;
    case 'rounds':
      return isPositive(duration.count);
    case 'conditional':
      return duration.description.trim().length > 0;
    case 'untilTurnEnd':
    case 'untilTurnStart':
      return Boolean(state.combatants[duration.combatantId]);
    default:
      return assertNever(duration);
  }
}

function cloneDuration(duration: Duration): Duration {
  return structuredClone(duration);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled duration variant: ${JSON.stringify(value)}`);
}
