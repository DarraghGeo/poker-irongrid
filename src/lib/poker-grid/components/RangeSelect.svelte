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
    e.target.style.borderColor = 'var(--poker-accent)';
    e.target.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.1)';
  }}
  onblur={(e) => {
    e.target.style.borderColor = 'var(--poker-border-light)';
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
    border-color: var(--poker-border-light);
    color: var(--poker-text-primary);
    background-color: var(--poker-white);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
</style>
