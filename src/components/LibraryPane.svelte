<script lang="ts">
  import type { Creature, Hazard, PartyMember } from '../domain';
  import type {
    ConditionOption,
    ManualCombatantInput,
    TemplateAdjustmentChoice
  } from '$lib/encounter-app';
  import BestiarySection from './BestiarySection.svelte';
  import HazardsSection from './HazardsSection.svelte';
  import LibraryManageModal from './LibraryManageModal.svelte';
  import PartySection from './PartySection.svelte';
  import SetupPanel from './SetupPanel.svelte';

  export let canStart: boolean;
  export let creatures: Creature[];
  export let hazards: Hazard[];
  export let partyMembers: PartyMember[];
  export let conditionOptions: ConditionOption[];
  export let encounterCounts: Record<string, number>;
  export let onAddOneFromBestiary: (creature: Creature, adjustment: TemplateAdjustmentChoice) => void;
  export let onRemoveOneFromBestiaryCount: (creatureId: string) => void;
  export let onAddManual: (input: Omit<ManualCombatantInput, 'id'>) => void;
  export let onImportCreatureFiles: (files: File[]) => void;
  export let onRemoveCreature: (id: string) => void;
  export let onAddOneFromHazards: (hazard: Hazard) => void;
  export let onRemoveOneFromHazardsCount: (hazardId: string) => void;
  export let onImportHazardFiles: (files: File[]) => void;
  export let onRemoveHazard: (id: string) => void;
  export let onAddPartyMemberToEncounter: (partyMember: PartyMember) => void;
  export let onRemovePartyMember: (id: string) => void;
  export let onSavePartyMember: (partyMember: PartyMember) => void;
  export let onImportPartyMemberYamlFiles: (files: File[]) => void;
  export let onStart: () => void;
  export let onReset: () => void;
  /* Desktop icon-rail collapse. When onToggleCollapsed is omitted the
     pane is always expanded (tablet drawer renders it that way). */
  export let collapsed = false;
  export let onToggleCollapsed: (() => void) | undefined = undefined;

  let manageOpen = false;

  function openManage() {
    manageOpen = true;
  }

  function closeManage() {
    manageOpen = false;
  }
</script>

{#if collapsed}
  <aside class="library library--rail" aria-label="Library (collapsed)">
    <button
      type="button"
      class="library__expand"
      aria-label="Expand library"
      aria-expanded="false"
      onclick={() => onToggleCollapsed?.()}
    >
      <span class="library__expand-glyph" aria-hidden="true">▸</span>
      <span class="library__expand-text">Library</span>
    </button>
  </aside>
{:else}
<aside class="library" aria-labelledby="library-title">
  <header class="library__header">
    <h2 id="library-title">Library</h2>
    {#if onToggleCollapsed}
      <button
        type="button"
        class="library__collapse"
        aria-label="Collapse library"
        aria-expanded="true"
        title="Collapse library"
        onclick={() => onToggleCollapsed?.()}
      >◂</button>
    {/if}
  </header>
  <BestiarySection
    {creatures}
    {encounterCounts}
    onAddToEncounter={onAddOneFromBestiary}
    onRemoveOneFromEncounter={onRemoveOneFromBestiaryCount}
    {onImportCreatureFiles}
    onOpenManageLibrary={openManage}
  />
  <HazardsSection
    {hazards}
    {encounterCounts}
    onAddToEncounter={onAddOneFromHazards}
    onRemoveOneFromEncounter={onRemoveOneFromHazardsCount}
    {onImportHazardFiles}
    onOpenManageLibrary={openManage}
  />
  <PartySection
    {partyMembers}
    {conditionOptions}
    {onAddPartyMemberToEncounter}
    {onRemovePartyMember}
    {onSavePartyMember}
    {onImportPartyMemberYamlFiles}
  />
  <div class="library__configure">
    <SetupPanel {canStart} {onAddManual} {onStart} {onReset} />
  </div>
</aside>
{/if}

{#if manageOpen}
  <LibraryManageModal
    {creatures}
    {hazards}
    onRemove={onRemoveCreature}
    {onRemoveHazard}
    onClose={closeManage}
  />
{/if}

<style>
  .library {
    display: flex;
    flex-direction: column;
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    overflow: hidden;
    min-width: 0;
  }

  .library__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-panel-2);
    border-bottom: var(--border-thin);
  }

  .library__collapse,
  .library__expand {
    background: transparent;
    border: var(--border-thin);
    color: var(--color-ink-mute);
    font-family: var(--font-sans);
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
  }

  .library__collapse {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: var(--text-sm);
    line-height: 1;
  }

  .library__collapse:hover,
  .library__expand:hover {
    color: var(--color-ink);
    border-color: var(--color-ink);
    background: var(--color-panel);
  }

  .library__collapse:focus-visible,
  .library__expand:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  /* Collapsed rail — a slim vertical tab that restores the pane. */
  .library--rail {
    align-items: stretch;
    min-height: 180px;
  }

  .library__expand {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-1);
    background: var(--color-panel-2);
    border: 0;
  }

  .library__expand-glyph {
    font-size: var(--text-sm);
  }

  .library__expand-text {
    writing-mode: vertical-rl;
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
  }

  @media (pointer: coarse) {
    .library__collapse {
      width: 32px;
      height: 32px;
    }
  }

  h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-ink);
    line-height: var(--leading-tight);
  }

  .library__configure {
    border-top: var(--border-thin);
    padding: var(--space-3) var(--space-4);
    /* SetupPanel adapts to this pane via @container queries. */
    container-type: inline-size;
  }
</style>
