<script lang="ts">
  import { onMount, tick } from 'svelte';

  type CloseReason = 'escape' | 'backdrop';

  export let label: string | undefined = undefined;
  export let labelledBy: string | undefined = undefined;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let closeOnBackdrop = true;
  export let initialFocusSelector: string | undefined = undefined;
  /* When false the body slot manages its own scrolling (e.g. a pinned tab
     strip above a scrolling region) and gets no padding. */
  export let scrollBody = true;
  export let onClose: (reason: CloseReason) => void;

  let dialogEl: HTMLDivElement | null = null;
  let returnFocusTo: HTMLElement | null = null;

  // Queried lazily per keydown — modal content is dynamic (steppers,
  // pickers, <details>) and a cached list would trap focus on stale nodes.
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(): HTMLElement[] {
    if (!dialogEl) return [];
    return [...dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE)];
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose('escape');
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) {
      event.preventDefault();
      dialogEl?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || active === dialogEl || !dialogEl?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || active === dialogEl) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropClick() {
    if (closeOnBackdrop) onClose('backdrop');
  }

  onMount(() => {
    returnFocusTo = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void tick().then(() => {
      const target = initialFocusSelector
        ? (dialogEl?.querySelector<HTMLElement>(initialFocusSelector) ?? null)
        : null;
      (target ?? dialogEl)?.focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      returnFocusTo?.focus?.();
    };
  });
</script>

<div class="modal-host">
  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close dialog"
    tabindex="-1"
    onclick={handleBackdropClick}
  ></button>
  <div
    bind:this={dialogEl}
    class="modal-card modal-card--{size}"
    role="dialog"
    aria-modal="true"
    aria-label={label}
    aria-labelledby={labelledBy}
    tabindex="-1"
    onkeydown={handleKeydown}
  >
    {#if $$slots.header}
      <header class="modal-header">
        <slot name="header" />
      </header>
    {/if}
    <div class="modal-body" class:modal-body--managed={!scrollBody}>
      <slot />
    </div>
    {#if $$slots.footer}
      <footer class="modal-footer">
        <slot name="footer" />
      </footer>
    {/if}
  </div>
</div>

<style>
  .modal-host {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    pointer-events: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-ink) 42%, transparent);
    border: 0;
    padding: 0;
    cursor: default;
    pointer-events: auto;
  }

  .modal-card {
    position: relative;
    pointer-events: auto;
    max-height: min(85vh, 760px);
    background: var(--color-panel);
    color: var(--color-ink);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-paper);
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .modal-card--sm {
    width: min(440px, 92vw);
  }

  .modal-card--md {
    width: min(640px, 92vw);
  }

  .modal-card--lg {
    width: min(720px, 92vw);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 2px solid var(--accent);
  }

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-3) var(--space-4);
  }

  .modal-body--managed {
    overflow: hidden;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-thin);
  }
</style>
