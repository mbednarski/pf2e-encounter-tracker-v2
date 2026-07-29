<script lang="ts" context="module">
  import type { CombatantFaction } from '$lib/encounter-app';

  export interface CastTargetOption {
    id: string;
    name: string;
    faction: CombatantFaction;
    isAlive: boolean;
  }
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Duration, EffectDefinition } from '../domain';
  import { durationFromSpec } from '../domain';

  export let casterId: string;
  export let casterName: string;
  export let effects: EffectDefinition[];
  export let combatants: CastTargetOption[];
  export let onCast: (effectId: string, targetIds: string[], duration: Duration) => void;
  export let onClose: () => void;

  type DurationChoice =
    | { kind: 'default' }
    | { kind: 'rounds'; count: number; label?: string }
    | { kind: 'unlimited' };

  let selectedEffectId = effects[0]?.id ?? '';
  let durationChoice: DurationChoice = { kind: 'default' };
  let customRounds = 3;
  let cardEl: HTMLDivElement | null = null;
  let returnFocusTo: HTMLElement | null = null;

  $: selectedEffect = effects.find((effect) => effect.id === selectedEffectId) ?? effects[0];

  // The caster's "side": PCs and allies buff together; enemies buff together.
  const casterFaction = combatants.find((c) => c.id === casterId)?.faction;
  const casterSide: ReadonlySet<CombatantFaction> =
    casterFaction === 'enemy' ? new Set(['enemy']) : new Set(['pc', 'ally']);

  let selectedTargets = new Set(
    combatants
      .filter((c) => c.isAlive && (c.id === casterId || casterSide.has(c.faction)))
      .map((c) => c.id)
  );

  function toggleTarget(id: string) {
    const next = new Set(selectedTargets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedTargets = next;
  }

  function selectSide(side: 'allies' | 'enemies' | 'all' | 'none') {
    if (side === 'none') {
      selectedTargets = new Set();
      return;
    }
    const wanted = combatants.filter((c) => {
      if (!c.isAlive) return false;
      if (side === 'all') return true;
      const isAllySide = c.faction === 'pc' || c.faction === 'ally';
      return side === 'allies' ? isAllySide : c.faction === 'enemy';
    });
    selectedTargets = new Set(wanted.map((c) => c.id));
  }

  function specLabel(effect: EffectDefinition | undefined): string {
    const spec = effect?.defaultDuration;
    if (!spec || spec.unit === 'unlimited') return 'unlimited';
    if (spec.unit === 'hours') return `${spec.value ?? 1} hour${(spec.value ?? 1) === 1 ? '' : 's'}`;
    if (spec.unit === 'days') return `${spec.value ?? 1} day${(spec.value ?? 1) === 1 ? '' : 's'}`;
    if (spec.unit === 'minutes') {
      const minutes = spec.value ?? 1;
      return `${minutes} minute${minutes === 1 ? '' : 's'} (${minutes * 10} rounds)`;
    }
    const rounds = spec.value ?? 1;
    return `${rounds} round${rounds === 1 ? '' : 's'}`;
  }

  // Lingering Composition upgrades a 1-round composition to 3 or 4 rounds, so
  // any short composition-style effect gets quick-pick chips for those.
  $: showLingering =
    (selectedEffect?.traits?.includes('composition') ?? false) ||
    (selectedEffect?.defaultDuration?.unit === 'rounds' &&
      (selectedEffect?.defaultDuration?.value ?? 1) === 1);

  function resolveDuration(): Duration {
    const spec = selectedEffect?.defaultDuration;
    switch (durationChoice.kind) {
      case 'default':
        return durationFromSpec(spec, casterId);
      case 'rounds':
        return {
          type: 'rounds',
          count: Math.max(1, Math.trunc(durationChoice.count)),
          anchorId: casterId,
          expiry: spec?.expiry ?? 'turnStart'
        };
      case 'unlimited':
        return { type: 'unlimited' };
    }
  }

  function isChoice(choice: DurationChoice): boolean {
    if (choice.kind !== durationChoice.kind) return false;
    if (choice.kind === 'rounds' && durationChoice.kind === 'rounds') {
      return choice.label === durationChoice.label;
    }
    return true;
  }

  function cast() {
    if (!selectedEffect || selectedTargets.size === 0) return;
    const orderedTargets = combatants
      .filter((c) => selectedTargets.has(c.id))
      .map((c) => c.id);
    onCast(selectedEffect.id, orderedTargets, resolveDuration());
    onClose();
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  const FACTION_GROUPS: Array<{ label: string; factions: CombatantFaction[] }> = [
    { label: 'Party & allies', factions: ['pc', 'ally'] },
    { label: 'Enemies', factions: ['enemy'] },
    { label: 'Hazards', factions: ['hazard'] }
  ];

  $: targetGroups = FACTION_GROUPS.map((group) => ({
    label: group.label,
    members: combatants.filter((c) => group.factions.includes(c.faction))
  })).filter((group) => group.members.length > 0);

  onMount(() => {
    returnFocusTo = (document.activeElement as HTMLElement) ?? null;
    void tick().then(() => cardEl?.focus());
    return () => {
      returnFocusTo?.focus?.();
    };
  });
</script>

<div class="modal-host">
  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close cast effect dialog"
    onclick={onClose}
    tabindex="-1"
  ></button>
  <div
    bind:this={cardEl}
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-label={`Apply ${selectedEffect?.name ?? 'spell effect'} from ${casterName}`}
    tabindex="-1"
    onkeydown={handleKey}
  >
    <header class="modal-header">
      <div>
        <h2>{selectedEffect?.name ?? 'Spell effect'}</h2>
        <p class="sub">cast by {casterName}</p>
      </div>
      <button type="button" class="close" aria-label="Close" onclick={onClose}>×</button>
    </header>

    <div class="body">
      {#if effects.length > 1}
        <section class="section">
          <h3 class="section-label">Effect</h3>
          <div class="chip-row" role="radiogroup" aria-label="Choose effect variant">
            {#each effects as effect (effect.id)}
              <button
                type="button"
                class="chip"
                class:chip-active={effect.id === selectedEffect?.id}
                role="radio"
                aria-checked={effect.id === selectedEffect?.id}
                onclick={() => (selectedEffectId = effect.id)}
              >
                {effect.name}
              </button>
            {/each}
          </div>
        </section>
      {/if}

      {#if selectedEffect?.description}
        <p class="description">{selectedEffect.description}</p>
      {/if}

      <section class="section" aria-label="Targets">
        <div class="section-head">
          <h3 class="section-label">Targets ({selectedTargets.size})</h3>
          <div class="quick-row">
            <button type="button" class="quick" onclick={() => selectSide('allies')}>Party & allies</button>
            <button type="button" class="quick" onclick={() => selectSide('enemies')}>Enemies</button>
            <button type="button" class="quick" onclick={() => selectSide('all')}>Everyone</button>
            <button type="button" class="quick" onclick={() => selectSide('none')}>None</button>
          </div>
        </div>
        {#each targetGroups as group (group.label)}
          <h4 class="group-label">{group.label}</h4>
          <ul class="target-list">
            {#each group.members as target (target.id)}
              <li>
                <label class="target" class:target--down={!target.isAlive}>
                  <input
                    type="checkbox"
                    checked={selectedTargets.has(target.id)}
                    onchange={() => toggleTarget(target.id)}
                  />
                  <span>{target.name}</span>
                  {#if target.id === casterId}<span class="caster-tag">caster</span>{/if}
                  {#if !target.isAlive}<span class="down-tag">down</span>{/if}
                </label>
              </li>
            {/each}
          </ul>
        {/each}
      </section>

      <section class="section" aria-label="Duration">
        <h3 class="section-label">Duration</h3>
        <div class="chip-row" role="radiogroup" aria-label="Choose duration">
          <button
            type="button"
            class="chip"
            class:chip-active={isChoice({ kind: 'default' })}
            role="radio"
            aria-checked={isChoice({ kind: 'default' })}
            onclick={() => (durationChoice = { kind: 'default' })}
          >
            Default — {specLabel(selectedEffect)}
          </button>
          {#if showLingering}
            <button
              type="button"
              class="chip"
              class:chip-active={isChoice({ kind: 'rounds', count: 3, label: 'lingering-3' })}
              role="radio"
              aria-checked={isChoice({ kind: 'rounds', count: 3, label: 'lingering-3' })}
              onclick={() => (durationChoice = { kind: 'rounds', count: 3, label: 'lingering-3' })}
            >
              Lingering (success) — 3 rounds
            </button>
            <button
              type="button"
              class="chip"
              class:chip-active={isChoice({ kind: 'rounds', count: 4, label: 'lingering-4' })}
              role="radio"
              aria-checked={isChoice({ kind: 'rounds', count: 4, label: 'lingering-4' })}
              onclick={() => (durationChoice = { kind: 'rounds', count: 4, label: 'lingering-4' })}
            >
              Lingering (crit) — 4 rounds
            </button>
          {/if}
          <button
            type="button"
            class="chip"
            class:chip-active={isChoice({ kind: 'rounds', count: customRounds, label: 'custom' })}
            role="radio"
            aria-checked={isChoice({ kind: 'rounds', count: customRounds, label: 'custom' })}
            onclick={() => (durationChoice = { kind: 'rounds', count: customRounds, label: 'custom' })}
          >
            Custom rounds
          </button>
          <button
            type="button"
            class="chip"
            class:chip-active={isChoice({ kind: 'unlimited' })}
            role="radio"
            aria-checked={isChoice({ kind: 'unlimited' })}
            onclick={() => (durationChoice = { kind: 'unlimited' })}
          >
            Unlimited
          </button>
        </div>
        {#if durationChoice.kind === 'rounds' && durationChoice.label === 'custom'}
          <label class="custom-rounds">
            Rounds
            <input
              type="number"
              min="1"
              bind:value={customRounds}
              oninput={() => (durationChoice = { kind: 'rounds', count: customRounds, label: 'custom' })}
              aria-label="Custom round count"
            />
          </label>
        {/if}
        {#if selectedEffect?.defaultDuration?.sustained}
          <p class="sustained-note">Sustained — remind {casterName} to Sustain each turn.</p>
        {/if}
        <p class="tick-note">Timed durations count down at the start of {casterName}'s turn.</p>
      </section>
    </div>

    <footer class="actions">
      <button type="button" class="ghost" onclick={onClose}>Cancel</button>
      <button
        type="button"
        class="primary"
        disabled={selectedTargets.size === 0}
        onclick={cast}
      >
        Apply to {selectedTargets.size} {selectedTargets.size === 1 ? 'target' : 'targets'}
      </button>
    </footer>
  </div>
</div>

<style>
  .modal-host {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-ink) 42%, transparent);
    border: 0;
    padding: 0;
    cursor: default;
    pointer-events: auto;
  }

  .modal-card {
    position: relative;
    pointer-events: auto;
    width: min(560px, 92vw);
    max-height: min(84vh, 680px);
    background: var(--color-bg);
    color: var(--color-ink);
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-paper);
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-rule);
  }

  .modal-header h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 700;
  }

  .sub {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--color-ink-mute);
  }

  .close {
    background: transparent;
    border: 0;
    color: var(--color-ink-soft);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
  }

  .body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .description {
    margin: 0;
    font-size: 12px;
    color: var(--color-ink-soft);
    white-space: pre-line;
    max-height: 5.5em;
    overflow-y: auto;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .section-label {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .group-label {
    margin: var(--space-1) 0 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-ink-mute);
  }

  .quick-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .quick {
    background: transparent;
    border: 0;
    color: var(--color-amber);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
    padding: 0 2px;
  }

  .target-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 2px;
  }

  .target {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  .target:hover {
    background: var(--color-panel);
  }

  .target--down {
    color: var(--color-ink-mute);
  }

  .caster-tag,
  .down-tag {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-mute);
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    padding: 0 6px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    background: var(--color-bg);
    border: 1px solid var(--color-rule-strong);
    border-radius: 999px;
    padding: 4px 12px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    color: var(--color-ink);
  }

  .chip:hover,
  .chip:focus-visible {
    background: var(--color-panel);
  }

  .chip-active {
    background: var(--color-ink);
    color: var(--color-bg);
    border-color: var(--color-ink);
  }

  .custom-rounds {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 12px;
    color: var(--color-ink-mute);
  }

  .custom-rounds input {
    width: 6ch;
    padding: 2px 6px;
    font: inherit;
    text-align: right;
    border: 1px solid var(--color-rule-strong);
    border-radius: 3px;
    background: var(--color-bg);
    color: inherit;
  }

  .sustained-note {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-amber);
  }

  .tick-note {
    margin: 0;
    font-size: 11px;
    color: var(--color-ink-mute);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-rule);
  }

  .primary {
    background: var(--color-ink);
    color: var(--color-bg);
    border: 0;
    border-radius: 4px;
    padding: 6px 14px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ghost {
    background: transparent;
    color: var(--color-ink-mute);
    border: 0;
    border-radius: 4px;
    padding: 6px 10px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
</style>
