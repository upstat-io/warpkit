/**
 * @warpkit/errors - Cross-package error reporting channel.
 *
 * Zero-dependency leaf package. Any WarpKit package can import
 * `reportError()` to report errors. Core subscribes via `onErrorReport()`
 * and routes to the central error store and UI overlay.
 */

export { reportError, onErrorReport, _resetChannel } from './channel';
export type {
	ErrorChannelSource,
	ErrorReportSeverity,
	ErrorReportOptions,
	ErrorReport,
	ErrorReportHandler
} from './types';
