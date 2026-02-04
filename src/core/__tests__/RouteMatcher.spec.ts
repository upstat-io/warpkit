/**
 * RouteMatcher Unit Tests
 *
 * Tests route matching, state filtering, redirects, and specificity ordering.
 */
import { describe, it, expect } from 'bun:test';
import { RouteMatcher } from '../RouteMatcher';
import type { Route, StateRoutes, RouteMatch } from '../types';

function createRoute(path: string, meta: Record<string, unknown> = {}): Route {
	return {
		path,
		component: () => Promise.resolve({ default: {} as never }),
		meta
	};
}

/** Helper to assert and extract route match */
function expectRouteMatch(result: RouteMatch | null): {
	route: Route;
	params: Record<string, string>;
	state: string;
} {
	expect(result).not.toBeNull();
	if (result === null) throw new Error('Expected route match');
	expect('route' in result).toBe(true);
	return result as { route: Route; params: Record<string, string>; state: string };
}

/** Helper to assert and extract redirect */
function expectRedirect(result: RouteMatch | null): { redirect: string } {
	expect(result).not.toBeNull();
	if (result === null) throw new Error('Expected redirect');
	expect('redirect' in result).toBe(true);
	return result as { redirect: string };
}

/** Helper to assert and extract state mismatch */
function expectStateMismatch(result: RouteMatch | null): {
	stateMismatch: true;
	requestedState: string;
	availableInState: string;
	pathname: string;
} {
	expect(result).not.toBeNull();
	if (result === null) throw new Error('Expected state mismatch');
	expect('stateMismatch' in result).toBe(true);
	return result as {
		stateMismatch: true;
		requestedState: string;
		availableInState: string;
		pathname: string;
	};
}

describe('RouteMatcher', () => {
	describe('constructor', () => {
		it('should compile routes from state configuration', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			expect(matcher.getStates()).toContain('auth');
		});

		it('should handle multiple states', () => {
			const routes: StateRoutes<'anon' | 'auth'> = {
				anon: {
					routes: [createRoute('/login')],
					default: '/login'
				},
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			expect(matcher.getStates()).toHaveLength(2);
			expect(matcher.getStates()).toContain('anon');
			expect(matcher.getStates()).toContain('auth');
		});

		it('should handle empty routes array', () => {
			const routes: StateRoutes<'loading'> = {
				loading: {
					routes: [],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			expect(matcher.getRoutesForState('loading')).toHaveLength(0);
		});
	});

	describe('match - route matching', () => {
		it('should match static path', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/dashboard', 'auth'));

			expect(result.route.path).toBe('/dashboard');
			expect(result.state).toBe('auth');
		});

		it('should match path with required param', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/users/[id]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/users/123', 'auth'));

			expect(result.params).toEqual({ id: '123' });
		});

		it('should match path with multiple params', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/users/[userId]/posts/[postId]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/users/u1/posts/p1', 'auth'));

			expect(result.params).toEqual({ userId: 'u1', postId: 'p1' });
		});

		it('should match path with optional param present', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/projects/[id]/[tab?]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/projects/123/settings', 'auth'));

			expect(result.params).toEqual({ id: '123', tab: 'settings' });
		});

		it('should match path with optional param absent', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/projects/[id]/[tab?]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/projects/123', 'auth'));

			expect(result.params).toEqual({ id: '123', tab: '' });
		});

		it('should match catch-all param', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/files/[...path]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/files/a/b/c', 'auth'));

			expect(result.params).toEqual({ path: 'a/b/c' });
		});

		it('should match optional catch-all with value', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/docs/[...slug?]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/docs/api/reference', 'auth'));

			expect(result.params).toEqual({ slug: 'api/reference' });
		});

		it('should match optional catch-all without value', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/docs/[...slug?]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/docs', 'auth'));

			expect(result.params).toEqual({ slug: '' });
		});

		it('should decode URI-encoded params', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/search/[query]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/search/hello%20world', 'auth'));

			expect(result.params).toEqual({ query: 'hello world' });
		});

		it('should return null for no match', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = matcher.match('/unknown', 'auth');

			expect(result).toBeNull();
		});

		it('should handle trailing slash', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);

			expect(matcher.match('/dashboard', 'auth')).not.toBeNull();
			expect(matcher.match('/dashboard/', 'auth')).not.toBeNull();
		});
	});

	describe('match - specificity ordering', () => {
		it('should match more specific route first (static over param)', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/projects/[id]'), createRoute('/projects/new')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/projects/new', 'auth'));

			expect(result.route.path).toBe('/projects/new');
		});

		it('should match more specific route regardless of definition order', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [
						createRoute('/projects/new'), // Defined first but should still win
						createRoute('/projects/[id]')
					],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/projects/new', 'auth'));

			expect(result.route.path).toBe('/projects/new');
		});

		it('should use definition order as tiebreaker for same score', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/items/[a]', { first: true }), createRoute('/items/[b]', { second: true })],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/items/123', 'auth'));

			// Both have same score (110), first defined wins
			expect(result.route.meta).toEqual({ first: true });
		});

		it('should order by specificity: static > required > optional > catch-all', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [
						createRoute('/a/[...rest]', { type: 'catch-all' }),
						createRoute('/a/[b?]', { type: 'optional' }),
						createRoute('/a/[b]', { type: 'required' }),
						createRoute('/a/static', { type: 'static' })
					],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);

			// /a/static - should match static
			expect(expectRouteMatch(matcher.match('/a/static', 'auth')).route.meta).toEqual({ type: 'static' });

			// /a/other - should match required param (higher than optional/catch-all)
			expect(expectRouteMatch(matcher.match('/a/other', 'auth')).route.meta).toEqual({ type: 'required' });
		});
	});

	describe('match - redirects', () => {
		it('should return redirect for matching redirect path', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard',
					redirects: { '/': '/dashboard' }
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRedirect(matcher.match('/', 'auth'));

			expect(result.redirect).toBe('/dashboard');
		});

		it('should check redirects before routes', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/'), createRoute('/dashboard')],
					default: '/dashboard',
					redirects: { '/': '/dashboard' }
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRedirect(matcher.match('/', 'auth'));

			// Redirect wins over route match
			expect(result.redirect).toBe('/dashboard');
		});

		it('should handle multiple redirects', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard',
					redirects: {
						'/': '/dashboard',
						'/home': '/dashboard',
						'/index': '/dashboard'
					}
				}
			};

			const matcher = new RouteMatcher(routes);

			expect(expectRedirect(matcher.match('/', 'auth')).redirect).toBe('/dashboard');
			expect(expectRedirect(matcher.match('/home', 'auth')).redirect).toBe('/dashboard');
			expect(expectRedirect(matcher.match('/index', 'auth')).redirect).toBe('/dashboard');
		});
	});

	describe('match - state mismatch', () => {
		it('should return state mismatch when route exists in different state', () => {
			const routes: StateRoutes<'anon' | 'auth'> = {
				anon: {
					routes: [createRoute('/login')],
					default: '/login'
				},
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectStateMismatch(matcher.match('/dashboard', 'anon'));

			expect(result.stateMismatch).toBe(true);
			expect(result.requestedState).toBe('anon');
			expect(result.availableInState).toBe('auth');
			expect(result.pathname).toBe('/dashboard');
		});

		it('should return null when path matches no state', () => {
			const routes: StateRoutes<'anon' | 'auth'> = {
				anon: {
					routes: [createRoute('/login')],
					default: '/login'
				},
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = matcher.match('/completely-unknown', 'anon');

			expect(result).toBeNull();
		});

		it('should return first matching state for mismatch', () => {
			const routes: StateRoutes<'a' | 'b' | 'c'> = {
				a: {
					routes: [],
					default: null
				},
				b: {
					routes: [createRoute('/shared')],
					default: null
				},
				c: {
					routes: [createRoute('/shared')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectStateMismatch(matcher.match('/shared', 'a'));

			// Should return one of b or c (first found)
			expect(result.stateMismatch).toBe(true);
			expect(['b', 'c']).toContain(result.availableInState);
		});
	});

	describe('getRoutesForState', () => {
		it('should return routes for existing state', () => {
			const route1 = createRoute('/a');
			const route2 = createRoute('/b');
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [route1, route2],
					default: '/a'
				}
			};

			const matcher = new RouteMatcher(routes);
			const stateRoutes = matcher.getRoutesForState('auth');

			expect(stateRoutes).toHaveLength(2);
		});

		it('should return routes in specificity order', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[...catch]'), createRoute('/static'), createRoute('/[param]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const stateRoutes = matcher.getRoutesForState('auth');

			expect(stateRoutes[0].path).toBe('/static'); // 100
			expect(stateRoutes[1].path).toBe('/[param]'); // 10
			expect(stateRoutes[2].path).toBe('/[...catch]'); // 2
		});

		it('should return empty array for unknown state', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			const stateRoutes = matcher.getRoutesForState('unknown');

			expect(stateRoutes).toEqual([]);
		});
	});

	describe('getStateConfig', () => {
		it('should return state config for existing state', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard',
					redirects: { '/': '/dashboard' }
				}
			};

			const matcher = new RouteMatcher(routes);
			const config = matcher.getStateConfig('auth');

			expect(config).toBeDefined();
			expect(config!.default).toBe('/dashboard');
			expect(config!.redirects).toEqual({ '/': '/dashboard' });
		});

		it('should return undefined for unknown state', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const config = matcher.getStateConfig('unknown');

			expect(config).toBeUndefined();
		});
	});

	describe('getStates', () => {
		it('should return all state names', () => {
			const routes: StateRoutes<'init' | 'anon' | 'auth'> = {
				init: { routes: [], default: null },
				anon: { routes: [], default: null },
				auth: { routes: [], default: null }
			};

			const matcher = new RouteMatcher(routes);
			const states = matcher.getStates();

			expect(states).toHaveLength(3);
			expect(states).toContain('init');
			expect(states).toContain('anon');
			expect(states).toContain('auth');
		});
	});

	describe('addRoutes', () => {
		it('should add routes to existing state', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			expect(matcher.getRoutesForState('auth')).toHaveLength(1);

			matcher.addRoutes([createRoute('/settings'), createRoute('/profile')], 'auth');
			expect(matcher.getRoutesForState('auth')).toHaveLength(3);
		});

		it('should add routes to new state', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			matcher.addRoutes([createRoute('/login')], 'anon');

			expect(matcher.getRoutesForState('anon')).toHaveLength(1);
		});

		it('should maintain specificity ordering after adding routes', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[param]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			matcher.addRoutes([createRoute('/static')], 'auth');

			const stateRoutes = matcher.getRoutesForState('auth');
			expect(stateRoutes[0].path).toBe('/static'); // Higher score, should be first
			expect(stateRoutes[1].path).toBe('/[param]');
		});

		it('should make added routes matchable', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/dashboard')],
					default: '/dashboard'
				}
			};

			const matcher = new RouteMatcher(routes);
			expect(matcher.match('/settings', 'auth')).toBeNull();

			matcher.addRoutes([createRoute('/settings')], 'auth');
			expect(matcher.match('/settings', 'auth')).not.toBeNull();
		});
	});

	describe('tryExpandPath', () => {
		it('should expand path when route starts with param segment', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]/incidents'), createRoute('/[projectAlias]/monitors')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/incidents', 'auth', { projectAlias: 'ip' });

			expect(expanded).toBe('/ip/incidents');
		});

		it('should expand path with lowercase param value', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]/incidents')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/incidents', 'auth', { projectAlias: 'IP' });

			expect(expanded).toBe('/ip/incidents');
		});

		it('should return null when no matching route exists', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]/incidents')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/unknown', 'auth', { projectAlias: 'ip' });

			expect(expanded).toBeNull();
		});

		it('should return null when stateData is undefined', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]/incidents')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/incidents', 'auth', undefined);

			expect(expanded).toBeNull();
		});

		it('should return null when param value is missing from stateData', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]/incidents')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/incidents', 'auth', { otherParam: 'value' });

			expect(expanded).toBeNull();
		});

		it('should expand root path to project root', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/', 'auth', { projectAlias: 'ip' });

			expect(expanded).toBe('/ip');
		});

		it('should not expand paths that do not need expansion', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/settings'), createRoute('/[projectAlias]/incidents')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			// /settings is a static route, not starting with a param
			const expanded = matcher.tryExpandPath('/settings', 'auth', { projectAlias: 'ip' });

			// Should return null because /settings doesn't match the pattern /[param]/rest
			expect(expanded).toBeNull();
		});

		it('should work with nested param routes', () => {
			const routes: StateRoutes<'auth'> = {
				auth: {
					routes: [createRoute('/[projectAlias]/on-call/rosters')],
					default: null
				}
			};

			const matcher = new RouteMatcher(routes);
			const expanded = matcher.tryExpandPath('/on-call/rosters', 'auth', { projectAlias: 'ip' });

			expect(expanded).toBe('/ip/on-call/rosters');
		});
	});

	describe('integration with RouteCompiler', () => {
		/**
		 * RouteMatcher internally uses RouteCompiler to:
		 * 1. Compile route paths into RegExp patterns
		 * 2. Extract parameter names from path segments
		 * 3. Calculate specificity scores for route ordering
		 *
		 * These tests verify the integration works correctly.
		 */

		it('should use RouteCompiler to generate correct RegExp patterns', () => {
			const routes: StateRoutes<'app'> = {
				app: {
					routes: [createRoute('/users/[id]')],
					default: '/users/1'
				}
			};

			const matcher = new RouteMatcher(routes);
			// RouteCompiler generates pattern that matches param segments
			const result = expectRouteMatch(matcher.match('/users/123', 'app'));
			expect(result.params.id).toBe('123');
		});

		it('should use RouteCompiler specificity scoring for route ordering', () => {
			const routes: StateRoutes<'app'> = {
				app: {
					routes: [
						createRoute('/users/[id]'), // Less specific (param)
						createRoute('/users/me') // More specific (static)
					],
					default: '/users/me'
				}
			};

			const matcher = new RouteMatcher(routes);
			// RouteCompiler scores static segments higher than params
			// So /users/me should match before /users/[id]
			const result = expectRouteMatch(matcher.match('/users/me', 'app'));
			expect(result.route.path).toBe('/users/me');
		});

		it('should use RouteCompiler to extract multiple params', () => {
			const routes: StateRoutes<'app'> = {
				app: {
					routes: [createRoute('/orgs/[orgId]/projects/[projectId]')],
					default: '/orgs/1/projects/1'
				}
			};

			const matcher = new RouteMatcher(routes);
			const result = expectRouteMatch(matcher.match('/orgs/abc/projects/xyz', 'app'));
			expect(result.params).toEqual({ orgId: 'abc', projectId: 'xyz' });
		});
	});
});
