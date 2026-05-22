<script lang="ts">
  import type { Creature, Hazard } from '../domain';
  import Button from './ui/Button.svelte';
  import IconButton from './ui/IconButton.svelte';

  export let creatures: Creature[];
  export let hazards: Hazard[] = [];
  export let onRemove: (creatureId: string) => void;
  export let onRemoveHazard: (hazardId: string) => void = () => {};
  export let onClose: () => void;

  type EntryKind = 'creature' | 'hazard';
  interface LibraryEntry {
    id: string;
    name: string;
    level: number;
    traits: string[];
  }

  // `creature` and `hazard` ids share no namespace, so a pending removal must
  // track which library the id belongs to.
  let pendingRemove: { kind: EntryKind; id: string } | null = null;

  $: sections = [
    { kind: 'creature' as EntryKind, label: 'Creatures', entries: creatures as LibraryEntry[] },
    { kind: 'hazard' as EntryKind, label: 'Hazards', entries: hazards as LibraryEntry[] }
  ];
  $: isEmpty = creatures.length === 0 && hazards.length === 0;

  function startRemove(kind: EntryKind, id: string) {
    pendingRemove = { kind, id };
  }

  function cancelRemove() {
    pendingRemove = null;
  }

  function confirmRemove(kind: EntryKind, id: string) {
    pendingRemove = null;
    if (kind === 'creature') onRemove(id);
    else onRemoveHazard(id);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (pendingRemove !== null) {
        cancelRemove();
        return;
      }
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="presentation" onclick={handleBackdropClick}>
  <div class="modal" role="dialog" aria-labelledby="library-manage-title" aria-modal="true">
    <header class="modal__header">
      <h2 id="library-manage-title">Manage Library</h2>
      <IconButton ariaLabel="Close" variant="default" onclick={onClose}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </IconButton>
    </header>

    <div class="modal__body">
      {#if isEmpty}
        <p class="empty">Your library is empty. Import a YAML or Foundry JSON file to add creatures or hazards.</p>
      {:else}
        {#each sections as section (section.kind)}
          {#if section.entries.length > 0}
            <h3 class="section-label">{section.label}</h3>
            <ul class="rows">
              {#each section.entries as entry (entry.id)}
                <li class="row">
                  <span class="row__level" aria-label="Level {entry.level}">{entry.level}</span>
                  <span class="row__body">
                    <span class="row__name">{entry.name}</span>
                    {#if entry.traits.length > 0}
                      <span class="row__traits">{entry.traits.join(' · ')}</span>
                    {/if}
                  </span>
                  {#if pendingRemove?.kind === section.kind && pendingRemove.id === entry.id}
                    <span class="row__confirm">
                      <span class="row__confirm-text">Delete?</span>
                      <Button variant="ghost" size="sm" onclick={cancelRemove}>Cancel</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onclick={() => confirmRemove(section.kind, entry.id)}
                      >
                        Delete
                      </Button>
                    </span>
                  {:else}
                    <Button
                      variant="destructive"
                      size="sm"
                      onclick={() => startRemove(section.kind, entry.id)}
                      ariaLabel="Remove {entry.name} from library"
                    >
                      Remove
                    </Button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/each}
      {/if}
    </div>

    <footer class="modal__footer">
      <Button variant="primary" onclick={onClose}>Done</Button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 35%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-4);
  }

  .modal {
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    width: min(560px, 100%);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgb(29 37 40 / 25%);
  }

  .modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-thin);
  }

  .modal__header h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .modal__body {
    padding: var(--space-3) var(--space-4);
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .modal__footer {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-thin);
  }

  .empty {
    margin: 0;
    color: var(--color-ink-mute);
    font-size: var(--text-base);
    font-style: italic;
  }

  .section-label {
    margin: var(--space-3) 0 var(--space-1);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .section-label:first-child {
    margin-top: 0;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
  }

  .row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px dashed var(--color-rule);
  }

  .row:last-child {
    border-bottom: none;
  }

  .row__level {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--color-ink);
  }

  .row__body {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .row__name {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row__traits {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row__confirm {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .row__confirm-text {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--color-red);
  }
</style>
