<script lang="ts">
  import { onMount, tick } from 'svelte';

  export let title: string;
  export let titleId = 'modal-title';
  export let descriptionId: string | undefined = undefined;
  export let dismissible = true;
  export let onClose: () => void;

  let dialogEl: HTMLDivElement | null = null;
  let returnFocusTo: HTMLElement | null = null;

  function close() {
    if (dismissible) onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !dismissible) return;
    event.preventDefault();
    onClose();
  }

  onMount(() => {
    returnFocusTo = document.activeElement as HTMLElement | null;
    void tick().then(() => {
      const defaultAction = dialogEl?.querySelector<HTMLElement>('[data-modal-default]');
      (defaultAction ?? dialogEl)?.focus();
    });
    return () => returnFocusTo?.focus?.();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="presentation" onclick={handleBackdropClick}>
  <div
    bind:this={dialogEl}
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    tabindex="-1"
  >
    <header class="modal__header">
      <h2 id={titleId}>{title}</h2>
      <button type="button" class="modal__close" aria-label="Close dialog" disabled={!dismissible} onclick={close}>×</button>
    </header>
    <div class="modal__body"><slot /></div>
    {#if $$slots.footer}
      <footer class="modal__footer"><slot name="footer" /></footer>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: var(--space-4);
    background: rgb(0 0 0 / 42%);
  }

  .modal {
    width: min(100%, 34rem);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    background: var(--color-panel);
    box-shadow: var(--shadow-soft);
  }

  .modal__header,
  .modal__footer {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }

  .modal__header {
    justify-content: space-between;
    border-bottom: var(--border-thin);
  }

  h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
  }

  .modal__close {
    display: inline-grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: var(--border-thin);
    border-radius: var(--radius-card);
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
  }

  .modal__close:hover:not(:disabled) {
    background: var(--color-panel-2);
  }

  .modal__close:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  .modal__close:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .modal__body {
    padding: var(--space-4);
  }

  .modal__footer {
    justify-content: flex-end;
    border-top: var(--border-thin);
  }
</style>
