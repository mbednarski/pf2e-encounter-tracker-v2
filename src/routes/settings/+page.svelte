<script lang="ts">
  import { onMount } from 'svelte';
  import { hasIndexedDb } from '$lib/storage/db';
  import { clearApiKey, loadApiKey, saveApiKey } from '$lib/storage/settings';

  type Feedback = { kind: 'success' | 'error'; message: string };

  let keyPresent = false;
  let draft = '';
  let showKey = false;
  let feedback: Feedback | null = null;
  let storageAvailable = true;

  onMount(async () => {
    storageAvailable = hasIndexedDb();
    if (!storageAvailable) {
      feedback = {
        kind: 'error',
        message:
          'IndexedDB is unavailable in this browser (e.g. private browsing or strict privacy mode). The API key cannot be stored here.'
      };
      return;
    }
    try {
      // Check only whether a key exists — never bind the stored value into
      // reactive state, so the secret cannot leak into the DOM, devtools,
      // or component snapshots.
      keyPresent = (await loadApiKey()) !== null;
    } catch (err) {
      console.error('Failed to check for saved API key', err);
      feedback = {
        kind: 'error',
        message:
          'Could not check for a saved key. Storage may be temporarily unavailable — if you have this app open in another tab, close it and reload.'
      };
    }
  });

  $: trimmedDraft = draft.trim();
  $: canSave = trimmedDraft.length > 0 && storageAvailable;
  $: canClear = keyPresent && storageAvailable;

  async function handleSave() {
    if (!canSave) return;
    feedback = null;
    try {
      const persisted = await saveApiKey(trimmedDraft);
      if (!persisted) {
        feedback = {
          kind: 'error',
          message:
            'Could not save: this browser has IndexedDB disabled. Your key was not stored.'
        };
        return;
      }
      draft = '';
      showKey = false;
      keyPresent = true;
      feedback = { kind: 'success', message: 'Saved.' };
    } catch (err) {
      console.error('Failed to save API key', err);
      feedback = {
        kind: 'error',
        message:
          'Save failed. Storage may be full, or another tab may be using a newer version — close other tabs and reload, then try again.'
      };
    }
  }

  async function handleClear() {
    if (!canClear) return;
    if (!confirm('Clear the saved API key?')) return;
    feedback = null;
    try {
      const cleared = await clearApiKey();
      if (!cleared) {
        feedback = {
          kind: 'error',
          message:
            'Could not clear: storage is unavailable in this browser. The key was not removed.'
        };
        return;
      }
      keyPresent = false;
      feedback = { kind: 'success', message: 'Cleared.' };
    } catch (err) {
      console.error('Failed to clear API key', err);
      feedback = {
        kind: 'error',
        message:
          'Clear failed. The key may still be stored — try reloading and clearing again.'
      };
    }
  }

  function toggleShow() {
    showKey = !showKey;
  }
</script>

<svelte:head>
  <title>Settings — PF2e Encounter Tracker</title>
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
      <button type="button" class="danger" on:click={handleClear} disabled={!canClear}>
        Clear
      </button>
    </div>

    {#if feedback}
      <p
        class="feedback"
        data-kind={feedback.kind}
        role={feedback.kind === 'error' ? 'alert' : 'status'}
      >
        {feedback.message}
      </p>
    {/if}
  </section>
</main>

<style>
  .settings {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
  }

  .header {
    margin-bottom: var(--space-6);
  }

  .back-link {
    display: inline-block;
    color: var(--color-blue);
    font-size: var(--text-base);
    text-decoration: none;
    padding: var(--space-2) 0;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  h1 {
    margin: var(--space-1) 0 0;
    font-family: var(--font-serif);
    font-size: var(--text-3xl);
    line-height: var(--leading-tight);
  }

  .card {
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-soft);
    padding: var(--space-5);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-family: var(--font-serif);
    font-size: var(--text-lg);
  }

  .hint {
    color: var(--color-ink-soft);
    font-size: var(--text-base);
    margin: 0 0 var(--space-4);
  }

  .status {
    border: var(--border-strong);
    border-radius: var(--radius-chip);
    padding: var(--space-2) var(--space-2);
    background: var(--color-panel-2);
    font-size: var(--text-base);
    margin: 0 0 var(--space-5);
    display: inline-block;
  }

  .status[data-state='set'] {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }

  .field {
    display: block;
    margin-bottom: var(--space-4);
  }

  .label {
    display: block;
    font-weight: 600;
    margin-bottom: var(--space-1);
    font-size: var(--text-base);
  }

  .input-row {
    display: flex;
    gap: var(--space-2);
  }

  input {
    flex: 1;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: var(--border-strong);
    border-radius: var(--radius-chip);
    background: var(--color-panel-up);
    color: var(--color-ink);
    font-size: 16px; /* >=16px prevents mobile-safari zoom on focus */
    font-family: inherit;
  }

  input:focus {
    outline: 2px solid var(--color-blue);
    outline-offset: 1px;
  }

  .toggle,
  .primary,
  .danger {
    min-height: 44px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-card);
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    border: var(--border-strong);
    background: transparent;
    color: var(--color-ink);
  }

  .toggle:hover,
  .primary:hover:not(:disabled),
  .danger:hover:not(:disabled) {
    background: var(--color-panel-2);
  }

  .toggle:focus-visible,
  .primary:focus-visible,
  .danger:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .primary {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }

  .primary:hover:not(:disabled) {
    background: var(--color-ink);
    border-color: var(--color-ink);
  }

  .danger {
    color: var(--color-red);
    border-color: var(--color-red);
  }

  .danger:hover:not(:disabled) {
    background: var(--color-red-soft);
  }

  .primary:disabled,
  .danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .feedback {
    margin: var(--space-4) 0 0;
    padding: var(--space-2) var(--space-2);
    border-radius: var(--radius-chip);
    font-size: var(--text-base);
    border: 1px solid transparent;
  }

  .feedback[data-kind='success'] {
    color: var(--color-green);
    background: var(--color-green-soft);
    border-color: var(--color-green);
  }

  .feedback[data-kind='error'] {
    color: var(--color-red);
    background: var(--color-red-soft);
    border-color: var(--color-red);
  }
</style>
