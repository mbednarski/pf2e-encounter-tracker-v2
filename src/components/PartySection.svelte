<script lang="ts">
  import type { PartyMember } from '../domain';
  import type { ConditionOption } from '$lib/encounter-app';
  import IconButton from './ui/IconButton.svelte';
  import Input from './ui/Input.svelte';
  import SectionLabel from './ui/SectionLabel.svelte';
  import Button from './ui/Button.svelte';
  import PartyMemberEditModal from './PartyMemberEditModal.svelte';

  export let partyMembers: PartyMember[];
  export let conditionOptions: ConditionOption[];
  export let onAddPartyMemberToEncounter: (partyMember: PartyMember) => void;
  export let onRemovePartyMember: (id: string) => void;
  export let onSavePartyMember: (partyMember: PartyMember) => void;
  export let onImportPartyMemberYamlFiles: (files: File[]) => void;

  let query = '';
  let editingMember: PartyMember | null = null;
  let isCreatingNew = false;
  let fileInput: HTMLInputElement | undefined;

  $: needle = query.trim().toLowerCase();
  $: filtered = needle
    ? partyMembers.filter((pm) => {
        if (pm.name.toLowerCase().includes(needle)) return true;
        if (pm.playerName?.toLowerCase().includes(needle)) return true;
        if (pm.class?.toLowerCase().includes(needle)) return true;
        return pm.tags.some((t) => t.toLowerCase().includes(needle));
      })
    : partyMembers;

  $: existingIds = partyMembers.map((pm) => pm.id);
  $: modalOpen = isCreatingNew || editingMember !== null;

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

<section class="party" aria-labelledby="party-label">
  <header class="party__header">
    <SectionLabel as="h3" id="party-label">Party</SectionLabel>
    <span class="count">{partyMembers.length}</span>
  </header>

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

  {#if partyMembers.length > 0}
    <div class="party__search">
      <Input
        ariaLabel="Search party"
        type="search"
        placeholder="Search…"
        bind:value={query}
      >
        <span slot="leading" aria-hidden="true">⌕</span>
      </Input>
    </div>
  {/if}

  {#if partyMembers.length === 0}
    <p class="empty">Click <strong>New</strong> or <strong>Import YAML</strong> to add party members.</p>
  {:else if filtered.length === 0}
    <p class="empty">No matching party members.</p>
  {:else}
    <ul class="rows">
      {#each filtered as pm (pm.id)}
        <li class="row">
          <span class="row__level" aria-label="Level {pm.level}">{pm.level}</span>
          <span class="row__body">
            <span class="row__name">{pm.name}</span>
            <span class="row__sub">{memberSubtext(pm)}</span>
          </span>
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
          <IconButton
            ariaLabel="Add {pm.name} to encounter"
            title="Add to encounter"
            variant="primary"
            size={26}
            onclick={() => onAddPartyMemberToEncounter(pm)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M7 2v10M2 7h10" />
            </svg>
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
</section>

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
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-thin);
  }

  .party__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink-mute);
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
    grid-template-columns: 32px 1fr auto auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px dashed var(--color-rule);
  }

  .row:last-child {
    border-bottom: none;
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
