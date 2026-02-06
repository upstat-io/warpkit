/**
 * Error Channel Types
 *
 * Types for the cross-package error reporting channel.
 * This package has zero dependencies - any WarpKit package can use it.
 */

/**
 * Source identifier for error reports.
 * Each sub-package uses a distinct source for routing and filtering.
 */
export type ErrorChannelSource =
	| 'data:query'
	| 'data:mutation'
	| 'websocket'
	| 'websocket:message'
	| 'websocket:heartbeat'
	| 'forms:submit'
	| 'cache'
	| 'auth'
	| 'event-emitter'
	| 'state-machine'
	| 'navigation-lifecycle';

/**
 * Severity level for error reports.
 */
export type ErrorReportSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Options for reporting an error.
 */
export interface ErrorReportOptions {
	/** Severity level (default: 'error') */
	severity?: ErrorReportSeverity;
	/** Whether the error UI overlay should be shown (default: true for error/fatal, false for warning/info) */
	showUI?: boolean;
	/** Whether the package already displays this error to the user (e.g., in a component) */
	handledLocally?: boolean;
	/** Additional context for debugging */
	context?: Record<string, unknown>;
}

/**
 * A structured error report emitted by any WarpKit package.
 */
export interface ErrorReport {
	/** Which sub-package reported the error */
	source: ErrorChannelSource;
	/** The error object (coerced from unknown if necessary) */
	error: Error;
	/** Severity level */
	severity: ErrorReportSeverity;
	/** Whether the error UI overlay should be shown */
	showUI: boolean;
	/** Whether the package already displays this error locally */
	handledLocally: boolean;
	/** Additional context */
	context?: Record<string, unknown>;
	/** Timestamp of the report */
	timestamp: number;
}

/**
 * Handler function for error reports.
 */
export type ErrorReportHandler = (report: ErrorReport) => void;
