/**
 * Test Utility: renderWithRouter
 *
 * Provides a wrapper for rendering Svelte components with router state initialized.
 * Use this when testing components that depend on router state (params, query, pathname).
 *
 * Usage:
 * ```typescript
 * import { renderWithRouter } from '@upstat/warpkit/testing';
 *
 * const { screen } = renderWithRouter(MyComponent, {
 *   props: { uuid: '123' },
 *   route: '/monitors/:uuid',
 *   path: '/monitors/abc-123'
 * });
 * ```
 */

import { render, type RenderResult } from 'vitest-browser-svelte';
import type { Component, ComponentProps } from 'svelte';
import { get } from 'svelte/store';
import {
	routerState,
	isNavigating,
	params,
	query,
	pathname,
	hash,
	currentRoute,
	loaderData,
	routeMeta
} from '../src/router/state';
import type { Route, RouterState } from '../src/types';

export interface RouterTestOptions {
	/** The route pattern (e.g., '/monitors/:uuid') */
	route?: string;

	/** The actual path being navigated to (e.g., '/monitors/abc-123') */
	path?: string;

	/** Route params extracted from path */
	params?: Record<string, string>;

	/** Query string parameters */
	query?: URLSearchParams | Record<string, string>;

	/** URL hash */
	hash?: string;

	/** Loader data for the route */
	loaderData?: unknown;

	/** Route meta */
	meta?: Route['meta'];

	/** Full route definition (overrides other route options) */
	fullRoute?: Route;
}

export interface RenderWithRouterOptions<T extends Component<any>> {
	/** Component props */
	props?: ComponentProps<T>;

	/** Router state options */
	router?: RouterTestOptions;
}

/**
 * Reset all router stores to initial state
 */
export function resetRouterState(): void {
	// Reset core router state
	routerState.set({
		path: '/',
		params: {},
		query: new URLSearchParams(),
		hash: ''
	});

	// Reset the resolved route
	currentRoute.set(null);

	// Reset navigation flag
	isNavigating.set(false);
}

/**
 * Set router state for testing
 */
export function setRouterState(options: RouterTestOptions): void {
	const routeMatch: Route | null =
		options.fullRoute ??
		(options.route
			? {
					path: options.route,
					component: () => Promise.resolve({ default: {} as any }),
					meta: options.meta
				}
			: null);

	const queryParams =
		options.query instanceof URLSearchParams
			? options.query
			: options.query
				? new URLSearchParams(Object.entries(options.query))
				: new URLSearchParams();

	// Set core router state (matches RouterState interface)
	routerState.set({
		path: options.path ?? '/',
		params: options.params ?? {},
		query: queryParams,
		hash: options.hash ?? ''
	});

	// Set resolved route if we have one
	if (routeMatch) {
		currentRoute.set({
			Component: {} as any, // Placeholder for testing
			Layout: null,
			loaderData: options.loaderData,
			route: routeMatch,
			params: options.params ?? {}
		});
	} else {
		currentRoute.set(null);
	}
}

/**
 * Render a component with router state initialized
 *
 * @param Component - Svelte component to render
 * @param options - Render and router options
 * @returns Render result from vitest-browser-svelte
 */
export function renderWithRouter<T extends Component<any>>(
	Component: T,
	options: RenderWithRouterOptions<T> = {}
): RenderResult<T> {
	// Reset and set router state
	resetRouterState();

	if (options.router) {
		setRouterState(options.router);
	}

	// Render the component
	// @ts-expect-error - vitest-browser-svelte render types are overly restrictive
	return render(Component, options.props ? { props: options.props } : undefined);
}

/**
 * Wait for router navigation to complete.
 *
 * Uses polling to check the isNavigating store rather than arbitrary timeout.
 * This makes tests more reliable and faster when navigation completes quickly.
 *
 * @param options - Wait options (timeout, interval)
 */
export async function waitForNavigation(
	options: { timeout?: number; interval?: number } = {}
): Promise<void> {
	const { timeout = 5000, interval = 10 } = options;
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const navigating = get(isNavigating);
		if (!navigating) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, interval));
	}

	// If we're here, we timed out
	throw new Error(`waitForNavigation timed out after ${timeout}ms. Navigation still in progress.`);
}

export { routerState, params, query, pathname, hash, currentRoute, loaderData, routeMeta };
