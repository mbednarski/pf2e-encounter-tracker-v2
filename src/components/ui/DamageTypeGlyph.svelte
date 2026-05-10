<script lang="ts">
  import { damageTypeGlyph } from '$lib/effects/damage-type-glyph';

  export let type: string;

  $: info = damageTypeGlyph(type);
</script>

<span
  class="damage-type-glyph"
  class:color-red={info.color === 'red'}
  class:color-blue={info.color === 'blue'}
  class:color-amber={info.color === 'amber'}
  class:color-green={info.color === 'green'}
  class:color-ink={info.color === 'ink'}
  aria-label={info.aria}
  title={info.aria}
>{info.glyph}</span>

<style>
  .damage-type-glyph {
    display: inline-block;
    font-size: 1em;
    line-height: 1;
    /* Emoji glyphs render their own colors; the .color-* classes apply
       only to monochrome unicode glyphs (♪, ❄, ☠, ➹, ⚔, ◯). */
  }

  .color-red {
    color: var(--color-red);
  }
  .color-blue {
    color: var(--color-blue);
  }
  .color-amber {
    color: var(--color-amber);
  }
  .color-green {
    color: var(--color-green);
  }
  .color-ink {
    color: var(--color-ink);
  }
</style>
