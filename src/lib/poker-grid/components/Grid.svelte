<script>
  /**
   * Grid.svelte
   * Purpose: Visual 13x13 poker grid displaying colors and selection; emits selectionChange.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  const dispatch = createEventDispatcher();

  export let hands = {};
  export let defaultColor = 'hsl(0, 0%, 100%)';
  // defaultSelectedColor is passed but only used by manager, not directly in this component
  export let defaultSelectedColor = 'hsl(0, 0%, 85%)';
  export let deadCards = [];
  export let manager = null; // PokerGridManager instance
  /** Whether the grid is interactive (allows clicking/selection). */
  export let interactive = true;
  /** Whether to show tooltips on click when non-interactive. */
  export let showTips = false;
  /** Whether to enable double-click details panel. */
  export let enableDetailsPanel = false;
  /**
   * Split the grid into 3x3 blocks: extra space after the T and 6 rows/columns (A-T, 9-6, 5-2).
   * The space is set by the --irongrid-subgrid-gap CSS variable.
   */
  export let subgrid = false;

  /** CSS grid line for a row/column index: with subgrid, spacer tracks follow T (index 4) and 6 (index 8). */
  function gridLine(index, split) {
    return index + 1 + (split ? (index >= 5 ? 1 : 0) + (index >= 9 ? 1 : 0) : 0);
  }

  /** The grid cell under a point (or null), from the cells' own positions, so it works with any spacing. */
  function cellAtPoint(gridElement, x, y) {
    const cells = gridElement.querySelectorAll('[data-row]');
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
        return { element: cell, rect: r, row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
      }
    }
    return null;
  }

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

  /**
   * How a cell looks: in range (combos colored or selected), the range color, lighter when only some of the
   * hand's live combos are in the range; out of range, a faint suited/offsuit/pair tint. Selected colored
   * combos get a ring.
   */
  /** Out-of-range tints (theme variables, with defaults). */
  const TINTS = {
    suited: 'var(--irongrid-cell-suited-bg, #eef0f9)',
    offsuit: 'var(--irongrid-cell-offsuit-bg, #f6f3ee)',
    paired: 'var(--irongrid-cell-paired-bg, #f1f2f4)'
  };

  function cellLook(hand, type, handsMap, dead) {
    const combos = getCombinations(hand);
    const live = combos.filter(c => !dead.includes(c.substring(0, 2)) && !dead.includes(c.substring(2, 4)));
    const counts = new Map();
    let inRange = 0;
    let selected = 0;
    let coloredSelected = 0;
    live.forEach(c => {
      const values = handsMap[c] || [];
      const color = manager ? manager.colorOf(values) : null;
      const isSelected = values.includes('selected');
      if (!color && !isSelected) return;
      inRange++;
      if (isSelected) selected++;
      if (color && isSelected) coloredSelected++;
      const key = color || defaultSelectedColor;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    if (live.length === 0) return { background: TINTS[type], inRange: false, dead: true, ring: '' };
    if (inRange === 0) return { background: TINTS[type], inRange: false, dead: false, ring: '' };
    let dominant = null;
    counts.forEach((n, color) => { if (!dominant || n > counts.get(dominant)) dominant = color; });
    const strength = Math.round(45 + 55 * (inRange / live.length));
    const ring = coloredSelected === 0 ? '' : selected === inRange ? 'full' : 'partial';
    return { background: `color-mix(in srgb, ${dominant} ${strength}%, white)`, inRange: true, dead: false, ring };
  }

  $: looks = (() => {
    const result = {};
    const dead = deadCards || [];
    ranks.forEach((_, rowIndex) => {
      ranks.forEach((__, colIndex) => {
        const cellInfo = getCellInfo(rowIndex, colIndex);
        result[cellInfo.hand] = cellLook(cellInfo.hand, cellInfo.type, hands || {}, dead);
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
    const coords = getEventCoordinates(event);
    const hit = cellAtPoint(gridElement, coords.x, coords.y);
    if (!hit) return;
    const cellInfo = getCellInfo(hit.row, hit.col);
    const cellSize = Math.min(hit.rect.width, hit.rect.height);
    const bufferSize = cellSize * 0.75;
    const bufferOffset = (cellSize - bufferSize) / 2;
    const x = coords.x - hit.rect.left;
    const y = coords.y - hit.rect.top;
    const inHitZone = x >= bufferOffset && x <= bufferOffset + bufferSize && y >= bufferOffset && y <= bufferOffset + bufferSize;
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
    <div class="poker-grid" class:subgrid bind:this={gridElement} onmousemove={handleMouseMove} role="application" aria-label="Poker hand selection grid" tabindex={interactive ? 0 : -1} onmouseup={handleMouseUp}>
    {#each Array(13) as _, rowIndex}
      {#each Array(13) as __, colIndex}
        {@const cellInfo = getCellInfo(rowIndex, colIndex)}
        {#if interactive || showTips}
          <button
            type="button"
            class="grid-cell {isDragging ? 'dragging' : ''} {interactive ? '' : showTips ? 'non-interactive show-tips' : 'non-interactive'}"
            class:in-range={looks[cellInfo.hand].inRange}
            class:dead={looks[cellInfo.hand].dead}
            class:ring-full={looks[cellInfo.hand].ring === 'full'}
            class:ring-partial={looks[cellInfo.hand].ring === 'partial'}
            style="background: {looks[cellInfo.hand].background} !important; grid-row: {gridLine(rowIndex, subgrid)}; grid-column: {gridLine(colIndex, subgrid)};"
            data-row={rowIndex}
            data-col={colIndex}
            onclick={(e) => handleClick(e, cellInfo)}
            ondblclick={(e) => handleDoubleClick(e, cellInfo)}
            onmousedown={(e) => handleMouseDown(e, cellInfo)}
            use:touchCellAction={cellInfo}
            onkeydown={(e) => handleKeyDown(e, cellInfo)}
            title={cellInfo.display}
          >
            <span class="cell-text">{cellInfo.hand.substring(0, 2)}</span>
          </button>
        {:else}
          <div
            class="grid-cell non-interactive"
            class:in-range={looks[cellInfo.hand].inRange}
            class:dead={looks[cellInfo.hand].dead}
            style="background: {looks[cellInfo.hand].background} !important; grid-row: {gridLine(rowIndex, subgrid)}; grid-column: {gridLine(colIndex, subgrid)};"
            data-row={rowIndex}
            data-col={colIndex}
            role="presentation"
            title={cellInfo.display}
          >
            <span class="cell-text">{cellInfo.hand.substring(0, 2)}</span>
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
  .poker-grid-container { 
    width: 100%; 
    margin: 0 auto; 
    padding: var(--irongrid-grid-container-padding); 
    touch-action: none; 
  }
  .poker-grid { 
    display: grid; 
    grid-template-columns: repeat(13, 1fr); 
    grid-template-rows: repeat(13, auto); 
    gap: var(--irongrid-cell-gap, 2px); 
  }
  /* 3x3 blocks: spacer tracks after T and 6 (A-T | 9-6 | 5-2) */
  .poker-grid.subgrid {
    grid-template-columns: repeat(5, 1fr) var(--irongrid-subgrid-gap, 4px) repeat(4, 1fr) var(--irongrid-subgrid-gap, 4px) repeat(4, 1fr);
    grid-template-rows: repeat(5, auto) var(--irongrid-subgrid-gap, 4px) repeat(4, auto) var(--irongrid-subgrid-gap, 4px) repeat(4, auto);
  }
  .grid-cell { 
    aspect-ratio: 1; 
    min-width: 0;
    display: flex; 
    align-items: center; 
    justify-content: center; 
    cursor: pointer; 
    border-radius: var(--irongrid-cell-radius, 3px); 
    transition: background-color var(--irongrid-transition-fast), box-shadow var(--irongrid-transition-fast); 
    user-select: none; 
    -webkit-user-select: none; 
    -moz-user-select: none; 
    -ms-user-select: none; 
  }
  button.grid-cell { 
    border: none; 
    padding: 0; 
    margin: 0; 
    font: inherit; 
    color: inherit; 
    text-align: inherit; 
  }
  .grid-cell.ring-full { 
    box-shadow: inset 0 0 0 2px var(--irongrid-cell-ring-color, #1f2937); 
  }
  .grid-cell.ring-partial { 
    box-shadow: inset 0 0 0 1px var(--irongrid-cell-ring-color, #1f2937); 
  }
  .grid-cell.dead { 
    opacity: 0.45; 
  }
  .grid-cell.dragging { 
    cursor: crosshair; 
  }
  .grid-cell.non-interactive { 
    cursor: default; 
    pointer-events: none; 
  }
  .grid-cell.non-interactive.show-tips { 
    cursor: pointer; 
    pointer-events: auto; 
  }
  .cell-text { 
    font-size: var(--irongrid-cell-font-size, 0.8125rem); 
    font-weight: 500; 
    letter-spacing: 0.01em; 
    color: var(--irongrid-cell-muted-text, #a3a8b3); 
    pointer-events: none; 
    text-rendering: optimizeLegibility; 
    -webkit-font-smoothing: antialiased; 
    -moz-osx-font-smoothing: grayscale; 
  }
  .grid-cell.in-range .cell-text { 
    font-weight: 700; 
    color: var(--irongrid-color-text-primary); 
  }
  @media (max-width: 480px) { 
    .cell-text { 
      font-size: var(--irongrid-cell-font-size-mobile, 0.6875rem); 
    } 
  }

  .grid-tooltip {
    position: fixed;
    z-index: var(--irongrid-z-tooltip);
    pointer-events: none;
    transform: translate(-50%, -100%);
    margin-top: calc(-1 * var(--irongrid-tooltip-offset));
  }

  .grid-tooltip-content {
    background: var(--irongrid-color-black);
    color: var(--irongrid-color-white);
    padding: var(--irongrid-spacing-md) var(--irongrid-spacing-lg);
    border-radius: var(--irongrid-border-radius-lg);
    font-size: var(--irongrid-font-size-lg);
    font-weight: var(--irongrid-font-weight-semibold);
    white-space: nowrap;
    box-shadow: var(--irongrid-shadow-md);
  }

  .grid-tooltip-arrow {
    position: absolute;
    bottom: calc(-1 * var(--irongrid-tooltip-arrow-size));
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: var(--irongrid-tooltip-arrow-size) solid transparent;
    border-right: var(--irongrid-tooltip-arrow-size) solid transparent;
    border-top: var(--irongrid-tooltip-arrow-size) solid var(--irongrid-color-black);
  }
</style>

