<script>
  /**
   * DeadCardsInput.svelte
   * Purpose: Compact inputs for hero, board, and dead cards. Emits normalized codes.
   * Events: 'deadCardsChange' with { deadCards, boardCards }
   */
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let deadCards = [];
  export let boardCards = [];
  export let heroCards = []; // Optional: explicitly provided hero cards

  let hero = '';
  let board = '';
  let dead = '';
  let initialized = false;

  /**
   * Format card array to display string (e.g., ["Ac", "Kd"] -> "A♣ K♦").
   * @param {string[]} cards
   * @returns {string}
   */
  function formatCardsForDisplay(cards) {
    if (!cards || cards.length === 0) return '';
    const suitMap = { 'c': '♣', 'd': '♦', 'h': '♥', 's': '♠' };
    return cards.map(card => {
      if (card.length === 2) {
        const rank = card[0].toUpperCase();
        const suit = card[1].toLowerCase();
        return rank + (suitMap[suit] || suit);
      }
      return card;
    }).join(' ');
  }

  /**
   * Initialize input fields from props.
   */
  function initializeFromProps() {
    if (initialized) return; // Only initialize once
    
    // Derive hero cards: if heroCards prop is provided, use it; otherwise try to derive
    let heroArr = [];
    if (heroCards && heroCards.length > 0) {
      heroArr = [...heroCards];
    } else if (deadCards && boardCards) {
      // Try to derive: deadCards minus boardCards (but this might include other dead cards)
      heroArr = deadCards.filter(card => !boardCards.includes(card));
    }
    
    // Derive other dead cards: deadCards minus heroCards minus boardCards
    const otherDead = deadCards.filter(card => 
      !heroArr.includes(card) && !boardCards.includes(card)
    );
    
    hero = formatCardsForDisplay(heroArr);
    board = formatCardsForDisplay(boardCards);
    dead = formatCardsForDisplay(otherDead);
    
    initialized = true;
  }

  // Initialize when props change (but only if not already manually edited)
  $: if (deadCards && deadCards.length > 0 && !initialized) {
    initializeFromProps();
  }
  
  // Reset initialization flag when deadCards/boardCards change externally (but not from user input)
  $: if (deadCards.length === 0 && boardCards.length === 0) {
    initialized = false;
  }

  /**
   * Format input string to convert suit letters to symbols.
   * @param {string} input
   * @returns {string}
   */
  function formatInput(input) {
    if (!input) return '';
    const suitMap = { 'c': '♣', 'd': '♦', 'h': '♥', 's': '♠' };
    return input.replace(/([AKQJT2-9])([cdhs])/gi, (match, rank, suit) => {
      return rank.toUpperCase() + suitMap[suit.toLowerCase()];
    });
  }

  /**
   * Handle input change with automatic formatting.
   * @param {Event} e
   * @param {'hero'|'board'|'dead'} type
   */
  function handleInput(e, type) {
    const input = e.target;
    const rawValue = input.value;
    const formatted = formatInput(rawValue);
    
    // Mark as initialized when user starts editing
    if (!initialized) {
      initialized = true;
    }
    
    if (formatted !== rawValue) {
      const cursorPos = input.selectionStart;
      const diff = formatted.length - rawValue.length;
      
      input.value = formatted;
      
      if (type === 'hero') hero = formatted;
      else if (type === 'board') board = formatted;
      else if (type === 'dead') dead = formatted;
      
      // Restore the caret right away: deferring it (e.g. to the next frame) moves it back
      // after any keys typed in between, so fast typing landed in the wrong place
      const newPos = Math.max(0, Math.min(cursorPos + diff, formatted.length));
      input.setSelectionRange(newPos, newPos);
    } else {
      if (type === 'hero') hero = rawValue;
      else if (type === 'board') board = rawValue;
      else if (type === 'dead') dead = rawValue;
    }
    
    emitChange();
  }

  /**
   * Convert a free-form input string to an array of two-character codes.
   * @param {string} input
   * @returns {string[]}
   */
  function normalizeTokens(input) {
    if (!input || !input.trim()) return [];
    const symbolMap = { '♣': 'c', '♦': 'd', '♥': 'h', '♠': 's' };
    const validRanks = new Set(['A','K','Q','J','T','9','8','7','6','5','4','3','2']);
    const validSuits = new Set(['c','d','h','s']);
    return input
      .replace(/[_,]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(tok => {
        if (!tok) return null;
        let t = tok.trim();
        t = t.replace(/[♣♦♥♠]/g, (m) => symbolMap[m] || m);
        const rank = t.charAt(0).toUpperCase();
        const suitRaw = t.charAt(1) || '';
        const suit = suitRaw.toLowerCase();
        if (validRanks.has(rank) && validSuits.has(suit)) {
          return rank + suit;
        }
        return null;
      })
      .filter(Boolean);
  }

  /** 
   * Handle input change and emit normalized arrays. 
   */
  function emitChange() {
    const heroArr = normalizeTokens(hero);
    const boardArr = normalizeTokens(board);
    const deadArr = normalizeTokens(dead);
    boardCards = [...boardArr];
    deadCards = [...heroArr, ...boardArr, ...deadArr];
    dispatch('deadCardsChange', { deadCards, boardCards, heroCards: heroArr });
  }
</script>

<input
  type="text"
  value={hero}
  oninput={(e) => handleInput(e, 'hero')}
  onfocus={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-accent)';
    e.target.style.boxShadow = 'var(--irongrid-shadow-sm)';
  }}
  onblur={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-border-light)';
    e.target.style.boxShadow = '';
  }}
  placeholder="Hero"
  class="w-20 px-1.5 py-1 border rounded text-xs focus:outline-none dead-card-input flex-shrink-0"
/>
<input
  type="text"
  value={board}
  oninput={(e) => handleInput(e, 'board')}
  onfocus={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-accent)';
    e.target.style.boxShadow = 'var(--irongrid-shadow-sm)';
  }}
  onblur={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-border-light)';
    e.target.style.boxShadow = '';
  }}
  placeholder="Board"
  class="w-20 px-1.5 py-1 border rounded text-xs focus:outline-none dead-card-input flex-shrink-0"
/>
<input
  type="text"
  value={dead}
  oninput={(e) => handleInput(e, 'dead')}
  onfocus={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-accent)';
    e.target.style.boxShadow = 'var(--irongrid-shadow-sm)';
  }}
  onblur={(e) => {
    e.target.style.borderColor = 'var(--irongrid-color-border-light)';
    e.target.style.boxShadow = '';
  }}
  placeholder="Dead"
  class="w-20 px-1.5 py-1 border rounded text-xs focus:outline-none dead-card-input flex-shrink-0"
/>

<style>
  .dead-card-input {
    border-color: var(--irongrid-color-border-light);
    color: var(--irongrid-color-text-primary);
    background-color: var(--irongrid-color-white);
    transition: border-color var(--irongrid-transition-base), box-shadow var(--irongrid-transition-base);
  }
</style>
