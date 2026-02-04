/**
 * RouteMatcher - Route matching engine with state filtering
 *
 * Constructed once during WarpKit initialization with the full StateRoutes configuration.
 * Pre-compiles all routes and sorts them by specificity score within each state.
 * At match time, iterates sorted routes and returns the first match.
 *
 * Match outcomes (discriminated union):
 * 1. Redirect - pathname matches a redirect entry in the current state
 * 2. Route match - pathname matches a route pattern in the current state
 * 3. State mismatch - pathname matches a route in a different state
 * 4. null - pathname matches no route in any state (NOT_FOUND)
 */

import type { Route, RouteMatch, StateConfig, StateRoutes, CompiledRoute } from '../core/types.js';
import { RouteCompiler } from './RouteCompiler.js';

/** CompiledRoute with definition order for sorting (transient, not stored) */
interface CompiledRouteWithOrder extends CompiledRoute {
	definitionOrder: number;
}

/** Pre-computed info for path expansion */
interface ExpandableRoute {
	/** The param name at the start (e.g., 'projectAlias') */
	paramName: string;
	/** The rest of the route after the param (e.g., '/incidents' or '') */
	restOfRoute: string;
	/** The compiled route for verification */
	compiled: CompiledRoute;
}

export class RouteMatcher {
	private compiledRoutes: Map<string, CompiledRoute[]> = new Map();
	private redirects: Map<string, Map<string, string>> = new Map();
	private stateConfigs: Map<string, StateConfig<unknown>> = new Map();

	/** Static path -> CompiledRoute lookup for O(1) matching */
	private staticPathLookup: Map<string, Map<string, CompiledRoute>> = new Map();

	/** Pre-computed expandable routes per state (routes starting with /[param]/...) */
	private expandableRoutes: Map<string, ExpandableRoute[]> = new Map();

	/** Lookup from restOfRoute -> ExpandableRoute for fast expansion */
	private expansionLookup: Map<string, Map<string, ExpandableRoute>> = new Map();

	/**
	 * Create a RouteMatcher with pre-compiled routes.
	 * Routes are compiled to RegExp patterns and sorted by specificity score within each state.
	 * Also pre-computes static path lookup tables and expandable route info for fast matching.
	 * @param routes - State routes configuration from createStateRoutes
	 */
	public constructor(routes: StateRoutes<string, unknown>) {
		const compiler = new RouteCompiler();
		// Regex to match routes starting with /[paramName] (with optional rest)
		const expandablePattern = /^\/\[([^\]]+)\](\/.*)?$/;

		for (const [state, config] of Object.entries(routes)) {
			// Store full state config (for getStateConfig/default paths)
			this.stateConfigs.set(state, config);

			// Compile and sort routes by specificity score.
			// Higher score = more specific = tested first.
			// Definition order breaks ties (earlier route wins).
			const compiled: CompiledRouteWithOrder[] = config.routes.map((route, index) => ({
				...compiler.compile(route, state),
				definitionOrder: index
			}));

			compiled.sort((a, b) => b.score - a.score || a.definitionOrder - b.definitionOrder);

			// Store without definitionOrder (no longer needed after sorting)
			const sortedRoutes = compiled.map(({ definitionOrder: _, ...rest }) => rest);
			this.compiledRoutes.set(state, sortedRoutes);

			// Build static path lookup for O(1) matching of non-param routes
			const staticLookup = new Map<string, CompiledRoute>();
			const expandable: ExpandableRoute[] = [];
			const expansionMap = new Map<string, ExpandableRoute>();

			for (const route of sortedRoutes) {
				const path = route.route.path;

				// Check if this is a static route (no params)
				if (route.paramNames.length === 0) {
					// Static route - add to lookup (handle trailing slash)
					staticLookup.set(path, route);
					if (path !== '/' && !path.endsWith('/')) {
						staticLookup.set(path + '/', route);
					}
				}

				// Check if this route is expandable (starts with /[param])
				const match = expandablePattern.exec(path);
				if (match) {
					const expandableRoute: ExpandableRoute = {
						paramName: match[1],
						restOfRoute: match[2] ?? '',
						compiled: route
					};
					expandable.push(expandableRoute);

					// Add to expansion lookup (restOfRoute -> expandableRoute)
					// First match wins (routes are already sorted by specificity)
					const rest = expandableRoute.restOfRoute || '/';
					if (!expansionMap.has(rest)) {
						expansionMap.set(rest, expandableRoute);
					}
				}
			}

			this.staticPathLookup.set(state, staticLookup);
			this.expandableRoutes.set(state, expandable);
			this.expansionLookup.set(state, expansionMap);

			// Store redirects as a Map for O(1) lookup
			if (config.redirects) {
				this.redirects.set(state, new Map(Object.entries(config.redirects)));
			}
		}
	}

	/**
	 * Match a pathname against routes in the given state.
	 *
	 * Returns one of four outcomes (discriminated union — see RouteMatch type):
	 * 1. **Redirect** — pathname matches a redirect entry in the current state
	 * 2. **Route match** — pathname matches a route pattern in the current state
	 * 3. **State mismatch** — pathname matches a route in a *different* state
	 * 4. **null** — pathname matches no route in any state (NOT_FOUND)
	 *
	 * Called by Navigator in Phase 2 of the navigation pipeline.
	 */
	public match(pathname: string, state: string): RouteMatch | null {
		// 1. Check redirects first (exact path match, O(1) lookup)
		const stateRedirects = this.redirects.get(state);
		if (stateRedirects?.has(pathname)) {
			return {
				redirect: stateRedirects.get(pathname)!
			};
		}

		// 2. Try static path lookup first (O(1) for non-param routes)
		const staticLookup = this.staticPathLookup.get(state);
		if (staticLookup) {
			const staticMatch = staticLookup.get(pathname);
			if (staticMatch) {
				return {
					route: staticMatch.route,
					params: {},
					state
				};
			}
		}

		// 3. Match against routes with params (sorted by specificity)
		const routes = this.compiledRoutes.get(state);
		if (routes) {
			for (const compiled of routes) {
				// Skip static routes (already checked via lookup)
				if (compiled.paramNames.length === 0) continue;

				const match = compiled.pattern.exec(pathname);
				if (match) {
					// Extract named params from regex capture groups
					const params: Record<string, string> = {};
					const paramNames = compiled.paramNames;
					for (let i = 0; i < paramNames.length; i++) {
						// Decode URI-encoded segments. Unmatched optional params default to ''
						const raw = match[i + 1] ?? '';
						params[paramNames[i]] = raw ? decodeURIComponent(raw) : '';
					}

					return {
						route: compiled.route,
						params,
						state
					};
				}
			}
		}

		// 4. No match in current state — check OTHER states for STATE_MISMATCH.
		// This provides a better error message: "route exists in state X"
		// instead of a generic 404.
		for (const [otherState, otherRoutes] of this.compiledRoutes) {
			if (otherState === state) continue;

			// Check static lookup first
			const otherStaticLookup = this.staticPathLookup.get(otherState);
			if (otherStaticLookup?.has(pathname)) {
				return {
					stateMismatch: true,
					requestedState: state,
					availableInState: otherState,
					pathname
				};
			}

			// Then check param routes
			for (const compiled of otherRoutes) {
				if (compiled.paramNames.length === 0) continue;
				if (compiled.pattern.test(pathname)) {
					return {
						stateMismatch: true,
						requestedState: state,
						availableInState: otherState,
						pathname
					};
				}
			}
		}

		// 5. No match in any state
		return null;
	}

	/**
	 * Get all routes for a state (in specificity order).
	 */
	public getRoutesForState(state: string): Route[] {
		return this.compiledRoutes.get(state)?.map((c) => c.route) ?? [];
	}

	/**
	 * Get the state configuration (default path, layout, redirects).
	 * Used by Navigator.setState to resolve default paths and by
	 * LayoutManager to resolve state-level layouts.
	 */
	public getStateConfig(state: string): StateConfig<unknown> | undefined {
		return this.stateConfigs.get(state);
	}

	/**
	 * Get all valid state names.
	 * Used by WarpKit.getValidStates().
	 */
	public getStates(): string[] {
		return [...this.compiledRoutes.keys()];
	}

	/**
	 * Try to expand a path by prepending a param value from state data.
	 *
	 * When a path like `/incidents` doesn't match directly, this method checks
	 * if there's a route like `/[projectAlias]/incidents` that would match
	 * if we prepend the param value from stateData.
	 *
	 * Uses pre-computed expansion lookup for O(1) path matching.
	 *
	 * @param pathname - The path to expand (e.g., '/incidents')
	 * @param state - The current app state
	 * @param stateData - State data containing param values (e.g., { projectAlias: 'ip' })
	 * @returns The expanded path (e.g., '/ip/incidents') or null if no expansion possible
	 */
	public tryExpandPath(pathname: string, state: string, stateData: Record<string, unknown> | undefined): string | null {
		if (!stateData) return null;

		// Get all expandable routes for this state
		const expandableRoutes = this.expandableRoutes.get(state);
		if (!expandableRoutes || expandableRoutes.length === 0) return null;

		// Try each expandable route to see if the pathname (when expanded) would match
		for (const expandable of expandableRoutes) {
			// Check if stateData has a value for this param
			const paramValue = stateData[expandable.paramName];
			if (typeof paramValue !== 'string' || !paramValue) continue;

			// Build expanded path
			const expandedPath = `/${paramValue.toLowerCase()}${pathname === '/' ? '' : pathname}`;

			// Test if the expanded path matches this route's pattern
			if (expandable.compiled.pattern.test(expandedPath)) {
				return expandedPath;
			}
		}

		return null;
	}

	/**
	 * Add routes dynamically.
	 * Routes are compiled and merged with existing routes for the state.
	 * Also updates static path lookup and expansion tables.
	 *
	 * @param routes - Routes to add (will be compiled and sorted by specificity)
	 * @param state - The app state to add routes to
	 *
	 * @remarks
	 * **Important**: Call this method only before `WarpKit.start()` to avoid
	 * race conditions with in-progress navigations. Adding routes after
	 * start() is not supported and may lead to undefined behavior.
	 */
	public addRoutes(routes: Route[], state: string): void {
		const compiler = new RouteCompiler();
		const expandablePattern = /^\/\[([^\]]+)\](\/.*)?$/;
		const existingRoutes = this.compiledRoutes.get(state) ?? [];
		const startIndex = existingRoutes.length;

		const newCompiled: CompiledRouteWithOrder[] = routes.map((route, index) => ({
			...compiler.compile(route, state),
			definitionOrder: startIndex + index
		}));

		// Merge and re-sort
		const allCompiled: CompiledRouteWithOrder[] = [
			...existingRoutes.map((r, i) => ({ ...r, definitionOrder: i })),
			...newCompiled
		];

		allCompiled.sort((a, b) => b.score - a.score || a.definitionOrder - b.definitionOrder);

		const sortedRoutes = allCompiled.map(({ definitionOrder: _, ...rest }) => rest);
		this.compiledRoutes.set(state, sortedRoutes);

		// Rebuild static path lookup and expansion tables
		const staticLookup = new Map<string, CompiledRoute>();
		const expandable: ExpandableRoute[] = [];
		const expansionMap = new Map<string, ExpandableRoute>();

		for (const route of sortedRoutes) {
			const path = route.route.path;

			// Static routes
			if (route.paramNames.length === 0) {
				staticLookup.set(path, route);
				if (path !== '/' && !path.endsWith('/')) {
					staticLookup.set(path + '/', route);
				}
			}

			// Expandable routes
			const match = expandablePattern.exec(path);
			if (match) {
				const expandableRoute: ExpandableRoute = {
					paramName: match[1],
					restOfRoute: match[2] ?? '',
					compiled: route
				};
				expandable.push(expandableRoute);

				const rest = expandableRoute.restOfRoute || '/';
				if (!expansionMap.has(rest)) {
					expansionMap.set(rest, expandableRoute);
				}
			}
		}

		this.staticPathLookup.set(state, staticLookup);
		this.expandableRoutes.set(state, expandable);
		this.expansionLookup.set(state, expansionMap);
	}
}
