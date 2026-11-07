<script>
  /**
   * HandSelector.svelte
   * Purpose: Range controls under the grid: color chips, selection, a Made x Draw / Made x Equity table,
   * rank filters and a suit matrix. Every table, rank and suit cell selects its combos (click replaces the
   * selection, ctrl/cmd adds, shift removes); a color chip then colors the selection.
   */
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** Visible hands (dead combos already removed). */
  export let hands = {};
  export let boardCards = [];
  export let evaluator = false;
  export let heroCards = [];
  export let colors = [];
  /** Color for selected combos without a color. */
  export let defaultSelectedColor = 'hsl(0, 0%, 85%)';
  /** Live equity from PokerGridPanel: { hero, villain, combos, byColor, byCombo } or null. */
  export let equity = null;
  /** True while a newer equity result is being calculated. */
  export let equityPending = false;
  export let manager = null; // PokerGridManager instance

  const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const SUITS = [
    { code: 'c', symbol: '♣', red: false },
    { code: 'd', symbol: '♦', red: true },
    { code: 'h', symbol: '♥', red: true },
    { code: 's', symbol: '♠', red: false }
  ];
  const MADE_ROWS = [
    { key: 'highCard', label: 'High card' },
    { key: 'onePair', label: 'One pair' },
    { key: 'twoPair', label: 'Two pair' },
    { key: 'trips', label: 'Trips' },
    { key: 'straight', label: 'Straight' },
    { key: 'flush', label: 'Flush' },
    { key: 'fullHouse', label: 'Full house' },
    { key: 'quads', label: 'Quads' },
    { key: 'straightFlush', label: 'Str. flush' }
  ];
  const DRAW_COLUMNS = [
    { key: 'none', label: 'None' },
    { key: 'straight', label: 'Straight' },
    { key: 'flush', label: 'Flush' },
    { key: 'combo', label: 'Combo' },
    { key: 'backdoorFlush', label: 'Bkdr F', title: 'Backdoor flush draw (with a backdoor straight draw too)' },
    { key: 'backdoorStraight', label: 'Bkdr S', title: 'Backdoor straight draw' }
  ];
  /** Hero's equity against the combos, in five bands. */
  const EQUITY_COLUMNS = [
    { key: 0, label: '<20%' },
    { key: 1, label: '20–40' },
    { key: 2, label: '40–60' },
    { key: 3, label: '60–80' },
    { key: 4, label: '80%+' }
  ];

  /** Color chips show the share of the range (%), the combo count (#) or hero's equity (Eq). */
  let chipMode = 'percentage';
  /** The table's columns: draws or hero's equity. */
  let tableMode = 'draw';

  // ---------- helpers ----------

  const modifiersOf = (event) => ({ ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey });
  const colorOf = (values) => (manager ? manager.colorOf(values) : null);
  const isSelected = (values) => Array.isArray(values) && values.includes('selected');

  /** 49%, 9.1%, <1%, 0% */
  function formatPercent(value) {
    if (!value) return '0%';
    if (value < 1) return '<1%';
    if (value < 9.95) return `${value.toFixed(1)}%`;
    return `${Math.round(value)}%`;
  }

  /**
   * Background for a group of combos: their colors side by side (by share), mixed with white by `strength`
   * (0-1), so fuller cells read darker.
   */
  function compositionBackground(combos, strength) {
    if (!combos.length) return 'transparent';
    const counts = new Map();
    combos.forEach(h => {
      const color = colorOf(hands[h]) || defaultSelectedColor;
      counts.set(color, (counts.get(color) || 0) + 1);
    });
    const mix = Math.round(25 + 75 * strength);
    const stops = [];
    let start = 0;
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([color, n]) => {
      const end = start + (n / combos.length) * 100;
      const shade = `color-mix(in srgb, ${color} ${mix}%, white)`;
      stops.push(`${shade} ${start.toFixed(2)}%`, `${shade} ${end.toFixed(2)}%`);
      start = end;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  function select(event, combos) {
    if (!manager || combos.length === 0) return;
    dispatch('selectionChange', { hands: manager.selectCombos(hands, combos, modifiersOf(event)) });
  }

  // ---------- range ----------

  $: rangeCombos = manager ? manager.getRangeCombos(hands || {}) : [];
  $: total = rangeCombos.length;
  $: selectedCount = rangeCombos.filter(h => isSelected(hands[h])).length;
  $: share = (n) => (total > 0 ? (n / total) * 100 : 0);

  // ---------- color chips ----------

  $: colorCombos = (() => {
    const byColor = {};
    colors.forEach(c => { byColor[c] = []; });
    rangeCombos.forEach(h => {
      const color = colorOf(hands[h]);
      if (color && byColor[color]) byColor[color].push(h);
    });
    return byColor;
  })();

  $: chipText = (color) => {
    const n = colorCombos[color]?.length || 0;
    if (chipMode === 'count') return String(n);
    if (chipMode === 'equity') {
      const value = equity?.byColor?.[color];
      return value === null || value === undefined ? '–' : `${Math.round(value)}%`;
    }
    return formatPercent(share(n));
  };

  function cycleChipMode() {
    const modes = evaluator ? ['percentage', 'count', 'equity'] : ['percentage', 'count'];
    chipMode = modes[(modes.indexOf(chipMode) + 1) % modes.length];
  }
  $: chipModeLabel = chipMode === 'count' ? '#' : chipMode === 'equity' ? 'Eq' : '%';

  function handleColorClick(event, color) {
    if (!manager) return;
    dispatch('selectionChange', { hands: manager.handleColorAction(color, modifiersOf(event), hands) });
  }

  function handleClear() {
    if (!manager) return;
    dispatch('selectionChange', { hands: manager.clearAll(hands) });
    dispatch('clearAll');
  }

  // ---------- selection ----------

  function selectAll(event) {
    select(event, rangeCombos);
  }

  function invertSelection() {
    if (!manager) return;
    dispatch('selectionChange', { hands: manager.invertRangeSelection(hands) });
  }

  $: hasHero = heroCards?.length === 2;
  $: equityText = !evaluator
    ? ''
    : !hasHero
      ? total > 0 ? 'Enter 2 hero cards for equity' : ''
      : equity && equity.hero !== null && equity.hero !== undefined
        ? `Hero ${Math.round(equity.hero)}% · Villain ${Math.round(equity.villain)}%`
        : equityPending ? 'Calculating…' : '';

  // ---------- Made x Draw / Made x Equity ----------

  $: hasBoard = (boardCards?.length || 0) >= 3;
  $: classification = manager && hasBoard ? manager.classifyCombos(rangeCombos, boardCards) : new Map();
  $: columns = tableMode === 'equity' ? EQUITY_COLUMNS : DRAW_COLUMNS;

  /** { rows, columns, cells: Map('row|col' -> combos), rowCombos, colCombos, max } */
  $: table = (() => {
    const cells = new Map();
    const rowCombos = new Map();
    const colCombos = new Map();
    const add = (row, col, h) => {
      const key = `${row}|${col}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(h);
      if (!rowCombos.has(row)) rowCombos.set(row, []);
      rowCombos.get(row).push(h);
      if (!colCombos.has(col)) colCombos.set(col, []);
      colCombos.get(col).push(h);
    };
    const byCombo = equity?.byCombo || {};
    rangeCombos.forEach(h => {
      const row = hasBoard ? classification.get(h)?.made : 'all';
      if (!row) return;
      if (tableMode === 'equity') {
        const value = byCombo[h];
        if (value === null || value === undefined) return;
        add(row, Math.min(4, Math.floor(value / 20)), h);
      } else if (hasBoard) {
        add(row, classification.get(h).draw, h);
      }
    });
    const rows = hasBoard
      ? MADE_ROWS.filter(r => rowCombos.has(r.key))
      : rowCombos.has('all') ? [{ key: 'all', label: 'All' }] : [];
    let max = 0;
    cells.forEach(list => { max = Math.max(max, list.length); });
    return { rows, cells, rowCombos, colCombos, max };
  })();

  $: tableHint = tableMode === 'draw'
    ? !hasBoard ? 'Add a flop to see made hands and draws' : total === 0 ? 'No hands in the range' : ''
    : !evaluator ? 'Equity is off' : !hasHero ? 'Enter 2 hero cards to see equity' : total === 0 ? 'No hands in the range' : table.rows.length === 0 ? (equityPending ? 'Calculating…' : '') : '';

  // ---------- ranks and suits ----------

  $: rankCombos = (rank) => rangeCombos.filter(h => h[0] === rank || h[2] === rank);
  $: suitPairCombos = (a, b) => rangeCombos.filter(h => (h[1] === a && h[3] === b) || (h[1] === b && h[3] === a));
  $: suitCombos = (suit) => rangeCombos.filter(h => h[1] === suit || h[3] === suit);
  $: suitMatrix = (() => {
    const cells = {};
    let max = 0;
    SUITS.forEach((a, i) => SUITS.forEach((b, j) => {
      if (j < i) return;
      const combos = suitPairCombos(a.code, b.code);
      cells[a.code + b.code] = combos;
      max = Math.max(max, combos.length);
    }));
    return { cells, max };
  })();
  $: suitedCombos = rangeCombos.filter(h => h[1] === h[3]);
  $: offsuitCombos = rangeCombos.filter(h => h[1] !== h[3]);
</script>

<div class="range-controls">
  <!-- Colors -->
  <div class="chip-row">
    <button type="button" class="mode-toggle" onclick={cycleChipMode} title="Show each color's share (%), combos (#) or hero's equity against it (Eq)">{chipModeLabel}</button>
    {#each colors as color (color)}
      {@const n = colorCombos[color]?.length || 0}
      <button
        type="button"
        class="chip"
        class:empty={n === 0}
        style="--chip-color: {color};"
        onclick={(e) => handleColorClick(e, color)}
        title="Color the selected hands (with nothing selected: select this color's hands)"
      >{chipText(color)}</button>
    {/each}
    <button type="button" class="clear" onclick={handleClear} title="Clear the grid" aria-label="Clear the grid">×</button>
  </div>

  <!-- Selection -->
  <div class="selection-row">
    <span class="muted">{formatPercent(share(selectedCount))} selected</span>
    {#if equityText}
      <span class="equity" class:pending={equityPending} aria-live="polite">{equityText}</span>
    {/if}
    <span class="links">
      <button type="button" class="link" onclick={selectAll}>All</button>
      <button type="button" class="link" onclick={invertSelection}>Invert</button>
    </span>
  </div>

  <!-- Made x Draw / Equity -->
  <div class="section-head">
    <span class="label">Made ×</span>
    <div class="segmented" role="tablist">
      <button type="button" role="tab" aria-selected={tableMode === 'draw'} class:active={tableMode === 'draw'} onclick={() => (tableMode = 'draw')}>Draw</button>
      <button type="button" role="tab" aria-selected={tableMode === 'equity'} class:active={tableMode === 'equity'} onclick={() => (tableMode = 'equity')} title="Hero's equity against the hands">Equity</button>
    </div>
  </div>
  {#if tableHint}
    <p class="hint">{tableHint}</p>
  {:else}
    <div class="made-table" style="--columns: {columns.length};">
      <span></span>
      {#each columns as column (column.key)}
        {@const combos = table.colCombos.get(column.key) || []}
        <button type="button" class="head" disabled={!combos.length} title={column.title || ''} onclick={(e) => select(e, combos)}>{column.label}</button>
      {/each}
      {#each table.rows as row (row.key)}
        <button type="button" class="head row-head" onclick={(e) => select(e, table.rowCombos.get(row.key) || [])}>{row.label}</button>
        {#each columns as column (column.key)}
          {@const combos = table.cells.get(`${row.key}|${column.key}`) || []}
          <button
            type="button"
            class="cell"
            disabled={!combos.length}
            style="background: {compositionBackground(combos, table.max ? combos.length / table.max : 0)};"
            onclick={(e) => select(e, combos)}
            title={combos.length ? `${combos.length} combos` : ''}
          >{combos.length ? formatPercent(share(combos.length)) : ''}</button>
        {/each}
      {/each}
    </div>
  {/if}

  <!-- Ranks -->
  <div class="section-head"><span class="label">Rank</span></div>
  <div class="rank-row">
    {#each RANKS as rank (rank)}
      {@const combos = rankCombos(rank)}
      <button type="button" class="pill" disabled={!combos.length} onclick={(e) => select(e, combos)}>{rank}</button>
    {/each}
  </div>

  <!-- Suits -->
  <div class="section-head">
    <span class="label">Suit</span>
    <span class="links">
      <button type="button" class="pill" disabled={!suitedCombos.length} onclick={(e) => select(e, suitedCombos)}>Suited</button>
      <button type="button" class="pill" disabled={!offsuitCombos.length} onclick={(e) => select(e, offsuitCombos)}>Offsuit</button>
    </span>
  </div>
  <div class="suit-matrix">
    <span></span>
    {#each SUITS as suit (suit.code)}
      <button type="button" class="head suit" class:red={suit.red} onclick={(e) => select(e, suitCombos(suit.code))}>{suit.symbol}</button>
    {/each}
    {#each SUITS as rowSuit, i (rowSuit.code)}
      <button type="button" class="head suit" class:red={rowSuit.red} onclick={(e) => select(e, suitCombos(rowSuit.code))}>{rowSuit.symbol}</button>
      {#each SUITS as colSuit, j (colSuit.code)}
        {#if j < i}
          <span></span>
        {:else}
          {@const combos = suitMatrix.cells[rowSuit.code + colSuit.code] || []}
          <button
            type="button"
            class="cell"
            disabled={!combos.length}
            style="background: {compositionBackground(combos, suitMatrix.max ? combos.length / suitMatrix.max : 0)};"
            onclick={(e) => select(e, combos)}
            title={`${rowSuit.symbol}${colSuit.symbol}: ${combos.length} combos`}
          >{combos.length ? formatPercent(share(combos.length)) : ''}</button>
        {/if}
      {/each}
    {/each}
  </div>
</div>

<style>
  .range-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: var(--irongrid-font-family, inherit);
    font-size: 0.8125rem;
    color: var(--irongrid-color-text-primary, #111827);
  }
  button {
    font: inherit;
    color: inherit;
    border: none;
    margin: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:disabled {
    cursor: default;
  }
  .muted,
  .label,
  .hint {
    color: var(--irongrid-color-text-secondary, #6b7280);
  }
  .label {
    font-size: 0.75rem;
  }
  .hint {
    margin: 0;
    font-size: 0.75rem;
  }

  /* Colors */
  .chip-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .mode-toggle {
    min-width: 1.75rem;
    padding: 0.25rem 0.375rem;
    background: transparent;
    color: var(--irongrid-color-text-secondary, #6b7280);
    font-weight: 600;
  }
  .chip {
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0.25rem;
    border-radius: 0.375rem;
    background: var(--chip-color);
    font-weight: 600;
  }
  .chip.empty {
    background: color-mix(in srgb, var(--chip-color) 35%, white);
    color: var(--irongrid-color-text-secondary, #6b7280);
    font-weight: 500;
  }
  .clear {
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    background: var(--irongrid-control-bg, #f3f4f6);
    color: var(--irongrid-color-text-secondary, #6b7280);
  }

  /* Selection */
  .selection-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8125rem;
  }
  .equity {
    color: var(--irongrid-color-text-primary, #111827);
    transition: opacity 120ms ease;
  }
  .equity.pending {
    opacity: 0.55;
  }
  .links {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
  }
  .link {
    padding: 0.125rem 0.25rem;
    background: transparent;
  }
  .link:hover {
    text-decoration: underline;
  }

  /* Section heads */
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.25rem;
  }
  .segmented {
    display: flex;
    gap: 0.125rem;
    padding: 0.125rem;
    border-radius: 0.375rem;
    background: var(--irongrid-control-bg, #f3f4f6);
  }
  .segmented button {
    padding: 0.1875rem 0.5rem;
    border-radius: 0.25rem;
    background: transparent;
    font-size: 0.75rem;
  }
  .segmented button.active {
    background: var(--irongrid-color-text-primary, #111827);
    color: #fff;
    font-weight: 600;
  }

  /* Tables */
  .made-table,
  .suit-matrix {
    display: grid;
    gap: 0.1875rem;
  }
  .made-table {
    grid-template-columns: minmax(4.25rem, 1.2fr) repeat(var(--columns), minmax(0, 1fr));
  }
  .suit-matrix {
    grid-template-columns: 2rem repeat(4, minmax(0, 1fr));
  }
  .head,
  .cell {
    min-height: 1.875rem;
    padding: 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .head {
    background: var(--irongrid-control-bg, #f3f4f6);
    font-weight: 500;
  }
  .row-head {
    text-align: left;
    padding-left: 0.5rem;
  }
  .cell {
    background: transparent;
    border: 1px solid var(--irongrid-control-bg, #f3f4f6);
    font-weight: 600;
  }
  .cell:disabled {
    font-weight: 400;
  }
  .suit {
    font-size: 0.9375rem;
  }
  .suit.red {
    color: #dc2626;
  }
  .head:not(:disabled):hover,
  .cell:not(:disabled):hover,
  .pill:not(:disabled):hover {
    filter: brightness(0.95);
  }

  /* Ranks */
  .rank-row {
    display: grid;
    grid-template-columns: repeat(13, minmax(0, 1fr));
    gap: 0.1875rem;
  }
  .pill {
    padding: 0.3125rem 0.25rem;
    border-radius: 0.25rem;
    background: transparent;
    border: 1px solid var(--irongrid-control-border, #e5e7eb);
    font-size: 0.75rem;
    text-align: center;
  }
  .pill:disabled {
    color: var(--irongrid-cell-muted-text, #a3a8b3);
  }
</style>
