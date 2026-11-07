# Poker Grid Component

A comprehensive Svelte 5 component for visualizing and managing poker hand ranges with an interactive 13x13 grid interface.

## Installation

```bash
npm install poker-irongrid
```

## Peer Dependencies

- `svelte`: ^5.0.0
- `poker-bitvaljs`: ^1.13.0 (for equity evaluation)
- `poker-extval`: ^6.0.0-beta.6 (for hand evaluation)
- `poker-rangeman`: ^4.0.0-beta.11 (for range parsing and filtering)

## Quick Start

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  let hands = {};
  let visibleHands = {};
  let deadCards = [];
  let boardCards = [];
  let heroCards = [];
  
  const ranges = [
    { name: 'Tight', abbreviation: '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,AJo+,KQo' },
    { name: 'Loose', abbreviation: '22+,A2+,K2+,Q2+,J2+,T2+,92+,82+,72+,62+,52+,42+,32+' }
  ];
  
  const colors = [
    'hsl(60, 100%, 70%)',
    'hsl(120, 100%, 70%)',
    'hsl(240, 100%, 85%)'
  ];
</script>

<PokerGridPanel
  bind:hands
  bind:visibleHands
  bind:deadCards
  bind:boardCards
  bind:heroCards
  {ranges}
  {colors}
/>
```

## API Reference

### Props

#### Core Data Props (Two-way Bound)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hands` | `Object` or `Array<string>` | `{}` | Raw hands map (combos/abstracts) or array of hand strings. Format: `{ "AcKd": ["selected", "hsl(60, 100%, 70%)"], "AA": ["selected"] }` |
| `visibleHands` | `Object` | `{}` | Visible hands after filtering by dead cards (read-only, automatically computed) |
| `deadCards` | `Array<string>` | `[]` | Dead cards as two-character codes (e.g., `["Ac", "Kd"]`) |
| `boardCards` | `Array<string>` | `[]` | Board cards as two-character codes (e.g., `["As", "Kh", "Qc"]`) |
| `heroCards` | `Array<string>` | `[]` | Hero cards as two-character codes (e.g., `["Ac", "Kd"]`) |

#### Visibility Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `interactive` | `boolean` | `true` | Whether the panel is interactive (shows inputs/controls and allows grid interaction) |
| `showDeadInputs` | `boolean` | `true` | Show dead cards input fields |
| `showRangeSelect` | `boolean` | `true` | Show range selection dropdown |
| `showControls` | `boolean` | `true` | Show hand selector controls (filters, colors, etc.) |
| `showSummary` | `boolean` | `true` | Show selection summary at bottom |
| `showTips` | `boolean` | `false` | Show tooltips on click when non-interactive |
| `enableDetailsPanel` | `boolean` | `false` | Enable double-click details panel |

#### Configuration Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ranges` | `Array<{name: string, abbreviation: string}>` | `[]` | Predefined ranges for range selection dropdown |
| `colors` | `Array<string>` | `[]` | Color palette for highlighting hands (HSL format recommended) |
| `defaultColor` | `string` | `'hsl(0, 0%, 100%)'` | Default background color for uncolored hands |
| `defaultSelectedColor` | `string` | `'hsl(0, 0%, 85%)'` | Default color for selected hands without explicit color |
| `evaluator` | `boolean` | `false` | Show hero's live equity against the hands on the grid (requires hero cards) |
| `equityColors` | `boolean` | `true` | With `evaluator`, color villain hands by hero's equity against each combo: equal-width bands, one per color (`colors[0]` = hero's lowest equity). Hands you color yourself keep their color |
| `subgrid` | `boolean` | `false` | Split the grid into 3x3 blocks (A–T, 9–6, 5–2) with space after the T and 6 rows/columns; spacing set by `--irongrid-subgrid-gap` (default `6px`) |
| `preflopTableUrl` | `string \| null` | `null` | URL of poker-bitvaljs's `bench/preflop-table.bin` for exact preflop equity (Monte Carlo without it) |

#### Initial State Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialHands` | `Object` | `undefined` | Initial hands state (only applied if hands is empty) |
| `initialBoard` | `Array<string>` | `undefined` | Initial board cards (only applied if boardCards is empty) |
| `initialDead` | `Array<string>` | `undefined` | Initial dead cards (only applied if deadCards is empty) |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `selectionChange` | `{ hands: Object, visibleHands: Object }` | Fired when hands selection changes |
| `rangeSelected` | `{ name: string, hands: Object }` | Fired when a range is selected from dropdown |
| `deadCardsChange` | `{ deadCards: Array<string>, boardCards: Array<string> }` | Fired when dead cards or board cards change |
| `cellClick` | `{ cellInfo: Object }` | Fired when a grid cell is clicked (when `showTips` is true) |
| `cellDetails` | `{ cellInfo: Object }` | Fired when a grid cell is double-clicked (when `enableDetailsPanel` is true) |

## Data Structures

### Hand Format

Hands are represented as objects where keys are hand strings and values are arrays of metadata:

```javascript
{
  "AcKd": ["selected", "hsl(60, 100%, 70%)"],  // Combo with selection and color
  "AA": ["selected"],                          // Abstract hand (all AA combos)
  "AKs": ["hsl(120, 100%, 70%)"]              // Suited hand with color
}
```

**Hand String Formats:**
- **Combos**: `"AcKd"` (specific cards)
- **Pairs**: `"AA"` (pocket pair)
- **Suited**: `"AKs"` (suited hand)
- **Offsuit**: `"AKo"` (offsuit hand)

**Metadata Array Values:**
- `"selected"` - Hand is selected
- `"hsl(...)"` - HSL color string for highlighting

### Card Format

Cards are represented as two-character strings:
- First character: Rank (`A`, `K`, `Q`, `J`, `T`, `9`, `8`, `7`, `6`, `5`, `4`, `3`, `2`)
- Second character: Suit (`c` = clubs, `d` = diamonds, `h` = hearts, `s` = spades)

Examples: `"Ac"`, `"Kd"`, `"Qh"`, `"Js"`

### Range Format

Ranges are arrays of objects with `name` and `abbreviation` properties:

```javascript
[
  { 
    name: 'Tight', 
    abbreviation: '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,AJo+,KQo' 
  }
]
```

The `abbreviation` uses standard poker range notation (e.g., `22+` = all pairs, `A2s+` = all suited aces, `AJo+` = all offsuit aces).

## Features

### Interactive Grid

- **13x13 Grid**: Visual representation of all 169 possible starting hands
- **Click Selection**: Click cells to select/deselect hands
- **Drag Selection**: Click and drag to select multiple hands
- **Modifier Keys**:
  - **Ctrl/Cmd + Click**: Add to selection
  - **Shift + Click**: Remove from selection
  - **Normal Click**: Replace selection

### Dead Card Filtering

- Automatically filters out hands containing dead cards
- Supports hero cards, board cards, and additional dead cards
- Real-time filtering as cards are added/removed

### Range Selection

- Apply predefined ranges from dropdown
- Ranges use standard poker notation
- Automatically selects all hands in the range

### Hand Filtering

The component includes comprehensive filtering options:

**Made Hands:**
- One Pair
- Two Pair
- Three of a Kind
- Four of a Kind
- Straight
- Flush
- Full House

**Draws:**
- Straight Draw
- Flush Draw
- Combo Draw
- Backdoor Flush Draw

**Card Filters:**
- By Rank (A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2)
- By Suit (Clubs, Diamonds, Hearts, Spades)
- Paired hands
- Suited hands
- Offsuit hands

**Selection Actions:**
- Clear All
- Inverse Selection
- Unselect All
- Remove Selected

### Color Highlighting

- Assign colors to selected hands
- Multiple colors supported
- Visual distinction between colored and uncolored hands
- Color statistics display

### Design (2.0)

- **Grid:** small tiles with rounded corners and 2px gaps (`--irongrid-cell-gap`, `--irongrid-cell-radius`),
  two-character labels (AK above the diagonal is suited, below is offsuit). Hands in the range are filled with
  their color (lighter when only some combos are in); hands outside it get a faint suited / offsuit / pair tint
  (`--irongrid-cell-suited-bg`, `--irongrid-cell-offsuit-bg`, `--irongrid-cell-paired-bg`) and grey text.
  Selected colored hands get a ring (`--irongrid-cell-ring-color`). With `subgrid`, the 3x3 blocks are set apart.
- **Loading a range** (range select) fills a fresh grid with the first color; nothing is selected.
- **Controls** (`showControls`): color chips showing each color's share of the range (%), combos (#) or hero's
  equity (Eq), and × to clear; the share selected with All / Invert; a **Made × Draw** table (made hand by draw:
  none, straight, flush, combo, backdoor flush, backdoor straight) or **Made × Equity** (hero's equity against the hands, in 20%
  bands); rank filters; and a suit matrix with Suited / Offsuit. Draws must use a hole card (poker-extval with
  `holeCards`). Clicking any table, rank or suit cell selects its hands (ctrl/cmd adds, shift removes); a color
  chip then colors the selection.

### Equity Evaluation

When `evaluator={true}`, hero's equity is calculated live (asynchronously) whenever the hero cards,
board, dead cards or the hands on the grid change; there is no button to press.
- The summary shows hero vs. villain equity against every selected or colored combo
- The color buttons' **Eq** mode shows hero's equity against each color's hands
- With `equityColors` (default), the villain hands are colored by hero's equity against each combo, in
  one equal-width band per color (6 colors: 0–16.7%, 16.7–33.3%, … 83.3–100%, `colors[0]` lowest), so the
  color buttons show each band's count, share and equity. Hands you color yourself keep their color; band
  colors follow the selection and go away without hero cards
- All of it comes from one poker-bitvaljs `compareRangeHands` call: exact on the flop, turn and river
  (a few ms), Monte Carlo preflop and on 1-2 card boards
- Pass `preflopTableUrl` for exact, near-instant preflop equity (the table is ~1.1 MB, fetched once):

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  import preflopTableUrl from 'poker-bitvaljs/bench/preflop-table.bin?url'; // Vite
</script>

<PokerGridPanel evaluator={true} {preflopTableUrl} />
```

### Responsive Design

- Mobile-friendly layout
- Touch support for drag selection
- Adaptive grid sizing
- Optimized for various screen sizes

## Usage Examples

### Basic Usage

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  let hands = {};
  let deadCards = [];
  let boardCards = [];
</script>

<PokerGridPanel
  bind:hands
  bind:deadCards
  bind:boardCards
/>
```

### With Ranges

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  const ranges = [
    { name: 'UTG', abbreviation: '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,AJo+,KQo' },
    { name: 'Button', abbreviation: '22+,A2+,K2+,Q2+,J2+,T2+,92+,82+,72+,62+,52+,42+,32+' }
  ];
  
  let hands = {};
</script>

<PokerGridPanel
  bind:hands
  {ranges}
  showRangeSelect={true}
/>
```

### With Colors

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  const colors = [
    'hsl(60, 100%, 70%)',   // Yellow
    'hsl(120, 100%, 70%)',  // Green
    'hsl(240, 100%, 85%)',  // Blue
    'hsl(300, 100%, 70%)',  // Magenta
    'hsl(30, 100%, 70%)',   // Orange
    'hsl(0, 100%, 85%)'     // Red
  ];
  
  let hands = {};
</script>

<PokerGridPanel
  bind:hands
  {colors}
  showControls={true}
/>
```

### With Equity Evaluation

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  let hands = {};
  let heroCards = ['Ac', 'Kd'];
  let boardCards = ['As', 'Kh', 'Qc'];
  let deadCards = [];
</script>

<PokerGridPanel
  bind:hands
  bind:heroCards
  bind:boardCards
  bind:deadCards
  evaluator={true}
  showSummary={true}
/>
```

### Read-Only Display

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  const hands = {
    "AA": ["selected"],
    "KK": ["selected"],
    "QQ": ["hsl(60, 100%, 70%)"]
  };
</script>

<PokerGridPanel
  hands={hands}
  interactive={false}
  showTips={true}
/>
```

### Handling Events

```svelte
<script>
  import PokerGridPanel from 'poker-irongrid';
  
  let hands = {};
  
  function handleSelectionChange(event) {
    console.log('Selection changed:', event.detail.hands);
    // Update your application state
  }
  
  function handleRangeSelected(event) {
    console.log('Range selected:', event.detail.name);
    console.log('Hands:', event.detail.hands);
  }
</script>

<PokerGridPanel
  bind:hands
  on:selectionChange={handleSelectionChange}
  on:rangeSelected={handleRangeSelected}
/>
```

## Styling

The component uses Tailwind CSS classes and CSS custom properties. You can customize the appearance by defining CSS variables:

```css
:root {
  --poker-accent: #dc2626;
  --poker-border: #e5e7eb;
  --poker-border-light: #d1d5db;
  --poker-text-primary: #111827;
  --poker-text-secondary: #6b7280;
  --poker-white: #ffffff;
}
```

## Component Structure

```
poker-grid/
├── components/
│   ├── Grid.svelte              # Main 13x13 grid display
│   ├── HandSelector.svelte      # Filter and color controls
│   ├── DeadCardsInput.svelte     # Dead cards input fields
│   ├── RangeSelect.svelte        # Range selection dropdown
│   ├── SelectionSummary.svelte   # Summary and evaluation
│   ├── DetailsPanel.svelte       # Cell details panel
│   └── PokerGridPanel.svelte     # Main component
├── utils/
│   ├── constants.js              # Constants (RANKS, SUITS, etc.)
│   └── index.js                  # Utility exports
├── PokerGridManager.js           # Business logic manager
└── index.js                      # Main entry point
```

## Browser Support

- Modern browsers with ES6+ support
- Touch devices (iOS Safari, Chrome Mobile)
- Desktop browsers (Chrome, Firefox, Safari, Edge)

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
