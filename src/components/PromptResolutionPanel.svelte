<script lang="ts">
  import type {
    CombatantState,
    EncounterPhase,
    Prompt,
    PromptResolution,
    TurnBoundarySuggestion
  } from '../domain';
  import Button from './ui/Button.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';

  export let prompts: Prompt[];
  export let combatantsById: Record<string, CombatantState>;
  export let phase: EncounterPhase;
  export let onResolve: (promptId: string, resolution: PromptResolution) => void;

  $: focused = phase === 'RESOLVING' && prompts.length > 0;

  let setValueDrafts: Record<string, number> = {};

  $: setValueDrafts = reconcileDrafts(prompts, setValueDrafts);

  function reconcileDrafts(
    list: Prompt[],
    current: Record<string, number>
  ): Record<string, number> {
    const next: Record<string, number> = {};
    for (const p of list) {
      if (!supportsSetValue(p.suggestionType)) continue;
      next[p.id] = current[p.id] ?? defaultSetValue(p);
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
</script>

{#if focused}
  <aside
    class="prompt-panel"
    aria-labelledby="prompt-resolution-title"
    aria-live="polite"
  >
    <header class="prompt-panel__header">
      <h2 id="prompt-resolution-title">Awaiting GM resolution</h2>
      <span class="prompt-panel__count">{prompts.length}</span>
    </header>
    <ol class="prompt-list">
      {#each prompts as prompt (prompt.id)}
        {@const target = targetLabel(prompt)}
        <li class="prompt">
          <div class="prompt__meta">
            <SectionLabel>{boundaryLabel(prompt)}</SectionLabel>
            <span class="prompt__effect">{prompt.effectName}</span>
            {#if target}
              <span class="prompt__target">on {target}</span>
            {/if}
          </div>
          <p class="prompt__description">{prompt.description}</p>
          <div class="prompt__actions">
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
          </div>
        </li>
      {/each}
    </ol>
  </aside>
{/if}

<style>
  .prompt-panel {
    background: #fff7ee;
    border: 1px solid var(--color-amber);
    border-left: 4px solid var(--color-amber);
    border-radius: var(--radius-card);
    padding: var(--space-3) var(--space-4);
  }

  .prompt-panel__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 600;
    line-height: var(--leading-tight);
    color: var(--color-amber);
  }

  .prompt-panel__count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-amber);
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
    border-left: 3px solid var(--color-amber);
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
</style>
