<script lang="ts">
  import type { Party, PartyMember } from '../domain';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';

  export let party: Party | null;
  export let partyMembers: PartyMember[];
  export let existingIds: string[];
  export let onSave: (party: Party) => void;
  export let onClose: () => void;

  const initial = party;

  let id = initial?.id ?? '';
  let name = initial?.name ?? '';
  let level = initial?.level ?? Math.max(1, ...partyMembers.map((pm) => pm.level));
  let notes = initial?.notes ?? '';
  let selectedIds = new Set(initial?.memberIds ?? []);

  let validationError: string | null = null;

  function toggleMember(memberId: string) {
    if (selectedIds.has(memberId)) selectedIds.delete(memberId);
    else selectedIds.add(memberId);
    selectedIds = selectedIds;
  }

  function slugify(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'party'
    );
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (trimmedName === '') {
      validationError = 'Name is required.';
      return;
    }
    if (!Number.isFinite(level) || level < 1) {
      validationError = 'Level must be at least 1.';
      return;
    }
    if (selectedIds.size === 0) {
      validationError = 'Pick at least one member.';
      return;
    }
    const finalId = initial?.id ?? slugify(trimmedName);
    if (initial === null && existingIds.includes(finalId)) {
      validationError = `A party with id "${finalId}" already exists.`;
      return;
    }
    const saved: Party = {
      id: finalId,
      name: trimmedName,
      level,
      memberIds: partyMembers.filter((pm) => selectedIds.has(pm.id)).map((pm) => pm.id)
    };
    const trimmedNotes = notes.trim();
    if (trimmedNotes !== '') saved.notes = trimmedNotes;
    onSave(saved);
  }
</script>

<Modal title={initial ? `Edit ${initial.name}` : 'New Party'} titleId="party-edit-title" onClose={onClose}>
  <div class="form">
    <label class="field">
      <span class="field__label">Name</span>
      <input type="text" bind:value={name} placeholder="Extinction Curse Party" />
    </label>
    <label class="field field--level">
      <span class="field__label">Party level</span>
      <input type="number" min="1" bind:value={level} />
    </label>
    <fieldset class="members">
      <legend class="field__label">Members</legend>
      {#if partyMembers.length === 0}
        <p class="members__empty">Add party members to the library first.</p>
      {:else}
        {#each partyMembers as pm (pm.id)}
          <label class="members__row">
            <input
              type="checkbox"
              checked={selectedIds.has(pm.id)}
              onchange={() => toggleMember(pm.id)}
            />
            <span>{pm.name}</span>
            <span class="members__level">Lv {pm.level}</span>
          </label>
        {/each}
      {/if}
    </fieldset>
    <label class="field">
      <span class="field__label">Notes</span>
      <textarea rows="2" bind:value={notes}></textarea>
    </label>
    {#if validationError}
      <p class="error" role="alert">{validationError}</p>
    {/if}
  </div>
  <svelte:fragment slot="footer">
    <Button variant="secondary" onclick={onClose}>Cancel</Button>
    <Button onclick={handleSave}>{initial ? 'Save Party' : 'Create Party'}</Button>
  </svelte:fragment>
</Modal>

<style>
  .form {
    display: grid;
    gap: var(--space-3);
  }

  .field {
    display: grid;
    gap: var(--space-1);
  }

  .field--level input {
    width: 6rem;
  }

  .field__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-mute);
  }

  .members {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
  }

  .members__empty {
    margin: 0;
    font-style: italic;
    color: var(--color-ink-mute);
  }

  .members__row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-2);
    align-items: center;
  }

  .members__level {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink-mute);
  }

  .error {
    margin: 0;
    color: var(--color-red, #a33);
    font-size: var(--text-base);
  }
</style>
