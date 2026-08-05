<script lang="ts">
  import type {
    AppliedEffect,
    CombatantState,
    EncounterPhase,
    Prompt,
    PromptResolution,
    TurnBoundarySuggestion
  } from '../domain';
  import { rollDiceFormula } from '$lib/dice/formula';
  import type { AppliedEffectView } from '$lib/encounter-app';
  import Button from './ui/Button.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let prompts: Prompt[];
  export let combatantsById: Record<string, CombatantState>;
  export let phase: EncounterPhase;
  export let onResolve: (promptId: string, resolution: PromptResolution) => void;
  export let onApplyPersistentDamage: (
    combatantId: string,
    amount: number,
    damageType: string
  ) => void = () => {};
  /** Effect views for this card's combatant — used to detect affliction prompts. */
  export let appliedEffectsView: AppliedEffectView[] = [];

  $: focused = phase === 'RESOLVING' && prompts.length > 0;

  interface PersistentDamageBranch {
    damageType: string;
    formula: string | null;
  }

  let setValueDrafts: Record<string, number> = {};
  let damageDrafts: Record<string, number | null> = {};

  $: persistentBranches = computePersistentBranches(prompts, combatantsById);
  $: afflictionBranches = computeAfflictionBranches(prompts, appliedEffectsView);

  interface AfflictionBranch {
    currentStage: number;
    saveLabel: string;
    outcomes: { label: string; delta: number }[];
  }

  /**
   * Structured affliction save resolution (afflictions spec §5.4): the four
   * save outcomes map to stage deltas. Recovery (stage <= 0) removes the
   * effect; a virulent "no change" success dismisses the prompt.
   */
  function computeAfflictionBranches(
    list: Prompt[],
    views: AppliedEffectView[]
  ): Record<string, AfflictionBranch> {
    const next: Record<string, AfflictionBranch> = {};
    for (const p of list) {
      if (p.suggestionType.type !== 'promptResolution') continue;
      const view = views.find((v) => v.instanceId === p.effectInstanceId);
      if (!view?.affliction) continue;
      const { deltas } = view.affliction;
      next[p.id] = {
        currentStage: view.affliction.currentStage,
        saveLabel: view.affliction.saveLabel,
        outcomes: [
          { label: 'Crit Success', delta: deltas.critSuccess },
          { label: 'Success', delta: deltas.success },
          { label: 'Failure', delta: deltas.failure },
          { label: 'Crit Failure', delta: deltas.critFailure }
        ]
      };
    }
    return next;
  }

  function outcomeHint(delta: number): string {
    if (delta === 0) return 'no change';
    return delta > 0 ? `+${delta} stage${delta === 1 ? '' : 's'}` : `${delta} stage${delta === -1 ? '' : 's'}`;
  }

  function handleAfflictionOutcome(p: Prompt, branch: AfflictionBranch, delta: number) {
    if (delta === 0) {
      onResolve(p.id, { type: 'dismiss' });
      return;
    }
    const newValue = branch.currentStage + delta;
    if (newValue <= 0) {
      onResolve(p.id, { type: 'remove' });
      return;
    }
    onResolve(p.id, { type: 'setValue', value: newValue });
  }
  $: setValueDrafts = reconcileDrafts(prompts, persistentBranches, setValueDrafts);
  $: damageDrafts = reconcileDamageDrafts(prompts, persistentBranches, damageDrafts);

  function computePersistentBranches(
    list: Prompt[],
    byId: Record<string, CombatantState>
  ): Record<string, PersistentDamageBranch> {
    const next: Record<string, PersistentDamageBranch> = {};
    for (const p of list) {
      if (p.suggestionType.type !== 'promptResolution') continue;
      const effect = byId[p.targetId]?.appliedEffects.find(
        (e) => e.instanceId === p.effectInstanceId
      );
      if (!effect || !effect.effectId.startsWith('persistent-')) continue;
      next[p.id] = {
        damageType: effect.effectId.slice('persistent-'.length),
        formula: effect.note?.trim() ? effect.note.trim() : null
      };
    }
    return next;
  }

  function reconcileDrafts(
    list: Prompt[],
    branches: Record<string, PersistentDamageBranch>,
    current: Record<string, number>
  ): Record<string, number> {
    const next: Record<string, number> = {};
    for (const p of list) {
      if (branches[p.id]) continue;
      if (!supportsSetValue(p.suggestionType)) continue;
      next[p.id] = current[p.id] ?? defaultSetValue(p);
    }
    return next;
  }

  function reconcileDamageDrafts(
    list: Prompt[],
    branches: Record<string, PersistentDamageBranch>,
    current: Record<string, number | null>
  ): Record<string, number | null> {
    const next: Record<string, number | null> = {};
    for (const p of list) {
      if (!branches[p.id]) continue;
      next[p.id] = p.id in current ? current[p.id] : null;
    }
    return next;
  }

  function defaultSetValue(p: Prompt): number {
    return p.suggestedValue ?? p.currentValue ?? 0;
  }

  function supportsSetValue(s: TurnBoundarySuggestion): boolean {
    return s.type === 'suggestDecrement' || s.type === 'promptResolution';
  }

  function showAccept(s: TurnBoundarySuggestion): boolean {
    return s.type !== 'reminder';
  }

  function showRemove(s: TurnBoundarySuggestion): boolean {
    return s.type !== 'reminder' && s.type !== 'suggestRemove';
  }

  function acceptLabel(s: TurnBoundarySuggestion): string {
    switch (s.type) {
      case 'suggestDecrement':
        return `Decrement by ${s.amount}`;
      case 'suggestRemove':
        return 'Remove (expires)';
      case 'confirmSustained':
        return 'Confirm sustained';
      case 'promptResolution':
        return 'Accept';
      default:
        return 'Accept';
    }
  }

  function boundaryLabel(p: Prompt): string {
    const owner = combatantsById[p.boundary.ownerId]?.name ?? p.boundary.ownerId;
    return p.boundary.type === 'turnEnd' ? `End of ${owner}'s turn` : `Start of ${owner}'s turn`;
  }

  function targetLabel(p: Prompt): string | null {
    if (p.targetId === p.boundary.ownerId) return null;
    return combatantsById[p.targetId]?.name ?? p.targetId;
  }

  function handleAccept(p: Prompt) {
    onResolve(p.id, { type: 'accept' });
  }

  function handleDismiss(p: Prompt) {
    onResolve(p.id, { type: 'dismiss' });
  }

  function handleRemove(p: Prompt) {
    onResolve(p.id, { type: 'remove' });
  }

  function handleSetValue(p: Prompt) {
    const value = setValueDrafts[p.id];
    if (!Number.isFinite(value)) return;
    onResolve(p.id, { type: 'setValue', value });
  }

  function handleRoll(p: Prompt, formula: string) {
    const rolled = rollDiceFormula(formula);
    if (rolled === null) return;
    damageDrafts = { ...damageDrafts, [p.id]: rolled };
  }

  function handleApplyDamage(p: Prompt, branch: PersistentDamageBranch) {
    const amount = damageDrafts[p.id];
    if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return;
    onApplyPersistentDamage(p.targetId, amount, branch.damageType);
    damageDrafts = { ...damageDrafts, [p.id]: null };
  }
</script>

{#if focused}
  <div
    class="prompt-block"
    aria-label="Awaiting resolution"
    aria-live="polite"
  >
    <SectionLabel>Awaiting resolution</SectionLabel>
    <ol class="prompt-list">
      {#each prompts as prompt (prompt.id)}
        {@const target = targetLabel(prompt)}
        <li class="prompt">
          <div class="prompt__meta">
            <span class="prompt__boundary">{boundaryLabel(prompt)}</span>
            <span class="prompt__effect">{prompt.effectName}</span>
            {#if target}
              <span class="prompt__target">on {target}</span>
            {/if}
          </div>
          <p class="prompt__description">{prompt.description}</p>
          <div class="prompt__actions">
            {#if afflictionBranches[prompt.id]}
              {@const affliction = afflictionBranches[prompt.id]}
              <span class="affliction-save" aria-label="Save outcome">
                {#each affliction.outcomes as outcome (outcome.label)}
                  <Button
                    size="sm"
                    variant={outcome.delta > 0 ? 'destructive' : 'primary'}
                    ariaLabel={`${outcome.label}: ${outcomeHint(outcome.delta)}`}
                    title={outcomeHint(outcome.delta)}
                    onclick={() => handleAfflictionOutcome(prompt, affliction, outcome.delta)}
                  >{outcome.label}</Button>
                {/each}
              </span>
              <Button
                size="sm"
                variant="secondary"
                ariaLabel="Dismiss"
                onclick={() => handleDismiss(prompt)}
              >Dismiss</Button>
              <Button
                size="sm"
                variant="destructive"
                ariaLabel="Remove effect"
                onclick={() => handleRemove(prompt)}
              >Remove effect</Button>
            {:else if persistentBranches[prompt.id]}
              {@const branch = persistentBranches[prompt.id]}
              {#if branch.formula}
                <Button
                  size="sm"
                  variant="primary"
                  ariaLabel={`Roll ${branch.formula}`}
                  onclick={() => handleRoll(prompt, branch.formula!)}
                >Roll {branch.formula}</Button>
              {/if}
              <span class="set-value">
                <label>
                  Damage
                  <input
                    type="number"
                    min="0"
                    aria-label={`Damage amount for ${prompt.effectName}`}
                    bind:value={damageDrafts[prompt.id]}
                  />
                </label>
                <span class="damage-type">{branch.damageType}</span>
                <Button
                  size="sm"
                  variant="primary"
                  ariaLabel="Apply damage"
                  onclick={() => handleApplyDamage(prompt, branch)}
                >Apply damage</Button>
              </span>
              <Button
                size="sm"
                variant="secondary"
                ariaLabel="Dismiss"
                onclick={() => handleDismiss(prompt)}
              >Dismiss</Button>
              <Button
                size="sm"
                variant="destructive"
                ariaLabel="Remove effect"
                onclick={() => handleRemove(prompt)}
              >Remove effect</Button>
            {:else}
              {#if showAccept(prompt.suggestionType)}
                <Button
                  size="sm"
                  variant="primary"
                  ariaLabel={acceptLabel(prompt.suggestionType)}
                  onclick={() => handleAccept(prompt)}
                >{acceptLabel(prompt.suggestionType)}</Button>
              {/if}
              {#if supportsSetValue(prompt.suggestionType)}
                <span class="set-value">
                  <label>
                    Set to
                    <input
                      type="number"
                      aria-label={`Set value for ${prompt.effectName}`}
                      bind:value={setValueDrafts[prompt.id]}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="secondary"
                    ariaLabel="Set"
                    onclick={() => handleSetValue(prompt)}
                  >Set</Button>
                </span>
              {/if}
              <Button
                size="sm"
                variant="secondary"
                ariaLabel="Dismiss"
                onclick={() => handleDismiss(prompt)}
              >Dismiss</Button>
              {#if showRemove(prompt.suggestionType)}
                <Button
                  size="sm"
                  variant="destructive"
                  ariaLabel="Remove effect"
                  onclick={() => handleRemove(prompt)}
                >Remove effect</Button>
              {/if}
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  </div>
{/if}

<style>
  .prompt-block {
    display: grid;
    gap: var(--space-2);
    background: var(--color-amber-soft);
    border: 1px solid var(--color-amber);
    border-left: 3px solid var(--color-amber);
    border-radius: var(--radius-card);
    padding: var(--space-2) var(--space-3);
  }

  .prompt-list {
    display: grid;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .prompt {
    background: var(--color-panel);
    border: var(--border-thin);
    padding: var(--space-2) var(--space-3);
    display: grid;
    gap: var(--space-2);
  }

  .prompt__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
  }

  .prompt__boundary {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-amber);
  }

  .prompt__effect {
    color: var(--color-ink);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .prompt__target {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .prompt__description {
    margin: 0;
    font-size: var(--text-base);
    color: var(--color-ink);
    line-height: var(--leading-snug);
  }

  .prompt__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .affliction-save {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    padding-right: var(--space-2);
    border-right: var(--border-thin);
  }

  .set-value {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .set-value label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-base);
    color: var(--color-ink);
  }

  .set-value input {
    width: 64px;
    padding: 4px var(--space-2);
    border: var(--border-thin);
    background: var(--color-panel);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-base);
  }

  .set-value input:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
    border-color: var(--color-ink);
  }

  .damage-type {
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
    text-transform: lowercase;
  }
</style>
