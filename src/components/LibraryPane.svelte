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
  export let partyMembers: PartyMember[];
  export let hazards: Hazard[];
  export let conditionOptions: ConditionOption[];
  export let encounterCounts: Record<string, number>;
  export let onAddOneFromBestiary: (creature: Creature, adjustment: TemplateAdjustmentChoice) => void;
  export let onRemoveOneFromBestiaryCount: (creatureId: string) => void;
  export let onAddManual: (input: Omit<ManualCombatantInput, 'id'>) => void;
  export let onImportYamlFiles: (files: File[]) => void;
  export let onRemoveCreature: (id: string) => void;
  export let onAddPartyMemberToEncounter: (partyMember: PartyMember) => void;
  export let onRemovePartyMember: (id: string) => void;
  export let onSavePartyMember: (partyMember: PartyMember) => void;
  export let onImportPartyMemberYamlFiles: (files: File[]) => void;
  export let onAddHazardToEncounter: (hazard: Hazard) => void;
  export let onRemoveOneHazardFromEncounter: (hazardId: string) => void;
  export let onImportHazardYamlFiles: (files: File[]) => void;
  export let onRemoveHazard: (id: string) => void;
  export let onStart: () => void;
  export let onReset: () => void;

  let manageOpen = false;

  function openManage() {
    manageOpen = true;
  }

  function closeManage() {
    manageOpen = false;
  }
</script>

<aside class="library" aria-labelledby="library-title">
  <header class="library__header">
    <h2 id="library-title">Library</h2>
  </header>
  <BestiarySection
    {creatures}
    {encounterCounts}
    onAddToEncounter={onAddOneFromBestiary}
    onRemoveOneFromEncounter={onRemoveOneFromBestiaryCount}
    {onImportYamlFiles}
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
  <HazardsSection
    {hazards}
    {encounterCounts}
    onAddToEncounter={onAddHazardToEncounter}
    onRemoveOneFromEncounter={onRemoveOneHazardFromEncounter}
    onImportYamlFiles={onImportHazardYamlFiles}
    {onRemoveHazard}
  />
  <div class="library__configure">
    <SetupPanel {canStart} {onAddManual} {onStart} {onReset} />
  </div>
</aside>

{#if manageOpen}
  <LibraryManageModal {creatures} onRemove={onRemoveCreature} onClose={closeManage} />
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
    padding: var(--space-3) var(--space-4);
    background: var(--color-panel-2);
    border-bottom: var(--border-thin);
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
  }
</style>
