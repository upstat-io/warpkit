/**
 * PageState
 *
 * Reactive state container for route information using Svelte 5 $state.
 * All properties are reactive and trigger component updates when changed.
 */
import type { Route, RouteMeta, NavigationError, ResolvedLocation } from './types';
import { SvelteURLSearchParams } from './SvelteURLSearchParams.svelte';

/**
 * Reactive page state container using Svelte 5 $state.
 * Components automatically react to changes in these properties.
 */
export class PageState {
	/** Full path including search and hash */
	path = $state('');

	/** Pathname without search or hash */
	pathname = $state('');

	/** Search params wrapper */
	search = $state(new SvelteURLSearchParams());

	/** URL hash (fragment) */
	hash = $state('');

	/** Route parameters extracted from path */
	params = $state<Record<string, string>>({});

	/** Currently matched route or null */
	route = $state<Route | null>(null);

	/** Current application state name */
	appState = $state('');

	/** Route metadata (shorthand for route?.meta) */
	get meta(): RouteMeta | undefined {
		return this.route?.meta;
	}

	/** True while navigation is in progress */
	isNavigating = $state(false);

	/** Navigation error if any */
	error = $state<NavigationError | null>(null);

	/**
	 * Atomically update all location-related fields.
	 * Clears any existing error on successful update.
	 * @param location - The resolved location from route matching
	 */
	update(location: ResolvedLocation): void {
		this.path = location.path;
		this.pathname = location.pathname;
		this.search.replaceAll(location.search);
		this.hash = location.hash;
		this.params = location.params;
		this.route = location.route;
		this.appState = location.appState;
		this.error = null;
	}

	/**
	 * Set the navigating flag.
	 * @param isNavigating - Whether navigation is in progress
	 */
	setNavigating(isNavigating: boolean): void {
		this.isNavigating = isNavigating;
	}

	/**
	 * Set error and clear navigating flag.
	 * @param error - The navigation error, or null to clear
	 */
	setError(error: NavigationError | null): void {
		this.error = error;
		this.isNavigating = false;
	}

	/**
	 * Clear any existing error.
	 */
	clearError(): void {
		this.error = null;
	}
}
