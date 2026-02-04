/**
 * Error Store (Svelte 5 Compatible)
 *
 * Centralized store for application errors.
 * Provides normalized error state that UI components can subscribe to.
 *
 * Uses a simple reactive class pattern that works with Svelte 5's
 * fine-grained reactivity when accessed in components via getters.
 *
 * SRP: This store only manages error state.
 * It does NOT import reporting providers - that's done in global-handlers.
 */
import type { NormalizedError, ErrorStoreState, ErrorSeverity, ErrorSource } from './types';

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
	return `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Default max history size
 */
const DEFAULT_MAX_HISTORY = 50;

/** Subscriber callback type */
type Subscriber = (state: ErrorStoreState) => void;

/**
 * Error store class providing reactive state management
 */
class ErrorStore {
	private _currentError: NormalizedError | null = null;
	private _errorHistory: NormalizedError[] = [];
	private _showErrorUI = false;
	private _maxHistorySize = DEFAULT_MAX_HISTORY;
	private _subscribers: Set<Subscriber> = new Set();
	private _cachedState: ErrorStoreState | null = null;

	/**
	 * Get the current error
	 */
	get currentError(): NormalizedError | null {
		return this._currentError;
	}

	/**
	 * Get whether to show error UI
	 */
	get showErrorUI(): boolean {
		return this._showErrorUI;
	}

	/**
	 * Get error history
	 */
	get errorHistory(): NormalizedError[] {
		return this._errorHistory;
	}

	/**
	 * Check if there's a fatal error
	 */
	get hasFatalError(): boolean {
		return this._currentError?.severity === 'fatal';
	}

	/**
	 * Set the maximum number of errors to keep in history
	 */
	setMaxHistorySize(size: number): void {
		this._maxHistorySize = size;
	}

	/**
	 * Set an error in the store
	 */
	setError(
		error: Error | string,
		options: {
			source?: ErrorSource;
			severity?: ErrorSeverity;
			context?: Record<string, unknown>;
			showUI?: boolean;
		} = {}
	): NormalizedError {
		const { source = 'manual', severity = 'error', context, showUI = true } = options;

		const normalizedError: NormalizedError = {
			id: generateErrorId(),
			message: typeof error === 'string' ? error : error.message,
			originalError: typeof error === 'string' ? undefined : error,
			stack: typeof error === 'string' ? undefined : error.stack,
			source,
			severity,
			timestamp: new Date(),
			context,
			url: typeof window !== 'undefined' ? window.location.href : undefined,
			reported: false
		};

		// Add to history, keeping within max size
		this._errorHistory = [normalizedError, ...this._errorHistory].slice(0, this._maxHistorySize);
		this._currentError = normalizedError;
		this._showErrorUI = showUI;

		this._invalidateCache();
		this._notify();
		return normalizedError;
	}

	/**
	 * Mark an error as reported to external service
	 */
	markAsReported(errorId: string): void {
		// Mutate in place - data is private and we notify subscribers after
		if (this._currentError?.id === errorId) {
			this._currentError.reported = true;
		}
		const historyError = this._errorHistory.find((e) => e.id === errorId);
		if (historyError) {
			historyError.reported = true;
		}
		this._invalidateCache();
		this._notify();
	}

	/**
	 * Clear the current error (dismiss error UI)
	 */
	clearCurrentError(): void {
		this._currentError = null;
		this._showErrorUI = false;
		this._invalidateCache();
		this._notify();
	}

	/**
	 * Hide error UI without clearing error from state
	 */
	hideErrorUI(): void {
		this._showErrorUI = false;
		this._invalidateCache();
		this._notify();
	}

	/**
	 * Clear all error history
	 */
	clearHistory(): void {
		this._currentError = null;
		this._errorHistory = [];
		this._showErrorUI = false;
		this._invalidateCache();
		this._notify();
	}

	/**
	 * Get error by ID from history
	 */
	getErrorById(errorId: string): NormalizedError | undefined {
		return this._errorHistory.find((e) => e.id === errorId);
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(callback: Subscriber): () => void {
		this._subscribers.add(callback);
		// Immediately call with current state
		callback(this._getState());
		// Return unsubscribe function
		return () => {
			this._subscribers.delete(callback);
		};
	}

	/**
	 * Invalidate cached state (call before any state mutation)
	 */
	private _invalidateCache(): void {
		this._cachedState = null;
	}

	/**
	 * Get current state as ErrorStoreState (cached to avoid creating new objects)
	 */
	private _getState(): ErrorStoreState {
		if (!this._cachedState) {
			this._cachedState = {
				currentError: this._currentError,
				errorHistory: this._errorHistory,
				showErrorUI: this._showErrorUI,
				hasFatalError: this.hasFatalError
			};
		}
		return this._cachedState;
	}

	/**
	 * Notify all subscribers of state change
	 */
	private _notify(): void {
		const state = this._getState();
		for (const subscriber of this._subscribers) {
			subscriber(state);
		}
	}
}

/**
 * The singleton error store instance
 */
export const errorStore = new ErrorStore();

/**
 * Convenience getter for current error (for backwards compatibility)
 */
export function getCurrentError(): NormalizedError | null {
	return errorStore.currentError;
}

/**
 * Convenience getter for showErrorUI (for backwards compatibility)
 */
export function getShowErrorUI(): boolean {
	return errorStore.showErrorUI;
}

/**
 * Convenience getter for error history (for backwards compatibility)
 */
export function getErrorHistory(): NormalizedError[] {
	return errorStore.errorHistory;
}

/**
 * Convenience getter for hasFatalError (for backwards compatibility)
 */
export function getHasFatalError(): boolean {
	return errorStore.hasFatalError;
}
