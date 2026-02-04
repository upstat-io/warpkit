/**
 * Mock WarpKit Factory for Testing
 *
 * Creates a fully configured WarpKit instance with mock providers for testing.
 * Uses MemoryBrowserProvider, MockConfirmProvider, and NoOpStorageProvider.
 */

import type { Component } from 'svelte';
import type { StateRoutes, NavigationError, NavigationErrorContext, Route, StateConfig } from '../core/types';
import { WarpKit, createWarpKit } from '../core/WarpKit.svelte';
import { MemoryBrowserProvider } from '../providers/browser/MemoryBrowserProvider';
import { MockConfirmProvider } from './MockConfirmProvider';
import { NoOpStorageProvider } from './NoOpStorageProvider';

/**
 * Options for creating a mock WarpKit instance.
 */
export interface MockWarpKitOptions<TAppState extends string> {
	/** Routes configuration */
	routes: StateRoutes<TAppState>;
	/** Initial application state */
	initialState: TAppState;
	/** Initial URL path (default: '/') */
	initialPath?: string;
	/** Delay (ms) to add to component loading for async testing */
	componentLoadDelay?: number;
	/** Custom error handler */
	onError?: (error: NavigationError, context: NavigationErrorContext) => void;
}

/**
 * Extended WarpKit with test helpers.
 */
export interface MockWarpKit<TAppState extends string> extends WarpKit<TAppState> {
	/** Direct access to MemoryBrowserProvider */
	readonly memoryBrowser: MemoryBrowserProvider;
	/** Direct access to MockConfirmProvider */
	readonly mockConfirm: MockConfirmProvider;
	/** Direct access to NoOpStorageProvider */
	readonly noOpStorage: NoOpStorageProvider;
	/** The configured component load delay */
	readonly componentLoadDelay: number;

	/** Get history stack from memory browser */
	getHistory(): Array<{ path: string; state: unknown }>;
	/** Get current index in history stack */
	getCurrentIndex(): number;
	/** Simulate browser back/forward button */
	simulatePopState(direction: 'back' | 'forward'): void;
	/** Set what next confirm() call returns */
	setConfirmResult(result: boolean): void;
}

/**
 * Create a mock WarpKit instance for testing.
 *
 * Automatically:
 * - Uses MemoryBrowserProvider (in-memory history)
 * - Uses MockConfirmProvider (configurable confirmation)
 * - Uses NoOpStorageProvider (silent storage)
 * - Calls start() to initialize
 *
 * @example
 * ```typescript
 * const warpkit = await createMockWarpKit({
 *   routes: {
 *     authenticated: {
 *       routes: [{ path: '/dashboard', component: () => import('./Dashboard.svelte'), meta: {} }],
 *       default: '/dashboard'
 *     }
 *   },
 *   initialState: 'authenticated',
 *   initialPath: '/dashboard'
 * });
 *
 * // Navigate and assert
 * await warpkit.navigate('/settings');
 * expect(warpkit.page.pathname).toBe('/settings');
 *
 * // Test blocker
 * warpkit.setConfirmResult(false);
 * // Navigation will be blocked when blocker triggers
 * ```
 */
export async function createMockWarpKit<TAppState extends string>(
	options: MockWarpKitOptions<TAppState>
): Promise<MockWarpKit<TAppState>> {
	const { routes, initialState, initialPath = '/', componentLoadDelay = 0, onError } = options;

	// Create mock providers
	const memoryBrowser = new MemoryBrowserProvider(initialPath);
	const mockConfirm = new MockConfirmProvider({ alwaysConfirm: true });
	const noOpStorage = new NoOpStorageProvider();

	// Optionally wrap route component loaders with delay
	const processedRoutes = componentLoadDelay > 0 ? wrapRoutesWithDelay(routes, componentLoadDelay) : routes;

	// Create WarpKit with mock providers
	const warpkit = createWarpKit({
		routes: processedRoutes,
		initialState,
		providers: {
			browser: memoryBrowser,
			confirmDialog: mockConfirm,
			storage: noOpStorage
		},
		onError
	});

	// Start to initialize providers and perform initial navigation
	await warpkit.start();

	// Create extended mock wrapper using Object.create pattern
	// This preserves the WarpKit prototype chain while adding test helpers
	const mock = Object.create(warpkit) as MockWarpKit<TAppState>;

	// Add provider references
	Object.defineProperty(mock, 'memoryBrowser', {
		value: memoryBrowser,
		writable: false,
		enumerable: true
	});
	Object.defineProperty(mock, 'mockConfirm', {
		value: mockConfirm,
		writable: false,
		enumerable: true
	});
	Object.defineProperty(mock, 'noOpStorage', {
		value: noOpStorage,
		writable: false,
		enumerable: true
	});
	Object.defineProperty(mock, 'componentLoadDelay', {
		value: componentLoadDelay,
		writable: false,
		enumerable: true
	});

	// Forward $state fields from the real WarpKit instance
	// These are compiled to private class members by Svelte 5, so we need explicit getters
	Object.defineProperty(mock, 'loadedComponent', {
		get: () => warpkit.loadedComponent,
		set: (v) => {
			warpkit.loadedComponent = v;
		},
		enumerable: true
	});
	Object.defineProperty(mock, 'loadedLayout', {
		get: () => warpkit.loadedLayout,
		set: (v) => {
			warpkit.loadedLayout = v;
		},
		enumerable: true
	});

	// Add shortcut methods
	Object.defineProperty(mock, 'getHistory', {
		value: () => memoryBrowser.getHistory(),
		writable: false,
		enumerable: true
	});
	Object.defineProperty(mock, 'getCurrentIndex', {
		value: () => memoryBrowser.getCurrentIndex(),
		writable: false,
		enumerable: true
	});
	Object.defineProperty(mock, 'simulatePopState', {
		value: (direction: 'back' | 'forward') => memoryBrowser.simulatePopState(direction),
		writable: false,
		enumerable: true
	});
	Object.defineProperty(mock, 'setConfirmResult', {
		value: (result: boolean) => mockConfirm.setNextResult(result),
		writable: false,
		enumerable: true
	});

	return mock;
}

/**
 * Deep clone routes and wrap component loaders with delay.
 * Does not modify the original routes object.
 */
function wrapRoutesWithDelay<TAppState extends string>(
	routes: StateRoutes<TAppState>,
	delay: number
): StateRoutes<TAppState> {
	const result = {} as StateRoutes<TAppState>;

	for (const [state, config] of Object.entries(routes) as [TAppState, StateConfig][]) {
		result[state] = {
			...config,
			routes: config.routes.map((route) => wrapRouteWithDelay(route, delay)),
			// Also wrap layout if present
			layout: config.layout
				? {
						...config.layout,
						load: wrapLoaderWithDelay(config.layout.load, delay)
					}
				: undefined
		};
	}

	return result;
}

/**
 * Wrap a single route's component loader with delay.
 */
function wrapRouteWithDelay(route: Route, delay: number): Route {
	return {
		...route,
		component: wrapLoaderWithDelay(route.component, delay),
		layout: route.layout
			? {
					...route.layout,
					load: wrapLoaderWithDelay(route.layout.load, delay)
				}
			: undefined
	};
}

/**
 * Wrap a component loader with a delay.
 */
function wrapLoaderWithDelay(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	loader: () => Promise<{ default: Component<any> }>,
	delay: number
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): () => Promise<{ default: Component<any> }> {
	return async () => {
		await new Promise((resolve) => setTimeout(resolve, delay));
		return loader();
	};
}
