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
import type { ErrorChannelSource, ErrorReportHandler, ErrorReportOptions } from './types';
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
export declare function reportError(source: ErrorChannelSource, error: unknown, options?: ErrorReportOptions): void;
/**
 * Subscribe to error reports.
 *
 * The first subscriber triggers a flush of all buffered errors.
 * Returns an unsubscribe function.
 *
 * @param handler - Called for each error report
 * @returns Unsubscribe function
 */
export declare function onErrorReport(handler: ErrorReportHandler): () => void;
/**
 * Reset internal state. For testing only.
 */
export declare function _resetChannel(): void;
