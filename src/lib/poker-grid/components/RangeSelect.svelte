<script>
  /**
   * RangeSelect.svelte
   * Purpose: Simple dropdown to select a predefined range name.
   * Emits: 'select' with the chosen range name.
   */
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  /** Predefined ranges array. Array of {name: string, abbreviation: string} */
  export let ranges = [];

  /** Emit selected range name. */
  function onChange(e) {
    dispatch('select', e.target.value);
  }
</script>

<select 
  id="range-select"
  class="flex-1 min-w-0 px-2 py-1 border rounded text-xs focus:outline-none range-select flex-shrink-0"
  onfocus={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-accent)';
    e.target.style.boxShadow = 'var(--irongrid-shadow-sm)';
  }}
  onblur={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-border-light)';
    e.target.style.boxShadow = '';
  }}
  onchange={onChange}
>
  <option value="">Villain's Range...</option>
  {#each ranges as range}
    <option value={range.name}>{range.name}</option>
  {/each}
</select>

<style>
  .range-select {
    border-color: var(--irongrid-color-border-light);
    color: var(--irongrid-color-text-primary);
    background-color: var(--irongrid-color-white);
    transition: border-color var(--irongrid-transition-base), box-shadow var(--irongrid-transition-base);
  }
</style>
