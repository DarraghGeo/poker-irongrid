<svelte:options runes={false} />

<script>
  /**
   * PokerGridPanel.svelte
   * Purpose: Orchestrates the full poker grid experience (dead inputs, range select, grid, controls, summary)
   * with configurable visibility and two-way bindings for raw and visible hands.
   */
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { PokerGridManager, loadPreflopTable } from '../PokerGridManager.js';
  import BaseGrid from './Grid.svelte';
  import HandSelector from './HandSelector.svelte';
  import SelectionSummary from './SelectionSummary.svelte';
  import DeadCardsInput from './DeadCardsInput.svelte';
  import RangeSelect from './RangeSelect.svelte';
  import DetailsPanel from './DetailsPanel.svelte';

  const dispatch = createEventDispatcher();

  /** Whether the panel is interactive (shows inputs/controls and allows grid interaction). */
  export let interactive = true;
  export let showDeadInputs = true;
  export let showRangeSelect = true;
  export let showControls = true;
  export let showSummary = true;
  export let showTips = false;
  export let enableDetailsPanel = false;
  export let evaluator = false;
  export let defaultColor = 'hsl(0, 0%, 100%)';
  export let defaultSelectedColor = 'hsl(0, 0%, 85%)';
  export let colors = [];
  /**
   * Optional URL of poker-bitvaljs's preflop table (bench/preflop-table.bin) for exact preflop equity,
   * e.g. with Vite: import preflopTableUrl from 'poker-bitvaljs/bench/preflop-table.bin?url'.
   * Without it, preflop equity is a Monte Carlo estimate.
   */
  export let preflopTableUrl = null;
  $: if (evaluator && preflopTableUrl) loadPreflopTable(preflopTableUrl);
  /** Predefined ranges for range selection. Array of {name: string, abbreviation: string} */
  export let ranges = [];

  /** Raw hands map (combos/abstracts) or array of hand strings. Two-way bound. */
  export let hands = {};
  /** Visible hands after filtering by dead cards (colored/selected). Two-way bound. */
  export let visibleHands = {};
  /** Dead cards (two-char codes). Two-way bound. */
  export let deadCards = [];
  /** Board cards (two-char codes). Two-way bound. */
  export let boardCards = [];
  /** Hero cards (two-char codes). Optional, for initializing DeadCardsInput. */
  export let heroCards = [];

  /** Optional initial state */
  export let initialHands = undefined;
  export let initialBoard = undefined;
  export let initialDead = undefined;

  /** Create manager instance */
  let manager = new PokerGridManager({
    hands: {},
    deadCards: [],
    boardCards: [],
    heroCards: [],
    colors,
    defaultColor,
    defaultSelectedColor
  });

  /** Update manager when props change */
  $: {
    manager.hands = hands;
    manager.deadCards = deadCards;
    manager.boardCards = boardCards;
    manager.heroCards = heroCards;
    manager.colors = colors;
    manager.defaultColor = defaultColor;
    manager.defaultSelectedColor = defaultSelectedColor;
  }

  /** Internal hands object (converted from array if needed). */
  let internalHands = {};
  $: {
    const converted = manager.convertHandsArrayToObject(hands);
    if (JSON.stringify(converted) !== JSON.stringify(internalHands)) {
      internalHands = converted;
    }
  }

  /** Initialize panel state from initials if provided. */
  $: if (initialHands && Object.keys(hands || {}).length === 0) {
    hands = { ...initialHands };
  }
  $: if (initialBoard && (boardCards?.length || 0) === 0) {
    boardCards = [...initialBoard];
  }
  $: if (initialDead && (deadCards?.length || 0) === 0) {
    deadCards = [...initialDead];
  }

  /** Derive visible hands (filtered by dead cards). */
  $: visibleHands = manager.filterByDeadCards(internalHands, deadCards);

  /**
   * Live equity (evaluator mode): recalculated, asynchronously, whenever the hero cards, board,
   * dead cards or the hands on the grid change. Results that arrive after a newer request are dropped.
   */
  let equity = null;
  let equityPending = false;
  let equityRequest = 0;
  let equityTimer = null;
  let lastEquityKey = '';

  $: equityKey = evaluator
    ? JSON.stringify({ heroCards, boardCards, deadCards, hands: visibleHands, colors })
    : '';
  $: if (equityKey !== lastEquityKey) {
    lastEquityKey = equityKey;
    scheduleEquity();
  }

  function scheduleEquity() {
    clearTimeout(equityTimer);
    const request = ++equityRequest;
    if (!evaluator || heroCards?.length !== 2) {
      equity = null;
      equityPending = false;
      return;
    }
    equityPending = true;
    // A short debounce coalesces bursts (typing cards, dragging across the grid)
    equityTimer = setTimeout(async () => {
      try {
        const result = await manager.calculateEquity(visibleHands, heroCards, boardCards, deadCards, colors);
        if (request === equityRequest) equity = result;
      } catch (error) {
        if (request === equityRequest) equity = null;
      } finally {
        if (request === equityRequest) equityPending = false;
      }
    }, 50);
  }

  onDestroy(() => clearTimeout(equityTimer));

  /** Highlighted and selected counts for summary. */
  $: highlightedCount = Object.values(visibleHands || {}).filter(v => manager.hasExplicitColor(v)).length;
  $: selectedCount = Object.values(visibleHands || {}).filter(v => manager.isSelected(v)).length;

  /**
   * Replace hands with selection from the provided range name.
   * @param {string} rangeName
   */
  function applyRange(rangeName) {
    const result = manager.applyRange(rangeName, ranges, internalHands);
    selectedRangeName = result.rangeName;
    internalHands = result.hands;
    hands = result.hands;
    dispatch('rangeSelected', { name: result.rangeName, hands: result.hands });
  }

  /**
   * Handle selectionChange from grid/controls.
   * @param {{ detail: { hands: Record<string, string[]> } }} event
   */
  function handleSelectionChange(event) {
    // The event.detail.hands contains only visible hands (from HandSelector which receives visibleHands)
    // We need to merge these changes into the full hands object, preserving dead card hands
    const updatedVisibleHands = event.detail.hands;
    const newHands = { ...internalHands };
    
    // Update all visible hands from the event
    Object.keys(updatedVisibleHands).forEach(hand => {
      newHands[hand] = updatedVisibleHands[hand];
    });
    
    // Remove hands that are no longer in the updated visible hands
    // Only remove non-dead hands that were previously visible but are now gone
    Object.keys(newHands).forEach(hand => {
      if (hand.length === 4) {
        const card1 = hand.substring(0, 2);
        const card2 = hand.substring(2, 4);
        const isDead = deadCards?.includes(card1) || deadCards?.includes(card2);
        // Only remove if hand is not dead and not in the updated visible hands
        // This handles the case where a hand was removed from selection
        if (!isDead && !updatedVisibleHands.hasOwnProperty(hand)) {
          // Check if this hand was previously visible (exists in current visibleHands)
          if (visibleHands.hasOwnProperty(hand)) {
            delete newHands[hand];
          }
        }
      }
    });
    
    internalHands = newHands;
    hands = newHands;
    dispatch('selectionChange', { hands: newHands, visibleHands });
  }

  /**
   * Handle dead cards change from inputs.
   * @param {{ detail: { deadCards: string[], boardCards?: string[], heroCards?: string[] } }} event
   */
  function handleDeadCardsChange(event) {
    deadCards = event.detail.deadCards;
    boardCards = event.detail.boardCards || [];
    // Use heroCards from event if provided, otherwise extract from deadCards
    if (event.detail.heroCards && Array.isArray(event.detail.heroCards)) {
      heroCards = [...event.detail.heroCards];
    } else {
      // Fallback: Extract hero cards from deadCards (deadCards = heroCards + boardCards + other dead cards)
      const otherDead = deadCards.filter(card => !boardCards.includes(card));
      if (otherDead.length >= 2) {
        heroCards = otherDead.slice(0, 2);
      } else {
        heroCards = [];
      }
    }
    dispatch('deadCardsChange', { deadCards, boardCards });
  }

  /**
   * Handle cell details event from grid (double-click).
   * @param {{ detail: { cellInfo: Object } }} event
   */
  let selectedCellForDetails = null;
  function handleCellDetails(event) {
    const clickedCell = event.detail.cellInfo;
    // Toggle: if same cell is double-clicked again, close the panel
    if (selectedCellForDetails && selectedCellForDetails.hand === clickedCell.hand) {
      selectedCellForDetails = null;
    } else {
      selectedCellForDetails = clickedCell;
    }
  }

  /** Track selected range name for evaluator. */
  let selectedRangeName = null;

  /** Effective visibility considers both interactive and individual props. */
  $: effectiveShowDeadInputs = interactive && showDeadInputs;
  $: effectiveShowRangeSelect = interactive && showRangeSelect;
  $: effectiveShowControls = interactive && showControls;
</script>

{#if effectiveShowDeadInputs || effectiveShowRangeSelect}
  <div class="mb-1">
    <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {#if effectiveShowDeadInputs}
        <DeadCardsInput {deadCards} {boardCards} {heroCards} on:deadCardsChange={handleDeadCardsChange} />
      {/if}
      {#if effectiveShowRangeSelect}
        <RangeSelect {ranges} on:select={(e) => applyRange(e.detail)} />
      {/if}
    </div>
  </div>
{/if}

<div class="mb-1" style="margin: 0;">
  <div class="w-full overflow-hidden" style="margin: 0; padding: 0;">
    <BaseGrid 
      hands={visibleHands}
      {deadCards}
      {defaultColor}
      {defaultSelectedColor}
      {interactive}
      {showTips}
      {enableDetailsPanel}
      {manager}
      on:selectionChange={handleSelectionChange}
      on:cellDetails={handleCellDetails}
      on:cellClick={(e) => dispatch('cellClick', e.detail)}
    />
  </div>
  {#if showSummary}
    <SelectionSummary 
      highlighted={highlightedCount} 
      selected={selectedCount}
      {evaluator}
      {heroCards}
      {equity}
      {equityPending}
      {visibleHands}
      {manager}
    />
  {/if}
  {#if enableDetailsPanel && selectedCellForDetails}
    <DetailsPanel 
      selectedCell={selectedCellForDetails}
      hands={visibleHands}
      {deadCards}
      {boardCards}
      {defaultColor}
      {defaultSelectedColor}
      {manager}
      onClose={() => selectedCellForDetails = null}
    />
  {/if}
</div>

  {#if effectiveShowControls}
  <div class="mt-2">
    <HandSelector 
      hands={visibleHands}
      {boardCards}
      {evaluator}
      {heroCards}
      {colors}
      {equity}
      {equityPending}
      {manager}
      on:selectionChange={handleSelectionChange}
      on:clearAll={() => {
        internalHands = {};
        hands = {};
      }}
    />
  </div>
{/if}

<style>
  .scrollbar-none {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style>
