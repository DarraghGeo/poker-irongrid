<script>
  /**
   * Grid.svelte
   * Purpose: Visual 13x13 poker grid displaying colors and selection; emits selectionChange.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  const dispatch = createEventDispatcher();

  export let hands = {};
  export let defaultColor = 'hsl(0, 0%, 100%)';
  export let defaultSelectedColor = 'hsl(0, 0%, 85%)';
  export let deadCards = [];
  export let manager = null; // PokerGridManager instance
  /** Whether the grid is interactive (allows clicking/selection). */
  export let interactive = true;
  /** Whether to show tooltips on click when non-interactive. */
  export let showTips = false;
  /** Whether to enable double-click details panel. */
  export let enableDetailsPanel = false;

  let isDragging = false;
  let tooltip = { visible: false, x: 0, y: 0, content: '' };
  let tooltipElement = null;
  let dragStartCell = null;
  let dragStartModifiers = { ctrl: false, shift: false };
  let dragCells = new Set(); // Stores hand strings for deduplication
  let dragCellInfos = new Map(); // Maps hand string to cellInfo for applying selection
  let longPressTimer = null;
  let longPressCellInfo = null;
  let touchStartPosition = null;
  let gridElement = null;

  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

  // Use manager methods if available, otherwise fallback to local functions
  function getCombinations(hand) {
    return manager ? manager.getCombinations(hand) : [];
  }

  function getHandData(combo, hand) {
    return manager ? manager.getHandData(combo, hand, hands) : { color: defaultColor, isSelected: false, hasExplicitColor: false };
  }

  function getCellInfo(rowIndex, colIndex) {
    return manager ? manager.getCellInfo(rowIndex, colIndex) : { hand: '', display: '', type: '' };
  }

  function getGradient(hand) {
    return manager ? manager.getGradient(hand, hands, deadCards) : `linear-gradient(to right, ${defaultColor})`;
  }
  $: handsLength = Object.keys(hands).length;
  $: handsString = JSON.stringify(hands);
  $: gradients = (() => {
    const result = {};
    try {
      const totalKeys = Object.keys(hands || {}).length;
      const selected = Object.keys(hands || {}).filter(k => Array.isArray(hands[k]) && hands[k].includes('selected')).length;
      void totalKeys;
      void selected;
    } catch (e) {
      // Ignore gradient recompute errors
    }
    ranks.forEach((rowRank, rowIndex) => {
      ranks.forEach((colRank, colIndex) => {
        const cellInfo = getCellInfo(rowIndex, colIndex);
        result[cellInfo.hand] = getGradient(cellInfo.hand);
      });
    });
    return result;
  })();

  function calculateTooltipContent(cellInfo) {
    if (!manager) return '0 of 0';
    const combinations = getCombinations(cellInfo.hand);
    const totalPossible = combinations.length; // Total possible for this hand type (6 for pairs, 4 for suited, 12 for offsuit)
    const validCombinations = combinations.filter(hand => {
      const card1 = hand.substring(0, 2);
      const card2 = hand.substring(2, 4);
      return !(deadCards.includes(card1) || deadCards.includes(card2));
    });
    
    if (totalPossible === 0) {
      return '0 of 0';
    }
    
    // Count highlighted combinations among all possible (not just valid ones after dead cards)
    const highlightedCount = combinations.filter(combo => {
      const handData = getHandData(combo, cellInfo.hand);
      return handData.hasExplicitColor;
    }).length;
    
    return `${highlightedCount} of ${totalPossible}`;
  }

  function showTooltip(event, cellInfo) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const content = calculateTooltipContent(cellInfo);
    tooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      content
    };
  }

  function hideTooltip() {
    tooltip = { visible: false, x: 0, y: 0, content: '' };
  }

  function handleDoubleClick(event, cellInfo) {
    if (!enableDetailsPanel) return;
    event.stopPropagation();
    dispatch('cellDetails', { cellInfo });
  }

  function handleLongPress(cellInfo) {
    if (!enableDetailsPanel) return;
    // Cancel any ongoing drag selection
    isDragging = false;
    dragStartCell = null;
    dragCells.clear();
    dragCellInfos.clear();
    dispatch('cellDetails', { cellInfo });
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressCellInfo = null;
    touchStartPosition = null;
  }

  function handleClick(event, cellInfo) {
    if (!interactive && showTips) {
      // Dispatch cellClick event for drawer opening instead of showing tooltip
      event.stopPropagation();
      dispatch('cellClick', { cellInfo });
      return;
    }
    if (!interactive || !manager) return;
    const modifiers = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey };
    const newHands = manager.handleSelection(hands, cellInfo, modifiers, deadCards);
    dispatch('selectionChange', { hands: newHands });
  }
  function handleKeyDown(event, cellInfo) {
    if (!interactive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event, cellInfo);
    }
  }
  function getEventCoordinates(event) {
    // Handle both mouse and touch events
    if (event.touches && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }

  function isInHitZone(event, cellElement) {
    const rect = cellElement.getBoundingClientRect();
    const cellSize = Math.min(rect.width, rect.height);
    const bufferSize = cellSize * 0.75;
    const bufferOffset = (cellSize - bufferSize) / 2;
    const coords = getEventCoordinates(event);
    const x = coords.x - rect.left;
    const y = coords.y - rect.top;
    return x >= bufferOffset && x <= bufferOffset + bufferSize && y >= bufferOffset && y <= bufferOffset + bufferSize;
  }
  function handleMouseDown(event, cellInfo) {
    if (!interactive) return;
    if (!isInHitZone(event, event.currentTarget)) return;
    isDragging = true;
    dragStartCell = cellInfo;
    dragStartModifiers = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey };
    dragCells.clear();
    dragCellInfos.clear();
    dragCells.add(cellInfo.hand);
    dragCellInfos.set(cellInfo.hand, cellInfo);
    applyDragSelection(cellInfo, dragStartModifiers);
    event.preventDefault();
  }
  function handleMouseMove(event) {
    if (!isDragging) return;
    const gridElement = event.currentTarget;
    const rect = gridElement.getBoundingClientRect();
    const cellSize = rect.width / 13;
    const coords = getEventCoordinates(event);
    const x = coords.x - rect.left;
    const y = coords.y - rect.top;
    const colIndex = Math.floor(x / cellSize);
    const rowIndex = Math.floor(y / cellSize);
    if (colIndex < 0 || colIndex >= 13 || rowIndex < 0 || rowIndex >= 13) return;
    const cellInfo = getCellInfo(rowIndex, colIndex);
    const cellRect = { left: colIndex * cellSize, top: rowIndex * cellSize, width: cellSize, height: cellSize };
    const bufferSize = cellSize * 0.75;
    const bufferOffset = (cellSize - bufferSize) / 2;
    const inHitZone = (x - cellRect.left) >= bufferOffset && (x - cellRect.left) <= bufferOffset + bufferSize && (y - cellRect.top) >= bufferOffset && (y - cellRect.top) <= bufferOffset + bufferSize;
    if (!inHitZone) return;
    if (!dragCells.has(cellInfo.hand)) {
      dragCells.add(cellInfo.hand);
      dragCellInfos.set(cellInfo.hand, cellInfo);
      // Apply selection to all accumulated cells during drag
      applyDragSelectionToAll(dragStartModifiers);
    }
  }
  function handleMouseUp() {
    if (!interactive || !isDragging) return;
      isDragging = false;
      dragStartCell = null;
      dragCells.clear();
      dragCellInfos.clear();
  }
  function handleTouchStart(event, cellInfo) {
    if (!interactive) return;
    const touch = event.touches[0];
    if (!touch) return;
    
    // Store touch start position for long press detection
    touchStartPosition = { x: touch.clientX, y: touch.clientY };
    longPressCellInfo = cellInfo;
    
    // Set up long press timer (500ms)
    longPressTimer = setTimeout(() => {
      if (longPressCellInfo) {
        handleLongPress(longPressCellInfo);
        clearLongPress();
      }
    }, 500);
    
    // Create a synthetic mouse event for compatibility
    const syntheticEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      currentTarget: event.currentTarget,
      touches: event.touches,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation()
    };
    
    if (!isInHitZone(syntheticEvent, event.currentTarget)) {
      clearLongPress();
      return;
    }
    event.preventDefault(); // Prevent scrolling
    handleMouseDown(syntheticEvent, cellInfo);
  }

  function handleTouchMove(event) {
    const touch = event.touches[0];
    if (!touch) return;
    
    // Cancel long press if finger moved too much (more than 10px)
    if (touchStartPosition && longPressTimer) {
      const dx = touch.clientX - touchStartPosition.x;
      const dy = touch.clientY - touchStartPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 10) {
        clearLongPress();
      }
    }
    
    if (!isDragging) return;
    event.preventDefault(); // Prevent scrolling during drag
    
    const syntheticEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      currentTarget: event.currentTarget,
      touches: event.touches
    };
    
    handleMouseMove(syntheticEvent);
  }

  function handleTouchEnd(event) {
    // Clear long press timer if touch ends before long press triggers
    clearLongPress();
    
    if (isDragging) {
      event.preventDefault();
    }
    handleMouseUp();
  }

  function handleGlobalMouseUp() { handleMouseUp(); }
  function handleGlobalTouchEnd() { handleMouseUp(); }
  function handleDocumentClick(event) {
    if (tooltipElement && !tooltipElement.contains(event.target)) {
      hideTooltip();
    }
  }

  function handleEscapeKey(event) {
    if (event.key === 'Escape') {
      hideTooltip();
    }
  }

  onMount(() => { 
    if (typeof document !== 'undefined') {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('keydown', handleEscapeKey);
      
      // Add touchmove listener to grid element with passive: false to allow preventDefault
      if (gridElement) {
        gridElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      }
    }
  });
  onDestroy(() => { 
    clearLongPress(); // Clean up long press timer
    if (typeof document !== 'undefined') {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleEscapeKey);
      
      // Remove touchmove listener from grid element
      if (gridElement) {
        gridElement.removeEventListener('touchmove', handleTouchMove);
      }
    }
  });
  function applyDragSelection(cellInfo, modifiers) {
    if (!interactive || !manager) return;
    const newHands = manager.handleSelection(hands, cellInfo, modifiers, deadCards);
    dispatch('selectionChange', { hands: newHands });
  }

  // Apply selection to all accumulated cells during drag
  function applyDragSelectionToAll(modifiers) {
    if (!interactive || !manager) return;
    
    // Get all cell infos from the accumulated drag cells
    const allCellInfos = Array.from(dragCellInfos.values());
    if (allCellInfos.length === 0) return;

    // Start with current hands state
    let newHands = { ...hands };
    
    // For normal drag (no modifiers), clear all selections first, then add all dragged cells
    if (!modifiers.ctrl && !modifiers.shift) {
      Object.keys(newHands).forEach(hand => { 
        newHands[hand] = (newHands[hand] || []).filter(item => item !== 'selected'); 
      });
    }

    // Apply selection to all accumulated cells
    allCellInfos.forEach(cellInfo => {
      const combinations = manager.getCombinations(cellInfo.hand);
      const validCombinations = combinations.filter(hand => {
        const card1 = hand.substring(0, 2);
        const card2 = hand.substring(2, 4);
        return !(deadCards.includes(card1) || deadCards.includes(card2));
      });
      
      validCombinations.forEach(hand => { 
        if (!newHands[hand]) newHands[hand] = [];
        
        if (modifiers.shift) {
          // Shift: Remove selection
          newHands[hand] = newHands[hand].filter(item => item !== 'selected');
        } else if (modifiers.ctrl) {
          // Ctrl: Add to selection
          if (!newHands[hand].includes('selected')) newHands[hand].push('selected');
        } else {
          // Normal: Add to selection (already cleared above)
          if (!newHands[hand].includes('selected')) newHands[hand].push('selected');
        }
      });
    });

    dispatch('selectionChange', { hands: newHands });
  }

  // Svelte action to handle touch events with non-passive listeners on cells
  function touchCellAction(node, cellInfo) {
    const touchStartHandler = (e) => handleTouchStart(e, cellInfo);
    const touchEndHandler = (e) => handleTouchEnd(e);

    node.addEventListener('touchstart', touchStartHandler, { passive: false });
    node.addEventListener('touchend', touchEndHandler, { passive: false });

    return {
      update(newCellInfo) {
        // Update handler if cellInfo changes
      },
      destroy() {
        node.removeEventListener('touchstart', touchStartHandler);
        node.removeEventListener('touchend', touchEndHandler);
      }
    };
  }
</script>

  <div class="poker-grid-container" role="region" aria-label="Poker hand grid container">
    <div class="poker-grid" bind:this={gridElement} onmousemove={handleMouseMove} role="application" aria-label="Poker hand selection grid" tabindex="0" onmouseup={handleMouseUp}>
    {#each Array(13) as _, rowIndex}
      {#each Array(13) as __, colIndex}
        {@const cellInfo = getCellInfo(rowIndex, colIndex)}
        {#if interactive || showTips}
          <button
            type="button"
            class="grid-cell {isDragging ? 'dragging' : ''} {interactive ? '' : showTips ? 'non-interactive show-tips' : 'non-interactive'}"
            style="background: {gradients[cellInfo.hand]} !important"
            onclick={(e) => handleClick(e, cellInfo)}
            ondblclick={(e) => handleDoubleClick(e, cellInfo)}
            onmousedown={(e) => handleMouseDown(e, cellInfo)}
            use:touchCellAction={cellInfo}
            onkeydown={(e) => handleKeyDown(e, cellInfo)}
            title={cellInfo.display}
          >
            <span class="cell-text">{cellInfo.display}</span>
          </button>
        {:else}
          <div
            class="grid-cell non-interactive"
            style="background: {gradients[cellInfo.hand]} !important"
            role="presentation"
            title={cellInfo.display}
          >
            <span class="cell-text">{cellInfo.display}</span>
          </div>
        {/if}
      {/each}
    {/each}
  </div>
</div>

{#if tooltip.visible}
  <div
    class="grid-tooltip"
    style="left: {tooltip.x}px; top: {tooltip.y}px;"
    role="tooltip"
    bind:this={tooltipElement}
  >
    <div class="grid-tooltip-content">{tooltip.content}</div>
    <div class="grid-tooltip-arrow"></div>
  </div>
{/if}

<style>
  .poker-grid-container { width: 100%; margin: 0 auto; padding: 0.125rem; touch-action: none; }
  .poker-grid { display: grid; grid-template-columns: repeat(13, 1fr); grid-template-rows: repeat(13, 1fr); gap: 0; border: 1px solid var(--poker-border); }
  .grid-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: opacity 0.15s ease; min-height: 28px; border-right: 1px solid var(--poker-border); border-bottom: 1px solid var(--poker-border); user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
  button.grid-cell { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; text-align: inherit; }
  .grid-cell:nth-child(13n) { border-right: none; }
  .grid-cell:nth-child(n + 157) { border-bottom: none; }
  .grid-cell.dragging { cursor: crosshair; }
  .grid-cell.non-interactive { cursor: default; pointer-events: none; }
  .grid-cell.non-interactive.show-tips { cursor: pointer; pointer-events: auto; }
  .cell-text { font-size: 0.75rem; font-weight: 600; color: var(--poker-text-primary); pointer-events: none; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  @media (max-width: 768px) { .poker-grid-container { padding: 0.25rem; } .poker-grid { gap: 0; } .grid-cell { min-height: 24px; } .cell-text { font-size: 0.625rem; } }
  @media (max-width: 480px) { .poker-grid-container { padding: 0.125rem; } .grid-cell { min-height: 20px; } .cell-text { font-size: 0.45rem; } }
  @media (max-width: 375px) { .poker-grid-container { padding: 0.1rem; } .grid-cell { min-height: 18px; } .cell-text { font-size: 0.4rem; } }

  .grid-tooltip {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    transform: translate(-50%, -100%);
    margin-top: -8px;
  }

  .grid-tooltip-content {
    background: var(--poker-black);
    color: var(--poker-white);
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .grid-tooltip-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid var(--poker-black);
  }
</style>

