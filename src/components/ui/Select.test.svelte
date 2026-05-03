<script lang="ts">
  import Select from './Select.svelte';

  export let value: string;
  export let onchange: ((value: string) => void) | undefined = undefined;
</script>

<Select ariaLabel="Condition" {value} {onchange}>
  <option value="frightened">Frightened</option>
  <option value="stunned">Stunned</option>
  <option value="prone">Prone</option>
</Select>
