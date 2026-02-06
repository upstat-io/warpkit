/**
 * Error Channel - Singleton pub/sub for cross-package error reporting.
 *
 * Any WarpKit package can call `reportError()` to report errors.
 * Core subscribes via `onErrorReport()` and routes to errorStore + ErrorOverlay.
 *
 * Key behaviors:
 * - If no subscribers: buffer errors (max 100), console.error in DEV
 * - First subscriber: flush buffered errors immediately
 * - Zero dependencies - safe to import from any package
 */

import type {
	ErrorChannelSource,
	ErrorReport,
	ErrorReportHandler,
	ErrorReportOptions,
	ErrorReportSeverity
} from './types';

const MAX_BUFFER_SIZE = 100;

/** Active subscribers */
let handlers = new Set<ErrorReportHandler>();

/** Pre-subscription buffer */
let buffer: ErrorReport[] = [];

/**
 * Resolve the default showUI value based on severity.
 * error/fatal → true, warning/info → false
 */
function defaultShowUI(severity: ErrorReportSeverity): boolean {
	return severity === 'error' || severity === 'fatal';
}

/**
 * Coerce an unknown value into an Error instance.
 */
function toError(value: unknown): Error {
	if (value instanceof Error) return value;
	if (typeof value === 'string') return new Error(value);
	return new Error(String(value));
}

/**
 * Build an ErrorReport from the given arguments.
 */
function buildReport(
	source: ErrorChannelSource,
	error: unknown,
	options?: ErrorReportOptions
): ErrorReport {
	const severity = options?.severity ?? 'error';
	return {
		source,
		error: toError(error),
		severity,
		showUI: options?.showUI ?? defaultShowUI(severity),
		handledLocally: options?.handledLocally ?? false,
		context: options?.context,
		timestamp: Date.now()
	};
}

/**
 * Report an error from any WarpKit package.
 *
 * If subscribers exist, the report is delivered immediately.
 * If no subscribers yet (before core init), the report is buffered
 * and will be flushed when the first subscriber registers.
 *
 * @param source - Which sub-package is reporting
 * @param error - The error (will be coerced to Error if not already)
 * @param options - Optional severity, showUI, context
 */
export function reportError(
	source: ErrorChannelSource,
	error: unknown,
	options?: ErrorReportOptions
): void {
	const report = buildReport(source, error, options);

	if (handlers.size > 0) {
		for (const handler of handlers) {
			try {
				handler(report);
			} catch {
				// Never throw from error reporting
			}
		}
	} else {
		// No subscribers yet - buffer and log in DEV
		if (buffer.length < MAX_BUFFER_SIZE) {
			buffer.push(report);
		}
		try {
			if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
				console.error(`[WarpKit ${source}]`, report.error);
			}
		} catch {
			// import.meta may not be available in all environments
		}
	}
}

/**
 * Subscribe to error reports.
 *
 * The first subscriber triggers a flush of all buffered errors.
 * Returns an unsubscribe function.
 *
 * @param handler - Called for each error report
 * @returns Unsubscribe function
 */
export function onErrorReport(handler: ErrorReportHandler): () => void {
	const isFirstSubscriber = handlers.size === 0;
	handlers.add(handler);

	// First subscriber: flush buffer
	if (isFirstSubscriber && buffer.length > 0) {
		const buffered = buffer;
		buffer = [];
		for (const report of buffered) {
			try {
				handler(report);
			} catch {
				// Never throw from error reporting
			}
		}
	}

	return () => {
		handlers.delete(handler);
	};
}

/**
 * Reset internal state. For testing only.
 */
export function _resetChannel(): void {
	handlers = new Set();
	buffer = [];
}
