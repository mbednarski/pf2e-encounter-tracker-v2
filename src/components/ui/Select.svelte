<script lang="ts">
  export let value: string;
  export let ariaLabel: string;
  export let id: string | undefined = undefined;
  export let disabled = false;
  export let onchange: ((value: string) => void) | undefined = undefined;

  function handleChange(event: Event) {
    const next = (event.target as HTMLSelectElement).value;
    value = next;
    onchange?.(next);
  }
</script>

<div class="select" class:select--disabled={disabled}>
  <select
    {value}
    {disabled}
    {id}
    aria-label={ariaLabel}
    onchange={handleChange}
  >
    <slot />
  </select>
  <span class="select__caret" aria-hidden="true">▾</span>
</div>

<style>
  .select {
    position: relative;
    display: inline-flex;
    align-items: center;
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    transition: border-color 0.12s;
  }

  .select:focus-within {
    border-color: var(--color-ink);
  }

  .select--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  select {
    appearance: none;
    border: none;
    outline: none;
    background: transparent;
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--leading-snug);
    padding: 6px 28px 6px 10px;
    cursor: pointer;
  }

  select:disabled {
    cursor: not-allowed;
  }

  .select__caret {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
    pointer-events: none;
  }
</style>
