<script>
  /**
   * DetailsPanel.svelte
   * Purpose: Display all possible combinations for a selected grid cell in a suit-organized table format.
   * Shows highlighted/selected combinations with colors and fades out impossible combinations.
   */
  import { SUITS } from '../utils/constants.js';
  
  export let selectedCell = null;
  export let hands = {}; // visibleHands - filtered by dead cards, same as grid uses
  export let deadCards = [];
  export let boardCards = [];
  export let defaultColor = 'hsl(0, 0%, 100%)';
  export let defaultSelectedColor = 'hsl(0, 0%, 85%)';
  export let manager = null; // PokerGridManager instance
  export let onClose = () => {};

  // Suit order: matches the order used in the poker grid (clubs, diamonds, hearts, spades)
  const suits = ['c', 'd', 'h', 's'];

  // 4-color suit scheme: Spades = Black, Clubs = Green, Diamonds = Blue, Hearts = Red
  const suitColors = {
    's': 'text-black',      // Spades = Black
    'c': 'text-green-600',  // Clubs = Green
    'd': 'text-blue-600',   // Diamonds = Blue
    'h': 'text-red-600'     // Hearts = Red
  };

  function getSuitInfo(suitCode) {
    const suit = SUITS.find(s => s.code === suitCode);
    if (!suit) return { code: suitCode, symbol: suitCode, color: 'text-black', name: suitCode };
    return {
      ...suit,
      color: suitColors[suitCode] || 'text-black'
    };
  }

  function getSuitSymbol(suitCode) {
    const suit = getSuitInfo(suitCode);
    return suit.symbol;
  }

  function getSuitIndex(suitCode) {
    return suits.indexOf(suitCode);
  }

  function formatComboWithSymbols(combo) {
    if (!combo || combo.length !== 4) {
      return { rank1: '', suit1Symbol: '', suit1Color: 'text-black', rank2: '', suit2Symbol: '', suit2Color: 'text-black' };
    }
    const rank1 = combo[0];
    const suit1Code = combo[1];
    const rank2 = combo[2];
    const suit2Code = combo[3];
    
    const suit1 = getSuitInfo(suit1Code);
    const suit2 = getSuitInfo(suit2Code);
    
    return { rank1, suit1Symbol: suit1.symbol, suit1Color: suit1.color, rank2, suit2Symbol: suit2.symbol, suit2Color: suit2.color };
  }

  function getCombinationForSuits(hand, rowSuit, colSuit) {
    if (!hand) return null;
    
    if (hand.length === 2) {
      // For pairs (e.g., AA): only show upper triangle to avoid duplicates
      // Only show if row suit index < column suit index
      const rowIndex = getSuitIndex(rowSuit);
      const colIndex = getSuitIndex(colSuit);
      if (rowIndex >= colIndex) return null;
      
      const rank = hand[0];
      return `${rank}${rowSuit}${rank}${colSuit}`;
    }
    
    const [r1, r2, type] = hand;
    
    if (type === 's') {
      // For suited: only diagonal cells (row suit = column suit)
      if (rowSuit === colSuit) {
        return `${r1}${rowSuit}${r2}${rowSuit}`;
      }
      return null;
    }
    
    if (type === 'o') {
      // For offsuit: all cells EXCEPT diagonal (row suit ≠ column suit)
      if (rowSuit !== colSuit) {
        return `${r1}${rowSuit}${r2}${colSuit}`;
      }
      return null;
    }
    
    return null;
  }

  // Reactive statement to ensure hands prop changes trigger updates
  // Stringifying to force reactivity when object contents change
  $: handsKey = JSON.stringify(hands);
  $: deadCardsKey = JSON.stringify(deadCards);
  $: boardCardsKey = JSON.stringify(boardCards);

  function getHandData(combo, hand) {
    if (!combo) return { color: defaultColor, isSelected: false, hasExplicitColor: false };
    return manager ? manager.getHandData(combo, hand, hands) : { color: defaultColor, isSelected: false, hasExplicitColor: false };
  }

  function isImpossible(combo) {
    if (!combo) return false;
    const card1 = combo.substring(0, 2);
    const card2 = combo.substring(2, 4);
    const allDeadCards = [...deadCards, ...boardCards];
    return allDeadCards.includes(card1) || allDeadCards.includes(card2);
  }
</script>

{#if selectedCell}
  {#key handsKey + deadCardsKey + boardCardsKey}
  <div class="details-panel">
    <div class="details-panel-header">
      <button 
        class="details-panel-close"
        onclick={onClose}
        aria-label="Close details panel"
      >
        ×
      </button>
    </div>
    <div class="details-panel-table">
      <!-- Column headers -->
      <div class="details-panel-corner"></div>
      {#each suits as colSuit}
        {@const suitInfo = getSuitInfo(colSuit)}
        <div class="details-panel-header-cell">
          <span class="suit-symbol {suitInfo.color}">{suitInfo.symbol}</span>
        </div>
      {/each}
      
      <!-- Rows with row headers and combo cells -->
      {#each suits as rowSuit (rowSuit)}
        {@const rowSuitInfo = getSuitInfo(rowSuit)}
        <!-- Row header -->
        <div class="details-panel-header-cell">
          <span class="suit-symbol {rowSuitInfo.color}">{rowSuitInfo.symbol}</span>
        </div>
        <!-- Combo cells for this row (all 4 columns) -->
        {#each suits as colSuit (colSuit)}
          {@const combo = getCombinationForSuits(selectedCell.hand, rowSuit, colSuit)}
          {@const handData = getHandData(combo, selectedCell.hand)}
          {@const { color, isSelected, hasExplicitColor } = handData}
          {@const impossible = combo ? isImpossible(combo) : false}
          {@const displayColor = isSelected ? (hasExplicitColor ? color : defaultSelectedColor) : (hasExplicitColor ? color : defaultColor)}
          <div 
            class="details-combo-cell {combo ? '' : 'empty'} {impossible ? 'impossible' : ''} {isSelected ? 'selected' : ''}"
            style="background-color: {combo ? displayColor : 'transparent'};"
          >
            {#if combo}
              {@const comboFormatted = formatComboWithSymbols(combo)}
              <span class="combo-text">
                <span class="combo-card">
                  <span class="combo-rank">{comboFormatted.rank1}</span>
                  <span class="combo-suit {comboFormatted.suit1Color}">{comboFormatted.suit1Symbol}</span>
                </span>
                <span class="combo-card">
                  <span class="combo-rank">{comboFormatted.rank2}</span>
                  <span class="combo-suit {comboFormatted.suit2Color}">{comboFormatted.suit2Symbol}</span>
                </span>
              </span>
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  </div>
  {/key}
{/if}

<style>
  .details-panel {
    margin-top: var(--irongrid-spacing-lg);
    padding: var(--irongrid-panel-padding);
    background-color: var(--irongrid-color-bg-secondary);
    border: var(--irongrid-border-width) solid var(--irongrid-color-border);
    border-radius: var(--irongrid-border-radius-md);
  }

  .details-panel-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: var(--irongrid-spacing-md);
    position: relative;
  }

  .details-panel-close {
    background: none;
    border: none;
    font-size: 1rem;
    line-height: 1;
    color: var(--irongrid-color-text-secondary);
    cursor: pointer;
    padding: var(--irongrid-spacing-sm);
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--irongrid-border-radius-sm);
    transition: all var(--irongrid-transition-fast);
    opacity: var(--irongrid-opacity-disabled);
  }

  .details-panel-close:hover {
    opacity: 1;
    background-color: var(--irongrid-color-bg-hover);
    color: var(--irongrid-color-text-tertiary);
  }

  .details-panel-table {
    display: grid;
    grid-template-columns: auto repeat(4, 1fr);
    gap: 0;
    font-size: var(--irongrid-font-size-base);
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    border-color: transparent !important;
    outline: none !important;
  }

  .details-panel-corner {
    background-color: var(--irongrid-color-bg-secondary);
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    border-color: transparent !important;
    border-top: none !important;
    border-right: none !important;
    border-bottom: none !important;
    border-left: none !important;
    outline: none !important;
  }

  .details-panel-header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--irongrid-spacing-sm);
    font-weight: var(--irongrid-font-weight-semibold);
    color: var(--irongrid-color-text-primary);
    background-color: var(--irongrid-color-bg-secondary);
    min-height: 1.5rem;
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    border-color: transparent !important;
    border-top: none !important;
    border-right: none !important;
    border-bottom: none !important;
    border-left: none !important;
    outline: none !important;
  }

  .suit-symbol {
    font-size: var(--irongrid-font-size-lg);
  }

  .details-combo-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--irongrid-spacing-sm) var(--irongrid-input-padding-x);
    min-height: 1.5rem;
    transition: opacity var(--irongrid-transition-fast);
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    border-color: transparent !important;
    border-top: none !important;
    border-right: none !important;
    border-bottom: none !important;
    border-left: none !important;
    outline: none !important;
  }

  .details-combo-cell.empty {
    background-color: transparent;
  }

  .details-combo-cell.impossible {
    opacity: var(--irongrid-opacity-impossible);
  }

  .details-combo-cell.selected {
    /* No visual indicator - selected state is handled by background color */
  }

  .combo-text {
    font-size: var(--irongrid-font-size-base);
    font-weight: var(--irongrid-font-weight-semibold);
    display: flex;
    align-items: center;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .combo-rank {
    color: var(--irongrid-color-text-primary);
  }

  .combo-suit {
    font-size: var(--irongrid-font-size-lg);
  }

  .combo-card {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }

  .combo-card + .combo-card {
    margin-left: var(--irongrid-spacing-sm);
  }

  @media (max-width: 768px) {
    .details-panel {
      padding: var(--irongrid-panel-padding);
    }

    .details-panel-title {
      font-size: var(--irongrid-font-size-md);
    }

    .combo-text {
      font-size: var(--irongrid-font-size-sm);
    }

    .suit-symbol {
      font-size: var(--irongrid-font-size-lg);
    }
  }
</style>
