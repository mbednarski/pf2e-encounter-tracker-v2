<script lang="ts">
  import { onMount } from 'svelte';
  import { clearApiKey, loadApiKey, saveApiKey } from '$lib/storage/settings';

  let keyPresent = false;
  let draft = '';
  let showKey = false;
  let feedback = '';

  onMount(async () => {
    // Compute presence only; never bind the stored value into reactive state.
    keyPresent = (await loadApiKey()) !== null;
  });

  $: trimmedDraft = draft.trim();
  $: canSave = trimmedDraft.length > 0;

  async function handleSave() {
    if (!canSave) return;
    await saveApiKey(trimmedDraft);
    draft = '';
    showKey = false;
    keyPresent = true;
    feedback = 'Saved.';
  }

  async function handleClear() {
    if (!keyPresent) return;
    if (!confirm('Clear the saved API key?')) return;
    await clearApiKey();
    keyPresent = false;
    feedback = 'Cleared.';
  }

  function toggleShow() {
    showKey = !showKey;
  }
</script>

<svelte:head>
  <title>Settings — PF2e Encounter Tracker v2</title>
</svelte:head>

<main class="settings">
  <header class="header">
    <a class="back-link" href="/">← Back to encounter</a>
    <h1>Settings</h1>
  </header>

  <section class="card" aria-labelledby="parser-heading">
    <h2 id="parser-heading">LLM parser API key</h2>
    <p class="hint">
      Used by the creature import parser. The key is stored only in this browser's
      IndexedDB and is sent directly to the LLM provider — never to a third-party server.
    </p>

    <p class="status" data-state={keyPresent ? 'set' : 'unset'}>
      {keyPresent ? 'Key set' : 'No key configured'}
    </p>

    <label class="field">
      <span class="label">API key</span>
      <div class="input-row">
        <input
          type={showKey ? 'text' : 'password'}
          bind:value={draft}
          autocomplete="off"
          spellcheck="false"
          placeholder={keyPresent ? 'Enter a new key to replace the saved one' : 'Paste your API key'}
        />
        <button type="button" class="toggle" aria-pressed={showKey} on:click={toggleShow}>
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>

    <div class="actions">
      <button type="button" class="primary" on:click={handleSave} disabled={!canSave}>
        Save
      </button>
      <button type="button" class="danger" on:click={handleClear} disabled={!keyPresent}>
        Clear
      </button>
    </div>

    {#if feedback}
      <p class="feedback" role="status">{feedback}</p>
    {/if}
  </section>
</main>

<style>
  .settings {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }

  .header {
    margin-bottom: 24px;
  }

  .back-link {
    display: inline-block;
    color: #28494c;
    font-size: 14px;
    text-decoration: none;
    padding: 8px 0;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  h1 {
    margin: 4px 0 0;
    font-size: 32px;
    line-height: 1.1;
  }

  .card {
    background: #ffffff;
    border: 1px solid #c5ccc8;
    border-radius: 8px;
    padding: 20px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 20px;
  }

  .hint {
    color: #415052;
    font-size: 14px;
    margin: 0 0 16px;
  }

  .status {
    border: 1px solid #c5ccc8;
    border-radius: 6px;
    padding: 8px 10px;
    background: #f3f6f5;
    font-size: 14px;
    margin: 0 0 20px;
    display: inline-block;
  }

  .status[data-state='set'] {
    background: #28494c;
    color: #f3f6f5;
    border-color: #28494c;
  }

  .field {
    display: block;
    margin-bottom: 16px;
  }

  .label {
    display: block;
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 14px;
  }

  .input-row {
    display: flex;
    gap: 8px;
  }

  input {
    flex: 1;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid #c5ccc8;
    border-radius: 6px;
    font-size: 16px;
    font-family: inherit;
  }

  input:focus {
    outline: 2px solid #28494c;
    outline-offset: 1px;
  }

  .toggle,
  .primary,
  .danger {
    min-height: 44px;
    padding: 0 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #c5ccc8;
    background: #ffffff;
    color: #28494c;
  }

  .toggle:hover,
  .primary:hover:not(:disabled),
  .danger:hover:not(:disabled) {
    background: #eef2f0;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .primary {
    background: #28494c;
    color: #f3f6f5;
    border-color: #28494c;
  }

  .primary:hover:not(:disabled) {
    background: #345e62;
  }

  .danger {
    color: #8c2a2a;
    border-color: #d8b4b4;
  }

  .danger:hover:not(:disabled) {
    background: #fbeeee;
  }

  .primary:disabled,
  .danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .feedback {
    margin: 16px 0 0;
    color: #2e6a3a;
    font-size: 14px;
  }
</style>
