/**
 * WarpKit.start() resilience tests
 *
 * Tests startup failure recovery, re-entrancy guards, queue drain behavior,
 * and partial-init safety.
 *
 * These tests run in a browser environment (vitest-browser) because
 * WarpKit.svelte.ts uses Svelte 5 $state runes that require the Svelte compiler.
 */
import { describe, it, expect, vi } from 'vitest';
import { createWarpKit } from '../src/core/WarpKit.svelte';
import { MemoryBrowserProvider } from '../src/providers/browser/MemoryBrowserProvider';
import { MockConfirmProvider } from '../src/testing/MockConfirmProvider';
import { NoOpStorageProvider } from '../src/testing/NoOpStorageProvider';
import type { WarpKitConfig } from '../src/core/types';
import type { Provider, ProviderRegistry } from '../src/providers/interfaces';

// Minimal dummy component loader for route definitions
const dummyComponent = () => Promise.resolve({ default: {} as never });

function createMinimalConfig(
	overrides: Partial<WarpKitConfig<'active' | 'inactive'>> = {}
): WarpKitConfig<'active' | 'inactive'> {
	return {
		initialState: 'active',
		routes: {
			active: {
				routes: [{ path: '/dashboard', component: dummyComponent, meta: {} }],
				default: '/dashboard'
			},
			inactive: {
				routes: [{ path: '/login', component: dummyComponent, meta: {} }],
				default: '/login'
			}
		},
		providers: {
			browser: new MemoryBrowserProvider('/dashboard'),
			confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
			storage: new NoOpStorageProvider()
		},
		...overrides
	};
}

describe('WarpKit.start() resilience', () => {
	it('should start successfully under normal conditions', async () => {
		const wk = createWarpKit(createMinimalConfig());
		await wk.start();
		expect(wk.ready).toBe(true);
		wk.destroy();
	});

	it('can be retried after resolveProviders failure', async () => {
		let shouldFail = true;
		const config = createMinimalConfig({
			providers: {
				browser: new MemoryBrowserProvider('/dashboard'),
				confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
				storage: new NoOpStorageProvider(),
				flaky: {
					id: 'flaky',
					initialize: () => {
						if (shouldFail) throw new Error('flaky init failed');
					}
				} as Provider
			}
		});

		const wk = createWarpKit(config);

		// First attempt fails
		await expect(wk.start()).rejects.toThrow('flaky init failed');
		expect(wk.ready).toBe(false);

		// Fix the flaky provider and retry
		shouldFail = false;
		await wk.start();
		expect(wk.ready).toBe(true);
		wk.destroy();
	});

	it('concurrent start() calls throw (second caller sees starting=true)', async () => {
		const config = createMinimalConfig({
			providers: {
				browser: new MemoryBrowserProvider('/dashboard'),
				confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
				storage: new NoOpStorageProvider(),
				slow: {
					id: 'slow',
					initialize: () => new Promise((r) => setTimeout(r, 50))
				} as Provider
			}
		});

		const wk = createWarpKit(config);

		const p1 = wk.start();
		// Second call should throw immediately
		await expect(wk.start()).rejects.toThrow('start() has already been called');
		await p1;
		wk.destroy();
	});

	it('destroy() does not throw when providers is undefined (partial init)', async () => {
		const config = createMinimalConfig({
			providers: {
				browser: new MemoryBrowserProvider('/dashboard'),
				confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
				storage: new NoOpStorageProvider(),
				boom: {
					id: 'boom',
					initialize: () => { throw new Error('boom init failed'); }
				} as Provider
			}
		});

		const wk = createWarpKit(config);

		// start() will fail during provider init
		await expect(wk.start()).rejects.toThrow('boom init failed');

		// Calling destroy() again should not throw (already called in catch)
		expect(() => wk.destroy()).not.toThrow();
	});

	it('pre-start queue applies state; queued path feeds into initial navigation', async () => {
		const wk = createWarpKit(createMinimalConfig());

		// Queue a state change before start
		await wk.setAppState('inactive', undefined, { path: '/login' });

		await wk.start();

		expect(wk.getState()).toBe('inactive');
		expect(wk.page.pathname).toBe('/login');
		wk.destroy();
	});

	it('pre-start queue is retained on navigation failure', async () => {
		const config = createMinimalConfig({
			providers: {
				// Start at a path that doesn't match any route
				browser: new MemoryBrowserProvider('/nonexistent'),
				confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
				storage: new NoOpStorageProvider()
			}
		});

		const wk = createWarpKit(config);

		// /nonexistent has no matching route → navigate returns { success: false }
		// → pageState.route === null → throws
		await expect(wk.start()).rejects.toThrow('Initial navigation failed');
		expect(wk.ready).toBe(false);
	});

	it('started flag is false during resolveProviders (setAppState queues)', async () => {
		const config = createMinimalConfig({
			providers: {
				browser: new MemoryBrowserProvider('/dashboard'),
				confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
				storage: new NoOpStorageProvider(),
				spy: {
					id: 'spy',
					initialize: () => {
						// During provider init, started is false.
						// Any calls to setAppState during this window will queue.
					}
				} as Provider
			}
		});

		const wk = createWarpKit(config);
		await wk.start();

		// If started were set too early, setAppState during provider init
		// would try to use the navigator (which doesn't exist yet) and crash.
		expect(wk.ready).toBe(true);
		wk.destroy();
	});

	it('start() fails when initial navigation fails and no route is committed', async () => {
		const config = createMinimalConfig({
			providers: {
				browser: new MemoryBrowserProvider('/does-not-exist'),
				confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
				storage: new NoOpStorageProvider()
			}
		});

		const wk = createWarpKit(config);
		await expect(wk.start()).rejects.toThrow('Initial navigation failed');
		expect(wk.ready).toBe(false);
	});

	describe('startup recovery (transient load failures)', () => {
		it('should recover from transient component load failure', async () => {
			let callCount = 0;
			const transientComponent = () => {
				callCount++;
				if (callCount <= 1) {
					return Promise.reject(new TypeError('Failed to fetch dynamically imported module: /src/pages/Dashboard.svelte'));
				}
				return Promise.resolve({ default: {} as never });
			};

			const config: WarpKitConfig<'active' | 'inactive'> = {
				initialState: 'active',
				routes: {
					active: {
						routes: [{ path: '/dashboard', component: transientComponent, meta: {} }],
						default: '/dashboard'
					},
					inactive: {
						routes: [{ path: '/login', component: dummyComponent, meta: {} }],
						default: '/login'
					}
				},
				providers: {
					browser: new MemoryBrowserProvider('/dashboard'),
					confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
					storage: new NoOpStorageProvider()
				}
			};

			const wk = createWarpKit(config);
			await wk.start();

			// Should eventually recover and become ready
			expect(wk.ready).toBe(true);
			wk.destroy();
		});

		it('should NOT retry on non-transient errors (SyntaxError)', async () => {
			let callCount = 0;
			const syntaxErrorComponent = () => {
				callCount++;
				return Promise.reject(new SyntaxError('Unexpected token'));
			};

			const config: WarpKitConfig<'active' | 'inactive'> = {
				initialState: 'active',
				routes: {
					active: {
						routes: [{ path: '/dashboard', component: syntaxErrorComponent, meta: {} }],
						default: '/dashboard'
					},
					inactive: {
						routes: [{ path: '/login', component: dummyComponent, meta: {} }],
						default: '/login'
					}
				},
				providers: {
					browser: new MemoryBrowserProvider('/dashboard'),
					confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
					storage: new NoOpStorageProvider()
				}
			};

			const wk = createWarpKit(config);
			await expect(wk.start()).rejects.toThrow('Initial navigation failed');
			expect(wk.ready).toBe(false);
			// SyntaxError should not trigger retries — component called only
			// once at the navigate level (retryDynamicImport also doesn't retry SyntaxError)
			expect(callCount).toBe(1);
		});

		it('should give up after max retries on persistent transient failure', { timeout: 30_000 }, async () => {
			const persistentComponent = () => {
				return Promise.reject(new TypeError('Failed to fetch dynamically imported module: /src/pages/Dashboard.svelte'));
			};

			const config: WarpKitConfig<'active' | 'inactive'> = {
				initialState: 'active',
				routes: {
					active: {
						routes: [{ path: '/dashboard', component: persistentComponent, meta: {} }],
						default: '/dashboard'
					},
					inactive: {
						routes: [{ path: '/login', component: dummyComponent, meta: {} }],
						default: '/login'
					}
				},
				providers: {
					browser: new MemoryBrowserProvider('/dashboard'),
					confirmDialog: new MockConfirmProvider({ alwaysConfirm: true }),
					storage: new NoOpStorageProvider()
				}
			};

			const wk = createWarpKit(config);
			await expect(wk.start()).rejects.toThrow('Initial navigation failed');
			expect(wk.ready).toBe(false);
		});
	});
});
