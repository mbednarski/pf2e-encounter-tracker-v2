<script lang="ts">
  import SectionLabel from './SectionLabel.svelte';

  export let text: string;
  export let as: 'span' | 'div' | 'h2' | 'h3' | 'h4' = 'span';
</script>

<SectionLabel {as}>{text}</SectionLabel>
