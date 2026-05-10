<script lang="ts">
  import { onMount } from 'svelte';
  import type { PartyMember } from '../domain';
  import type { ConditionOption } from '$lib/encounter-app';
  import IconButton from './ui/IconButton.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';
  import Button from './ui/Button.svelte';
  import PartyMemberEditModal from './PartyMemberEditModal.svelte';

  export let partyMembers: PartyMember[];
  export let conditionOptions: ConditionOption[];
  export let onAddPartyMemberToEncounter: (partyMember: PartyMember) => void;
  export let onRemovePartyMember: (id: string) => void;
  export let onSavePartyMember: (partyMember: PartyMember) => void;
  export let onImportPartyMemberYamlFiles: (files: File[]) => void;

  const COLLAPSE_KEY = 'pf2e:partyCollapsed';

  let editingMember: PartyMember | null = null;
  let isCreatingNew = false;
  let fileInput: HTMLInputElement | undefined;
  let collapsed = false;

  $: existingIds = partyMembers.map((pm) => pm.id);
  $: modalOpen = isCreatingNew || editingMember !== null;

  onMount(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      collapsed = stored === '1';
    } catch {
      // localStorage unavailable (private mode, blocked) — fall back to default open.
    }
  });

  function handleToggle(event: Event) {
    const open = (event.currentTarget as HTMLDetailsElement).open;
    collapsed = !open;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Persistence is best-effort; the section still works without it.
    }
  }

  function openNew() {
    editingMember = null;
    isCreatingNew = true;
  }

  function openEdit(pm: PartyMember) {
    isCreatingNew = false;
    editingMember = pm;
  }

  function closeModal() {
    editingMember = null;
    isCreatingNew = false;
  }

  function handleSave(member: PartyMember) {
    onSavePartyMember(member);
    closeModal();
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onImportPartyMemberYamlFiles(files);
    }
    input.value = '';
  }

  function memberSubtext(pm: PartyMember): string {
    if (pm.playerName && pm.class) return `${pm.playerName} · ${pm.class}`;
    return pm.playerName ?? pm.class ?? pm.ancestry ?? '';
  }
</script>

<details class="party" open={!collapsed} ontoggle={handleToggle}>
  <summary class="party__summary">
    <span class="party__heading">
      <span class="party__chevron" aria-hidden="true">▾</span>
      <SectionLabel as="span">Party</SectionLabel>
      <span class="count">{partyMembers.length}</span>
    </span>
  </summary>

  <div class="party__body">
    <div class="party__actions">
      <Button variant="secondary" size="sm" onclick={openNew}>New</Button>
      <Button variant="secondary" size="sm" onclick={() => fileInput?.click()}>Import YAML…</Button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".yaml,.yml,application/yaml,text/yaml"
        multiple
        hidden
        onchange={handleFileChange}
      />
    </div>

    {#if partyMembers.length === 0}
      <p class="empty">Click <strong>New</strong> or <strong>Import YAML</strong> to add party members.</p>
    {:else}
      <ul class="rows">
        {#each partyMembers as pm (pm.id)}
          <li class="row">
            <button
              type="button"
              class="row__add"
              aria-label="Add {pm.name} to encounter"
              title="Add to encounter"
              onclick={() => onAddPartyMemberToEncounter(pm)}
            >
              <span class="row__level" aria-label="Level {pm.level}">{pm.level}</span>
              <span class="row__body">
                <span class="row__name">{pm.name}</span>
                <span class="row__sub">{memberSubtext(pm)}</span>
              </span>
            </button>
            <span class="row__actions">
              <IconButton
                ariaLabel="Edit {pm.name}"
                title="Edit"
                variant="default"
                size={22}
                onclick={() => openEdit(pm)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 10l1-3 5-5 2 2-5 5-3 1z" />
                </svg>
              </IconButton>
              <span class="row__remove">
                <IconButton
                  ariaLabel="Remove {pm.name} from library"
                  title="Remove from library"
                  variant="destructive"
                  size={22}
                  onclick={() => onRemovePartyMember(pm.id)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                    <path d="M2 6h8" />
                  </svg>
                </IconButton>
              </span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</details>

{#if modalOpen}
  <PartyMemberEditModal
    partyMember={editingMember}
    {conditionOptions}
    {existingIds}
    onSave={handleSave}
    onClose={closeModal}
  />
{/if}

<style>
  .party {
    display: block;
    padding: 0;
    border-bottom: var(--border-thin);
  }

  .party__summary {
    list-style: none;
    cursor: pointer;
    padding: var(--space-3) var(--space-4);
    user-select: none;
  }

  .party__summary::-webkit-details-marker {
    display: none;
  }

  .party__heading {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .party__chevron {
    display: inline-block;
    color: var(--color-ink-mute);
    transition: transform 0.12s;
  }

  .party:not([open]) .party__chevron {
    transform: rotate(-90deg);
  }

  .count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink-mute);
  }

  .party__body {
    display: grid;
    gap: var(--space-2);
    padding: 0 var(--space-4) var(--space-3);
  }

  .party__actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .empty {
    margin: var(--space-2) 0 0;
    color: var(--color-ink-mute);
    font-size: var(--text-base);
    font-style: italic;
  }

  .empty strong {
    font-style: normal;
    color: var(--color-ink);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    max-height: 320px;
    overflow: auto;
    border-top: var(--border-thin);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    align-items: center;
    padding: 0;
    border-bottom: 1px dashed var(--color-rule);
  }

  .row:last-child {
    border-bottom: none;
  }

  .row__add {
    all: unset;
    cursor: pointer;
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) var(--space-2);
    min-width: 0;
    transition: background 0.08s;
  }

  .row__add:hover {
    background: var(--color-panel-2);
  }

  .row__add:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: -2px;
  }

  .row__actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding-right: var(--space-2);
  }

  .row__remove {
    opacity: 0;
    transition: opacity 0.12s;
  }

  .row:hover .row__remove,
  .row:focus-within .row__remove {
    opacity: 1;
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

  .row__sub {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-ink-mute);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
