<script>
  /** SelectionSummary: display counts for highlighted and selected combos. */
  import BitValModule from 'poker-bitvaljs';

  // Handle CommonJS export
  const BitVal = BitValModule?.default || BitValModule;

  export let highlighted = 0;
  export let selected = 0;
  export let evaluator = false;
  export let heroCards = [];
  export let boardCards = [];
  export let deadCards = [];
  export let hands = {};
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

  /** Evaluation state */
  let evaluationResults = null;
  let isEvaluating = false;
  let evaluationProgress = 0;
  let evaluationKey = 0;
  let lastEvaluationKey = '';

  /** Reset results when inputs change */
  $: {
    if (evaluator && (heroCards?.length !== 2 || !hasHandsOnGrid)) {
      evaluationResults = null;
    }
    const newKey = JSON.stringify({ heroCards, boardCards, deadCards, visibleHands });
    if (newKey !== lastEvaluationKey) {
      evaluationResults = null;
      lastEvaluationKey = newKey;
    }
    evaluationKey = newKey;
  }

  /** Check if there are hands on the grid to evaluate against */
  $: hasHandsOnGrid = visibleHands && Object.keys(visibleHands).length > 0;
  
  /** Check if button should be enabled */
  $: isButtonEnabled = evaluator && heroCards?.length === 2 && hasHandsOnGrid && !isEvaluating;
  
  /** Check if button should be visible (always show when evaluator is true, even if disabled) */
  $: showButton = evaluator;

  /** Run equity evaluation */
  async function runEvaluation() {
    if (!isButtonEnabled) return;
    
    isEvaluating = true;
    evaluationResults = null;
    evaluationProgress = 0;

    try {
      // Get villain hands from visibleHands (already filtered for dead cards)
      // Only hands that are highlighted (have colors) or selected
      // A hand is highlighted if its value array contains an HSL color string
      const hasExplicitColor = (values) => manager ? manager.hasExplicitColor(values) : false;
      const isSelected = (values) => manager ? manager.isSelected(values) : false;
      const villainHands = Object.entries(visibleHands || {})
        .filter(([hand, values]) => 
          hand && hand.length === 4 && // Valid hand format (e.g., 'AcKd')
          (hasExplicitColor(values) || isSelected(values)) // Has color or is selected
        )
        .map(([hand]) => hand);
      
      if (villainHands.length === 0) {
        isEvaluating = false;
        evaluationProgress = 0;
        return;
      }

      // Create hero hands array (single hand)
      const heroHand = heroCards[0] + heroCards[1];
      const heroHands = [heroHand];

      // Initialize BitVal
      const bitval = new BitVal();

      // numberOfBoardCards should always be 5 (total board cards to be dealt)
      // For preflop, boardCards is empty but numberOfBoardCards is still 5
      // For postflop, boardCards has known cards and numberOfBoardCards is 5
      const numberOfBoardCards = 5;
      
      // Dead cards for bitval: hero cards + dead cards from input (exclude board cards)
      // Hero cards MUST be included so they don't get dealt to villain
      // Board cards are excluded because bitval adds them internally
      const deadCardsFromInput = (deadCards || []).filter(card => 
        !(heroCards || []).includes(card) && !(boardCards || []).includes(card)
      );
      const deadCardsForBitval = [...heroCards, ...deadCardsFromInput];
      
      // Disable optimize mode when 3 or more board cards are present (flop, turn, river)
      // Optimize mode uses canonical caching which can introduce ±0.5% margin of error
      // For 0, 1, or 2 board cards, use optimization for speed
      // For 3+ board cards, accuracy is more important
      const boardCardsCount = (boardCards || []).length;
      const optimize = boardCardsCount < 3;
      
      // Progress callback to update progress percentage
      const progressCallback = (current, total, message) => {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        evaluationProgress = percentage;
      };
      
      // Prepare exact parameters for bitval.compareRange
      const bitvalParams = {
        heroHands,
        villainHands,
        boardCards: boardCards || [],
        deadCards: deadCardsForBitval,
        numberOfBoardCards,
        iterations: 10000,
        optimize,
        progressCallback
      };
      
      // Run evaluation
      const result = await bitval.compareRange(
        bitvalParams.heroHands,
        bitvalParams.villainHands,
        bitvalParams.boardCards,
        bitvalParams.deadCards,
        bitvalParams.numberOfBoardCards,
        bitvalParams.iterations,
        bitvalParams.optimize,
        bitvalParams.progressCallback
      );

      // Calculate equity
      const total = result.win + result.tie + result.lose;
      const heroEquity = total > 0 ? ((result.win + result.tie / 2) / total) * 100 : 0;
      const villainEquity = 100 - heroEquity;

      evaluationResults = {
        heroEquity: heroEquity,
        villainEquity: villainEquity
      };
      evaluationProgress = 100;
    } catch (error) {
      evaluationResults = null;
      evaluationProgress = 0;
    } finally {
      isEvaluating = false;
      // Reset progress after a brief delay to show 100%
      setTimeout(() => {
        if (!isEvaluating) {
          evaluationProgress = 0;
        }
      }, 500);
    }
  }
</script>

<div class="flex items-center justify-between mt-1">
  <span class="text-xs" style="color: var(--poker-text-secondary);">
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
    {#if evaluator && evaluationResults}
      <div class="text-xs" style="color: var(--poker-text-secondary);">
        <span>Hero: {Math.round(evaluationResults.heroEquity)}% vs. Villain: {Math.round(evaluationResults.villainEquity)}%</span>
      </div>
    {:else if evaluator && isEvaluating}
      <div class="text-xs" style="color: var(--poker-text-secondary);">
        <span>Evaluating: {evaluationProgress}%</span>
      </div>
    {:else if showButton}
      <button
        type="button"
        onclick={runEvaluation}
        disabled={!isButtonEnabled}
        class="px-2 py-1 text-xs rounded border transition-colors"
        style="
          background-color: {isButtonEnabled ? 'var(--poker-accent)' : 'var(--poker-border-light)'};
          color: {isButtonEnabled ? 'white' : 'var(--poker-text-secondary)'};
          border-color: {isButtonEnabled ? 'var(--poker-accent)' : 'var(--poker-border-light)'};
          cursor: {isButtonEnabled ? 'pointer' : 'not-allowed'};
          opacity: {isButtonEnabled ? '1' : '0.6'};
        "
        onmouseover={(e) => {
          if (isButtonEnabled) e.target.style.opacity = '0.9';
        }}
        onmouseout={(e) => {
          if (isButtonEnabled) e.target.style.opacity = '1';
        }}
      >
        Evaluate
      </button>
    {/if}
  </div>
</div>

<style>
</style>

