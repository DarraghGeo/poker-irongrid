<script>
  /** SelectionSummary: display counts for highlighted and selected combos. */
  export let highlighted = 0;
  export let selected = 0;
  export let evaluator = false;
  export let heroCards = [];
  /** Live equity from PokerGridPanel: { hero, villain, combos, byColor } or null. */
  export let equity = null;
  /** True while a newer equity result is being calculated. */
  export let equityPending = false;
  export let visibleHands = {};
  export let manager = null; // PokerGridManager instance

  /** Get highlighted hands from visibleHands */
  function getHighlightedHands() {
    return manager ? manager.getHighlightedHands(visibleHands) : [];
  }

  /** Get selected hands from visibleHands */
  function getSelectedHands() {
    return manager ? manager.getSelectedHandsFromVisible(visibleHands) : [];
  }

  /** Copy hands to clipboard */
  async function copyToClipboard(hands) {
    if (hands.length === 0) return;
    const text = hands.join(', ');
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here if desired
    } catch (error) {
      // Clipboard unavailable; ignore
    }
  }

  /** Handle click on highlighted count */
  async function handleHighlightedClick() {
    const highlightedHands = getHighlightedHands();
    await copyToClipboard(highlightedHands);
  }

  /** Handle click on selected count */
  async function handleSelectedClick() {
    const selectedHands = getSelectedHands();
    await copyToClipboard(selectedHands);
  }

  /** Equity display: the panel recalculates it live whenever the inputs change. */
  $: showEquity = evaluator && heroCards?.length === 2;
  $: hasEquity = equity && equity.hero !== null && equity.hero !== undefined;
</script>

<div class="flex items-center justify-between mt-1">
  <span class="text-xs" style="color: var(--irongrid-color-text-secondary);">
    Combinations: 
    <span 
      onclick={handleHighlightedClick}
      style="cursor: pointer; text-decoration: underline;"
      onmouseover={(e) => e.target.style.opacity = '0.7'}
      onmouseout={(e) => e.target.style.opacity = '1'}
      title="Click to copy highlighted hands to clipboard"
    >
      {highlighted} highlighted
    </span>
    , 
    <span 
      onclick={handleSelectedClick}
      style="cursor: pointer; text-decoration: underline;"
      onmouseover={(e) => e.target.style.opacity = '0.7'}
      onmouseout={(e) => e.target.style.opacity = '1'}
      title="Click to copy selected hands to clipboard"
    >
      {selected} selected
    </span>
  </span>
  <div class="flex items-center gap-2">
    {#if showEquity}
      <div
        class="text-xs equity-readout"
        class:equity-pending={equityPending}
        style="color: var(--irongrid-color-text-secondary);"
        aria-live="polite"
        title={hasEquity ? `Hero's equity against ${equity.combos} villain combos (selected or colored)` : ''}
      >
        {#if hasEquity}
          <span>Hero: {Math.round(equity.hero)}% vs. Villain: {Math.round(equity.villain)}%</span>
        {:else if equityPending}
          <span>Calculating…</span>
        {:else}
          <span>Select villain hands for equity</span>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .equity-readout {
    transition: opacity 120ms ease;
  }
  .equity-pending {
    opacity: 0.55;
  }
</style>

