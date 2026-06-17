<script lang="ts">
  import { tick } from 'svelte';
  import {
    formatGameClock,
    fromParts,
    stepClock,
    toParts,
    STEP_TEN_MINUTES,
    STEP_HOUR,
    STEP_DAY
  } from '$lib/game-clock';

  export let minutes: number;
  export let onChange: (minutes: number) => void;

  let editing = false;
  let dayBuffer = '';
  let hourBuffer = '';
  let minuteBuffer = '';
  let dayInputEl: HTMLInputElement | null = null;

  $: display = formatGameClock(minutes);

  async function startEdit() {
    const parts = toParts(minutes);
    dayBuffer = String(parts.day);
    hourBuffer = String(parts.hour);
    minuteBuffer = String(parts.minute);
    editing = true;
    await tick();
    dayInputEl?.select();
  }

  function cancelEdit() {
    editing = false;
  }

  function commitEdit() {
    const next = fromParts({
      day: Number(dayBuffer),
      hour: Number(hourBuffer),
      minute: Number(minuteBuffer)
    });
    editing = false;
    onChange(next);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  function step(delta: number) {
    onChange(stepClock(minutes, delta));
  }
</script>

<div class="clock" aria-label="In-game time">
  <span class="clock__label">Time</span>
  <div class="clock__controls">
    <div class="clock__group" aria-label="Subtract time">
      <button type="button" onclick={() => step(-STEP_DAY)} aria-label="Minus one day">−1d</button>
      <button type="button" onclick={() => step(-STEP_HOUR)} aria-label="Minus one hour">−1h</button>
      <button type="button" onclick={() => step(-STEP_TEN_MINUTES)} aria-label="Minus ten minutes">−10m</button>
    </div>

    {#if editing}
      <span class="clock__edit">
        <input
          bind:this={dayInputEl}
          bind:value={dayBuffer}
          type="text"
          inputmode="numeric"
          autocomplete="off"
          aria-label="Day"
          onkeydown={onKeydown}
        />
        <span class="clock__sep">·</span>
        <input
          bind:value={hourBuffer}
          type="text"
          inputmode="numeric"
          autocomplete="off"
          aria-label="Hour"
          onkeydown={onKeydown}
        />
        <span class="clock__colon">:</span>
        <input
          bind:value={minuteBuffer}
          type="text"
          inputmode="numeric"
          autocomplete="off"
          aria-label="Minute"
          onkeydown={onKeydown}
        />
        <button type="button" class="clock__ok" onclick={commitEdit} aria-label="Set time">Set</button>
      </span>
    {:else}
      <button type="button" class="clock__value" onclick={startEdit} aria-label="Set time, currently {display}">
        {display}
      </button>
    {/if}

    <div class="clock__group" aria-label="Add time">
      <button type="button" onclick={() => step(STEP_TEN_MINUTES)} aria-label="Plus ten minutes">+10m</button>
      <button type="button" onclick={() => step(STEP_HOUR)} aria-label="Plus one hour">+1h</button>
      <button type="button" onclick={() => step(STEP_DAY)} aria-label="Plus one day">+1d</button>
    </div>
  </div>
</div>

<style>
  .clock {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .clock__label {
    font-family: var(--font-sans);
    font-size: var(--text-xs, 11px);
    font-weight: 600;
    letter-spacing: var(--tracking-wider, 0.06em);
    text-transform: uppercase;
    color: var(--color-ink-soft);
    line-height: 1;
  }

  .clock__controls {
    display: flex;
    align-items: center;
    gap: var(--space-2, 6px);
  }

  .clock__group {
    display: flex;
    gap: 2px;
  }

  .clock__group button {
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--text-sm, 13px);
    font-weight: 600;
    color: var(--color-ink);
    background: transparent;
    border: var(--border-thin, 1px solid #cfd6d1);
    border-radius: var(--radius-sm, 4px);
    padding: 2px 6px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .clock__group button:hover {
    background: var(--color-panel-2, #eef1ee);
    border-color: var(--color-ink);
  }

  .clock__value {
    font-family: var(--font-mono);
    font-size: var(--text-lg, 16px);
    font-weight: 700;
    color: var(--color-ink);
    background: transparent;
    border: 0;
    padding: 2px 4px;
    min-width: 11ch;
    text-align: center;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
    text-decoration-color: rgba(0, 0, 0, 0.25);
  }

  .clock__value:hover,
  .clock__value:focus-visible {
    text-decoration-color: currentColor;
  }

  .clock__edit {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .clock__edit input {
    width: 3ch;
    padding: 1px 4px;
    font: inherit;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: center;
    border: 1px solid var(--input-border, #888);
    border-radius: 3px;
    background: var(--color-panel-up, #fff);
    color: inherit;
  }

  .clock__sep,
  .clock__colon {
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
  }

  .clock__ok {
    font: inherit;
    font-size: var(--text-xs, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider, 0.06em);
    color: var(--color-ink);
    background: transparent;
    border: var(--border-thin, 1px solid #cfd6d1);
    border-radius: var(--radius-sm, 4px);
    padding: 2px 6px;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--color-blue, #b88a2c);
    outline-offset: 2px;
  }
</style>
