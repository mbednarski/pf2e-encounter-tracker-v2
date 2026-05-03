<script lang="ts">
  export let value: string = '';
  export let type: 'text' | 'search' | 'email' | 'password' = 'text';
  export let placeholder = '';
  export let ariaLabel: string;
  export let disabled = false;
  export let id: string | undefined = undefined;
  export let oninput: ((value: string) => void) | undefined = undefined;

  function handleInput(event: Event) {
    const next = (event.target as HTMLInputElement).value;
    value = next;
    oninput?.(next);
  }
</script>

<div class="field" class:field--disabled={disabled}>
  {#if $$slots.leading}
    <span class="field__leading"><slot name="leading" /></span>
  {/if}
  <input
    {type}
    {value}
    {placeholder}
    {disabled}
    {id}
    aria-label={ariaLabel}
    oninput={handleInput}
  />
  {#if $$slots.trailing}
    <span class="field__trailing"><slot name="trailing" /></span>
  {/if}
</div>

<style>
  .field {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-panel);
    border: var(--border-strong);
    border-radius: var(--radius-card);
    padding: 6px 10px;
    transition: border-color 0.12s;
  }

  .field:focus-within {
    border-color: var(--color-ink);
  }

  .field--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--leading-snug);
  }

  input::placeholder {
    color: var(--color-ink-mute);
  }

  .field__leading,
  .field__trailing {
    display: inline-flex;
    align-items: center;
    color: var(--color-ink-mute);
    font-size: var(--text-sm);
  }
</style>
