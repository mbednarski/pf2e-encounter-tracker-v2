<script lang="ts">
  import type { ActionCost } from '../../domain';
  import { actionGlyph } from '$lib/abilities/action-glyph';

  export let cost: ActionCost | undefined;

  $: info = actionGlyph(cost);
</script>

{#if info.glyph}
  <span class="action-glyph" aria-label={info.aria} title={info.aria}>{info.glyph}</span>
{/if}

<style>
  .action-glyph {
    display: inline-block;
    color: var(--color-red);
    font-family: var(--font-serif);
    font-size: var(--text-base);
    font-weight: 700;
    letter-spacing: -1px;
    line-height: 1;
  }
</style>
