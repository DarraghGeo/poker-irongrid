/**
 * poker-grid/index.js
 * Purpose: Main entry point for the poker-grid module.
 * Re-exports the PokerGridPanel component.
 */
export { default as PokerGridPanel } from './components/PokerGridPanel.svelte';
export { default } from './components/PokerGridPanel.svelte';
export { loadPreflopTable } from './PokerGridManager.js';

// Export theme CSS for consumers to import
import './theme.css';

