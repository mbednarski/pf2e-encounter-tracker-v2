<script lang="ts">
  import type { AppliedEffect, PartyMember } from '../domain';
  import type { ConditionOption } from '$lib/encounter-app';
  import Button from './ui/Button.svelte';
  import IconButton from './ui/IconButton.svelte';

  export let partyMember: PartyMember | null;
  export let conditionOptions: ConditionOption[];
  export let existingIds: string[];
  export let onSave: (member: PartyMember) => void;
  export let onClose: () => void;

  type SpeedRow = { key: string; value: number };
  type SkillRow = { key: string; value: number };
  type DamageRow = { type: string; value: number };
  type EffectRow = AppliedEffect;

  const initial = partyMember;

  let id = initial?.id ?? '';
  let name = initial?.name ?? '';
  let playerName = initial?.playerName ?? '';
  let level = initial?.level ?? 1;
  let ancestry = initial?.ancestry ?? '';
  let className = initial?.class ?? '';

  let ac = initial?.ac ?? 16;
  let fortitude = initial?.fortitude ?? 5;
  let reflex = initial?.reflex ?? 5;
  let will = initial?.will ?? 5;
  let perception = initial?.perception ?? 5;
  let hp = initial?.hp ?? 20;

  let speedRows: SpeedRow[] = recordToRows(initial?.speed);
  let skillRows: SkillRow[] = recordToRows(initial?.skills);
  let resistanceRows: DamageRow[] = (initial?.resistances ?? []).map((r) => ({ ...r }));
  let weaknessRows: DamageRow[] = (initial?.weaknesses ?? []).map((w) => ({ ...w }));
  let immunitiesText = (initial?.immunities ?? []).join(', ');
  let tagsText = (initial?.tags ?? []).join(', ');
  let notes = initial?.notes ?? '';

  let effectRows: EffectRow[] = (initial?.persistentEffects ?? []).map((e) => structuredClone(e));
  let effectToAdd = conditionOptions[0]?.id ?? '';
  let effectValueToAdd = 1;

  let validationError: string | null = null;

  function recordToRows(record: Record<string, number> | undefined): { key: string; value: number }[] {
    if (!record) return [];
    return Object.entries(record).map(([key, value]) => ({ key, value }));
  }

  function rowsToRecord(rows: { key: string; value: number }[]): Record<string, number> | undefined {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const k = row.key.trim();
      if (k && Number.isFinite(row.value)) out[k] = row.value;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }

  function parseList(text: string): string[] {
    return text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function generateId(): string {
    const base = slugify(name) || 'party-member';
    if (!existingIds.includes(base)) return base;
    let i = 2;
    while (existingIds.includes(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  function generateInstanceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `pm-effect-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }

  function selectedConditionOption(): ConditionOption | undefined {
    return conditionOptions.find((c) => c.id === effectToAdd);
  }

  function addEffect() {
    const option = selectedConditionOption();
    if (!option) return;
    const row: EffectRow = {
      instanceId: generateInstanceId(),
      effectId: option.id,
      duration: { type: 'unlimited' }
    };
    if (option.value.kind === 'valued') {
      row.value = Math.max(1, Math.trunc(effectValueToAdd) || 1);
    }
    effectRows = [...effectRows, row];
  }

  function removeEffect(instanceId: string) {
    effectRows = effectRows.filter((e) => e.instanceId !== instanceId);
  }

  function effectName(effectId: string): string {
    return conditionOptions.find((c) => c.id === effectId)?.name ?? effectId;
  }

  function addSpeedRow() {
    speedRows = [...speedRows, { key: '', value: 0 }];
  }
  function removeSpeedRow(index: number) {
    speedRows = speedRows.filter((_, i) => i !== index);
  }
  function addSkillRow() {
    skillRows = [...skillRows, { key: '', value: 0 }];
  }
  function removeSkillRow(index: number) {
    skillRows = skillRows.filter((_, i) => i !== index);
  }
  function addResistanceRow() {
    resistanceRows = [...resistanceRows, { type: '', value: 0 }];
  }
  function removeResistanceRow(index: number) {
    resistanceRows = resistanceRows.filter((_, i) => i !== index);
  }
  function addWeaknessRow() {
    weaknessRows = [...weaknessRows, { type: '', value: 0 }];
  }
  function removeWeaknessRow(index: number) {
    weaknessRows = weaknessRows.filter((_, i) => i !== index);
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    validationError = null;

    const trimmedName = name.trim();
    if (!trimmedName) {
      validationError = 'Name is required.';
      return;
    }
    if (!Number.isFinite(level) || level < 1) {
      validationError = 'Level must be at least 1.';
      return;
    }
    for (const [label, val] of Object.entries({ ac, fortitude, reflex, will, perception, hp })) {
      if (!Number.isFinite(val) || val < 0) {
        validationError = `${label.toUpperCase()} must be a non-negative number.`;
        return;
      }
    }

    const finalId = id || generateId();
    const member: PartyMember = {
      id: finalId,
      name: trimmedName,
      level: Math.trunc(level),
      ac: Math.trunc(ac),
      fortitude: Math.trunc(fortitude),
      reflex: Math.trunc(reflex),
      will: Math.trunc(will),
      perception: Math.trunc(perception),
      hp: Math.trunc(hp),
      persistentEffects: effectRows.map((e) => structuredClone(e)),
      companionIds: initial?.companionIds ?? [],
      tags: parseList(tagsText)
    };

    const trimmedPlayerName = playerName.trim();
    if (trimmedPlayerName) member.playerName = trimmedPlayerName;
    const trimmedAncestry = ancestry.trim();
    if (trimmedAncestry) member.ancestry = trimmedAncestry;
    const trimmedClass = className.trim();
    if (trimmedClass) member.class = trimmedClass;
    const trimmedNotes = notes.trim();
    if (trimmedNotes) member.notes = trimmedNotes;

    const speed = rowsToRecord(speedRows);
    if (speed) member.speed = speed;
    const skills = rowsToRecord(skillRows);
    if (skills) member.skills = skills;
    if (resistanceRows.length > 0) {
      member.resistances = resistanceRows
        .filter((r) => r.type.trim())
        .map((r) => ({ type: r.type.trim(), value: Math.trunc(r.value) }));
      if (member.resistances.length === 0) delete member.resistances;
    }
    if (weaknessRows.length > 0) {
      member.weaknesses = weaknessRows
        .filter((w) => w.type.trim())
        .map((w) => ({ type: w.type.trim(), value: Math.trunc(w.value) }));
      if (member.weaknesses.length === 0) delete member.weaknesses;
    }
    const immunitiesList = parseList(immunitiesText);
    if (immunitiesList.length > 0) member.immunities = immunitiesList;

    onSave(member);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }

  $: selectedOption = selectedConditionOption();
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="backdrop"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="modal"
    role="dialog"
    aria-labelledby="party-member-modal-title"
    aria-modal="true"
  >
  <form class="modal__form" onsubmit={handleSubmit}>
    <header class="modal__header">
      <h2 id="party-member-modal-title">{initial ? 'Edit Party Member' : 'New Party Member'}</h2>
      <IconButton ariaLabel="Close" variant="default" onclick={onClose}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </IconButton>
    </header>

    <div class="modal__body">
      <fieldset class="block">
        <legend>Identity</legend>
        <label>Name<input bind:value={name} autocomplete="off" required /></label>
        <label>Player<input bind:value={playerName} autocomplete="off" /></label>
        <div class="row-3">
          <label>Level<input type="number" min="1" bind:value={level} /></label>
          <label>Ancestry<input bind:value={ancestry} autocomplete="off" /></label>
          <label>Class<input bind:value={className} autocomplete="off" /></label>
        </div>
      </fieldset>

      <fieldset class="block">
        <legend>Defenses</legend>
        <div class="stat-grid">
          <label>AC<input type="number" min="0" bind:value={ac} /></label>
          <label>Fort<input type="number" min="0" bind:value={fortitude} /></label>
          <label>Ref<input type="number" min="0" bind:value={reflex} /></label>
          <label>Will<input type="number" min="0" bind:value={will} /></label>
          <label>Per<input type="number" min="0" bind:value={perception} /></label>
          <label>Max HP<input type="number" min="0" bind:value={hp} /></label>
        </div>
      </fieldset>

      <fieldset class="block">
        <legend>Speed</legend>
        {#each speedRows as row, i (i)}
          <div class="kv-row">
            <input bind:value={row.key} placeholder="land" autocomplete="off" />
            <input type="number" bind:value={row.value} placeholder="30" />
            <IconButton ariaLabel="Remove speed entry" variant="destructive" onclick={() => removeSpeedRow(i)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M2 6h8" />
              </svg>
            </IconButton>
          </div>
        {/each}
        <Button variant="ghost" size="sm" onclick={addSpeedRow}>+ Speed</Button>
      </fieldset>

      <fieldset class="block">
        <legend>Skills</legend>
        {#each skillRows as row, i (i)}
          <div class="kv-row">
            <input bind:value={row.key} placeholder="arcana" autocomplete="off" />
            <input type="number" bind:value={row.value} placeholder="14" />
            <IconButton ariaLabel="Remove skill entry" variant="destructive" onclick={() => removeSkillRow(i)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M2 6h8" />
              </svg>
            </IconButton>
          </div>
        {/each}
        <Button variant="ghost" size="sm" onclick={addSkillRow}>+ Skill</Button>
      </fieldset>

      <fieldset class="block">
        <legend>Resistances</legend>
        {#each resistanceRows as row, i (i)}
          <div class="kv-row">
            <input bind:value={row.type} placeholder="cold" autocomplete="off" />
            <input type="number" bind:value={row.value} placeholder="2" />
            <IconButton ariaLabel="Remove resistance" variant="destructive" onclick={() => removeResistanceRow(i)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M2 6h8" />
              </svg>
            </IconButton>
          </div>
        {/each}
        <Button variant="ghost" size="sm" onclick={addResistanceRow}>+ Resistance</Button>
      </fieldset>

      <fieldset class="block">
        <legend>Weaknesses</legend>
        {#each weaknessRows as row, i (i)}
          <div class="kv-row">
            <input bind:value={row.type} placeholder="fire" autocomplete="off" />
            <input type="number" bind:value={row.value} placeholder="5" />
            <IconButton ariaLabel="Remove weakness" variant="destructive" onclick={() => removeWeaknessRow(i)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M2 6h8" />
              </svg>
            </IconButton>
          </div>
        {/each}
        <Button variant="ghost" size="sm" onclick={addWeaknessRow}>+ Weakness</Button>
      </fieldset>

      <fieldset class="block">
        <legend>Immunities</legend>
        <input bind:value={immunitiesText} placeholder="sleep, poison" autocomplete="off" />
      </fieldset>

      <fieldset class="block">
        <legend>Tags</legend>
        <input bind:value={tagsText} placeholder="party-leader, arcane" autocomplete="off" />
      </fieldset>

      <fieldset class="block">
        <legend>Persistent Effects</legend>
        <p class="hint">Effects that carry between encounters (e.g. Wounded 1, Doomed 2). Applied to the combatant when this member joins an encounter.</p>
        {#if effectRows.length > 0}
          <ul class="effect-list">
            {#each effectRows as effect (effect.instanceId)}
              <li class="effect-row">
                <span class="effect-name">{effectName(effect.effectId)}</span>
                {#if effect.value !== undefined}
                  <span class="effect-value">{effect.value}</span>
                {/if}
                <IconButton ariaLabel="Remove {effectName(effect.effectId)}" variant="destructive" onclick={() => removeEffect(effect.instanceId)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                    <path d="M2 6h8" />
                  </svg>
                </IconButton>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">No persistent effects.</p>
        {/if}
        <div class="add-effect">
          <select bind:value={effectToAdd} aria-label="Select condition">
            {#each conditionOptions as option (option.id)}
              <option value={option.id}>{option.name}</option>
            {/each}
          </select>
          {#if selectedOption?.value.kind === 'valued'}
            <input type="number" min="1" max={selectedOption.value.maxValue ?? 999} bind:value={effectValueToAdd} aria-label="Effect value" />
          {/if}
          <Button variant="secondary" size="sm" onclick={addEffect}>Add Effect</Button>
        </div>
      </fieldset>

      <fieldset class="block">
        <legend>Notes</legend>
        <textarea rows="3" bind:value={notes}></textarea>
      </fieldset>
    </div>

    {#if validationError}
      <p class="error" role="alert">{validationError}</p>
    {/if}

    <footer class="modal__footer">
      <Button variant="ghost" onclick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit">Save</Button>
    </footer>
  </form>
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
    width: min(640px, 100%);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgb(29 37 40 / 25%);
  }

  .modal__form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
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
    display: grid;
    gap: var(--space-3);
  }

  .modal__footer {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-thin);
  }

  .block {
    border: var(--border-thin);
    border-radius: var(--radius-card);
    padding: var(--space-2) var(--space-3);
    display: grid;
    gap: var(--space-2);
    margin: 0;
  }

  .block legend {
    padding: 0 var(--space-2);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-ink-mute);
  }

  .block label {
    display: grid;
    gap: 2px;
    font-size: var(--text-xs);
    color: var(--color-ink-mute);
  }

  .block input,
  .block textarea,
  .block select {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--color-ink);
    background: var(--color-panel);
    border: var(--border-thin);
    border-radius: var(--radius-card);
    padding: 4px 8px;
  }

  .block input:focus,
  .block textarea:focus,
  .block select:focus {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .row-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .kv-row {
    display: grid;
    grid-template-columns: 1fr 80px auto;
    gap: var(--space-2);
    align-items: center;
  }

  .effect-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .effect-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2);
    background: var(--color-panel-2);
    border-radius: var(--radius-card);
  }

  .effect-name {
    font-weight: 600;
  }

  .effect-value {
    font-family: var(--font-mono);
    color: var(--color-ink-mute);
  }

  .add-effect {
    display: grid;
    grid-template-columns: 1fr 80px auto;
    gap: var(--space-2);
    align-items: center;
  }

  .add-effect:has(select:only-of-type:not(+ input)) {
    grid-template-columns: 1fr auto;
  }

  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-ink-mute);
  }

  .empty {
    margin: 0;
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .error {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    color: var(--color-red);
    font-size: var(--text-sm);
  }
</style>
