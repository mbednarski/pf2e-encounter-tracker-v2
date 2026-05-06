<script lang="ts">
  import type { Creature } from '../domain';
  import type { ManualCombatantInput, TemplateAdjustmentChoice } from '$lib/encounter-app';
  import BestiarySection from './BestiarySection.svelte';
  import PartySection from './PartySection.svelte';
  import SetupPanel from './SetupPanel.svelte';

  export let canStart: boolean;
  export let creatures: Creature[];
  export let onAddCreatures: (input: {
    creature: Creature;
    adjustment: TemplateAdjustmentChoice;
    quantity: number;
    namePrefix: string;
  }) => void;
  export let onAddManual: (input: Omit<ManualCombatantInput, 'id'>) => void;
  export let onImportYamlFiles: (files: File[]) => void;
  export let onRemoveCreature: (id: string) => void;
  export let onStart: () => void;
  export let onReset: () => void;

  function quickAdd(creature: Creature) {
    onAddCreatures({ creature, adjustment: 'normal', quantity: 1, namePrefix: '' });
  }
</script>

<aside class="library" aria-labelledby="library-title">
  <header class="library__header">
    <h2 id="library-title">Library</h2>
  </header>
  <PartySection />
  <BestiarySection {creatures} onAddCreature={quickAdd} {onRemoveCreature} />
  <div class="library__configure">
    <SetupPanel
      {canStart}
      {creatures}
      {onAddCreatures}
      {onAddManual}
      {onImportYamlFiles}
      {onStart}
      {onReset}
    />
  </div>
</aside>

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

  /*
   * SetupPanel still owns the configure-before-add form (template / quantity /
   * name prefix), the manual-combatant form, the YAML import flow, and the
   * Start / Reset buttons. A future slice can split those further (per-row
   * configure UI in the bestiary) and strip SetupPanel's redundant creature
   * dropdown; for now the dropdown coexists with the bestiary list above.
   */
  .library__configure {
    border-top: var(--border-thin);
    padding: var(--space-3) var(--space-4);
  }
</style>
