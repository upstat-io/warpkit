/**
 * Error Store Unit Tests
 *
 * Tests error state management, history tracking, and derived stores.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import { errorStore, currentError, showErrorUI, errorHistory, hasFatalError } from '../error-store';

describe('errorStore', () => {
	// Clear store before each test
	beforeEach(() => {
		errorStore.clearHistory();
	});

	describe('initial state', () => {
		it('should start with no current error', () => {
			expect(get(errorStore).currentError).toBeNull();
		});

		it('should start with empty error history', () => {
			expect(get(errorStore).errorHistory).toEqual([]);
		});

		it('should start with showErrorUI false', () => {
			expect(get(errorStore).showErrorUI).toBe(false);
		});
	});

	describe('setError', () => {
		it('should set error from string message', () => {
			const normalized = errorStore.setError('Test error message');

			expect(normalized.message).toBe('Test error message');
			expect(normalized.originalError).toBeUndefined();
			expect(normalized.stack).toBeUndefined();
		});

		it('should set error from Error object', () => {
			const error = new Error('Error object message');
			const normalized = errorStore.setError(error);

			expect(normalized.message).toBe('Error object message');
			expect(normalized.originalError).toBe(error);
			expect(normalized.stack).toBe(error.stack);
		});

		it('should generate unique error IDs', () => {
			const err1 = errorStore.setError('Error 1');
			const err2 = errorStore.setError('Error 2');

			expect(err1.id).toMatch(/^err_\d+_[a-z0-9]+$/);
			expect(err2.id).toMatch(/^err_\d+_[a-z0-9]+$/);
			expect(err1.id).not.toBe(err2.id);
		});

		it('should set default source to manual', () => {
			const normalized = errorStore.setError('Test error');
			expect(normalized.source).toBe('manual');
		});

		it('should set default severity to error', () => {
			const normalized = errorStore.setError('Test error');
			expect(normalized.severity).toBe('error');
		});

		it('should use provided source option', () => {
			const normalized = errorStore.setError('Test error', { source: 'router' });
			expect(normalized.source).toBe('router');
		});

		it('should use provided severity option', () => {
			const normalized = errorStore.setError('Test error', { severity: 'fatal' });
			expect(normalized.severity).toBe('fatal');
		});

		it('should include context when provided', () => {
			const context = { userId: '123', action: 'submit' };
			const normalized = errorStore.setError('Test error', { context });
			expect(normalized.context).toEqual(context);
		});

		it('should set timestamp to current time', () => {
			const before = new Date();
			const normalized = errorStore.setError('Test error');
			const after = new Date();

			expect(normalized.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(normalized.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it('should set reported to false', () => {
			const normalized = errorStore.setError('Test error');
			expect(normalized.reported).toBe(false);
		});

		it('should update currentError in store', () => {
			const normalized = errorStore.setError('Test error');
			expect(get(errorStore).currentError).toEqual(normalized);
		});

		it('should add error to history', () => {
			const normalized = errorStore.setError('Test error');
			expect(get(errorStore).errorHistory).toContain(normalized);
		});

		it('should show error UI by default', () => {
			errorStore.setError('Test error');
			expect(get(errorStore).showErrorUI).toBe(true);
		});

		it('should not show error UI when showUI is false', () => {
			errorStore.setError('Test error', { showUI: false });
			expect(get(errorStore).showErrorUI).toBe(false);
		});
	});

	describe('error history', () => {
		it('should add new errors to beginning of history', () => {
			const err1 = errorStore.setError('Error 1');
			const err2 = errorStore.setError('Error 2');

			const history = get(errorStore).errorHistory;
			expect(history[0]).toEqual(err2);
			expect(history[1]).toEqual(err1);
		});

		it('should limit history to max size', () => {
			errorStore.setMaxHistorySize(3);

			errorStore.setError('Error 1');
			errorStore.setError('Error 2');
			errorStore.setError('Error 3');
			const err4 = errorStore.setError('Error 4');

			const history = get(errorStore).errorHistory;
			expect(history.length).toBe(3);
			expect(history[0]).toEqual(err4);
			expect(history.find((e) => e.message === 'Error 1')).toBeUndefined();
		});
	});

	describe('markAsReported', () => {
		it('should mark current error as reported', () => {
			const normalized = errorStore.setError('Test error');
			expect(get(errorStore).currentError?.reported).toBe(false);

			errorStore.markAsReported(normalized.id);

			expect(get(errorStore).currentError?.reported).toBe(true);
		});

		it('should mark error in history as reported', () => {
			const normalized = errorStore.setError('Test error');
			errorStore.markAsReported(normalized.id);

			const historyError = get(errorStore).errorHistory.find((e) => e.id === normalized.id);
			expect(historyError?.reported).toBe(true);
		});

		it('should not affect unrelated errors', () => {
			const err1 = errorStore.setError('Error 1');
			const err2 = errorStore.setError('Error 2');

			errorStore.markAsReported(err1.id);

			expect(get(errorStore).currentError?.reported).toBe(false); // err2 is current
			const historyErr2 = get(errorStore).errorHistory.find((e) => e.id === err2.id);
			expect(historyErr2?.reported).toBe(false);
		});
	});

	describe('clearCurrentError', () => {
		it('should clear current error', () => {
			errorStore.setError('Test error');
			expect(get(errorStore).currentError).not.toBeNull();

			errorStore.clearCurrentError();

			expect(get(errorStore).currentError).toBeNull();
		});

		it('should hide error UI', () => {
			errorStore.setError('Test error');
			expect(get(errorStore).showErrorUI).toBe(true);

			errorStore.clearCurrentError();

			expect(get(errorStore).showErrorUI).toBe(false);
		});

		it('should preserve error history', () => {
			errorStore.setError('Test error');
			const historyLength = get(errorStore).errorHistory.length;

			errorStore.clearCurrentError();

			expect(get(errorStore).errorHistory.length).toBe(historyLength);
		});
	});

	describe('hideErrorUI', () => {
		it('should hide error UI without clearing error', () => {
			const normalized = errorStore.setError('Test error');

			errorStore.hideErrorUI();

			expect(get(errorStore).showErrorUI).toBe(false);
			expect(get(errorStore).currentError).toEqual(normalized);
		});
	});

	describe('clearHistory', () => {
		it('should reset to initial state', () => {
			errorStore.setError('Error 1');
			errorStore.setError('Error 2');

			errorStore.clearHistory();

			expect(get(errorStore).currentError).toBeNull();
			expect(get(errorStore).errorHistory).toEqual([]);
			expect(get(errorStore).showErrorUI).toBe(false);
		});
	});

	describe('getErrorById', () => {
		it('should return error from history', () => {
			const err1 = errorStore.setError('Error 1');
			errorStore.setError('Error 2');

			const found = errorStore.getErrorById(err1.id);

			expect(found).toEqual(err1);
		});

		it('should return undefined for non-existent ID', () => {
			errorStore.setError('Test error');

			const found = errorStore.getErrorById('non-existent-id');

			expect(found).toBeUndefined();
		});
	});
});

describe('derived stores', () => {
	beforeEach(() => {
		errorStore.clearHistory();
	});

	describe('currentError', () => {
		it('should return null when no error', () => {
			expect(get(currentError)).toBeNull();
		});

		it('should return current error when set', () => {
			const normalized = errorStore.setError('Test error');
			expect(get(currentError)).toEqual(normalized);
		});
	});

	describe('showErrorUI', () => {
		it('should return false when no error', () => {
			expect(get(showErrorUI)).toBe(false);
		});

		it('should return true when error is shown', () => {
			errorStore.setError('Test error');
			expect(get(showErrorUI)).toBe(true);
		});

		it('should return false after hiding UI', () => {
			errorStore.setError('Test error');
			errorStore.hideErrorUI();
			expect(get(showErrorUI)).toBe(false);
		});
	});

	describe('errorHistory', () => {
		it('should return empty array initially', () => {
			expect(get(errorHistory)).toEqual([]);
		});

		it('should return history in reverse chronological order', () => {
			const err1 = errorStore.setError('Error 1');
			const err2 = errorStore.setError('Error 2');

			const history = get(errorHistory);
			expect(history[0]).toEqual(err2);
			expect(history[1]).toEqual(err1);
		});
	});

	describe('hasFatalError', () => {
		it('should return false when no error', () => {
			expect(get(hasFatalError)).toBe(false);
		});

		it('should return false for non-fatal errors', () => {
			errorStore.setError('Test error', { severity: 'error' });
			expect(get(hasFatalError)).toBe(false);
		});

		it('should return true for fatal errors', () => {
			errorStore.setError('Fatal error', { severity: 'fatal' });
			expect(get(hasFatalError)).toBe(true);
		});

		it('should return false after clearing fatal error', () => {
			errorStore.setError('Fatal error', { severity: 'fatal' });
			errorStore.clearCurrentError();
			expect(get(hasFatalError)).toBe(false);
		});
	});
});
