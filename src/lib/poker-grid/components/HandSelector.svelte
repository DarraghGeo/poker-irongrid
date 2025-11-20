<script>
  /**
   * HandSelector.svelte
   * Purpose: Provides filtering and color controls for poker hand selection.
   * Sections: Color Actions, Hand Strength, Cards (ranks/suits), Selection Actions.
   */
  import { createEventDispatcher } from 'svelte';
  import { RANKS, SUITS } from '../utils/index.js';
  import BitValModule from 'poker-bitvaljs';

  const dispatch = createEventDispatcher();

  // Handle CommonJS export
  const BitVal = BitValModule?.default || BitValModule;

  export let hands = {};
  export let boardCards = [];
  export let evaluator = false;
  export let heroCards = [];
  export let deadCards = [];
  export let colors = [
    'hsl(60, 100%, 70%)',
    'hsl(120, 100%, 70%)',
    'hsl(240, 100%, 85%)',
    'hsl(300, 100%, 70%)',
    'hsl(30, 100%, 70%)',
    'hsl(0, 100%, 85%)'
  ];
  export let manager = null; // PokerGridManager instance

  // Display mode: 'count' (#), 'percentage' (%), or 'equity' (Eq)
  let colorDisplayMode = 'count';

  /**
   * Handle button click for filtering/selection.
   * @param {Event} event
   * @param {string} filterType
   * @param {string|null} filterValue
   */
  async function handleButtonClick(event, filterType, filterValue = null) {
    if (!manager) return;
    const modifiers = { 
      ctrl: event.ctrlKey || event.metaKey, 
      shift: event.shiftKey 
    };
    const newHands = await manager.applyFilterSelection(filterType, filterValue, modifiers, hands, boardCards);
    dispatch('selectionChange', { hands: newHands });
  }

  /**
   * Handle color button click.
   * @param {string} color
   * @param {Event} event
   */
  function handleColorClick(color, event) {
    if (!manager) return;
    const modifiers = { 
      ctrl: event.ctrlKey || event.metaKey, 
      shift: event.shiftKey 
    };
    const newHands = manager.handleColorAction(color, modifiers, hands);
    dispatch('selectionChange', { hands: newHands });
  }

  /**
   * Handle remove selected button.
   */
  function handleRemoveClick() {
    if (!manager) return;
    const newSelection = manager.removeSelected(hands);
    dispatch('selectionChange', { hands: newSelection });
  }

  /**
   * Handle unselect all button.
   */
  function handleUnselectAllClick() {
    if (!manager) return;
    const newSelection = manager.unselectAll(hands);
    dispatch('selectionChange', { hands: newSelection });
  }

  /**
   * Handle inverse selection button.
   */
  function handleInverseSelectionClick() {
    if (!manager) return;
    const newSelection = manager.inverseSelection(hands);
    dispatch('selectionChange', { hands: newSelection });
  }

  /**
   * Handle clear button - removes all selected hands entirely (removes colors and selection).
   */
  function handleClearAllClick() {
    if (!manager) return;
    const newSelection = manager.clearAll(hands);
    dispatch('selectionChange', { hands: newSelection });
  }

  /**
   * Check if a button should be active.
   * @param {string} filterType
   * @param {string|null} filterValue
   * @returns {boolean}
   */
  function isButtonActive(filterType, filterValue = null) {
    return manager ? manager.isFilterActive(filterType, filterValue, hands, boardCards) : false;
  }

  /** Get color statistics from manager. */
  $: colorStats = manager ? manager.getColorStatistics(hands, colors) : {counts: {}, percentages: {}};
  $: colorCounts = colorStats.counts;
  $: colorPercentages = colorStats.percentages;

  /** Calculate equity for each color group. */
  let colorEquities = {};
  let isCalculatingEquity = false;
  let calculatingColors = {}; // Track which colors are currently calculating (object for reactivity)
  let equityCalculationKey = 0;
  let lastColorHands = {}; // Track previous color hands to detect changes

  /** Track changes to trigger equity recalculation - only when colors change, not selections */
  $: if (evaluator && colorDisplayMode === 'equity' && heroCards?.length === 2 && manager) {
    // Only track colored hands, not selected-only hands
    const currentColorHands = {};
    colors.forEach(color => {
      const coloredHands = Object.keys(hands || {}).filter(h => {
        const handData = hands[h];
        if (!Array.isArray(handData)) return false;
        // Only include if hand has this color (not just selected)
        return handData.some(item => item === color);
      });
      currentColorHands[color] = coloredHands.sort();
    });

    // Check if any color's hands have changed
    const hasChanged = colors.some(color => {
      const current = JSON.stringify(currentColorHands[color] || []);
      const last = JSON.stringify(lastColorHands[color] || []);
      return current !== last;
    });

    // Also check if board/hero/dead cards changed
    const boardKey = JSON.stringify((boardCards || []).sort());
    const heroKey = JSON.stringify((heroCards || []).sort());
    const deadKey = JSON.stringify((deadCards || []).sort());
    const lastBoardKey = JSON.stringify((lastBoardCards || []).sort());
    const lastHeroKey = JSON.stringify((lastHeroCards || []).sort());
    const lastDeadKey = JSON.stringify((lastDeadCards || []).sort());

    if (hasChanged || boardKey !== lastBoardKey || heroKey !== lastHeroKey || deadKey !== lastDeadKey) {
      lastColorHands = currentColorHands;
      lastBoardCards = [...(boardCards || [])];
      lastHeroCards = [...(heroCards || [])];
      lastDeadCards = [...(deadCards || [])];
      
      // Use requestAnimationFrame to ensure UI updates first, then calculate
      requestAnimationFrame(() => {
        setTimeout(() => {
          calculateColorEquities();
        }, 0);
      });
    }
  }

  let lastBoardCards = [];
  let lastHeroCards = [];
  let lastDeadCards = [];

  async function calculateColorEquities() {
    if (isCalculatingEquity || !manager) return;
    if (!evaluator || colorDisplayMode !== 'equity' || heroCards?.length !== 2) {
      colorEquities = {};
      return;
    }

    isCalculatingEquity = true;
    const currentKey = ++equityCalculationKey;
    
    try {
      const newEquities = await manager.calculateColorEquities(hands, heroCards, boardCards, deadCards, colors);
        
        // Check if calculation was invalidated
        if (currentKey !== equityCalculationKey) {
          isCalculatingEquity = false;
          calculatingColors = {};
          return;
        }

        colorEquities = newEquities;
    } catch (error) {
      colorEquities = {};
      colors.forEach(c => colorEquities[c] = 0);
    } finally {
      if (currentKey === equityCalculationKey) {
        isCalculatingEquity = false;
        calculatingColors = {};
      }
    }
  }

  /** Check if a color is currently calculating equity */
  function isColorCalculating(color) {
    return calculatingColors[color] === true;
  }

  /** Toggle color display mode: count -> percentage -> equity -> count */
  function toggleColorDisplayMode() {
    if (!evaluator) {
      // Without evaluator, just toggle between count and percentage
      colorDisplayMode = colorDisplayMode === 'count' ? 'percentage' : 'count';
    } else {
      // With evaluator, cycle through all three modes
      if (colorDisplayMode === 'count') {
        colorDisplayMode = 'percentage';
      } else if (colorDisplayMode === 'percentage') {
        colorDisplayMode = 'equity';
      } else {
        colorDisplayMode = 'count';
      }
    }
  }

  /** Reactive display text for each color button */
  $: colorDisplayTexts = (() => {
    const texts = {};
    colors.forEach(color => {
      if (colorDisplayMode === 'percentage') {
        texts[color] = `${colorPercentages[color] || 0}%`;
      } else if (colorDisplayMode === 'equity') {
        texts[color] = `${colorEquities[color] || 0}%`;
      } else {
        texts[color] = colorCounts[color] || 0;
      }
    });
    return texts;
  })();


  /** Get button text for toggle */
  $: toggleButtonText = (() => {
    if (!evaluator) {
      return colorDisplayMode === 'percentage' ? '%' : '#';
    }
    if (colorDisplayMode === 'count') return '#';
    if (colorDisplayMode === 'percentage') return '%';
    return 'Eq';
  })();
</script>

<div class="hand-selector">
  <div class="space-y-1">
    <!-- Colors -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium whitespace-nowrap" style="color: var(--irongrid-color-text-secondary);">Colors:</span>
      <div class="flex flex-nowrap gap-1 overflow-x-auto flex-1 min-w-0">
      <button
          class="px-1 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors flex-shrink-0 whitespace-nowrap"
        onclick={toggleColorDisplayMode}
        title={evaluator ? "Toggle between count (#), percentage (%), and equity (Eq) display" : "Toggle between percentage and count display"}
      >
        {toggleButtonText}
      </button>
      {#each colors as color}
        <button
            class="px-2 py-1 rounded border border-gray-300 hover:border-gray-400 transition-colors flex-shrink-0 whitespace-nowrap relative {calculatingColors[color] ? 'pulsing' : ''}"
          style="--button-color: {color}; background-color: var(--button-color);"
          onclick={(e) => handleColorClick(color, e)}
          title="Apply color to selected hands"
        >
          <span 
            class="text-xs font-medium"
            style="color: black;"
          >
            {colorDisplayTexts[color] || 0}
          </span>
        </button>
      {/each}
    </div>
  </div>

    <!-- Made -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium whitespace-nowrap" style="color: var(--irongrid-color-text-secondary);">Made:</span>
      <div class="flex flex-nowrap gap-1 overflow-x-auto flex-1 min-w-0">
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('allMade') ? 'text-white border-red-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('allMade') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'allMade')}
        disabled={boardCards.length < 3}
      >
          All
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('onePair') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('onePair') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'onePair')}
        disabled={boardCards.length < 3}
      >
        One Pair
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('twoPair') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('twoPair') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'twoPair')}
        disabled={boardCards.length < 3}
      >
        Two Pair
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('threeOfAKind') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('threeOfAKind') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'threeOfAKind')}
        disabled={boardCards.length < 3}
      >
        Three of a Kind
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('fourOfAKind') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('fourOfAKind') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'fourOfAKind')}
        disabled={boardCards.length < 3}
      >
        Four of a Kind
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('straight') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('straight') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'straight')}
        disabled={boardCards.length < 3}
      >
        Straight
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('flush') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('flush') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'flush')}
        disabled={boardCards.length < 3}
      >
        Flush
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('fullHouse') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('fullHouse') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'fullHouse')}
        disabled={boardCards.length < 3}
      >
        Full House
      </button>
      </div>
    </div>

    <!-- Draws -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium whitespace-nowrap" style="color: var(--irongrid-color-text-secondary);">Draws:</span>
      <div class="flex flex-nowrap gap-1 overflow-x-auto flex-1 min-w-0">
        <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('allMadePlusDraws') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('allMadePlusDraws') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
          onclick={(e) => handleButtonClick(e, 'allMadePlusDraws')}
          disabled={boardCards.length >= 5}
        >
          All
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('comboDraw') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('comboDraw') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
          onclick={(e) => handleButtonClick(e, 'comboDraw')}
        disabled={boardCards.length >= 5}
      >
          Combo
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('flushDraw') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('flushDraw') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'flushDraw')}
        disabled={boardCards.length >= 5}
      >
          Flush
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('straightDraw') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('straightDraw') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
          onclick={(e) => handleButtonClick(e, 'straightDraw')}
        disabled={boardCards.length >= 5}
      >
          Straight
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('backdoorFlushDraw') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('backdoorFlushDraw') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'backdoorFlushDraw')}
        disabled={boardCards.length >= 5}
      >
          Bkdr Flush
      </button>
    </div>
  </div>

    <!-- Ranks -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium whitespace-nowrap" style="color: var(--irongrid-color-text-secondary);">Ranks:</span>
      <div class="flex flex-nowrap gap-1 overflow-x-auto flex-1 min-w-0">
      {#each RANKS as rank}
        <button
            class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('rank', rank) ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
            style="{isButtonActive('rank', rank) ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
          onclick={(e) => handleButtonClick(e, 'rank', rank)}
        >
          {rank}
        </button>
      {/each}
    </div>
    </div>

    <!-- Suits -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium whitespace-nowrap" style="color: var(--irongrid-color-text-secondary);">Suits:</span>
      <div class="flex flex-nowrap gap-1 overflow-x-auto flex-1 min-w-0">
        <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('suited') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('suited') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
          onclick={(e) => handleButtonClick(e, 'suited')}
        >
          Suited
        </button>
        <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('unsuited') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('unsuited') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
          onclick={(e) => handleButtonClick(e, 'unsuited')}
        >
          Unsuited
        </button>
        {#each SUITS as suit}
      <button
            class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('suit', suit.name) ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} {suit.color}"
            style="{isButtonActive('suit', suit.name) ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
            onclick={(e) => handleButtonClick(e, 'suit', suit.name)}
      >
            {suit.symbol}
      </button>
      <button
            class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('doubleSuit', suit.name) ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} {suit.color}"
            style="{isButtonActive('doubleSuit', suit.name) ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
            onclick={(e) => handleButtonClick(e, 'doubleSuit', suit.name)}
      >
            {suit.symbol}{suit.symbol}
      </button>
        {/each}
    </div>
  </div>

    <!-- Selected -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium whitespace-nowrap" style="color: var(--irongrid-color-text-secondary);">Selected:</span>
      <div class="flex flex-nowrap gap-1 overflow-x-auto flex-1 min-w-0">
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap {isButtonActive('all') ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
          style="{isButtonActive('all') ? 'background-color: var(--irongrid-color-primary); border-color: var(--irongrid-color-primary);' : ''}"
        onclick={(e) => handleButtonClick(e, 'all')}
      >
          All
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50 flex-shrink-0 whitespace-nowrap"
        onclick={handleUnselectAllClick}
      >
          Deselect
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50 flex-shrink-0 whitespace-nowrap"
        onclick={handleInverseSelectionClick}
      >
          Inverse
      </button>
      <button
          class="px-2 py-1 border rounded text-xs font-medium transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50 flex-shrink-0 whitespace-nowrap"
        onclick={handleClearAllClick}
      >
          Clear
      </button>
      </div>
    </div>
  </div>
</div>

<style>
  .hand-selector {
    padding: var(--irongrid-panel-padding);
    border: var(--irongrid-border-width) solid var(--irongrid-color-border);
    border-radius: var(--irongrid-border-radius-md);
    background-color: var(--irongrid-color-bg-secondary);
  }

  /* Hide scrollbar but keep scroll functionality */
  .hand-selector [class*="overflow-x-auto"] {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }

  .hand-selector [class*="overflow-x-auto"]::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }

  .pulsing {
    position: relative;
  }

  .pulsing::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: inherit;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      transparent 250deg,
      rgba(0, 0, 0, 0.3) 280deg,
      rgba(0, 0, 0, 0.5) 290deg,
      rgba(0, 0, 0, 0.3) 300deg,
      transparent 330deg,
      transparent 360deg
    );
    animation: borderRotate 1.5s linear infinite;
    pointer-events: none;
    z-index: 1;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    -webkit-mask-composite: xor;
    padding: 2px;
  }

  .pulsing > * {
    position: relative;
    z-index: 2;
  }

  @keyframes borderRotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
