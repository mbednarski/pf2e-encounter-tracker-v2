<script lang="ts">
  import Chip from './Chip.svelte';

  type Variant =
    | 'default'
    | 'pc'
    | 'enemy'
    | 'success'
    | 'warning'
    | 'danger'
    | 'attack'
    | 'damage'
    | 'save'
    | 'condition'
    | 'persistent';

  export let label: string;
  export let variant: Variant = 'default';
  export let selected = false;
</script>

<Chip {variant} {selected}>{label}</Chip>
