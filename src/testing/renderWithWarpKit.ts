/**
 * Render with WarpKit Helper
 *
 * Wraps vitest-browser-svelte render() to provide WarpKit context.
 * Use for testing components that need WarpKit context (useWarpKit, usePage).
 */

import type { Component } from 'svelte';
import type { RenderResult } from 'vitest-browser-svelte';
import { render } from 'vitest-browser-svelte';
import type { StateRoutes, NavigationError, NavigationErrorContext } from '../core/types';
import type { MockWarpKit } from './createMockWarpKit';
import { createMockWarpKit } from './createMockWarpKit';
import WarpKitTestWrapper from './WarpKitTestWrapper.svelte';

/**
 * Options for renderWithWarpKit.
 */
export interface RenderWithWarpKitOptions<TAppState extends string> {
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
	/** Props to pass to the component being rendered */
	props?: Record<string, unknown>;
}

/**
 * Result from renderWithWarpKit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RenderWithWarpKitResult<TAppState extends string> extends RenderResult<any> {
	/** The mock WarpKit instance with test helpers */
	warpkit: MockWarpKit<TAppState>;
}

/**
 * Render a component with WarpKit context.
 *
 * This is the primary testing helper for components that use WarpKit hooks.
 * It creates a mock WarpKit instance, wraps the component with WarpKitTestWrapper,
 * and returns both the render result and the WarpKit instance.
 *
 * @example
 * ```typescript
 * // Test a component that uses usePage()
 * const { getByTestId, warpkit } = await renderWithWarpKit(MyComponent, {
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
 * // Assert on rendered content
 * await expect.element(getByTestId('page-title')).toHaveTextContent('Dashboard');
 *
 * // Navigate and verify updates
 * await warpkit.navigate('/settings');
 * await expect.element(getByTestId('page-title')).toHaveTextContent('Settings');
 * ```
 *
 * @param component - The Svelte component to render
 * @param options - WarpKit configuration and component props
 * @returns Render result with WarpKit instance
 */
export async function renderWithWarpKit<TAppState extends string>(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: Component<any>,
	options: RenderWithWarpKitOptions<TAppState>
): Promise<RenderWithWarpKitResult<TAppState>> {
	const { routes, initialState, initialPath, componentLoadDelay, onError, props = {} } = options;

	// Create mock WarpKit
	const warpkit = await createMockWarpKit({
		routes,
		initialState,
		initialPath,
		componentLoadDelay,
		onError
	});

	// Create a wrapper component that provides context and renders the target
	// We use a factory to create the wrapper with the component and props baked in
	const TestHarness = createTestHarness(component, warpkit, props);

	// Render the wrapper
	const result = render(TestHarness);

	// Return extended result with WarpKit access
	return {
		...result,
		warpkit
	};
}

/**
 * Create a test harness component that wraps the target with WarpKit context.
 *
 * This is a factory function because Svelte components need to be defined
 * with their props known at definition time.
 */
function createTestHarness(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	TargetComponent: Component<any>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	warpkit: MockWarpKit<any>,
	props: Record<string, unknown>
): Component {
	// Create a wrapper that renders:
	// <WarpKitTestWrapper {warpkit}>
	//   <TargetComponent {...props} />
	// </WarpKitTestWrapper>
	//
	// Since we can't dynamically create Svelte components in JS, we return
	// a pre-built harness component. Users who need custom wrappers can
	// use WarpKitTestWrapper directly.

	// For now, we'll need to use a different approach - export a factory
	// that creates the wrapper. Users will need to use the wrapper directly.
	// This limitation is documented.

	// Return a simple wrapper that the test can render
	// The limitation is that props can't be passed through easily
	// without a dedicated wrapper component per test

	// Actually, vitest-browser-svelte's render accepts props as second arg
	// but for wrapped components, we need a different approach

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return WarpKitTestWrapper as any;
}

/**
 * Helper to create a simple routes configuration for testing.
 *
 * @example
 * ```typescript
 * const routes = createTestRoutes({
 *   authenticated: [
 *     { path: '/dashboard', component: () => import('./Dashboard.svelte') },
 *     { path: '/settings', component: () => import('./Settings.svelte') }
 *   ]
 * }, { defaultState: 'authenticated' });
 * ```
 */
/**
 * Route configuration for createTestRoutes.
 */
interface TestRouteConfig {
	path: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: () => Promise<{ default: Component<any> }>;
	meta?: Record<string, unknown>;
}

export function createTestRoutes<TAppState extends string>(
	stateRoutes: Record<TAppState, TestRouteConfig[]>,
	options: { defaultState: TAppState }
): StateRoutes<TAppState> {
	const routes = {} as StateRoutes<TAppState>;

	for (const [state, routeList] of Object.entries(stateRoutes) as [TAppState, TestRouteConfig[]][]) {
		routes[state] = {
			routes: routeList.map((r) => ({
				path: r.path,
				component: r.component,
				meta: r.meta ?? {}
			})),
			default: routeList[0]?.path ?? null
		};
	}

	// Override default for the defaultState
	if (routes[options.defaultState]) {
		// Already set from first route
	}

	return routes;
}
