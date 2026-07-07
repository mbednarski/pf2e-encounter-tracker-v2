<script lang="ts">
  import Modal from './Modal.svelte';

  export let closeOnBackdrop = true;
  export let initialFocusSelector: string | undefined = undefined;
  export let onCloseSpy: ((reason: 'escape' | 'backdrop') => void) | undefined = undefined;

  let open = false;

  function handleClose(reason: 'escape' | 'backdrop') {
    onCloseSpy?.(reason);
    open = false;
  }
</script>

<button type="button" onclick={() => (open = true)}>Open dialog</button>

{#if open}
  <Modal label="Test dialog" {closeOnBackdrop} {initialFocusSelector} onClose={handleClose}>
    <svelte:fragment slot="header">
      <h2>Test header</h2>
    </svelte:fragment>
    <button type="button">First</button>
    <button type="button">Second</button>
    <svelte:fragment slot="footer">
      <button type="button">Last</button>
    </svelte:fragment>
  </Modal>
{/if}
