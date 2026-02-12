/**
 * MemoryBrowserProvider
 *
 * In-memory browser provider for testing. Maintains history stack internally
 * without interacting with actual browser APIs.
 */
import type { BrowserProvider, BrowserLocation, HistoryState, PopStateCallback } from '../interfaces';
import { notifyListeners } from './utils';

/**
 * Internal history entry structure.
 */
interface HistoryEntry {
	path: string;
	state: HistoryState | null;
}

/**
 * In-memory implementation of BrowserProvider for testing.
 */
export class MemoryBrowserProvider implements BrowserProvider {
	readonly id = 'browser' as const;

	private history: HistoryEntry[] = [];
	private currentIndex = 0;
	private historyPosition = 0;
	private listeners: Set<PopStateCallback> = new Set();

	constructor(initialPath = '/') {
		this.history = [{ path: initialPath, state: null }];
		this.currentIndex = 0;
		this.historyPosition = 0;
	}

	getLocation(): BrowserLocation {
		const entry = this.history[this.currentIndex];
		const path = entry?.path ?? '/';
		return this.parsePath(path);
	}

	getHistoryState(): HistoryState | null {
		return this.history[this.currentIndex]?.state ?? null;
	}

	buildUrl(path: string): string {
		return path;
	}

	parseUrl(url: string): string {
		return url;
	}

	push(path: string, state: HistoryState): void {
		// Truncate forward history
		this.history = this.history.slice(0, this.currentIndex + 1);

		// Increment history position for new entry
		this.historyPosition++;

		// Update state with current position
		const stateWithPosition: HistoryState = {
			...state,
			position: this.historyPosition
		};

		// Add new entry
		this.history.push({ path, state: stateWithPosition });
		this.currentIndex = this.history.length - 1;
	}

	replace(path: string, state: HistoryState): void {
		// Keep current position for replace
		const stateWithPosition: HistoryState = {
			...state,
			position: this.historyPosition
		};

		this.history[this.currentIndex] = { path, state: stateWithPosition };
	}

	go(delta: number): void {
		const newIndex = this.currentIndex + delta;

		// Boundary check - no-op if out of bounds
		if (newIndex < 0 || newIndex >= this.history.length) {
			return;
		}

		const previousPosition = this.historyPosition;
		this.currentIndex = newIndex;

		const newState = this.history[this.currentIndex]?.state ?? null;
		this.historyPosition = newState?.position ?? this.historyPosition;

		// Determine direction based on position change
		const direction = this.historyPosition < previousPosition ? 'back' : 'forward';

		// Fire listeners synchronously (matches browser behavior in tests)
		notifyListeners(this.listeners, newState, direction);
	}

	onPopState(callback: PopStateCallback): () => void {
		this.listeners.add(callback);
		return () => {
			this.listeners.delete(callback);
		};
	}

	// ============================================================================
	// Test Helpers
	// ============================================================================

	/**
	 * Get the full history stack for test assertions.
	 */
	getHistory(): HistoryEntry[] {
		return [...this.history];
	}

	/**
	 * Get current index in history stack.
	 */
	getCurrentIndex(): number {
		return this.currentIndex;
	}

	/**
	 * Get current history position (for direction detection).
	 */
	getHistoryPosition(): number {
		return this.historyPosition;
	}

	/**
	 * Simulate popstate event for testing.
	 * Moves the history index in the given direction before firing listeners,
	 * so the location actually changes (matching real browser behavior).
	 */
	simulatePopState(direction: 'back' | 'forward'): void {
		const delta = direction === 'back' ? -1 : 1;
		const newIndex = this.currentIndex + delta;
		if (newIndex >= 0 && newIndex < this.history.length) {
			this.currentIndex = newIndex;
		}
		const state = this.history[this.currentIndex]?.state ?? null;
		notifyListeners(this.listeners, state, direction);
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private parsePath(path: string): BrowserLocation {
		// Parse path into pathname, search, hash
		let pathname = path;
		let search = '';
		let hash = '';

		// Extract hash
		const hashIndex = pathname.indexOf('#');
		if (hashIndex !== -1) {
			hash = pathname.slice(hashIndex);
			pathname = pathname.slice(0, hashIndex);
		}

		// Extract search
		const searchIndex = pathname.indexOf('?');
		if (searchIndex !== -1) {
			search = pathname.slice(searchIndex);
			pathname = pathname.slice(0, searchIndex);
		}

		return { pathname, search, hash };
	}
}
