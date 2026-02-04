/**
 * Browser Provider Utilities
 *
 * Shared helper functions for browser provider implementations.
 */

import type { HistoryState, PopStateCallback } from '../interfaces';

/**
 * Extract WarpKit history state from browser history state.
 * Returns null if the state is not a valid WarpKit history entry.
 */
export function extractHistoryState(state: unknown): HistoryState | null {
	if (state && typeof state === 'object' && '__warpkit' in state) {
		return state as HistoryState;
	}
	return null;
}

/**
 * Notify all listeners of a popstate event.
 * Iterates through listeners and calls each with the state and direction.
 * Errors in individual listeners are caught and logged to prevent blocking other listeners.
 */
export function notifyListeners(
	listeners: Set<PopStateCallback>,
	state: HistoryState | null,
	direction: 'back' | 'forward'
): void {
	for (const listener of listeners) {
		try {
			listener(state, direction);
		} catch (error) {
			console.error('[WarpKit] PopState listener threw error:', error);
		}
	}
}
