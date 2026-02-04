/**
 * Error Store
 *
 * Centralized store for application errors.
 * Provides normalized error state that UI components can subscribe to.
 *
 * SRP: This store only manages error state.
 * It does NOT import reporting providers - that's done in global-handlers.
 */
import { writable, derived, type Readable } from 'svelte/store';
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

/**
 * Internal store state
 */
const initialState: ErrorStoreState = {
	currentError: null,
	errorHistory: [],
	showErrorUI: false
};

/**
 * Create the error store
 */
function createErrorStore() {
	const { subscribe, set, update } = writable<ErrorStoreState>(initialState);

	let maxHistorySize = DEFAULT_MAX_HISTORY;

	return {
		subscribe,

		/**
		 * Set the maximum number of errors to keep in history
		 */
		setMaxHistorySize(size: number): void {
			maxHistorySize = size;
		},

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

			update((state) => {
				// Add to history, keeping within max size
				const newHistory = [normalizedError, ...state.errorHistory].slice(0, maxHistorySize);

				return {
					currentError: normalizedError,
					errorHistory: newHistory,
					showErrorUI: showUI
				};
			});

			return normalizedError;
		},

		/**
		 * Mark an error as reported to external service
		 */
		markAsReported(errorId: string): void {
			update((state) => ({
				...state,
				currentError:
					state.currentError?.id === errorId ? { ...state.currentError, reported: true } : state.currentError,
				errorHistory: state.errorHistory.map((e) => (e.id === errorId ? { ...e, reported: true } : e))
			}));
		},

		/**
		 * Clear the current error (dismiss error UI)
		 */
		clearCurrentError(): void {
			update((state) => ({
				...state,
				currentError: null,
				showErrorUI: false
			}));
		},

		/**
		 * Hide error UI without clearing error from state
		 */
		hideErrorUI(): void {
			update((state) => ({
				...state,
				showErrorUI: false
			}));
		},

		/**
		 * Clear all error history
		 */
		clearHistory(): void {
			set(initialState);
		},

		/**
		 * Get error by ID from history
		 */
		getErrorById(errorId: string): NormalizedError | undefined {
			let found: NormalizedError | undefined;
			const unsubscribe = subscribe((state) => {
				found = state.errorHistory.find((e) => e.id === errorId);
			});
			unsubscribe();
			return found;
		}
	};
}

/**
 * The singleton error store instance
 */
export const errorStore = createErrorStore();

/**
 * Derived store for just the current error
 */
export const currentError: Readable<NormalizedError | null> = derived(
	errorStore,
	($store) => $store.currentError
);

/**
 * Derived store for whether to show error UI
 */
export const showErrorUI: Readable<boolean> = derived(errorStore, ($store) => $store.showErrorUI);

/**
 * Derived store for error history
 */
export const errorHistory: Readable<NormalizedError[]> = derived(errorStore, ($store) => $store.errorHistory);

/**
 * Check if there's a fatal error
 */
export const hasFatalError: Readable<boolean> = derived(
	errorStore,
	($store) => $store.currentError?.severity === 'fatal'
);
