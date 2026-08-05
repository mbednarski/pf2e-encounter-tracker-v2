<script lang="ts">
  import Modal from './ui/Modal.svelte';

  export let onDiscard: () => Promise<boolean>;
  export let label = 'Discard Encounter…';
  export let dialogTitle = 'Discard active encounter?';
  export let buttonClass = 'secondary';

  let confirmationOpen = false;
  let isDiscarding = false;

  function closeConfirmation() {
    if (!isDiscarding) confirmationOpen = false;
  }

  async function confirmDiscard() {
    if (isDiscarding) return;
    isDiscarding = true;
    try {
      if (await onDiscard()) confirmationOpen = false;
    } finally {
      isDiscarding = false;
    }
  }
</script>

<button type="button" class={buttonClass} onclick={() => (confirmationOpen = true)}>{label}</button>

{#if confirmationOpen}
  <Modal
    title={dialogTitle}
    titleId="discard-encounter-title"
    descriptionId="discard-encounter-description"
    dismissible={!isDiscarding}
    onClose={closeConfirmation}
  >
    <p id="discard-encounter-description">
      This removes the active encounter and combat log from this device. Your creature, hazard,
      and party libraries remain.
    </p>
    <svelte:fragment slot="footer">
      <button
        type="button"
        class="secondary"
        disabled={isDiscarding}
        data-modal-default
        onclick={closeConfirmation}
      >Keep Encounter</button>
      <button
        type="button"
        class="destructive"
        disabled={isDiscarding}
        onclick={confirmDiscard}
      >
        {isDiscarding ? 'Discarding…' : 'Discard Encounter'}
      </button>
    </svelte:fragment>
  </Modal>
{/if}

<style>
  button {
    min-height: 38px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-card);
    background: var(--accent);
    color: var(--accent-ink);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: var(--space-2) var(--space-3);
  }

  button.secondary {
    border-color: var(--color-rule-strong);
    background: transparent;
    color: var(--color-ink);
  }

  button.destructive {
    border-color: var(--color-red);
    background: var(--color-red);
    color: var(--color-panel-up);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  @media (pointer: coarse), (max-width: 1024px) {
    button {
      min-height: var(--tap-target-min);
    }
  }
</style>
