<script lang="ts">
  type Variant = 'default' | 'primary' | 'destructive';
  type Size = 22 | 26;

  export let variant: Variant = 'default';
  export let size: Size = 22;
  export let type: 'button' | 'submit' = 'button';
  export let disabled = false;
  export let title: string | undefined = undefined;
  export let ariaLabel: string;
  export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
</script>

<button
  {type}
  {disabled}
  {title}
  aria-label={ariaLabel}
  class="icon-btn icon-btn--{variant}"
  style="--icon-btn-size: {size}px"
  {onclick}
>
  <slot />
</button>

<style>
  .icon-btn {
    width: var(--icon-btn-size);
    height: var(--icon-btn-size);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-card);
    font-family: var(--font-sans);
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .icon-btn--default {
    border: var(--border-thin);
    color: var(--color-ink-mute);
  }

  .icon-btn--default:hover:not(:disabled) {
    border-color: var(--color-ink);
    color: var(--color-ink);
  }

  .icon-btn--primary {
    border: var(--border-ink);
    color: var(--color-ink);
    font-weight: 600;
  }

  .icon-btn--primary:hover:not(:disabled) {
    background: var(--color-ink);
    color: var(--color-panel);
  }

  .icon-btn--destructive {
    border: 1px solid var(--color-red);
    color: var(--color-red);
  }

  .icon-btn--destructive:hover:not(:disabled) {
    background: var(--color-red);
    color: var(--color-panel);
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: 2px;
  }

  .icon-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Touch devices: extend the hit area to 44px with an invisible overlay
     so the visible square stays at --icon-btn-size. */
  @media (pointer: coarse) {
    .icon-btn {
      position: relative;
    }

    .icon-btn::after {
      content: '';
      position: absolute;
      inset: calc((var(--icon-btn-size) - 44px) / 2);
    }
  }
</style>
