<script lang="ts">
  import type { EncounterPhase } from '../domain';
  import Button from './ui/Button.svelte';
  import DiscardEncounterButton from './DiscardEncounterButton.svelte';

  export let phase: EncounterPhase;
  export let pendingPromptCount = 0;
  export let onComplete: () => void;
  export let onPrepareRematch: () => void;
  export let onExport: () => void;
  export let onImport: () => void = () => {};
  export let canExport = true;
  export let onDiscard: () => Promise<boolean>;
  export let canUndo = false;
  export let canRedo = false;
  export let undoLabel: string | undefined = undefined;
  export let redoLabel: string | undefined = undefined;
  export let onUndo: () => void = () => {};
  export let onRedo: () => void = () => {};
</script>

<section class="encounter-header" aria-label="Encounter lifecycle">
  <div>
    <strong>{phase === 'COMPLETED' ? 'Encounter complete' : 'Encounter workspace'}</strong>
    {#if phase === 'COMPLETED'}
      <span>Review the final state, export it, prepare a rematch, or start fresh.</span>
    {:else if phase === 'RESOLVING'}
      <span>Resolve all turn prompts before completing the encounter.</span>
    {:else if phase === 'ACTIVE'}
      <span>Combat is live. Changes save automatically on this device.</span>
    {:else}
      <span>Build the initiative order, then start when at least two combatants are ready.</span>
    {/if}
  </div>

  <div class="encounter-header__actions">
    <Button
      variant="ghost"
      disabled={!canUndo}
      title={undoLabel ? `Undo ${undoLabel} (Ctrl/Cmd+Z)` : 'Nothing to undo'}
      onclick={onUndo}
    >Undo</Button>
    <Button
      variant="ghost"
      disabled={!canRedo}
      title={redoLabel ? `Redo ${redoLabel} (Ctrl/Cmd+Shift+Z)` : 'Nothing to redo'}
      onclick={onRedo}
    >Redo</Button>
    {#if phase === 'PREPARING'}
      <Button variant="secondary" onclick={onImport}>Import Encounter</Button>
      <Button variant="secondary" disabled={!canExport} onclick={onExport}>Export Encounter</Button>
    {:else if phase === 'ACTIVE'}
      <Button
        variant="secondary"
        disabled={pendingPromptCount > 0}
        title={pendingPromptCount > 0 ? 'Resolve pending prompts first' : 'Finish and review this encounter'}
        onclick={onComplete}
      >Complete Encounter</Button>
      <DiscardEncounterButton onDiscard={onDiscard} />
    {:else if phase === 'COMPLETED'}
      <Button variant="primary" onclick={onPrepareRematch}>Prepare Rematch</Button>
      <Button variant="secondary" onclick={onExport}>Export Encounter</Button>
      <DiscardEncounterButton
        label="Start New Encounter…"
        dialogTitle="Start a new encounter?"
        onDiscard={onDiscard}
      />
    {/if}
  </div>
</section>

<style>
  .encounter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--border-strong);
    background: var(--color-panel);
  }

  .encounter-header > div:first-child {
    display: grid;
    gap: var(--space-1);
  }

  strong {
    font-family: var(--font-serif);
    font-size: var(--text-md);
  }

  span {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .encounter-header__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .encounter-header {
      align-items: stretch;
      flex-direction: column;
    }

    .encounter-header__actions {
      justify-content: flex-start;
    }
  }
</style>
