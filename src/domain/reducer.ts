import type {
  CombatantId,
  CombatantState,
  Command,
  CommandResult,
  CommandType,
  DomainEvent,
  EffectLibrary,
  EncounterPhase,
  EncounterState
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

export function applyCommand(state: EncounterState, command: Command, _effectLibrary: EffectLibrary): CommandResult {
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
      return startEncounter(state);
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

function startEncounter(state: EncounterState): CommandResult {
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

  return {
    newState,
    events: [
      { type: 'encounter-started' },
      { type: 'phase-changed', from: 'PREPARING', to: 'ACTIVE' },
      { type: 'turn-started', combatantId: firstCombatantId, round: 1 }
    ]
  };
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

function isPositive(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegative(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
