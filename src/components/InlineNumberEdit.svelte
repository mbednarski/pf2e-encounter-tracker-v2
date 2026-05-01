<script lang="ts">
  import { tick } from 'svelte';
  import { parseHpExpression, type CommittableEdit } from '$lib/hp-input';

  export let value: number;
  export let ariaLabel: string;
  export let displayAriaLabel: string = ariaLabel;
  export let placeholder: string = '';
  export let emptyDisplay: string | undefined = undefined;
  export let displayClass: string = '';
  export let onCommit: (parsed: CommittableEdit) => void;

  let editing = false;
  let buffer = '';
  let invalid = false;
  let inputEl: HTMLInputElement | null = null;
  const hintId = `hp-edit-hint-${Math.random().toString(36).slice(2, 10)}`;

  async function startEdit() {
    buffer = String(value);
    invalid = false;
    editing = true;
    await tick();
    inputEl?.select();
  }

  function cancelEdit() {
    editing = false;
    buffer = '';
    invalid = false;
  }

  function commitEdit() {
    const parsed = parseHpExpression(buffer);
    if (parsed.kind === 'cancel') {
      cancelEdit();
      return;
    }
    if (parsed.kind === 'invalid') {
      invalid = true;
      return;
    }
    editing = false;
    buffer = '';
    invalid = false;
    onCommit(parsed);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }
</script>

{#if editing}
  <span class="inline-edit">
    <input
      bind:this={inputEl}
      bind:value={buffer}
      type="text"
      inputmode="numeric"
      autocomplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalid}
      aria-describedby={invalid ? hintId : undefined}
      class:invalid
      placeholder={placeholder}
      onkeydown={onKeydown}
      onblur={cancelEdit}
    />
    {#if invalid}
      <span id={hintId} class="hint" role="status">use 42, +3, or −5</span>
    {/if}
  </span>
{:else}
  <button
    type="button"
    class="display {displayClass}"
    aria-label={displayAriaLabel}
    onclick={startEdit}
  >
    {#if value === 0 && emptyDisplay !== undefined}
      {emptyDisplay}
    {:else}
      {value}
    {/if}
  </button>
{/if}

<style>
  .inline-edit {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  input {
    width: 5ch;
    padding: 1px 4px;
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: right;
    border: 1px solid var(--input-border, #888);
    border-radius: 3px;
    background: var(--input-bg, #fff);
    color: inherit;
  }

  input.invalid {
    border-color: #c0392b;
    outline: 2px solid rgba(192, 57, 43, 0.25);
    outline-offset: 0;
  }

  .hint {
    font-size: 0.75em;
    color: #c0392b;
    line-height: 1;
  }

  .display {
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
    text-decoration-color: rgba(0, 0, 0, 0.25);
  }

  .display:hover,
  .display:focus-visible {
    text-decoration-color: currentColor;
  }

  .display:focus-visible {
    outline: 2px solid var(--focus, #2c7be5);
    outline-offset: 2px;
    border-radius: 2px;
  }
</style>
