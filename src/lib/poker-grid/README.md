# Poker Grid Component

A fully self-contained poker grid component that can be copy/pasted to any project.

## Structure

```
poker-grid/
├── components/          # All Svelte components
│   ├── Grid.svelte
│   ├── HandSelector.svelte
│   ├── DeadCardsInput.svelte
│   ├── RangeSelect.svelte
│   ├── SelectionSummary.svelte
│   └── PokerGridPanel.svelte (main component)
├── utils/              # Self-contained utilities
│   ├── constants.js
│   └── index.js
├── index.js            # Main entry point
└── README.md
```

## Usage

```svelte
<script>
  import PokerGridPanel from '$lib/components/poker-grid/index.js';
  
  let hands = {};
  let visibleHands = {};
  let deadCards = [];
  let boardCards = [];
</script>

<PokerGridPanel
  bind:hands
  bind:visibleHands
  bind:deadCards
  bind:boardCards
  showDeadInputs={true}
  showRangeSelect={true}
  showControls={true}
  showSummary={true}
  colors={['hsl(60, 100%, 50%)', ...]}
/>
```

## Features

- Fully self-contained (no external dependencies beyond Svelte)
- Dead card filtering
- Range selection from predefined ranges
- Hand strength filtering
- Color highlighting
- Selection tracking
- Responsive grid display

## Dependencies

- `poker-rangeman` - For range parsing and hand filtering
- `poker-extval` - For hand evaluation

The component uses these npm packages for poker logic. Constants (RANKS, SUITS) are self-contained for UI display purposes.

