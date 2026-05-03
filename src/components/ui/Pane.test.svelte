<script lang="ts">
  import Pane from './Pane.svelte';

  export let ariaLabel: string;
  export let scrollable = false;
</script>

<Pane {ariaLabel} {scrollable}>
  <span slot="header">Header content</span>
  <span slot="footer">Footer content</span>
  Body content
</Pane>
