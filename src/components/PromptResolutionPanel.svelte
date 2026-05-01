<script lang="ts">
  import type {
    CombatantState,
    EncounterPhase,
    Prompt,
    PromptResolution,
    TurnBoundarySuggestion
  } from '../domain';

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
    class="panel prompt-panel"
    aria-labelledby="prompt-resolution-title"
    aria-live="polite"
  >
    <div class="panel-heading">
      <h2 id="prompt-resolution-title">Awaiting GM resolution</h2>
      <span>{prompts.length}</span>
    </div>
    <ol class="prompt-list">
      {#each prompts as prompt (prompt.id)}
        {@const target = targetLabel(prompt)}
        <li class="prompt">
          <div class="meta">
            <span class="boundary">{boundaryLabel(prompt)}</span>
            <span class="effect">{prompt.effectName}</span>
            {#if target}
              <span class="target">on {target}</span>
            {/if}
          </div>
          <p class="description">{prompt.description}</p>
          <div class="actions">
            {#if showAccept(prompt.suggestionType)}
              <button type="button" class="primary" on:click={() => handleAccept(prompt)}>
                {acceptLabel(prompt.suggestionType)}
              </button>
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
                <button type="button" on:click={() => handleSetValue(prompt)}>Set</button>
              </span>
            {/if}
            <button type="button" on:click={() => handleDismiss(prompt)}>Dismiss</button>
            {#if showRemove(prompt.suggestionType)}
              <button type="button" class="danger" on:click={() => handleRemove(prompt)}>
                Remove effect
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  </aside>
{/if}

<style>
  .panel {
    border: 1px solid #b6652e;
    border-radius: 8px;
    background: #fff7ee;
    box-shadow: 0 1px 2px rgb(29 37 40 / 7%);
    padding: 14px;
    max-width: 1440px;
    margin: 0 auto 18px;
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
    color: #6f3f16;
  }

  .panel-heading > span {
    color: #6f3f16;
    font-size: 13px;
    font-weight: 600;
  }

  .prompt-list {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .prompt {
    border-left: 4px solid #b6652e;
    border-radius: 6px;
    background: #ffffff;
    padding: 10px 12px;
    display: grid;
    gap: 8px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
    color: #627171;
  }

  .meta .boundary {
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    color: #6f3f16;
  }

  .meta .effect {
    color: #1d2528;
    font-size: 14px;
    font-weight: 600;
  }

  .description {
    margin: 0;
    font-size: 13px;
    color: #1d2528;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .actions button {
    border: 1px solid #cfd6d1;
    background: #fbfcfa;
    color: #1d2528;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    cursor: pointer;
  }

  .actions button.primary {
    background: #b6652e;
    border-color: #6f3f16;
    color: #ffffff;
  }

  .actions button.danger {
    background: #fbfcfa;
    border-color: #b6652e;
    color: #6f3f16;
  }

  .actions button:hover {
    filter: brightness(0.96);
  }

  .set-value {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .set-value label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #1d2528;
  }

  .set-value input {
    width: 64px;
    padding: 4px 6px;
    border: 1px solid #cfd6d1;
    border-radius: 6px;
    font-size: 13px;
  }
</style>
