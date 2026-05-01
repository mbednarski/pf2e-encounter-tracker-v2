<script lang="ts">
  import { tick } from 'svelte';

  export let value: string;
  export let onCommit: (note: string | null) => void;
  export let placeholder: string = 'Add note…';
  export let ariaLabel: string = 'Edit note';

  let editing = false;
  let buffer = '';
  let textareaEl: HTMLTextAreaElement | null = null;

  async function startEdit() {
    buffer = value;
    editing = true;
    await tick();
    if (textareaEl) {
      textareaEl.focus();
      const end = textareaEl.value.length;
      textareaEl.setSelectionRange(end, end);
    }
  }

  function cancelEdit() {
    editing = false;
    buffer = '';
  }

  function commit() {
    if (!editing) return;
    const trimmed = buffer.trim();
    const next = trimmed === '' ? null : trimmed;
    const current = value === '' ? null : value;
    if (next !== current) {
      onCommit(next);
    }
    editing = false;
    buffer = '';
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
    }
  }
</script>

{#if editing}
  <textarea
    bind:value={buffer}
    bind:this={textareaEl}
    class="notes-edit"
    rows="3"
    aria-label={ariaLabel}
    onkeydown={onKeydown}
    onblur={commit}
  ></textarea>
  <p class="notes-hint">Ctrl+Enter to save · Esc to cancel</p>
{:else if value === ''}
  <button type="button" class="notes-display empty" onclick={startEdit}>{placeholder}</button>
{:else}
  <button type="button" class="notes-display" onclick={startEdit}>{value}</button>
{/if}

<style>
  .notes-display {
    display: block;
    width: 100%;
    margin: 0;
    padding: 6px 8px;
    border: 1px dashed transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    line-height: 1.45;
    text-align: left;
    white-space: pre-wrap;
    cursor: text;
  }

  .notes-display:hover,
  .notes-display:focus-visible {
    border-color: #b8c3be;
    background: #f3f6f1;
    outline: none;
  }

  .notes-display.empty {
    color: #8a9690;
    font-style: italic;
  }

  .notes-edit {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 6px 8px;
    border: 1px solid #2f6f8a;
    border-radius: 6px;
    background: #fbfcfa;
    color: inherit;
    font: inherit;
    font-size: 13px;
    line-height: 1.45;
    resize: vertical;
  }

  .notes-edit:focus-visible {
    outline: 2px solid var(--focus, #2c7be5);
    outline-offset: 1px;
  }

  .notes-hint {
    margin: 4px 0 0;
    color: #8a9690;
    font-size: 11px;
    line-height: 1;
  }
</style>
