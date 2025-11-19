/**
 * PokerGridManager.js
 * Purpose: Centralized business logic for poker-grid component.
 * Manages state, filtering, selection, colors, and calculations.
 */
import { RangeManager } from 'poker-rangeman';
import { evaluateHand } from 'poker-extval';
import BitValModule from 'poker-bitvaljs';
import { SUITS } from './utils/constants.js';

// Handle CommonJS export
const BitVal = BitValModule?.default || BitValModule;

// Criteria mappings for RangeManager.hitsHand()
const strengthCriteriaMap = {
  'onePair': ['Pair'],
  'twoPair': ['Two Pair'],
  'threeOfAKind': ['Three of a Kind'],
  'flush': ['Flush'],
  'straight': ['Straight'],
  'fullHouse': ['Full House'],
  'fourOfAKind': ['Four of a Kind']
};

const drawCriteriaMap = {
  'flushDraw': ['Flush Draw'],
  'straightDraw': ['Straight Draw'],
  'comboDraw': ['Combo Draw'],
  'backdoorFlushDraw': ['Backdoor Flush Draw']
};

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS_ARRAY = ['c', 'd', 'h', 's'];

export class PokerGridManager {
  constructor(options = {}) {
    this.hands = options.hands || {};
    this.deadCards = options.deadCards || [];
    this.boardCards = options.boardCards || [];
    this.heroCards = options.heroCards || [];
    this.colors = options.colors || [];
    this.defaultColor = options.defaultColor || 'hsl(0, 0%, 100%)';
    this.defaultSelectedColor = options.defaultSelectedColor || 'hsl(0, 0%, 85%)';
    
    // Internal state
    this.selectedColor = null;
    this.lastHandsLength = 0;
  }

  // ==================== Core Methods ====================

  /**
   * Convert hands array to object if needed.
   * @param {Array|Object} handsInput
   * @returns {Object}
   */
  convertHandsArrayToObject(handsInput) {
    if (Array.isArray(handsInput)) {
      const handsObj = {};
      const availableColors = this.colors.length > 0 ? this.colors : [this.defaultColor];
      // Reset color if hands array changed significantly
      if (this.selectedColor === null || Math.abs(handsInput.length - this.lastHandsLength) > 5) {
        this.selectedColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        this.lastHandsLength = handsInput.length;
      }
      const color = this.selectedColor;
      handsInput.forEach(combo => {
        if (combo && typeof combo === 'string' && combo.length === 4) {
          if (!handsObj[combo]) handsObj[combo] = [];
          if (!handsObj[combo].includes(color)) handsObj[combo].push(color);
        }
      });
      return handsObj;
    }
    return handsInput || {};
  }

  /**
   * Get all combinations for a hand type (AA, AKs, AKo).
   * @param {string} hand - Hand notation (e.g., 'AA', 'AKs', 'AKo')
   * @returns {string[]} Array of combo strings (e.g., ['AcAd', 'AcAh', ...])
   */
  getCombinations(hand) {
    if (hand.length === 2) {
      const rank = hand[0];
      return SUITS_ARRAY.flatMap((s1, i) => SUITS_ARRAY.slice(i + 1).map(s2 => `${rank}${s1}${rank}${s2}`));
    }
    const [r1, r2, type] = hand;
    if (type === 's') return SUITS_ARRAY.map(s => `${r1}${s}${r2}${s}`);
    if (type === 'o') return SUITS_ARRAY.flatMap(s1 => SUITS_ARRAY.filter(s2 => s2 !== s1).map(s2 => `${r1}${s1}${r2}${s2}`));
    return [];
  }

  /**
   * Get hand data (color, selection state) for a combo.
   * @param {string} combo - Combo string (e.g., 'AcKd')
   * @param {string} hand - Hand abstraction (e.g., 'AKo')
   * @param {Object} hands - Hands object to check
   * @returns {{color: string, isSelected: boolean, hasExplicitColor: boolean}}
   */
  getHandData(combo, hand, hands = this.hands) {
    let data = hands[combo] || [];
    if (data.length === 0) data = hands[hand] || [];
    const foundColor = data.find(item => item?.startsWith('hsl('));
    const color = foundColor || this.defaultColor;
    const isSelected = data.includes('selected');
    const hasExplicitColor = !!foundColor;
    return { color, isSelected, hasExplicitColor };
  }

  /**
   * Filter hands by dead cards.
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards array
   * @returns {Object} Filtered hands object
   */
  filterByDeadCards(hands, deadCards = this.deadCards) {
    const entries = Object.entries(hands || {});
    if (!entries.length) return {};
    const filtered = entries.filter(([k]) => {
      if (k.length === 4) {
        const card1 = k.substring(0, 2);
        const card2 = k.substring(2, 4);
        return !(deadCards?.includes(card1) || deadCards?.includes(card2));
      }
      return true;
    });
    return filtered.reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
  }

  /**
   * Get cell info for grid position.
   * @param {number} rowIndex - Row index (0-12)
   * @param {number} colIndex - Column index (0-12)
   * @returns {{hand: string, display: string, type: string}}
   */
  getCellInfo(rowIndex, colIndex) {
    const rowRank = RANKS[rowIndex];
    const colRank = RANKS[colIndex];
    if (rowIndex === colIndex) return { hand: `${rowRank}${rowRank}`, display: `${rowRank}${rowRank}`, type: 'paired' };
    if (rowIndex < colIndex) return { hand: `${rowRank}${colRank}s`, display: `${rowRank}${colRank}s`, type: 'suited' };
    return { hand: `${colRank}${rowRank}o`, display: `${colRank}${rowRank}o`, type: 'offsuit' };
  }

  /**
   * Calculate gradient string for a hand.
   * @param {string} hand - Hand notation
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards
   * @returns {string} CSS gradient string
   */
  getGradient(hand, hands = this.hands, deadCards = this.deadCards) {
    const combinations = this.getCombinations(hand);
    const hasAnySelected = this.hasAnySelectedHands(hands);
    const steps = combinations.map((combo, i) => {
      const { color, isSelected, hasExplicitColor } = this.getHandData(combo, hand, hands);
      const finalColor = this.applyEffects(color, isSelected, hasExplicitColor, hasAnySelected);
      const start = (i * 100) / combinations.length;
      const end = ((i + 1) * 100) / combinations.length;
      return `${finalColor} ${start}%, ${finalColor} ${end}%`;
    });
    return `linear-gradient(to right, ${steps.join(', ')})`;
  }

  // ==================== Selection Methods ====================

  /**
   * Handle selection from grid click/drag.
   * @param {Object} hands - Current hands object
   * @param {Object} cellInfo - Cell info from getCellInfo
   * @param {Object} modifiers - {ctrl: boolean, shift: boolean}
   * @param {string[]} deadCards - Dead cards
   * @returns {Object} Updated hands object
   */
  handleSelection(hands, cellInfo, modifiers, deadCards = this.deadCards) {
    const combinations = this.getCombinations(cellInfo.hand);
    const validCombinations = combinations.filter(hand => {
      const card1 = hand.substring(0, 2);
      const card2 = hand.substring(2, 4);
      return !(deadCards.includes(card1) || deadCards.includes(card2));
    });
    if (validCombinations.length === 0) return hands;
    
    let newHands = { ...hands };
    combinations.forEach(hand => { if (!newHands[hand]) newHands[hand] = []; });
    
    if (modifiers.shift) {
      validCombinations.forEach(hand => { 
        newHands[hand] = newHands[hand].filter(item => item !== 'selected'); 
      });
    } else if (modifiers.ctrl) {
      validCombinations.forEach(hand => { 
        if (!newHands[hand].includes('selected')) newHands[hand].push('selected'); 
      });
    } else {
      Object.keys(newHands).forEach(hand => { 
        newHands[hand] = newHands[hand].filter(item => item !== 'selected'); 
      });
      validCombinations.forEach(hand => { newHands[hand].push('selected'); });
    }
    
    return newHands;
  }

  /**
   * Clear all selections.
   * @param {Object} hands - Current hands object
   * @returns {Object} Updated hands object
   */
  clearAll(hands = this.hands) {
    return {};
  }

  /**
   * Inverse selection state.
   * @param {Object} hands - Current hands object
   * @returns {Object} Updated hands object
   */
  inverseSelection(hands = this.hands) {
    const newHands = { ...hands };
    Object.keys(newHands).forEach(h => {
      if ((newHands[h] || []).includes('selected')) {
        newHands[h] = (newHands[h] || []).filter(item => item !== 'selected');
      } else {
        if (!newHands[h]) newHands[h] = [];
        newHands[h].push('selected');
      }
    });
    return newHands;
  }

  /**
   * Unselect all hands.
   * @param {Object} hands - Current hands object
   * @returns {Object} Updated hands object
   */
  unselectAll(hands = this.hands) {
    const newHands = { ...hands };
    Object.keys(newHands).forEach(h => {
      newHands[h] = (newHands[h] || []).filter(item => item !== 'selected');
    });
    return newHands;
  }

  /**
   * Remove selected hands entirely.
   * @param {Object} hands - Current hands object
   * @returns {Object} Updated hands object
   */
  removeSelected(hands = this.hands) {
    const newHands = { ...hands };
    const selectedHands = Object.keys(newHands).filter(h => 
      Array.isArray(newHands[h]) && newHands[h].includes('selected')
    );
    selectedHands.forEach(h => delete newHands[h]);
    return newHands;
  }

  // ==================== Filtering Methods ====================

  /**
   * Helper to create RangeManager from hands object with optional dead cards exclusion.
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {RangeManager} RangeManager instance
   */
  getHandsRangeManager(hands = this.hands, deadCards = []) {
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return new RangeManager([]);
    const rm = new RangeManager(allHands);
    return deadCards.length > 0 ? rm.exclude(deadCards) : rm;
  }

  /**
   * Helper to convert RangeManager result to matching hands object.
   * @param {RangeManager} rmResult - RangeManager instance
   * @param {Object} hands - Hands object to match against
   * @returns {Object} Matching hands object
   */
  rangeManagerToMatching(rmResult, hands = this.hands) {
    const matching = {};
    rmResult.toArray().forEach(hand => {
      if (hands[hand]) matching[hand] = hands[hand];
    });
    return matching;
  }

  /**
   * Unified batch filtering function using RangeManager.hitsHand().
   * @param {string[]} criteria - Array of RangeManager criteria
   * @param {string[]} boardCards - Board cards
   * @param {Object} hands - Hands object to filter
   * @returns {Promise<Object>} Filtered hands object
   */
  async getFilteredHandsByCriteria(criteria, boardCards = this.boardCards, hands = this.hands) {
    const allHands = Object.keys(hands);
    if (allHands.length === 0 || !criteria || criteria.length === 0) return {};
    
    if (!boardCards || boardCards.length < 3) return {};
    
    try {
      const rm = new RangeManager(allHands);
      const matched = await rm.hitsHand(criteria, boardCards);
      return this.rangeManagerToMatching(matched, hands);
    } catch (error) {
      // Swallow errors silently to keep UI responsive
      return {};
    }
  }

  /**
   * Get hands matching a rank.
   * @param {string} rank - Rank (A, K, Q, etc.)
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {Object} Matching hands
   */
  getHandsByRank(rank, hands = this.hands, deadCards = []) {
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return {};
    try {
      const rankRange = `${rank}Xs,${rank}Xo`;
      const currentRm = this.getHandsRangeManager(hands, deadCards);
      const matched = currentRm.intersect(rankRange);
      return this.rangeManagerToMatching(matched, hands);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get hands matching a suit.
   * @param {string} suitName - Suit name (clubs, diamonds, hearts, spades)
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {Object} Matching hands
   */
  getHandsBySuit(suitName, hands = this.hands, deadCards = []) {
    const suitCode = SUITS.find(s => s.name === suitName)?.code;
    if (!suitCode) return {};
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return {};
    try {
      const currentRm = this.getHandsRangeManager(hands, deadCards);
      const matched = currentRm.hasSuit(suitCode);
      return this.rangeManagerToMatching(matched, hands);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get hands with both cards of a suit.
   * @param {string} suitName - Suit name
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {Object} Matching hands
   */
  getHandsByDoubleSuit(suitName, hands = this.hands, deadCards = []) {
    const suitCode = SUITS.find(s => s.name === suitName)?.code;
    if (!suitCode) return {};
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return {};
    try {
      const currentRm = this.getHandsRangeManager(hands, deadCards);
      const matched = currentRm.suitedOf(suitCode);
      return this.rangeManagerToMatching(matched, hands);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get paired hands.
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {Object} Matching hands
   */
  getPairedHands(hands = this.hands, deadCards = []) {
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return {};
    try {
      const currentRm = this.getHandsRangeManager(hands, deadCards);
      const matched = currentRm.intersect('22+');
      return this.rangeManagerToMatching(matched, hands);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get suited hands.
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {Object} Matching hands
   */
  getSuitedHands(hands = this.hands, deadCards = []) {
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return {};
    try {
      const currentRm = this.getHandsRangeManager(hands, deadCards);
      // Use method chaining to combine all suited hands
      let allSuited = new RangeManager([]);
      ['c', 'd', 'h', 's'].forEach(suit => {
        allSuited = allSuited.include(currentRm.suitedOf(suit));
      });
      return this.rangeManagerToMatching(allSuited, hands);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get offsuit hands.
   * @param {Object} hands - Hands object
   * @param {string[]} deadCards - Dead cards to exclude
   * @returns {Object} Matching hands
   */
  getOffsuitHands(hands = this.hands, deadCards = []) {
    const allHands = Object.keys(hands);
    if (allHands.length === 0) return {};
    try {
      const currentRm = this.getHandsRangeManager(hands, deadCards);
      // Use method chaining to combine all offsuit hands
      // For offsuit: get hands that have the suit but exclude suited hands
      let allOffsuit = new RangeManager([]);
      ['c', 'd', 'h', 's'].forEach(suit => {
        // Get hands that have this suit, then exclude suited hands
        const hasSuit = currentRm.hasSuit(suit);
        const suited = currentRm.suitedOf(suit);
        const offsuit = hasSuit.exclude(suited);
        allOffsuit = allOffsuit.include(offsuit);
      });
      return this.rangeManagerToMatching(allOffsuit, hands);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get hands with explicit colors.
   * @param {Object} hands - Hands object
   * @returns {Object} Matching hands
   */
  getHandsWithColors(hands = this.hands) {
    const matching = {};
    Object.keys(hands).forEach(h => {
      if (Array.isArray(hands[h]) && hands[h].some(item => typeof item === 'string' && item.startsWith('hsl('))) {
        matching[h] = hands[h];
      }
    });
    return matching;
  }

  /**
   * Get array of hand strings with a specific color.
   * @param {string} color - Color to find
   * @param {Object} hands - Hands object
   * @returns {string[]} Array of hand strings
   */
  getHandsWithColor(color, hands = this.hands) {
    return Object.keys(hands).filter(h => 
      Array.isArray(hands[h]) && hands[h].some(item => item === color)
    );
  }

  /**
   * Get selected hands.
   * @param {Object} hands - Hands object
   * @returns {Object} Matching hands
   */
  getSelectedHands(hands = this.hands) {
    const matching = {};
    Object.keys(hands).forEach(h => {
      if (Array.isArray(hands[h]) && hands[h].includes('selected')) matching[h] = hands[h];
    });
    return matching;
  }

  /**
   * Get hand strength type.
   * @param {string} hand - Hand code
   * @param {string[]} boardCards - Board cards
   * @returns {string|null} Hand strength type
   */
  getHandStrengthType(hand, boardCards = this.boardCards) {
    if (!boardCards || boardCards.length < 3) return null;
    try {
      const handCard1 = hand.substring(0, 2);
      const handCard2 = hand.substring(2, 4);
      const allCards = [...boardCards, handCard1, handCard2];
      const evaluation = evaluateHand(allCards);
      
      const evalObj = Object.values(evaluation)[0];
      if (!evalObj) return null;

      if (evalObj.isRoyalFlush) return 'royalFlush';
      if (evalObj.isStraightFlush) return 'straightFlush';
      if (evalObj.isFourOfAKind) return 'fourOfAKind';
      if (evalObj.isFullHouse) return 'fullHouse';
      if (evalObj.isFlush) return 'flush';
      if (evalObj.isStraight) return 'straight';
      if (evalObj.isThreeOfAKind) return 'threeOfAKind';
      if (evalObj.isTwoPair) return 'twoPair';
      if (evalObj.isPair) return 'onePair';
      if (evalObj.isHighCard) return 'highCard';
      return null;
    } catch (error) {
      return null;
      return null;
    }
  }

  /**
   * Get hands by hand strength.
   * @param {string} targetStrength - Strength type
   * @param {Object} hands - Hands object
   * @param {string[]} boardCards - Board cards
   * @returns {Promise<Object>} Matching hands
   */
  async getHandsByStrength(targetStrength, hands = this.hands, boardCards = this.boardCards) {
    const criteria = strengthCriteriaMap[targetStrength];
    if (!criteria) return {};
    return await this.getFilteredHandsByCriteria(criteria, boardCards, hands);
  }

  /**
   * Get hands by draw type.
   * @param {string} targetDraw - Draw type
   * @param {Object} hands - Hands object
   * @param {string[]} boardCards - Board cards
   * @param {number} boardLength - Board length
   * @returns {Promise<Object>} Matching hands
   */
  async getHandsByDraw(targetDraw, hands = this.hands, boardCards = this.boardCards, boardLength = null) {
    if (boardLength === null) boardLength = boardCards.length;
    if (boardLength >= 5) return {};
    
    const criteria = drawCriteriaMap[targetDraw];
    if (!criteria) return {};
    
    const drawHands = await this.getFilteredHandsByCriteria(criteria, boardCards, hands);
    
    // For combo draw, we need hands that have BOTH flush and straight draws
    if (targetDraw === 'comboDraw') {
      const flushDrawHands = await this.getFilteredHandsByCriteria(['Flush Draw'], boardCards, hands);
      const straightDrawHands = await this.getFilteredHandsByCriteria(['Straight Draw'], boardCards, hands);
      
      const flushHandsArray = Object.keys(flushDrawHands);
      const straightHandsArray = Object.keys(straightDrawHands);
      
      if (flushHandsArray.length === 0 || straightHandsArray.length === 0) return {};
      
      const flushHandsSet = new Set(flushHandsArray);
      const comboHandsArray = straightHandsArray.filter(hand => flushHandsSet.has(hand));
      
      if (comboHandsArray.length === 0) return {};
      
      const madeHandsCriteria = ['Straight', 'Flush', 'Full House', 'Four of a Kind'];
      const madeHandsRm = await this.getFilteredHandsByCriteria(madeHandsCriteria, boardCards, hands);
      const madeHandsSet = new Set(Object.keys(madeHandsRm));
      const comboOnlyHands = comboHandsArray.filter(hand => !madeHandsSet.has(hand));
      
      if (comboOnlyHands.length === 0) return {};
      const finalRm = new RangeManager(comboOnlyHands);
      return this.rangeManagerToMatching(finalRm, hands);
    }
    
    // For backdoor draws, filter out regular draws
    if (targetDraw === 'backdoorFlushDraw') {
      const regularFlushDraws = await this.getFilteredHandsByCriteria(['Flush Draw'], boardCards, hands);
      const backdoorHandsArray = Object.keys(drawHands);
      const regularHandsSet = new Set(Object.keys(regularFlushDraws));
      
      if (backdoorHandsArray.length === 0) return {};
      const backdoorOnlyHands = backdoorHandsArray.filter(hand => !regularHandsSet.has(hand));
      if (backdoorOnlyHands.length === 0) return {};
      
      const backdoorOnlyRm = new RangeManager(backdoorOnlyHands);
      return this.rangeManagerToMatching(backdoorOnlyRm, hands);
    }
    
    
    // For regular flush/straight draws, exclude made hands
    const madeHandsCriteria = ['Straight', 'Flush', 'Full House', 'Four of a Kind'];
    const madeHandsRm = await this.getFilteredHandsByCriteria(madeHandsCriteria, boardCards, hands);
    const drawHandsArray = Object.keys(drawHands);
    const madeHandsSet = new Set(Object.keys(madeHandsRm));
    
    if (drawHandsArray.length === 0) return {};
    const drawOnlyHands = drawHandsArray.filter(hand => !madeHandsSet.has(hand));
    if (drawOnlyHands.length === 0) return {};
    
    const drawOnlyRm = new RangeManager(drawOnlyHands);
    return this.rangeManagerToMatching(drawOnlyRm, hands);
  }

  // ==================== Color Methods ====================

  /**
   * Apply color to hands.
   * @param {Object} hands - Current hands object
   * @param {string} color - Color to apply
   * @param {string[]} targetHands - Array of hand strings to color
   * @returns {Object} Updated hands object
   */
  applyColor(hands, color, targetHands) {
    const newHands = { ...hands };
    targetHands.forEach(h => {
      if (!newHands[h]) newHands[h] = [];
      // Remove existing colors but keep 'selected'
      newHands[h] = newHands[h].filter(item => !item.startsWith('hsl('));
      newHands[h].push(color);
    });
    return newHands;
  }

  /**
   * Remove color from hands.
   * @param {Object} hands - Current hands object
   * @param {string} color - Color to remove
   * @returns {Object} Updated hands object
   */
  removeColor(hands, color) {
    const newHands = { ...hands };
    Object.keys(newHands).forEach(h => {
      newHands[h] = (newHands[h] || []).filter(item => item !== color);
    });
    return newHands;
  }

  /**
   * Calculate color equities.
   * @param {Object} hands - Hands object
   * @param {string[]} heroCards - Hero cards
   * @param {string[]} boardCards - Board cards
   * @param {string[]} deadCards - Dead cards
   * @param {string[]} colors - Colors array
   * @returns {Promise<Object>} Color equities object
   */
  async calculateColorEquities(hands = this.hands, heroCards = this.heroCards, boardCards = this.boardCards, deadCards = this.deadCards, colors = this.colors) {
    if (heroCards?.length !== 2) {
      return {};
    }

    try {
      const coloredHands = Object.keys(hands).filter(h => 
        Array.isArray(hands[h]) && hands[h].some(item => typeof item === 'string' && item.startsWith('hsl('))
      );

      if (coloredHands.length === 0) {
        const equities = {};
        colors.forEach(c => equities[c] = 0);
        return equities;
      }

      const bitval = new BitVal();
      const heroHand = heroCards[0] + heroCards[1];
      const heroHands = [heroHand];
      const numberOfBoardCards = 5;
      
      const deadCardsFromInput = (deadCards || []).filter(card => 
        !(heroCards || []).includes(card) && !(boardCards || []).includes(card)
      );
      const deadCardsForBitval = [...heroCards, ...deadCardsFromInput];
      
      const boardCardsCount = (boardCards || []).length;
      const optimize = boardCardsCount < 3;

      const equities = {};
      
      for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        
        const colorHands = coloredHands.filter(h => 
          hands[h].some(item => item === color)
        );

        if (colorHands.length === 0) {
          equities[color] = 0;
          continue;
        }

        try {
          const result = await bitval.compareRange(
            heroHands,
            colorHands,
            boardCards || [],
            deadCardsForBitval,
            numberOfBoardCards,
            10000,
            optimize,
            null
          );

          const total = result.win + result.tie + result.lose;
          const heroEquity = total > 0 ? ((result.win + result.tie / 2) / total) * 100 : 0;
          equities[color] = Math.round(heroEquity);
        } catch (error) {
          return;
          equities[color] = 0;
        }
      }
      
      return equities;
    } catch (error) {
      return;
      return {};
    }
  }

  // ==================== Range Methods ====================

  /**
   * Apply predefined range.
   * @param {string} rangeName - Range name
   * @param {Array} ranges - Ranges array
   * @param {Object} hands - Current hands object
   * @returns {{hands: Object, rangeName: string}} Updated hands and range name
   */
  applyRange(rangeName, ranges, hands = this.hands) {
    const selectedRange = ranges.find(r => r.name === rangeName);
    if (!selectedRange) {
      return { hands, rangeName: null };
    }
    
    const rm = new RangeManager(selectedRange.abbreviation);
    const rangeHands = rm.toArray();
    let newHands = { ...hands };
    Object.keys(newHands).forEach(h => {
      newHands[h] = newHands[h].filter(item => item !== 'selected');
    });
    rangeHands.forEach(h => {
      if (!newHands[h]) newHands[h] = [];
      if (!newHands[h].includes('selected')) newHands[h].push('selected');
    });
    
    return { hands: newHands, rangeName };
  }

  // ==================== Utility Methods ====================

  /**
   * Check if values array has explicit color.
   * @param {Array} values - Values array
   * @returns {boolean}
   */
  hasExplicitColor(values) {
    if (!values || !Array.isArray(values)) return false;
    return values.some((v) => typeof v === 'string' && v.startsWith('hsl('));
  }

  /**
   * Check if values array has selected state.
   * @param {Array} values - Values array
   * @returns {boolean}
   */
  isSelected(values) {
    if (!values || !Array.isArray(values)) return false;
    return values.includes('selected');
  }

  /**
   * Check if any hands are selected.
   * @param {Object} hands - Hands object
   * @returns {boolean}
   */
  hasAnySelectedHands(hands = this.hands) {
    return Object.values(hands).some(data => data.includes('selected'));
  }

  /**
   * Make color faint (reduce saturation and lightness).
   * @param {string} color - HSL color string
   * @returns {string} Faint color
   */
  makeFaint(color) {
    const match = color.match(/hsl\(([^,]+),\s*([^,]+)%?,\s*([^)]+)%?\)/);
    if (!match) return color;
    const [, h] = match;
    const newS = 50;
    const newL = 85;
    return `hsl(${h}, ${newS}%, ${newL}%)`;
  }

  /**
   * Apply visual effects to color based on selection state.
   * @param {string} color - Base color
   * @param {boolean} isSelected - Is selected
   * @param {boolean} hasExplicitColor - Has explicit color
   * @param {boolean} hasAnySelected - Any hands selected
   * @returns {string} Final color
   */
  applyEffects(color, isSelected, hasExplicitColor, hasAnySelected = false) {
    if (isSelected) return hasExplicitColor ? color : this.defaultSelectedColor;
    if (hasAnySelected && hasExplicitColor) return this.makeFaint(color);
    return color;
  }

  /**
   * Get highlighted hands from visible hands.
   * @param {Object} visibleHands - Visible hands object
   * @returns {string[]} Array of hand strings
   */
  getHighlightedHands(visibleHands) {
    return Object.entries(visibleHands || {})
      .filter(([hand, values]) => 
        hand && hand.length === 4 && this.hasExplicitColor(values)
      )
      .map(([hand]) => hand)
      .sort();
  }

  /**
   * Get selected hands from visible hands.
   * @param {Object} visibleHands - Visible hands object
   * @returns {string[]} Array of hand strings
   */
  getSelectedHandsFromVisible(visibleHands) {
    return Object.entries(visibleHands || {})
      .filter(([hand, values]) => 
        hand && hand.length === 4 && this.isSelected(values)
      )
      .map(([hand]) => hand)
      .sort();
  }

  // ==================== Selection with Modifiers ====================

  /**
   * Apply selection state based on modifiers (ctrl, shift, normal).
   * @param {Object} hands - Current hands object
   * @param {Object} filteredHands - Filtered hands to apply selection to
   * @param {Object} modifiers - {ctrl: boolean, shift: boolean}
   * @param {string[]} strengthFilters - Array of filter types that are strength-based
   * @param {string} filterType - Filter type for determining if it's a strength filter
   * @returns {Object} Updated hands object
   */
  applySelectionWithModifiers(hands, filteredHands, modifiers, strengthFilters = [], filterType = '') {
    let newSelection = { ...hands };
    const isStrengthFilter = strengthFilters.includes(filterType);
    
    if (modifiers.shift) {
      // Shift: Remove selection from filtered hands
      Object.keys(filteredHands).forEach(h => {
        newSelection[h] = (newSelection[h] || []).filter(item => item !== 'selected');
      });
    } else if (modifiers.ctrl) {
      // Ctrl: Add selection to filtered hands
      Object.keys(filteredHands).forEach(h => {
        if (!newSelection[h]) newSelection[h] = [];
        if (!newSelection[h].includes('selected')) newSelection[h].push('selected');
      });
    } else {
      // Normal: Clear all, then select filtered hands
      Object.keys(newSelection).forEach(h => {
        newSelection[h] = (newSelection[h] || []).filter(item => item !== 'selected');
      });
      
      let finalFiltered = {};
      if (isStrengthFilter) {
        finalFiltered = filteredHands;
      } else {
        // For non-strength filters, only select from currently selected or colored hands
        const selectedHands = this.getSelectedHands(hands);
        const handsToFilter = Object.keys(selectedHands).length > 0 ? selectedHands : this.getHandsWithColors(hands);
        Object.keys(handsToFilter).forEach(h => {
          if (filteredHands[h]) finalFiltered[h] = handsToFilter[h];
        });
      }
      
      Object.keys(finalFiltered).forEach(h => {
        if (!newSelection[h]) newSelection[h] = [];
        newSelection[h].push('selected');
      });
    }
    
    return newSelection;
  }

  // ==================== Filter Selection Methods ====================

  /**
   * Apply filter selection with modifiers (consolidates handleButtonClick logic).
   * @param {string} filterType - Filter type (rank, suit, paired, etc.)
   * @param {string|null} filterValue - Filter value (rank letter, suit name, etc.)
   * @param {Object} modifiers - {ctrl: boolean, shift: boolean}
   * @param {Object} hands - Current hands object
   * @param {string[]} boardCards - Board cards
   * @returns {Promise<Object>} Updated hands object
   */
  async applyFilterSelection(filterType, filterValue, modifiers, hands, boardCards = this.boardCards) {
    let filteredHands = {};
    
    switch (filterType) {
      case 'rank':
        filteredHands = this.getHandsByRank(filterValue, hands);
        break;
      case 'suit':
        filteredHands = this.getHandsBySuit(filterValue, hands);
        break;
      case 'doubleSuit':
        filteredHands = this.getHandsByDoubleSuit(filterValue, hands);
        break;
      case 'paired':
        filteredHands = this.getPairedHands(hands);
        break;
      case 'suited':
        filteredHands = this.getSuitedHands(hands);
        break;
      case 'unsuited':
        filteredHands = this.getOffsuitHands(hands);
        break;
      case 'colored':
        filteredHands = this.getHandsWithColors(hands);
        break;
      case 'all':
        filteredHands = { ...hands };
        break;
      case 'onePair':
        filteredHands = await this.getHandsByStrength('onePair', hands, boardCards);
        break;
      case 'twoPair':
        filteredHands = await this.getHandsByStrength('twoPair', hands, boardCards);
        break;
      case 'threeOfAKind':
        filteredHands = await this.getHandsByStrength('threeOfAKind', hands, boardCards);
        break;
      case 'fourOfAKind':
        filteredHands = await this.getHandsByStrength('fourOfAKind', hands, boardCards);
        break;
      case 'straight':
        filteredHands = await this.getHandsByStrength('straight', hands, boardCards);
        break;
      case 'flush':
        filteredHands = await this.getHandsByStrength('flush', hands, boardCards);
        break;
      case 'fullHouse':
        filteredHands = await this.getHandsByStrength('fullHouse', hands, boardCards);
        break;
      case 'straightDraw':
        filteredHands = await this.getHandsByDraw('straightDraw', hands, boardCards, boardCards.length);
        break;
      case 'flushDraw':
        filteredHands = await this.getHandsByDraw('flushDraw', hands, boardCards, boardCards.length);
        break;
      case 'comboDraw':
        filteredHands = await this.getHandsByDraw('comboDraw', hands, boardCards, boardCards.length);
        break;
      case 'backdoorFlushDraw':
        filteredHands = await this.getHandsByDraw('backdoorFlushDraw', hands, boardCards, boardCards.length);
        break;
      case 'allMade':
        filteredHands = {
          ...(await this.getHandsByStrength('onePair', hands, boardCards)),
          ...(await this.getHandsByStrength('twoPair', hands, boardCards)),
          ...(await this.getHandsByStrength('threeOfAKind', hands, boardCards)),
          ...(await this.getHandsByStrength('fourOfAKind', hands, boardCards)),
          ...(await this.getHandsByStrength('straight', hands, boardCards)),
          ...(await this.getHandsByStrength('flush', hands, boardCards)),
          ...(await this.getHandsByStrength('fullHouse', hands, boardCards))
        };
        break;
      case 'allMadePlusDraws':
        filteredHands = {
          ...(await this.getHandsByStrength('onePair', hands, boardCards)),
          ...(await this.getHandsByStrength('twoPair', hands, boardCards)),
          ...(await this.getHandsByStrength('threeOfAKind', hands, boardCards)),
          ...(await this.getHandsByStrength('fourOfAKind', hands, boardCards)),
          ...(await this.getHandsByStrength('straight', hands, boardCards)),
          ...(await this.getHandsByStrength('flush', hands, boardCards)),
          ...(await this.getHandsByStrength('fullHouse', hands, boardCards)),
          ...(await this.getHandsByDraw('straightDraw', hands, boardCards, boardCards.length)),
          ...(await this.getHandsByDraw('flushDraw', hands, boardCards, boardCards.length)),
          ...(await this.getHandsByDraw('comboDraw', hands, boardCards, boardCards.length))
        };
        break;
      default:
        return hands;
    }
    
    const strengthFilters = ['onePair', 'twoPair', 'threeOfAKind', 'fourOfAKind', 'straight', 'flush', 'fullHouse', 'straightDraw', 'flushDraw', 'comboDraw', 'backdoorFlushDraw', 'allMade', 'allMadePlusDraws'];
    return this.applySelectionWithModifiers(hands, filteredHands, modifiers, strengthFilters, filterType);
  }

  /**
   * Handle color action with modifiers (consolidates handleColorClick logic).
   * @param {string} color - Color to apply
   * @param {Object} modifiers - {ctrl: boolean, shift: boolean}
   * @param {Object} hands - Current hands object
   * @returns {Object} Updated hands object
   */
  handleColorAction(color, modifiers, hands = this.hands) {
    let newSelection = { ...hands };
    const selectedHands = Object.keys(hands).filter(h => 
      Array.isArray(hands[h]) && hands[h].includes('selected')
    );
    const handsWithColor = this.getHandsWithColor(color, hands);
    
    if (selectedHands.length === 0) {
      // No selection: select all hands with this color
      handsWithColor.forEach(h => {
        if (!newSelection[h]) newSelection[h] = [];
        if (!newSelection[h].includes('selected')) newSelection[h].push('selected');
      });
    } else if (modifiers.ctrl) {
      // Ctrl: Add selection to hands with this color
      handsWithColor.forEach(h => {
        if (!newSelection[h]) newSelection[h] = [];
        if (!newSelection[h].includes('selected')) newSelection[h].push('selected');
      });
    } else if (modifiers.shift) {
      // Shift: Remove selection from hands with this color
      handsWithColor.forEach(h => {
        newSelection[h] = (newSelection[h] || []).filter(item => item !== 'selected');
      });
    } else {
      // Normal: Apply color to selected hands
      newSelection = this.applyColor(newSelection, color, selectedHands);
    }
    
    return newSelection;
  }

  /**
   * Check if a filter button should be active (consolidates isButtonActive logic).
   * @param {string} filterType - Filter type
   * @param {string|null} filterValue - Filter value
   * @param {Object} hands - Hands object
   * @param {string[]} boardCards - Board cards
   * @returns {boolean} True if button should be active
   */
  isFilterActive(filterType, filterValue, hands = this.hands, boardCards = this.boardCards) {
    const activeHands = Object.keys(hands).filter(h => 
      Array.isArray(hands[h]) && hands[h].includes('selected')
    );
    if (activeHands.length === 0) return false;
    
    try {
      const activeRm = new RangeManager(activeHands);
      
      switch (filterType) {
        case 'rank':
          // Use standard notation: KK,K2s+,K2o+ to check all hands with this rank
          const rankRange = `${filterValue}${filterValue},${filterValue}2s+,${filterValue}2o+`;
          return activeRm.intersect(rankRange).size() === activeHands.length;
        
        case 'suit':
          const suitCode = SUITS.find(s => s.name === filterValue)?.code;
          if (!suitCode) return false;
          return activeRm.hasSuit(suitCode).size() === activeHands.length;
        
        case 'doubleSuit':
          const doubleSuitCode = SUITS.find(s => s.name === filterValue)?.code;
          if (!doubleSuitCode) return false;
          return activeRm.suitedOf(doubleSuitCode).size() === activeHands.length;
        
        case 'paired':
          return activeRm.intersect('22+').size() === activeHands.length;
        
        case 'suited':
          // Check if all active hands are suited in at least one suit
          return ['c', 'd', 'h', 's'].some(suit => 
            activeRm.suitedOf(suit).size() === activeHands.length
          );
        
        case 'unsuited':
          // Check if all active hands are offsuit (have different suits)
          // For offsuit: get hands that have a suit but exclude suited hands
          return ['c', 'd', 'h', 's'].some(suit => {
            try {
              const hasSuit = activeRm.hasSuit(suit);
              const suited = activeRm.suitedOf(suit);
              const offsuit = hasSuit.exclude(suited);
              return offsuit.size() === activeHands.length;
            } catch (error) {
              return false;
            }
          });
        
        case 'colored':
          return activeHands.every(h => 
            Array.isArray(hands[h]) && hands[h].some(item => typeof item === 'string' && item.startsWith('hsl('))
          );
        
        case 'all':
          return activeHands.length === Object.keys(hands).length;
        
        case 'onePair':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'onePair');
        case 'twoPair':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'twoPair');
        case 'threeOfAKind':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'threeOfAKind');
        case 'fourOfAKind':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'fourOfAKind');
        case 'straight':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'straight');
        case 'flush':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'flush');
        case 'fullHouse':
          return activeHands.every(h => this.getHandStrengthType(h, boardCards) === 'fullHouse');
        
        case 'straightDraw':
        case 'flushDraw':
        case 'comboDraw':
        case 'backdoorFlushDraw':
          // Draw detection is async, so we can't check synchronously here
          return false;
        
        case 'allMade':
          return activeHands.every(h => {
            const st = this.getHandStrengthType(h, boardCards);
            return st && ['onePair', 'twoPair', 'threeOfAKind', 'fourOfAKind', 'straight', 'flush', 'fullHouse'].includes(st);
          });
        
        case 'allMadePlusDraws':
          // Draw detection is async, so we can't check synchronously here
          return false;
        
        default:
          return false;
      }
    } catch (error) {
      return false;
      return false;
    }
  }

  /**
   * Get color statistics (counts and percentages).
   * @param {Object} hands - Hands object
   * @param {string[]} colors - Colors array
   * @returns {{counts: Object, percentages: Object}} Color statistics
   */
  getColorStatistics(hands = this.hands, colors = this.colors) {
    const coloredHands = Object.keys(hands).filter(h => 
      Array.isArray(hands[h]) && hands[h].some(item => typeof item === 'string' && item.startsWith('hsl('))
    );
    
    const counts = {};
    const percentages = {};
    
    if (coloredHands.length === 0) {
      colors.forEach(c => {
        counts[c] = 0;
        percentages[c] = 0;
      });
      return { counts, percentages };
    }
    
    colors.forEach(c => {
      const matching = coloredHands.filter(h => hands[h].some(item => item === c));
      counts[c] = matching.length;
      percentages[c] = Math.round((matching.length / coloredHands.length) * 100);
    });
    
    return { counts, percentages };
  }
}

