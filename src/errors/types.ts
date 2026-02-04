/**
 * Error System Types
 *
 * Generic error handling types for WarpKit.
 * These are provider-agnostic - no Sentry, LogRocket, or other service references.
 */

/**
 * Severity level for errors
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Source of the error
 */
export type ErrorSource = 'global' | 'unhandled-rejection' | 'router' | 'component' | 'manual';

/**
 * Normalized error state stored in error-store
 */
export interface NormalizedError {
	/** Unique ID for this error instance */
	id: string;
	/** Error message */
	message: string;
	/** Original error object (if available) */
	originalError?: Error;
	/** Stack trace (if available) */
	stack?: string;
	/** Where the error originated */
	source: ErrorSource;
	/** Severity level */
	severity: ErrorSeverity;
	/** When the error occurred */
	timestamp: Date;
	/** Additional context data */
	context?: Record<string, unknown>;
	/** URL where error occurred */
	url?: string;
	/** Whether this error has been reported to external service */
	reported?: boolean;
}

/**
 * Error store state
 */
export interface ErrorStoreState {
	/** Current error (most recent) */
	currentError: NormalizedError | null;
	/** History of errors (optional, for debugging) */
	errorHistory: NormalizedError[];
	/** Whether error UI should be shown */
	showErrorUI: boolean;
	/** Whether there's a fatal error */
	hasFatalError: boolean;
}

/**
 * ReportingProvider interface
 *
 * Generic interface for error reporting services.
 * Apps implement this with Sentry, LogRocket, custom analytics, etc.
 * WarpKit calls this interface - never knows about specific services.
 */
export interface ReportingProvider {
	/**
	 * Report an error to the external service
	 * @param error - Normalized error to report
	 * @returns Promise that resolves when reported (or void for fire-and-forget)
	 */
	captureError(error: NormalizedError): void | Promise<void>;

	/**
	 * Set user context for error reports
	 * @param user - User info or null to clear
	 */
	setUser?(user: { id: string; email?: string; name?: string } | null): void;

	/**
	 * Add breadcrumb/context for debugging
	 * @param message - Breadcrumb message
	 * @param data - Additional data
	 */
	addBreadcrumb?(message: string, data?: Record<string, unknown>): void;

	/**
	 * Set additional tags/context
	 * @param tags - Key-value pairs
	 */
	setTags?(tags: Record<string, string>): void;
}

/**
 * Options for initializing error handlers
 */
export interface ErrorHandlerOptions {
	/** Reporting provider (optional - errors still stored locally without it) */
	reporter?: ReportingProvider;
	/** Whether to show error UI for uncaught errors */
	showUIOnError?: boolean;
	/** Maximum errors to keep in history */
	maxHistorySize?: number;
	/** Custom error filter - return false to ignore error */
	shouldCapture?: (error: Error | string, source: ErrorSource) => boolean;
}
