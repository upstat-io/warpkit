/**
 * Browser Tests: Testing Utilities
 *
 * Tests for createMockWarpKit, waitForNavigation, and expectations.
 * These require browser environment because WarpKit uses $state runes.
 */
import { expect, test, describe } from 'vitest';
import {
	createMockWarpKit,
	waitForNavigation,
	waitForNavigationWithTimeout,
	expectNavigation,
	expectState,
	expectSearchParam,
	expectParams,
	expectIsNavigating,
	expectHasError,
	expectHistoryLength,
	MockConfirmProvider,
	NoOpStorageProvider
} from '../src/testing';
import { MemoryBrowserProvider } from '../src/providers/browser/MemoryBrowserProvider';
import type { StateRoutes } from '../src/core/types';

// Simple test routes
type TestState = 'authenticated' | 'unauthenticated';

const createTestRoutes = (): StateRoutes<TestState> => ({
	authenticated: {
		routes: [
			{
				path: '/dashboard',
				component: async () => ({ default: {} as any }),
				meta: { title: 'Dashboard' }
			},
			{
				path: '/settings',
				component: async () => ({ default: {} as any }),
				meta: { title: 'Settings' }
			},
			{
				path: '/users/[id]',
				component: async () => ({ default: {} as any }),
				meta: { title: 'User' }
			}
		],
		default: '/dashboard'
	},
	unauthenticated: {
		routes: [
			{
				path: '/login',
				component: async () => ({ default: {} as any }),
				meta: { title: 'Login' }
			}
		],
		default: '/login'
	}
});

describe('createMockWarpKit', () => {
	describe('creation', () => {
		test('should create a WarpKit instance', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			expect(warpkit).toBeDefined();
			expect(warpkit.page).toBeDefined();
		});

		test('should have error when initial path has no matching route', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
				// Default initialPath is '/' which has no route
			});

			// '/' has no matching route, so there's an error
			expect(warpkit.page.error).not.toBeNull();
		});

		test('should start at custom initial path', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings'
			});

			expect(warpkit.page.pathname).toBe('/settings');
		});

		test('should use initial state', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'unauthenticated'
			});

			expect(warpkit.getState()).toBe('unauthenticated');
		});
	});

	describe('mock providers', () => {
		test('should expose memoryBrowser', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			expect(warpkit.memoryBrowser).toBeInstanceOf(MemoryBrowserProvider);
		});

		test('should expose mockConfirm', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			expect(warpkit.mockConfirm).toBeInstanceOf(MockConfirmProvider);
		});

		test('should expose noOpStorage', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			expect(warpkit.noOpStorage).toBeInstanceOf(NoOpStorageProvider);
		});
	});

	describe('navigation', () => {
		test('should navigate between routes', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			await warpkit.navigate('/settings');

			expect(warpkit.page.pathname).toBe('/settings');
		});

		test('should track navigation in history', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const initialLength = warpkit.getHistory().length;

			await warpkit.navigate('/settings');

			expect(warpkit.getHistory().length).toBe(initialLength + 1);
		});
	});

	describe('helper methods', () => {
		test('should provide setConfirmResult shortcut', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			warpkit.setConfirmResult(false);

			const result = await warpkit.mockConfirm.confirm('Test?');
			expect(result).toBe(false);
		});
	});
});

describe('waitForNavigation', () => {
	test('should resolve after navigation completes', async () => {
		const warpkit = await createMockWarpKit({
			routes: createTestRoutes(),
			initialState: 'authenticated',
			initialPath: '/dashboard'
		});

		const navigationPromise = waitForNavigation(warpkit);
		warpkit.navigate('/settings');
		const context = await navigationPromise;

		expect(context.to.pathname).toBe('/settings');
	});

	test('should return NavigationContext with correct from location', async () => {
		const warpkit = await createMockWarpKit({
			routes: createTestRoutes(),
			initialState: 'authenticated',
			initialPath: '/dashboard'
		});

		const navigationPromise = waitForNavigation(warpkit);
		warpkit.navigate('/settings');
		const context = await navigationPromise;

		expect(context.from?.pathname).toBe('/dashboard');
	});

	test('should work with parameterized routes', async () => {
		const warpkit = await createMockWarpKit({
			routes: createTestRoutes(),
			initialState: 'authenticated',
			initialPath: '/dashboard'
		});

		const navigationPromise = waitForNavigation(warpkit);
		warpkit.navigate('/users/123');
		const context = await navigationPromise;

		expect(context.to.pathname).toBe('/users/123');
		expect(context.to.params.id).toBe('123');
	});
});

describe('waitForNavigationWithTimeout', () => {
	test('should resolve before timeout', async () => {
		const warpkit = await createMockWarpKit({
			routes: createTestRoutes(),
			initialState: 'authenticated',
			initialPath: '/dashboard'
		});

		const navigationPromise = waitForNavigationWithTimeout(warpkit, 5000);
		warpkit.navigate('/settings');
		const context = await navigationPromise;

		expect(context.to.pathname).toBe('/settings');
	});

	test('should reject on timeout', async () => {
		const warpkit = await createMockWarpKit({
			routes: createTestRoutes(),
			initialState: 'authenticated',
			initialPath: '/dashboard'
		});

		// Wait without triggering navigation
		const promise = waitForNavigationWithTimeout(warpkit, 50);

		await expect(promise).rejects.toThrow('Navigation did not complete within 50ms');
	});
});

describe('expectations', () => {
	describe('expectNavigation', () => {
		test('should pass when path matches', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			expect(() => expectNavigation(warpkit, '/dashboard')).not.toThrow();
		});

		test('should throw when path does not match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			expect(() => expectNavigation(warpkit, '/settings')).toThrow();
		});
	});

	describe('expectState', () => {
		test('should pass when state matches', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			expect(() => expectState(warpkit, 'authenticated')).not.toThrow();
		});

		test('should throw when state does not match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(() => expectState(warpkit, 'unauthenticated' as any)).toThrow();
		});
	});

	describe('expectSearchParam', () => {
		test('should pass when param matches', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard?tab=settings'
			});

			expect(() => expectSearchParam(warpkit, 'tab', 'settings')).not.toThrow();
		});

		test('should pass when param is absent and expected null', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			expect(() => expectSearchParam(warpkit, 'nonexistent', null)).not.toThrow();
		});
	});

	describe('expectParams', () => {
		test('should pass when params match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/users/123'
			});

			expect(() => expectParams(warpkit, { id: '123' })).not.toThrow();
		});
	});

	describe('expectIsNavigating', () => {
		test('should pass when isNavigating matches false', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			expect(() => expectIsNavigating(warpkit, false)).not.toThrow();
		});
	});

	describe('expectHasError', () => {
		test('should pass when no error and expected false', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			expect(() => expectHasError(warpkit, false)).not.toThrow();
		});

		test('should pass when has error and expected true', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			// Navigate to non-existent path to trigger error
			await warpkit.navigate('/nonexistent');

			expect(() => expectHasError(warpkit, true)).not.toThrow();
		});
	});

	describe('expectHistoryLength', () => {
		test('should pass when history length matches', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const initialLength = warpkit.getHistory().length;
			expect(() => expectHistoryLength(warpkit, initialLength)).not.toThrow();
		});

		test('should track navigation in history length', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const initialLength = warpkit.getHistory().length;
			await warpkit.navigate('/users/123');

			expect(() => expectHistoryLength(warpkit, initialLength + 1)).not.toThrow();
		});
	});
});
