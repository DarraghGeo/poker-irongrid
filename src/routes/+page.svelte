<script>
  import PokerGridPanel from '$lib/poker-grid/index.js';
  import preflopTableUrl from 'poker-bitvaljs/bench/preflop-table.bin?url';
  
  // Example ranges - you can customize these
  const ranges = [
    { name: 'Tight', abbreviation: '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,AJo+,KQo' },
    { name: 'Loose', abbreviation: '22+,A2+,K2+,Q2+,J2+,T2+,92+,82+,72+,62+,52+,42+,32+' },
    { name: 'Premium', abbreviation: 'AA,KK,QQ,AKs,AKo' },
    { name: 'UTG', abbreviation: '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,AJo+,KQo' },
    { name: 'Button', abbreviation: '22+,A2+,K2+,Q2+,J2+,T2+,92+,82+,72+,62+,52+,42+,32+' },
    { name: 'Small Blind', abbreviation: '22+,A2s+,K2s+,Q2s+,J2s+,T2s+,92s+,82s+,72s+,62s+,52s+,42s+,32s+,A2o+,K2o+,Q2o+,J2o+,T2o+,92o+,82o+,72o+,62o+,52o+,42o+,32o+' }
  ];
  
  let hands = {};
  let visibleHands = {};
  let deadCards = [];
  let boardCards = [];
  let heroCards = [];
  let colors = [
    'hsl(60, 100%, 70%)',
    'hsl(120, 100%, 70%)',
    'hsl(240, 100%, 85%)',
    'hsl(300, 100%, 70%)',
    'hsl(30, 100%, 70%)',
    'hsl(0, 100%, 85%)'
  ];

  // Handle events from the component
  function handleSelectionChange(event) {
    // Event handler for selection changes
  }

  function handleRangeSelected(event) {
    // Event handler for range selection
  }

  function handleDeadCardsChange(event) {
    // Event handler for dead cards changes
  }

  function handleCellClick(event) {
    // Event handler for cell clicks
  }
</script>

<div class="min-h-screen bg-gray-50 p-2 sm:p-4">
  <div class="max-w-xl mx-auto">
    <div class="mb-4 sm:mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Poker Grid Component Test</h1>
      <p class="text-sm sm:text-base text-gray-600">Test page for the poker-grid package component</p>
    </div>

    <div class="mt-4 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
      <h3 class="text-sm sm:text-base font-semibold text-blue-900 mb-2">Usage Instructions:</h3>
      <ul class="list-disc list-inside text-xs sm:text-sm text-blue-800 space-y-1">
        <li>Click and drag on the grid to select hands</li>
        <li>Use Ctrl+Click to add to selection, Shift+Click to remove</li>
        <li>Enter dead cards, board cards, and hero cards in the input fields</li>
        <li>Select a range from the dropdown to apply it</li>
        <li>Use the filter buttons to filter by rank, suit, hand strength, etc.</li>
        <li>Click color buttons to apply colors to selected hands</li>
      </ul>
    </div>

    <div class="bg-white rounded-lg shadow-lg p-3 sm:p-6 overflow-x-auto">
      <PokerGridPanel
        bind:hands
        bind:visibleHands
        bind:deadCards
        bind:boardCards
        bind:heroCards
        {ranges}
        {colors}
        showDeadInputs={true}
        showRangeSelect={true}
        showControls={true}
        showSummary={true}
        interactive={true}
        evaluator={true}
        {preflopTableUrl}
        on:selectionChange={handleSelectionChange}
        on:rangeSelected={handleRangeSelected}
        on:deadCardsChange={handleDeadCardsChange}
        on:cellClick={handleCellClick}
      />
    </div>

    <div class="mt-4 sm:mt-6 bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <h2 class="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Component State</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
        <div>
          <h3 class="font-medium mb-2">Hands Count:</h3>
          <p class="text-gray-600">{Object.keys(hands).length} total hands</p>
        </div>
        <div>
          <h3 class="font-medium mb-2">Visible Hands Count:</h3>
          <p class="text-gray-600">{Object.keys(visibleHands).length} visible hands</p>
        </div>
        <div>
          <h3 class="font-medium mb-2">Dead Cards:</h3>
          <p class="text-gray-600">{deadCards.length > 0 ? deadCards.join(', ') : 'None'}</p>
        </div>
        <div>
          <h3 class="font-medium mb-2">Board Cards:</h3>
          <p class="text-gray-600">{boardCards.length > 0 ? boardCards.join(', ') : 'None'}</p>
        </div>
        <div>
          <h3 class="font-medium mb-2">Hero Cards:</h3>
          <p class="text-gray-600">{heroCards.length > 0 ? heroCards.join(', ') : 'None'}</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>
