<script lang="ts">
  import Button from './ui/Button.svelte';
  import Modal from './ui/Modal.svelte';

  export let onReset: () => Promise<boolean>;
  export let triggerLabel = 'Discard Encounter…';
  export let dialogTitle = 'Discard active encounter?';

  let confirmationOpen = false;
  let isDiscarding = false;

  function closeConfirmation() {
    if (!isDiscarding) confirmationOpen = false;
  }

  async function confirmDiscard() {
    if (isDiscarding) return;
    isDiscarding = true;
    try {
      if (await onReset()) confirmationOpen = false;
    } finally {
      isDiscarding = false;
    }
  }
</script>

<Button variant="secondary" onclick={() => (confirmationOpen = true)}>
  {triggerLabel}
</Button>

{#if confirmationOpen}
  <Modal
    title={dialogTitle}
    titleId="discard-encounter-title"
    descriptionId="discard-encounter-description"
    dismissible={!isDiscarding}
    onClose={closeConfirmation}
  >
    <p id="discard-encounter-description">
      This removes the active encounter and combat log from this device. Your creature, hazard, and party libraries remain.
    </p>
    <svelte:fragment slot="footer">
      <Button variant="secondary" modalDefault disabled={isDiscarding} onclick={closeConfirmation}>
        Keep Encounter
      </Button>
      <Button variant="destructive" disabled={isDiscarding} onclick={confirmDiscard}>
        {isDiscarding ? 'Discarding…' : 'Discard Encounter'}
      </Button>
    </svelte:fragment>
  </Modal>
{/if}
