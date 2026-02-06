import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationLifecycle } from '../NavigationLifecycle.js';
import { onErrorReport, _resetChannel } from '@warpkit/errors';
import type { ErrorReport } from '@warpkit/errors';
import type { NavigationContext } from '../types.js';

describe('NavigationLifecycle', () => {
	let lifecycle: NavigationLifecycle;
	let mockContext: NavigationContext;

	beforeEach(() => {
		_resetChannel();
		lifecycle = new NavigationLifecycle();
		mockContext = {
			from: null,
			to: {
				path: '/dashboard',
				pathname: '/dashboard',
				search: '',
				hash: '',
				params: {},
				route: {
					path: '/dashboard',
					component: () => Promise.resolve({ default: {} as any }),
					meta: {}
				},
				appState: 'authenticated'
			},
			type: 'push',
			direction: 'forward',
			navigationId: 1
		};
	});

	describe('registerBeforeNavigate', () => {
		it('should register a hook and return unsubscribe function', () => {
			const hook = vi.fn();
			const unsubscribe = lifecycle.registerBeforeNavigate(hook);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should allow unsubscribing', async () => {
			const hook = vi.fn().mockReturnValue(true);
			const unsubscribe = lifecycle.registerBeforeNavigate(hook);

			unsubscribe();

			const result = await lifecycle.runBeforeNavigate(mockContext);
			expect(hook).not.toHaveBeenCalled();
			expect(result.proceed).toBe(true);
		});
	});

	describe('registerOnNavigate', () => {
		it('should register a hook and return unsubscribe function', () => {
			const hook = vi.fn();
			const unsubscribe = lifecycle.registerOnNavigate(hook);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should allow unsubscribing', async () => {
			const hook = vi.fn();
			const unsubscribe = lifecycle.registerOnNavigate(hook);

			unsubscribe();

			await lifecycle.runOnNavigate(mockContext);
			expect(hook).not.toHaveBeenCalled();
		});
	});

	describe('registerAfterNavigate', () => {
		it('should register a hook and return unsubscribe function', () => {
			const hook = vi.fn();
			const unsubscribe = lifecycle.registerAfterNavigate(hook);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should allow unsubscribing', () => {
			const hook = vi.fn();
			const unsubscribe = lifecycle.registerAfterNavigate(hook);

			unsubscribe();

			lifecycle.runAfterNavigate(mockContext);
			expect(hook).not.toHaveBeenCalled();
		});
	});

	describe('runBeforeNavigate', () => {
		it('should return proceed: true when no hooks registered', async () => {
			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(true);
			expect(result.redirect).toBeUndefined();
		});

		it('should run all hooks in parallel', async () => {
			const order: number[] = [];
			const hook1 = vi.fn(async () => {
				await new Promise((r) => setTimeout(r, 10));
				order.push(1);
				return true;
			});
			const hook2 = vi.fn(async () => {
				order.push(2);
				return true;
			});

			lifecycle.registerBeforeNavigate(hook1);
			lifecycle.registerBeforeNavigate(hook2);

			await lifecycle.runBeforeNavigate(mockContext);

			// Both hooks called
			expect(hook1).toHaveBeenCalledWith(mockContext);
			expect(hook2).toHaveBeenCalledWith(mockContext);
			// hook2 should complete first (no delay)
			expect(order[0]).toBe(2);
		});

		it('should return proceed: true when all hooks return void/true', async () => {
			lifecycle.registerBeforeNavigate(() => {});
			lifecycle.registerBeforeNavigate(() => true);
			lifecycle.registerBeforeNavigate(async () => true);

			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(true);
		});

		it('should abort when any hook returns false', async () => {
			lifecycle.registerBeforeNavigate(() => true);
			lifecycle.registerBeforeNavigate(() => false);
			lifecycle.registerBeforeNavigate(() => true);

			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(false);
			expect(result.redirect).toBeUndefined();
		});

		it('should return redirect when a hook returns a string', async () => {
			lifecycle.registerBeforeNavigate(() => true);
			lifecycle.registerBeforeNavigate(() => '/login');

			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(false);
			expect(result.redirect).toBe('/login');
		});

		it('should prefer abort over redirect (abort wins)', async () => {
			lifecycle.registerBeforeNavigate(() => '/login');
			lifecycle.registerBeforeNavigate(() => false);

			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(false);
			expect(result.redirect).toBeUndefined();
		});

		it('should use first redirect when multiple hooks redirect', async () => {
			lifecycle.registerBeforeNavigate(() => '/first');
			lifecycle.registerBeforeNavigate(() => '/second');

			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(false);
			expect(result.redirect).toBe('/first');
		});

		it('should treat hook throwing as abort and report to error channel', async () => {
			const reports: ErrorReport[] = [];
			onErrorReport((report) => reports.push(report));

			lifecycle.registerBeforeNavigate(() => {
				throw new Error('Hook error');
			});

			const result = await lifecycle.runBeforeNavigate(mockContext);

			// Hook throw should be treated as abort
			expect(result.proceed).toBe(false);

			// Error should be reported to channel
			expect(reports).toHaveLength(1);
			expect(reports[0].source).toBe('navigation-lifecycle');
			expect(reports[0].error.message).toBe('Hook error');
			expect(reports[0].severity).toBe('warning');
			expect(reports[0].context).toEqual({ hook: 'beforeNavigate' });
		});

		it('should handle async hooks', async () => {
			lifecycle.registerBeforeNavigate(async () => {
				await new Promise((r) => setTimeout(r, 1));
				return true;
			});
			lifecycle.registerBeforeNavigate(async () => {
				await new Promise((r) => setTimeout(r, 1));
				return '/redirect';
			});

			const result = await lifecycle.runBeforeNavigate(mockContext);

			expect(result.proceed).toBe(false);
			expect(result.redirect).toBe('/redirect');
		});
	});

	describe('runOnNavigate', () => {
		it('should run hooks sequentially', async () => {
			const order: number[] = [];

			lifecycle.registerOnNavigate(async () => {
				await new Promise((r) => setTimeout(r, 10));
				order.push(1);
			});
			lifecycle.registerOnNavigate(async () => {
				order.push(2);
			});

			await lifecycle.runOnNavigate(mockContext);

			// Sequential: first hook completes before second starts
			expect(order).toEqual([1, 2]);
		});

		it('should pass context to hooks', async () => {
			const hook = vi.fn();
			lifecycle.registerOnNavigate(hook);

			await lifecycle.runOnNavigate(mockContext);

			expect(hook).toHaveBeenCalledWith(mockContext);
		});

		it('should continue running hooks even if one throws and report to error channel', async () => {
			const reports: ErrorReport[] = [];
			onErrorReport((report) => reports.push(report));

			const hook1 = vi.fn(() => {
				throw new Error('Hook error');
			});
			const hook2 = vi.fn();

			lifecycle.registerOnNavigate(hook1);
			lifecycle.registerOnNavigate(hook2);

			await lifecycle.runOnNavigate(mockContext);

			// Both hooks should be called even when first one throws
			expect(hook1).toHaveBeenCalled();
			expect(hook2).toHaveBeenCalled();

			// Error should be reported to channel
			expect(reports).toHaveLength(1);
			expect(reports[0].source).toBe('navigation-lifecycle');
			expect(reports[0].context).toEqual({ hook: 'onNavigate' });
		});
	});

	describe('runAfterNavigate', () => {
		it('should run all hooks', () => {
			const hook1 = vi.fn();
			const hook2 = vi.fn();

			lifecycle.registerAfterNavigate(hook1);
			lifecycle.registerAfterNavigate(hook2);

			lifecycle.runAfterNavigate(mockContext);

			expect(hook1).toHaveBeenCalledWith(mockContext);
			expect(hook2).toHaveBeenCalledWith(mockContext);
		});

		it('should not throw when a hook throws and report to error channel', () => {
			const reports: ErrorReport[] = [];
			onErrorReport((report) => reports.push(report));

			const hook1 = vi.fn(() => {
				throw new Error('Hook error');
			});
			const hook2 = vi.fn();

			lifecycle.registerAfterNavigate(hook1);
			lifecycle.registerAfterNavigate(hook2);

			// Should not throw
			expect(() => lifecycle.runAfterNavigate(mockContext)).not.toThrow();

			// Both hooks should be called even when first one throws
			expect(hook1).toHaveBeenCalled();
			expect(hook2).toHaveBeenCalled();

			// Error should be reported to channel
			expect(reports).toHaveLength(1);
			expect(reports[0].source).toBe('navigation-lifecycle');
			expect(reports[0].context).toEqual({ hook: 'afterNavigate' });
		});

		it('should be fire-and-forget (synchronous)', () => {
			// runAfterNavigate returns void, not Promise
			const result = lifecycle.runAfterNavigate(mockContext);
			expect(result).toBeUndefined();
		});
	});
});
