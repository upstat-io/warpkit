/**
 * Global Error Handlers
 *
 * Sets up window.onerror, window.onunhandledrejection, and Vite HMR
 * error handlers to route all uncaught errors to the errorStore.
 *
 * This module is designed to be resilient:
 * - Uses try/catch internally to never throw
 * - Works even if WarpKit fails to initialize
 * - Can be called multiple times safely (idempotent)
 * - Captures Vite dev server errors (HMR, compile errors)
 */
/// <reference types="vite/client" />
import { errorStore } from './error-store.svelte.js';
import type { ReportingProvider } from './types.js';
import { onErrorReport } from '@warpkit/errors';

/** Track if handlers are already installed */
let installed = false;

/** Optional reporting provider */
let reporter: ReportingProvider | undefined;

/** Vite HMR cleanup function */
let viteCleanup: (() => void) | undefined;

/** Error channel unsubscribe function */
let channelCleanup: (() => void) | undefined;

/**
 * Vite error payload types (from vite/types/hmrPayload.d.ts)
 */
interface ViteErrorPayload {
	type: 'error';
	err: {
		message: string;
		stack: string;
		id?: string;
		frame?: string;
		plugin?: string;
		pluginCode?: string;
		loc?: {
			file?: string;
			line: number;
			column: number;
		};
	};
}

/**
 * Install global error handlers.
 * Safe to call multiple times - will only install once.
 *
 * @param options - Optional configuration
 * @returns Cleanup function to remove handlers
 */
export function setupGlobalErrorHandlers(options?: { reporter?: ReportingProvider }): () => void {
	// Skip in SSR
	if (typeof window === 'undefined') {
		return () => {};
	}

	// Already installed - just update reporter if provided
	if (installed) {
		if (options?.reporter) {
			reporter = options.reporter;
		}
		return () => removeGlobalErrorHandlers();
	}

	reporter = options?.reporter;

	// Store original handlers to restore later
	const originalOnError = window.onerror;
	const originalOnUnhandledRejection = window.onunhandledrejection;

	// Set up Vite HMR error handling
	setupViteErrorHandlers();

	/**
	 * Check if a Vite error is already being displayed.
	 * When a Vite compile error occurs, both the vite:error handler AND
	 * window.onerror/onunhandledrejection fire for the same underlying error.
	 * Skip the generic handlers when a Vite error is already shown to avoid
	 * overwriting the richer error message (with plugin/file/frame context).
	 */
	const hasActiveViteError = (): boolean => {
		return errorStore.currentError?.context?.viteError === true;
	};

	/**
	 * Global error handler (synchronous errors, script errors)
	 */
	window.onerror = (message, source, lineno, colno, error) => {
		try {
			if (hasActiveViteError()) return false;

			const normalizedError = errorStore.setError(error ?? String(message), {
				source: 'global',
				severity: 'error',
				context: { source, lineno, colno },
				showUI: true
			});

			// Report to external service if configured
			reporter?.captureError(normalizedError);
		} catch {
			// Never throw from error handler
		}

		// Call original handler if it exists
		if (typeof originalOnError === 'function') {
			return originalOnError(message, source, lineno, colno, error);
		}

		// Return false to allow default browser handling (console error)
		return false;
	};

	/**
	 * Unhandled promise rejection handler
	 */
	window.onunhandledrejection = (event) => {
		try {
			if (hasActiveViteError()) return;

			const reason = event.reason;
			const error = reason instanceof Error ? reason : new Error(String(reason));

			const normalizedError = errorStore.setError(error, {
				source: 'unhandled-rejection',
				severity: 'error',
				showUI: true
			});

			// Report to external service if configured
			reporter?.captureError(normalizedError);
		} catch {
			// Never throw from error handler
		}

		// Call original handler if it exists
		if (typeof originalOnUnhandledRejection === 'function') {
			originalOnUnhandledRejection.call(window, event);
		}
	};

	// Subscribe to error channel from sub-packages
	channelCleanup = onErrorReport((report) => {
		try {
			const showUI = report.showUI && !report.handledLocally;
			const normalizedError = errorStore.setError(report.error, {
				source: report.source,
				severity: report.severity,
				context: report.context,
				showUI
			});

			reporter?.captureError(normalizedError);
		} catch {
			// Never throw from error handler
		}
	});

	installed = true;

	return () => removeGlobalErrorHandlers();
}

/**
 * Remove global error handlers and restore originals.
 */
export function removeGlobalErrorHandlers(): void {
	if (typeof window === 'undefined' || !installed) {
		return;
	}

	// Reset to default (null removes our handlers)
	window.onerror = null;
	window.onunhandledrejection = null;

	// Clean up Vite handlers
	viteCleanup?.();
	viteCleanup = undefined;

	// Clean up error channel subscription
	channelCleanup?.();
	channelCleanup = undefined;

	installed = false;
	reporter = undefined;
}

/**
 * Set up Vite HMR error handlers.
 * Captures compile errors, HMR errors, and Vite overlay errors.
 */
function setupViteErrorHandlers(): void {
	try {
		// Check if we're in Vite dev mode with HMR
		const hot = import.meta.hot;
		if (!hot) return;

		// Listen for Vite error events
		const handleViteError = (payload: ViteErrorPayload) => {
			try {
				const { err } = payload;

				// Build a descriptive error message
				let message = err.message;
				if (err.plugin) {
					message = `[${err.plugin}] ${message}`;
				}
				if (err.loc) {
					const file = err.loc.file ?? err.id ?? 'unknown';
					message = `${message}\n\nFile: ${file}:${err.loc.line}:${err.loc.column}`;
				}
				if (err.frame) {
					message = `${message}\n\n${err.frame}`;
				}

				const error = new Error(message);
				error.stack = err.stack;

				const normalizedError = errorStore.setError(error, {
					source: 'global', // Use 'global' since we don't have a 'vite' source type
					severity: 'error',
					context: {
						viteError: true,
						plugin: err.plugin,
						pluginCode: err.pluginCode,
						file: err.id ?? err.loc?.file,
						line: err.loc?.line,
						column: err.loc?.column
					},
					showUI: true
				});

				reporter?.captureError(normalizedError);
			} catch {
				// Never throw from error handler
			}
		};

		// Subscribe to Vite HMR error events
		// Type assertion needed because Vite's types use a generic callback signature
		hot.on('vite:error', handleViteError as (data: unknown) => void);

		// Clear stale Vite errors when a successful HMR update arrives
		const handleViteUpdate = () => {
			try {
				const current = errorStore.currentError;
				if (current?.context?.viteError) {
					errorStore.clearCurrentError();
				}
			} catch {
				// Never throw from error handler
			}
		};
		hot.on('vite:beforeUpdate', handleViteUpdate as (data: unknown) => void);

		viteCleanup = () => {
			try {
				hot.off('vite:error', handleViteError as (data: unknown) => void);
				hot.off('vite:beforeUpdate', handleViteUpdate as (data: unknown) => void);
			} catch {
				// Ignore cleanup errors
			}
		};
	} catch {
		// Not in Vite dev mode or HMR not available - that's fine
	}
}

/**
 * Check if global handlers are installed.
 */
export function areGlobalHandlersInstalled(): boolean {
	return installed;
}

/**
 * Set or update the reporting provider.
 * Can be called after handlers are installed.
 *
 * @param provider - The reporting provider or undefined to clear
 */
export function setReportingProvider(provider: ReportingProvider | undefined): void {
	reporter = provider;
}
