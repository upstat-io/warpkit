/**
 * Global Error Handlers Browser Tests
 *
 * Tests that global error handlers properly capture and route errors
 * to the errorStore. These tests intentionally trigger various error
 * scenarios to verify resilient error handling.
 *
 * These tests run in a real browser environment (vitest-browser-svelte)
 * because they need access to window.onerror and window.onunhandledrejection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	setupGlobalErrorHandlers,
	removeGlobalErrorHandlers,
	areGlobalHandlersInstalled,
	setReportingProvider
} from '../../src/errors/global-handlers';
import { errorStore } from '../../src/errors/error-store.svelte';
import type { ReportingProvider, NormalizedError } from '../../src/errors/types';

describe('setupGlobalErrorHandlers', () => {
	beforeEach(() => {
		// Clean state before each test
		removeGlobalErrorHandlers();
		errorStore.clearHistory();
	});

	afterEach(() => {
		// Clean up after each test
		removeGlobalErrorHandlers();
		errorStore.clearHistory();
	});

	describe('installation', () => {
		it('should install handlers on first call', () => {
			expect(areGlobalHandlersInstalled()).toBe(false);

			setupGlobalErrorHandlers();

			expect(areGlobalHandlersInstalled()).toBe(true);
		});

		it('should return cleanup function', () => {
			const cleanup = setupGlobalErrorHandlers();

			expect(typeof cleanup).toBe('function');

			cleanup();
			expect(areGlobalHandlersInstalled()).toBe(false);
		});

		it('should be idempotent - multiple calls return same cleanup', () => {
			const cleanup1 = setupGlobalErrorHandlers();
			const cleanup2 = setupGlobalErrorHandlers();

			// Both should work
			expect(areGlobalHandlersInstalled()).toBe(true);

			cleanup2();
			expect(areGlobalHandlersInstalled()).toBe(false);
		});

		it('should update reporter on subsequent calls', () => {
			const reporter1: ReportingProvider = {
				captureError: vi.fn()
			};
			const reporter2: ReportingProvider = {
				captureError: vi.fn()
			};

			setupGlobalErrorHandlers({ reporter: reporter1 });
			setupGlobalErrorHandlers({ reporter: reporter2 });

			// Trigger an error to verify reporter2 is used
			window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));

			expect(reporter1.captureError).not.toHaveBeenCalled();
			expect(reporter2.captureError).toHaveBeenCalled();
		});
	});

	describe('window.onerror handling', () => {
		beforeEach(() => {
			setupGlobalErrorHandlers();
		});

		it('should capture synchronous errors via window.onerror', () => {
			const error = new Error('Sync error test');

			window.onerror?.('Sync error test', 'test.js', 10, 5, error);

			expect(errorStore.currentError).not.toBeNull();
			expect(errorStore.currentError?.message).toBe('Sync error test');
			expect(errorStore.currentError?.source).toBe('global');
			expect(errorStore.showErrorUI).toBe(true);
		});

		it('should capture errors with string message only (no Error object)', () => {
			window.onerror?.('String only error', 'test.js', 10, 5, undefined);

			expect(errorStore.currentError).not.toBeNull();
			expect(errorStore.currentError?.message).toBe('String only error');
		});

		it('should include source location in context', () => {
			window.onerror?.('Error with location', 'script.js', 42, 10, new Error('Error with location'));

			expect(errorStore.currentError?.context).toEqual({
				source: 'script.js',
				lineno: 42,
				colno: 10
			});
		});

		it('should report to external provider when configured', () => {
			removeGlobalErrorHandlers();

			const capturedErrors: NormalizedError[] = [];
			const reporter: ReportingProvider = {
				captureError: (error) => {
					capturedErrors.push(error);
				}
			};

			setupGlobalErrorHandlers({ reporter });

			window.onerror?.('Reported error', 'test.js', 1, 1, new Error('Reported error'));

			expect(capturedErrors.length).toBe(1);
			expect(capturedErrors[0].message).toBe('Reported error');
		});

		it('should call original window.onerror if it existed', () => {
			removeGlobalErrorHandlers();

			const originalHandler = vi.fn(() => false);
			window.onerror = originalHandler;

			setupGlobalErrorHandlers();

			window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));

			expect(originalHandler).toHaveBeenCalled();
		});

		it('should not throw even if errorStore.setError throws', () => {
			// This tests resilience - error handler should never throw
			const setErrorSpy = vi.spyOn(errorStore, 'setError').mockImplementation(() => {
				throw new Error('Store failed');
			});

			// Should not throw
			expect(() => {
				window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));
			}).not.toThrow();

			setErrorSpy.mockRestore();
		});
	});

	describe('window.onunhandledrejection handling', () => {
		beforeEach(() => {
			setupGlobalErrorHandlers();
		});

		it('should capture unhandled promise rejections with Error', () => {
			const error = new Error('Promise rejection test');
			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason: error,
				promise: Promise.reject(error).catch(() => {}) // Prevent actual unhandled rejection
			});

			window.onunhandledrejection?.(event);

			expect(errorStore.currentError).not.toBeNull();
			expect(errorStore.currentError?.message).toBe('Promise rejection test');
			expect(errorStore.currentError?.source).toBe('unhandled-rejection');
		});

		it('should capture unhandled promise rejections with string reason', () => {
			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason: 'String rejection reason',
				promise: Promise.reject('String rejection reason').catch(() => {})
			});

			window.onunhandledrejection?.(event);

			expect(errorStore.currentError).not.toBeNull();
			expect(errorStore.currentError?.message).toBe('String rejection reason');
		});

		it('should capture unhandled promise rejections with object reason', () => {
			const reason = { code: 'ERR_001', detail: 'Something failed' };
			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason,
				promise: Promise.reject(reason).catch(() => {})
			});

			window.onunhandledrejection?.(event);

			expect(errorStore.currentError).not.toBeNull();
			// Object should be stringified
			expect(errorStore.currentError?.message).toContain('object');
		});

		it('should report to external provider when configured', () => {
			removeGlobalErrorHandlers();

			const capturedErrors: NormalizedError[] = [];
			const reporter: ReportingProvider = {
				captureError: (error) => {
					capturedErrors.push(error);
				}
			};

			setupGlobalErrorHandlers({ reporter });

			const error = new Error('Reported rejection');
			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason: error,
				promise: Promise.reject(error).catch(() => {})
			});

			window.onunhandledrejection?.(event);

			expect(capturedErrors.length).toBe(1);
			expect(capturedErrors[0].message).toBe('Reported rejection');
		});

		it('should call original window.onunhandledrejection if it existed', () => {
			removeGlobalErrorHandlers();

			const originalHandler = vi.fn();
			window.onunhandledrejection = originalHandler;

			setupGlobalErrorHandlers();

			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason: new Error('Test'),
				promise: Promise.reject(new Error('Test')).catch(() => {})
			});

			window.onunhandledrejection?.(event);

			expect(originalHandler).toHaveBeenCalled();
		});
	});

	describe('removeGlobalErrorHandlers', () => {
		it('should remove handlers', () => {
			setupGlobalErrorHandlers();
			expect(areGlobalHandlersInstalled()).toBe(true);

			removeGlobalErrorHandlers();

			expect(areGlobalHandlersInstalled()).toBe(false);
		});

		it('should be safe to call multiple times', () => {
			setupGlobalErrorHandlers();

			removeGlobalErrorHandlers();
			removeGlobalErrorHandlers();
			removeGlobalErrorHandlers();

			expect(areGlobalHandlersInstalled()).toBe(false);
		});

		it('should be safe to call without prior installation', () => {
			expect(() => {
				removeGlobalErrorHandlers();
			}).not.toThrow();
		});

		it('should clear reporter', () => {
			const capturedErrors: NormalizedError[] = [];
			const reporter: ReportingProvider = {
				captureError: (error) => {
					capturedErrors.push(error);
				}
			};

			setupGlobalErrorHandlers({ reporter });
			removeGlobalErrorHandlers();
			setupGlobalErrorHandlers(); // Re-install without reporter

			window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));

			// Reporter should not have been called after removal
			expect(capturedErrors.length).toBe(0);
		});
	});

	describe('setReportingProvider', () => {
		it('should allow setting reporter after installation', () => {
			setupGlobalErrorHandlers();

			const capturedErrors: NormalizedError[] = [];
			const reporter: ReportingProvider = {
				captureError: (error) => {
					capturedErrors.push(error);
				}
			};

			setReportingProvider(reporter);

			window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));

			expect(capturedErrors.length).toBe(1);
		});

		it('should allow clearing reporter', () => {
			const capturedErrors: NormalizedError[] = [];
			const reporter: ReportingProvider = {
				captureError: (error) => {
					capturedErrors.push(error);
				}
			};

			setupGlobalErrorHandlers({ reporter });
			setReportingProvider(undefined);

			window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));

			// Error should still be in store, just not reported
			expect(errorStore.currentError).not.toBeNull();
			expect(capturedErrors.length).toBe(0);
		});
	});

	describe('error severity and UI visibility', () => {
		beforeEach(() => {
			setupGlobalErrorHandlers();
		});

		it('should set severity to error for window.onerror', () => {
			window.onerror?.('Test', 'test.js', 1, 1, new Error('Test'));

			expect(errorStore.currentError?.severity).toBe('error');
		});

		it('should set severity to error for unhandled rejections', () => {
			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason: new Error('Test'),
				promise: Promise.reject(new Error('Test')).catch(() => {})
			});

			window.onunhandledrejection?.(event);

			expect(errorStore.currentError?.severity).toBe('error');
		});

		it('should show error UI for all captured errors', () => {
			window.onerror?.('Test', 'test.js', 1, 1, new Error('Test'));

			expect(errorStore.showErrorUI).toBe(true);
		});
	});

	describe('multiple error handling', () => {
		beforeEach(() => {
			setupGlobalErrorHandlers();
		});

		it('should capture multiple errors in sequence', () => {
			window.onerror?.('Error 1', 'test.js', 1, 1, new Error('Error 1'));
			window.onerror?.('Error 2', 'test.js', 2, 1, new Error('Error 2'));
			window.onerror?.('Error 3', 'test.js', 3, 1, new Error('Error 3'));

			expect(errorStore.currentError?.message).toBe('Error 3');
			expect(errorStore.errorHistory.length).toBe(3);
		});

		it('should handle mixed error types', () => {
			// Sync error
			window.onerror?.('Sync error', 'test.js', 1, 1, new Error('Sync error'));

			// Promise rejection
			const event = new PromiseRejectionEvent('unhandledrejection', {
				reason: new Error('Promise error'),
				promise: Promise.reject(new Error('Promise error')).catch(() => {})
			});
			window.onunhandledrejection?.(event);

			expect(errorStore.errorHistory.length).toBe(2);
			expect(errorStore.errorHistory[0].source).toBe('unhandled-rejection');
			expect(errorStore.errorHistory[1].source).toBe('global');
		});
	});
});

describe('error propagation resilience', () => {
	beforeEach(() => {
		errorStore.clearHistory();
		removeGlobalErrorHandlers();
	});

	afterEach(() => {
		removeGlobalErrorHandlers();
		errorStore.clearHistory();
	});

	it('should handle errors even when reporter throws', () => {
		const reporter: ReportingProvider = {
			captureError: () => {
				throw new Error('Reporter failed');
			}
		};

		setupGlobalErrorHandlers({ reporter });

		// Should not throw
		expect(() => {
			window.onerror?.('Test error', 'test.js', 1, 1, new Error('Test'));
		}).not.toThrow();

		// Error should still be in store (Error object message takes precedence over onerror message)
		expect(errorStore.currentError?.message).toBe('Test');
	});

	it('should handle null/undefined error gracefully', () => {
		setupGlobalErrorHandlers();

		// These edge cases should not throw
		expect(() => {
			window.onerror?.(null as unknown as string, 'test.js', 1, 1, undefined);
		}).not.toThrow();
	});
});
