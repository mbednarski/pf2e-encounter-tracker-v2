<script lang="ts">
  type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
  type Size = 'sm' | 'md';

  export let variant: Variant = 'primary';
  export let size: Size = 'md';
  export let type: 'button' | 'submit' = 'button';
  export let disabled = false;
  export let title: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
</script>

<button
  {type}
  {disabled}
  {title}
  aria-label={ariaLabel}
  class="btn btn--{variant} btn--{size}"
  {onclick}
>
  <slot />
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-weight: 600;
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    border-radius: var(--radius-card);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .btn--md {
    padding: 6px 14px;
    font-size: var(--text-sm);
  }

  .btn--sm {
    padding: 4px 10px;
    font-size: var(--text-xs);
  }

  .btn--primary {
    background: var(--color-ink);
    color: var(--color-panel);
    border: 1px solid var(--color-ink);
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--color-ink-soft);
    border-color: var(--color-ink-soft);
  }

  .btn--secondary {
    background: transparent;
    color: var(--color-ink);
    border: var(--border-strong);
  }

  .btn--secondary:hover:not(:disabled) {
    background: var(--color-panel-2);
  }

  .btn--ghost {
    background: transparent;
    color: var(--color-ink-soft);
    border: 1px dashed var(--color-rule-strong);
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--color-panel-2);
    color: var(--color-ink);
  }

  .btn--destructive {
    background: transparent;
    color: var(--color-red);
    border: 1px solid var(--color-red);
  }

  .btn--destructive:hover:not(:disabled) {
    background: var(--color-red);
    color: var(--color-panel);
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
