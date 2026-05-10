<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  export let x: number;
  export let y: number;
  export let total: string;
  export let detail: string = '';
  export let tone: 'normal' | 'crit' | 'fumble' | 'damage' = 'normal';
  export let badge: string = '';
</script>

<div
  class="bubble bubble--{tone}"
  style="left: {x}px; top: {y}px;"
  role="status"
  aria-live="polite"
  in:fly={{ y: 12, duration: 140 }}
  out:fade={{ duration: 320 }}
>
  {#if badge}
    <span class="bubble__badge">{badge}</span>
  {/if}
  <span class="bubble__total">{total}</span>
  {#if detail}
    <span class="bubble__detail">{detail}</span>
  {/if}
</div>

<style>
  .bubble {
    position: fixed;
    transform: translate(-50%, -100%) translateY(-12px);
    pointer-events: none;
    z-index: 9999;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 12px;
    background: var(--color-panel);
    border: 2px solid var(--color-ink);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: var(--font-serif);
    line-height: 1;
    white-space: nowrap;
  }

  .bubble__total {
    color: var(--color-ink);
    font-size: 22px;
    font-weight: 700;
  }

  .bubble__detail {
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .bubble__badge {
    color: var(--color-ink-mute);
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .bubble--crit {
    border-color: var(--color-green);
    background: var(--color-panel);
  }
  .bubble--crit .bubble__total { color: var(--color-green); font-size: 28px; }
  .bubble--crit .bubble__badge { color: var(--color-green); }

  .bubble--fumble {
    border-color: var(--color-red);
  }
  .bubble--fumble .bubble__total { color: var(--color-red); font-size: 28px; }
  .bubble--fumble .bubble__badge { color: var(--color-red); }

  .bubble--damage {
    border-color: var(--color-red);
  }
  .bubble--damage .bubble__total { color: var(--color-red); }
</style>
