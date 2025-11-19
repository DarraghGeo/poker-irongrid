/**
 * poker-grid/utils/constants.js
 * Purpose: Constants needed for poker-grid functionality (self-contained).
 */

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export const SUITS = [
  { code: 'c', symbol: '♣', color: 'text-black', name: 'clubs' },
  { code: 'd', symbol: '♦', color: 'text-red-600', name: 'diamonds' },
  { code: 'h', symbol: '♥', color: 'text-red-600', name: 'hearts' },
  { code: 's', symbol: '♠', color: 'text-black', name: 'spades' }
];

export const RANK_VALUES = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
  '4': 4, '3': 3, '2': 2
};

export const HAND_TYPES = [
  { id: 'highCard', label: 'High Card', value: 0 },
  { id: 'onePair', label: 'One Pair', value: 1 },
  { id: 'twoPair', label: 'Two Pair', value: 2 },
  { id: 'threeOfAKind', label: 'Three of a Kind', value: 3 },
  { id: 'straight', label: 'Straight', value: 4 },
  { id: 'flush', label: 'Flush', value: 5 },
  { id: 'fullHouse', label: 'Full House', value: 6 },
  { id: 'fourOfAKind', label: 'Four of a Kind', value: 7 },
  { id: 'straightFlush', label: 'Straight Flush', value: 8 },
  { id: 'royalFlush', label: 'Royal Flush', value: 9 }
];

