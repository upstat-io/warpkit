/**
 * WarpKit v2 Provider Interfaces Tests
 *
 * These tests verify provider interface definitions compile correctly.
 * Since interfaces have no runtime behavior, tests focus on type inference.
 */
import { describe, it, expect, mock } from 'bun:test';
import type {
	Provider,
	WarpKitCore,
	BrowserProvider,
	BrowserProviderConfig,
	BrowserLocation,
	HistoryState,
	PopStateCallback,
	ConfirmDialogProvider,
	StorageProvider,
	StorageProviderConfig,
	ScrollPosition,
	ProviderRegistry,
	ResolvedProviders
} from '../interfaces';

describe('WarpKit v2 Provider Interfaces', () => {
	describe('Provider base interface', () => {
		it('should require id field', () => {
			const provider: Provider = {
				id: 'custom'
			};
			expect(provider.id).toBe('custom');
		});

		it('should allow optional dependsOn', () => {
			const provider: Provider = {
				id: 'analytics',
				dependsOn: ['auth', 'browser']
			};
			expect(provider.dependsOn).toEqual(['auth', 'browser']);
		});

		it('should allow optional initialize', () => {
			const initFn = mock(() => {});
			const provider: Provider = {
				id: 'test',
				initialize: initFn
			};
			expect(provider.initialize).toBe(initFn);
		});

		it('should allow optional destroy', () => {
			const destroyFn = mock(() => {});
			const provider: Provider = {
				id: 'test',
				destroy: destroyFn
			};
			expect(provider.destroy).toBe(destroyFn);
		});
	});

	describe('BrowserProvider interface', () => {
		it('should have fixed id of browser', () => {
			const mockBrowserProvider: BrowserProvider = {
				id: 'browser',
				getLocation: () => ({ pathname: '/', search: '', hash: '' }),
				buildUrl: (path) => path,
				parseUrl: (url) => url,
				push: mock(() => {}),
				replace: mock(() => {}),
				go: mock(() => {}),
				getHistoryState: () => null,
				onPopState: () => () => {}
			};
			expect(mockBrowserProvider.id).toBe('browser');
		});

		it('should return BrowserLocation from getLocation', () => {
			const location: BrowserLocation = {
				pathname: '/test',
				search: '?q=1',
				hash: '#section'
			};
			expect(location.pathname).toBe('/test');
			expect(location.search).toBe('?q=1');
			expect(location.hash).toBe('#section');
		});
	});

	describe('HistoryState interface', () => {
		it('should have warpkit marker', () => {
			const state: HistoryState = {
				__warpkit: true,
				id: 1,
				position: 0,
				appState: 'authenticated'
			};
			expect(state.__warpkit).toBe(true);
		});

		it('should track navigation id and position', () => {
			const state: HistoryState = {
				__warpkit: true,
				id: 5,
				position: 3,
				appState: 'authenticated',
				data: { returnUrl: '/settings' }
			};
			expect(state.id).toBe(5);
			expect(state.position).toBe(3);
			expect(state.data?.returnUrl).toBe('/settings');
		});
	});

	describe('ConfirmDialogProvider interface', () => {
		it('should have fixed id of confirmDialog', () => {
			const mockConfirmProvider: ConfirmDialogProvider = {
				id: 'confirmDialog',
				confirm: async () => true
			};
			expect(mockConfirmProvider.id).toBe('confirmDialog');
		});

		it('should return Promise<boolean> from confirm', async () => {
			const mockConfirmProvider: ConfirmDialogProvider = {
				id: 'confirmDialog',
				confirm: async (message) => {
					expect(message).toBe('Leave page?');
					return true;
				}
			};
			const result = await mockConfirmProvider.confirm('Leave page?');
			expect(result).toBe(true);
		});
	});

	describe('StorageProvider interface', () => {
		it('should have fixed id of storage', () => {
			const mockStorageProvider: StorageProvider = {
				id: 'storage',
				saveScrollPosition: mock(() => {}),
				getScrollPosition: () => null,
				saveIntendedPath: mock(() => {}),
				popIntendedPath: () => null
			};
			expect(mockStorageProvider.id).toBe('storage');
		});

		it('should handle scroll positions', () => {
			const positions = new Map<number, ScrollPosition>();
			const mockStorageProvider: StorageProvider = {
				id: 'storage',
				saveScrollPosition: (id, pos) => positions.set(id, pos),
				getScrollPosition: (id) => positions.get(id) ?? null,
				saveIntendedPath: mock(() => {}),
				popIntendedPath: () => null
			};

			mockStorageProvider.saveScrollPosition(1, { x: 0, y: 100 });
			expect(mockStorageProvider.getScrollPosition(1)).toEqual({ x: 0, y: 100 });
			expect(mockStorageProvider.getScrollPosition(999)).toBeNull();
		});

		it('should handle intended path', () => {
			let storedPath: string | null = null;
			const mockStorageProvider: StorageProvider = {
				id: 'storage',
				saveScrollPosition: mock(() => {}),
				getScrollPosition: () => null,
				saveIntendedPath: (path) => {
					storedPath = path;
				},
				popIntendedPath: () => {
					const path = storedPath;
					storedPath = null;
					return path;
				}
			};

			mockStorageProvider.saveIntendedPath('/dashboard');
			expect(mockStorageProvider.popIntendedPath()).toBe('/dashboard');
			expect(mockStorageProvider.popIntendedPath()).toBeNull();
		});
	});

	describe('ProviderRegistry interface', () => {
		it('should allow partial registry', () => {
			const browser: BrowserProvider = {
				id: 'browser',
				getLocation: () => ({ pathname: '/', search: '', hash: '' }),
				buildUrl: (path) => path,
				parseUrl: (url) => url,
				push: mock(() => {}) as BrowserProvider['push'],
				replace: mock(() => {}) as BrowserProvider['replace'],
				go: mock(() => {}) as BrowserProvider['go'],
				getHistoryState: () => null,
				onPopState: () => () => {}
			};
			const registry: ProviderRegistry = { browser };
			expect(registry.browser).toBeDefined();
			expect(registry.confirmDialog).toBeUndefined();
		});

		it('should allow custom providers', () => {
			const registry: ProviderRegistry = {
				customAuth: {
					id: 'customAuth',
					initialize: mock(() => {})
				}
			};
			expect(registry.customAuth?.id).toBe('customAuth');
		});
	});

	describe('ResolvedProviders interface', () => {
		it('should require all core providers', () => {
			const browser: BrowserProvider = {
				id: 'browser',
				getLocation: () => ({ pathname: '/', search: '', hash: '' }),
				buildUrl: (path) => path,
				parseUrl: (url) => url,
				push: mock(() => {}) as BrowserProvider['push'],
				replace: mock(() => {}) as BrowserProvider['replace'],
				go: mock(() => {}) as BrowserProvider['go'],
				getHistoryState: () => null,
				onPopState: () => () => {}
			};
			const confirmDialog: ConfirmDialogProvider = {
				id: 'confirmDialog',
				confirm: async () => true
			};
			const storage: StorageProvider = {
				id: 'storage',
				saveScrollPosition: mock(() => {}) as StorageProvider['saveScrollPosition'],
				getScrollPosition: () => null,
				saveIntendedPath: mock(() => {}) as StorageProvider['saveIntendedPath'],
				popIntendedPath: () => null
			};
			const resolved: ResolvedProviders = { browser, confirmDialog, storage };
			expect(resolved.browser.id).toBe('browser');
			expect(resolved.confirmDialog.id).toBe('confirmDialog');
			expect(resolved.storage.id).toBe('storage');
		});
	});

	describe('ScrollPosition interface', () => {
		it('should have x and y coordinates', () => {
			const pos: ScrollPosition = { x: 100, y: 500 };
			expect(pos.x).toBe(100);
			expect(pos.y).toBe(500);
		});
	});

	describe('PopStateCallback type', () => {
		it('should receive state and direction', () => {
			const callback: PopStateCallback = (state, direction) => {
				expect(state).toBeNull();
				expect(direction).toBe('back');
			};
			callback(null, 'back');
		});

		it('should receive HistoryState when available', () => {
			const callback: PopStateCallback = (state, direction) => {
				expect(state?.__warpkit).toBe(true);
				expect(state?.id).toBe(1);
				expect(direction).toBe('forward');
			};
			callback({ __warpkit: true, id: 1, position: 0, appState: 'test' }, 'forward');
		});
	});

	describe('Config interfaces', () => {
		it('should allow BrowserProviderConfig with basePath', () => {
			const config: BrowserProviderConfig = {
				basePath: '/app'
			};
			expect(config.basePath).toBe('/app');
		});

		it('should allow StorageProviderConfig with maxScrollPositions', () => {
			const config: StorageProviderConfig = {
				maxScrollPositions: 100
			};
			expect(config.maxScrollPositions).toBe(100);
		});
	});
});
