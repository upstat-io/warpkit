/**
 * Error Channel Tests
 *
 * Tests buffering, flushing, subscriber isolation, defaults, coercion,
 * max buffer, unsubscribe, and _resetChannel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportError, onErrorReport, _resetChannel } from './channel';
import type { ErrorReport } from './types';

describe('Error Channel', () => {
	beforeEach(() => {
		_resetChannel();
	});

	describe('reportError', () => {
		it('should deliver to subscriber immediately', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('data:query', new Error('fetch failed'));

			expect(handler).toHaveBeenCalledTimes(1);
			const report: ErrorReport = handler.mock.calls[0][0];
			expect(report.source).toBe('data:query');
			expect(report.error.message).toBe('fetch failed');
			expect(report.severity).toBe('error');
			expect(report.showUI).toBe(true);
			expect(report.handledLocally).toBe(false);
			expect(report.timestamp).toBeGreaterThan(0);
		});

		it('should coerce string errors to Error instances', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('cache', 'storage quota exceeded');

			const report: ErrorReport = handler.mock.calls[0][0];
			expect(report.error).toBeInstanceOf(Error);
			expect(report.error.message).toBe('storage quota exceeded');
		});

		it('should coerce non-Error non-string values to Error', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('websocket', 42);

			const report: ErrorReport = handler.mock.calls[0][0];
			expect(report.error).toBeInstanceOf(Error);
			expect(report.error.message).toBe('42');
		});

		it('should use default severity of error', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('forms:submit', new Error('validation'));

			expect(handler.mock.calls[0][0].severity).toBe('error');
		});

		it('should respect custom severity', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('cache', new Error('quota'), { severity: 'warning' });

			expect(handler.mock.calls[0][0].severity).toBe('warning');
		});

		it('should default showUI to true for error severity', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('auth', new Error('init failed'));

			expect(handler.mock.calls[0][0].showUI).toBe(true);
		});

		it('should default showUI to true for fatal severity', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('auth', new Error('crash'), { severity: 'fatal' });

			expect(handler.mock.calls[0][0].showUI).toBe(true);
		});

		it('should default showUI to false for warning severity', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('cache', new Error('quota'), { severity: 'warning' });

			expect(handler.mock.calls[0][0].showUI).toBe(false);
		});

		it('should default showUI to false for info severity', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('websocket', new Error('reconnecting'), { severity: 'info' });

			expect(handler.mock.calls[0][0].showUI).toBe(false);
		});

		it('should allow overriding showUI explicitly', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('data:query', new Error('failed'), { showUI: false });

			expect(handler.mock.calls[0][0].showUI).toBe(false);
		});

		it('should pass context through', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('data:query', new Error('failed'), {
				context: { key: 'users', params: { page: 1 } }
			});

			expect(handler.mock.calls[0][0].context).toEqual({
				key: 'users',
				params: { page: 1 }
			});
		});

		it('should pass handledLocally through', () => {
			const handler = vi.fn();
			onErrorReport(handler);

			reportError('data:query', new Error('failed'), { handledLocally: true });

			expect(handler.mock.calls[0][0].handledLocally).toBe(true);
		});

		it('should deliver to multiple subscribers', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			onErrorReport(handler1);
			onErrorReport(handler2);

			reportError('auth', new Error('expired'));

			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);
		});

		it('should not throw if a handler throws', () => {
			onErrorReport(() => {
				throw new Error('handler bug');
			});
			const handler2 = vi.fn();
			onErrorReport(handler2);

			expect(() => {
				reportError('auth', new Error('test'));
			}).not.toThrow();

			expect(handler2).toHaveBeenCalledTimes(1);
		});
	});

	describe('buffering', () => {
		it('should buffer errors when no subscribers exist', () => {
			// Suppress console.error in DEV
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			reportError('auth', new Error('early error'));
			reportError('cache', new Error('another early'));

			// No handler yet - errors buffered
			const handler = vi.fn();
			onErrorReport(handler);

			// First subscriber should receive buffered errors
			expect(handler).toHaveBeenCalledTimes(2);
			expect(handler.mock.calls[0][0].source).toBe('auth');
			expect(handler.mock.calls[1][0].source).toBe('cache');

			spy.mockRestore();
		});

		it('should flush buffer only to the first subscriber', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			reportError('auth', new Error('buffered'));

			const handler1 = vi.fn();
			const handler2 = vi.fn();

			onErrorReport(handler1);
			// handler1 gets the buffer flush
			expect(handler1).toHaveBeenCalledTimes(1);

			onErrorReport(handler2);
			// handler2 does NOT get the already-flushed buffer
			expect(handler2).toHaveBeenCalledTimes(0);

			spy.mockRestore();
		});

		it('should clear buffer after flush', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			reportError('auth', new Error('buffered'));

			const handler1 = vi.fn();
			onErrorReport(handler1);
			expect(handler1).toHaveBeenCalledTimes(1);

			// Remove subscriber, add new one
			_resetChannel();
			const handler2 = vi.fn();
			onErrorReport(handler2);

			// Buffer was cleared by the flush, not by reset - but reset also clears
			expect(handler2).toHaveBeenCalledTimes(0);

			spy.mockRestore();
		});

		it('should cap buffer at max size (100)', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Report 110 errors with no subscriber
			for (let i = 0; i < 110; i++) {
				reportError('cache', new Error(`error ${i}`));
			}

			const handler = vi.fn();
			onErrorReport(handler);

			// Only 100 should be buffered
			expect(handler).toHaveBeenCalledTimes(100);

			spy.mockRestore();
		});

		it('should console.error in DEV when no subscribers', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			reportError('websocket', new Error('no listener'));

			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy).toHaveBeenCalledWith('[WarpKit websocket]', expect.any(Error));

			spy.mockRestore();
		});
	});

	describe('onErrorReport', () => {
		it('should return an unsubscribe function', () => {
			const handler = vi.fn();
			const unsubscribe = onErrorReport(handler);

			reportError('auth', new Error('test1'));
			expect(handler).toHaveBeenCalledTimes(1);

			unsubscribe();

			reportError('auth', new Error('test2'));
			expect(handler).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should handle unsubscribe called multiple times', () => {
			const handler = vi.fn();
			const unsubscribe = onErrorReport(handler);

			unsubscribe();
			unsubscribe(); // Should not throw
			unsubscribe();
		});

		it('should not throw when flushing if handler throws', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			reportError('auth', new Error('buffered'));

			expect(() => {
				onErrorReport(() => {
					throw new Error('handler bug');
				});
			}).not.toThrow();

			spy.mockRestore();
		});
	});

	describe('_resetChannel', () => {
		it('should clear all handlers and buffer', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const handler = vi.fn();
			onErrorReport(handler);
			reportError('auth', new Error('before reset'));
			expect(handler).toHaveBeenCalledTimes(1);

			_resetChannel();

			// Report after reset - no handlers, goes to buffer
			reportError('auth', new Error('after reset'));
			expect(handler).toHaveBeenCalledTimes(1); // Not called

			// New handler gets only the post-reset buffered error
			const handler2 = vi.fn();
			onErrorReport(handler2);
			expect(handler2).toHaveBeenCalledTimes(1);
			expect(handler2.mock.calls[0][0].error.message).toBe('after reset');

			spy.mockRestore();
		});
	});
});
