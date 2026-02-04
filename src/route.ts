/**
 * Route Factory Functions
 *
 * createRoute - Creates a typed route with param extraction and path building
 * createStateRoutes - Validates and organizes routes by app state
 */

import type {
	Route,
	RouteMeta,
	RouteConfig,
	TypedRoute,
	ExtractParams,
	StateConfig,
	StateRoutes
} from './core/types.js';

/**
 * Extract param names from a path pattern.
 * e.g., '/projects/[id]/[...rest?]' => ['id', 'rest']
 */
function extractParamNames(path: string): string[] {
	const names: string[] = [];
	const regex = /\[(?:\.\.\.)?([^\]?]+)\??]/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(path)) !== null) {
		names.push(match[1]);
	}
	return names;
}

/**
 * Validate a path pattern follows WarpKit conventions.
 * Throws descriptive error on invalid patterns.
 */
function validatePathPattern(path: string): void {
	if (!path.startsWith('/')) {
		throw new Error(`Route path '${path}' must start with '/'.`);
	}

	const segments = path.split('/').filter(Boolean);
	let foundCatchAll = false;

	for (const segment of segments) {
		if (foundCatchAll) {
			throw new Error(
				`Route path '${path}': catch-all parameter [...] must be the last segment. ` +
					`Found segment '${segment}' after catch-all.`
			);
		}

		if (segment.startsWith('[...')) {
			foundCatchAll = true;
			// Validate catch-all syntax: [...name] or [...name?]
			if (!segment.match(/^\[\.\.\.([a-zA-Z_]\w*)\?\]$/) && !segment.match(/^\[\.\.\.([a-zA-Z_]\w*)\]$/)) {
				throw new Error(
					`Route path '${path}': invalid catch-all syntax '${segment}'. ` + `Use '[...name]' or '[...name?]'.`
				);
			}
		} else if (segment.startsWith('[')) {
			// Validate param syntax: [name] or [name?]
			if (!segment.match(/^\[([a-zA-Z_]\w*)\?\]$/) && !segment.match(/^\[([a-zA-Z_]\w*)\]$/)) {
				throw new Error(
					`Route path '${path}': invalid parameter syntax '${segment}'. ` + `Use '[name]' or '[name?]'.`
				);
			}
		}
	}
}

// Overload: no meta provided → RouteMeta
export function createRoute<TPath extends string>(
	config: Omit<RouteConfig<TPath, RouteMeta>, 'meta'> & { meta?: undefined }
): TypedRoute<TPath, RouteMeta>;

// Overload: meta provided → TMeta
export function createRoute<TPath extends string, TMeta extends RouteMeta>(
	config: RouteConfig<TPath, TMeta> & { meta: TMeta }
): TypedRoute<TPath, TMeta>;

/**
 * Create a typed route with param extraction and path building.
 *
 * @example
 * const projectRoute = createRoute({
 *   path: '/projects/[id]',
 *   component: () => import('./pages/Project.svelte'),
 *   meta: { title: 'Project' }
 * });
 *
 * // Type-safe param access
 * const params = projectRoute.getParams({ id: '123', other: 'ignored' });
 * // params.id: string
 *
 * // Type-safe path building
 * const path = projectRoute.buildPath({ id: '123' });
 * // '/projects/123'
 */
export function createRoute<TPath extends string, TMeta extends RouteMeta = RouteMeta>(
	config: RouteConfig<TPath, TMeta>
): TypedRoute<TPath, TMeta> {
	validatePathPattern(config.path);

	const paramNames = extractParamNames(config.path);
	// Default meta to empty object. The overload signatures ensure correct typing.
	const meta: RouteMeta = config.meta ?? {};

	return {
		path: config.path,
		component: config.component,
		layout: config.layout,
		meta,

		getParams(allParams: Record<string, string>): ExtractParams<TPath> {
			const result: Record<string, string> = {};
			for (const name of paramNames) {
				if (name in allParams) {
					result[name] = allParams[name];
				}
			}
			return result as ExtractParams<TPath>;
		},

		buildPath(params: ExtractParams<TPath>): string {
			let path = config.path as string;
			for (const [key, value] of Object.entries(params)) {
				const strValue = value as string;
				// Handle catch-all params [...key] and [...key?]
				// Catch-all values may contain slashes (e.g., 'a/b/c') — encode each segment individually
				if (path.includes(`[...${key}]`) || path.includes(`[...${key}?]`)) {
					const encoded = strValue.split('/').map(encodeURIComponent).join('/');
					path = path.replace(`[...${key}]`, encoded);
					path = path.replace(`[...${key}?]`, encoded);
				} else {
					// Regular params [key] and [key?] — encode the single segment
					const encoded = encodeURIComponent(strValue);
					path = path.replace(`[${key}]`, encoded);
					path = path.replace(`[${key}?]`, encoded);
				}
			}
			// Remove optional params that weren't provided (handles both [param?] and [...param?])
			path = path.replace(/\/\[(?:\.\.\.)?[^\]]+\?\]/g, '');
			// Normalize: remove trailing slashes (from empty optional params) and ensure leading /
			path = path.replace(/\/+$/, '') || '/';
			return path;
		}
	} as TypedRoute<TPath, TMeta>;
}

/**
 * Validate and organize routes by app state.
 *
 * Validation includes:
 * - No duplicate paths within a state
 * - Valid path patterns (catches syntax errors early)
 * - Default path exists in routes or redirects
 * - No self-referencing redirects
 *
 * @example
 * type AppState = 'unauthenticated' | 'authenticated';
 *
 * const routes = createStateRoutes<AppState>({
 *   unauthenticated: {
 *     routes: [
 *       createRoute({ path: '/login', component: () => import('./Login.svelte') }),
 *     ],
 *     default: '/login',
 *   },
 *   authenticated: {
 *     routes: [
 *       createRoute({ path: '/dashboard', component: () => import('./Dashboard.svelte') }),
 *     ],
 *     default: '/dashboard',
 *     layout: { id: 'app-layout', load: () => import('./AppLayout.svelte') },
 *   },
 * });
 */
export function createStateRoutes<TAppState extends string, TStateData = unknown>(
	config: StateRoutes<TAppState, TStateData>
): StateRoutes<TAppState, TStateData> {
	// Validate at startup - catch configuration errors early
	for (const [state, stateConfig] of Object.entries<StateConfig<TStateData>>(config)) {
		// 1. Validate no duplicate paths within a state
		const paths = new Set<string>();
		for (const route of stateConfig.routes) {
			if (paths.has(route.path)) {
				throw new Error(
					`Duplicate route path '${route.path}' in state '${state}'. ` +
						`Each path must be unique within a state.`
				);
			}
			paths.add(route.path);
		}

		// 2. Validate path patterns
		for (const route of stateConfig.routes) {
			validatePathPattern(route.path);
		}

		// 3. Validate default path is either null, a function, or matches a route in this state
		// Skip validation for function defaults - they are resolved at runtime with state data
		if (stateConfig.default !== null && typeof stateConfig.default !== 'function') {
			const defaultPath = stateConfig.default;
			const defaultMatches = stateConfig.routes.some((r) => r.path === defaultPath);
			// Default may also be a redirect target, so check redirects too
			const isRedirectTarget = stateConfig.redirects
				? Object.values(stateConfig.redirects).includes(defaultPath)
				: false;
			if (!defaultMatches && !isRedirectTarget && import.meta.env?.DEV !== false) {
				console.warn(
					`[WarpKit] Default path '${defaultPath}' in state '${state}' ` +
						`does not match any route in this state. Navigation to this state ` +
						`will trigger route matching which may result in NOT_FOUND.`
				);
			}
		}

		// 4. Validate redirect targets are valid paths (not pointing to themselves)
		if (stateConfig.redirects) {
			for (const [from, to] of Object.entries(stateConfig.redirects)) {
				if (from === to) {
					throw new Error(
						`Self-referencing redirect '${from}' → '${to}' in state '${state}'. ` +
							`This would cause an infinite redirect loop.`
					);
				}
			}
		}
	}

	return config;
}
