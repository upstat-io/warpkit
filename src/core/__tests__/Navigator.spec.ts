import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Component } from 'svelte';
import { Navigator, type NavigatorDeps } from '../Navigator.js';
import { NavigationErrorCode } from '../types.js';
import type { Route, StateConfig, NavigationContext, ResolvedLocation } from '../types.js';
import type { HistoryState, ResolvedProviders } from '../../providers/interfaces.js';

// Mock component
const MockComponent = (() => {}) as unknown as Component;
const MockLayout = (() => {}) as unknown as Component;

// Helper to create mock route (returns mutable version for testing)
function createMockRoute(path: string): { path: string; component: ReturnType<typeof vi.fn>; meta: object } {
	return {
		path,
		component: vi.fn().mockResolvedValue({ default: MockComponent }),
		meta: {}
	};
}

// Helper to create mock state config
function createMockStateConfig(defaultPath: string | null): StateConfig {
	return {
		routes: [],
		default: defaultPath
	};
}

describe('Navigator', () => {
	let navigator: Navigator;
	let mockMatcher: any;
	let mockStateMachine: any;
	let mockPageState: any;
	let mockLifecycle: any;
	let mockLayoutManager: any;
	let mockProviders: any;
	let mockCheckBlockers: ReturnType<typeof vi.fn>;
	let mockSetLoadedComponents: (c: Component | null, l: Component | null) => void;
	let mockOnError: ReturnType<typeof vi.fn>;
	let mockFireNavigationComplete: ReturnType<typeof vi.fn>;
	let mockGetResolvedDefault: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Mock RouteMatcher
		mockMatcher = {
			match: vi.fn(),
			getStateConfig: vi.fn().mockReturnValue(createMockStateConfig('/dashboard'))
		};

		// Mock StateMachine
		mockStateMachine = {
			getState: vi.fn().mockReturnValue('authenticated'),
			getStateId: vi.fn().mockReturnValue(1),
			setState: vi.fn()
		};

		// Mock PageState
		mockPageState = {
			path: '/current',
			pathname: '/current',
			search: { toString: () => '' },
			hash: '',
			params: {},
			route: null,
			appState: 'authenticated',
			error: null,
			isNavigating: false,
			setNavigating: vi.fn(),
			setError: vi.fn(),
			clearError: vi.fn(),
			update: vi.fn()
		};

		// Mock NavigationLifecycle
		mockLifecycle = {
			runBeforeNavigate: vi.fn().mockResolvedValue({ proceed: true }),
			runOnNavigate: vi.fn().mockResolvedValue(undefined),
			runAfterNavigate: vi.fn()
		};

		// Mock LayoutManager
		mockLayoutManager = {
			resolveLayout: vi.fn().mockResolvedValue(null)
		};

		// Mock providers
		mockProviders = {
			browser: {
				id: 'browser' as const,
				getLocation: vi.fn().mockReturnValue({ pathname: '/dashboard', search: '', hash: '' }),
				getHistoryState: vi.fn().mockReturnValue(null),
				push: vi.fn(),
				replace: vi.fn(),
				go: vi.fn(),
				buildUrl: vi.fn((p: string) => p),
				parseUrl: vi.fn((p: string) => p),
				onPopState: vi.fn().mockReturnValue(() => {})
			},
			confirmDialog: {
				id: 'confirmDialog' as const,
				confirm: vi.fn().mockResolvedValue(true)
			},
			storage: {
				id: 'storage' as const,
				saveScrollPosition: vi.fn(),
				getScrollPosition: vi.fn().mockReturnValue(null),
				saveIntendedPath: vi.fn(),
				popIntendedPath: vi.fn().mockReturnValue(null)
			}
		};

		mockCheckBlockers = vi.fn().mockResolvedValue({ proceed: true });
		mockSetLoadedComponents = vi.fn();
		mockOnError = vi.fn();
		mockFireNavigationComplete = vi.fn();

		mockGetResolvedDefault = vi.fn().mockReturnValue(null);

		const deps = {
			matcher: mockMatcher,
			stateMachine: mockStateMachine,
			pageState: mockPageState,
			lifecycle: mockLifecycle,
			layoutManager: mockLayoutManager,
			providers: mockProviders,
			checkBlockers: mockCheckBlockers,
			setLoadedComponents: mockSetLoadedComponents,
			onError: mockOnError,
			fireNavigationComplete: mockFireNavigationComplete,
			// Default resolver - used for state mismatch handling
			getResolvedDefault: mockGetResolvedDefault
		} as NavigatorDeps;

		navigator = new Navigator(deps);
	});

	describe('navigate', () => {
		it('should complete successfully when route matches', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			const result = await navigator.navigate('/dashboard');

			expect(result.success).toBe(true);
			expect(result.location?.pathname).toBe('/dashboard');
		});

		it('should set isNavigating during navigation', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard');

			expect(mockPageState.setNavigating).toHaveBeenCalledWith(true);
			expect(mockPageState.setNavigating).toHaveBeenCalledWith(false);
		});

		it('should return NOT_FOUND when route does not match', async () => {
			mockMatcher.match.mockReturnValue(null);

			const result = await navigator.navigate('/unknown');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.NOT_FOUND);
			expect(mockPageState.setError).toHaveBeenCalled();
		});

		it('should handle redirect from route config', async () => {
			const targetRoute = createMockRoute('/new-path');

			// First match returns redirect
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/new-path' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/old-path');

			expect(result.success).toBe(true);
			expect(result.location?.pathname).toBe('/new-path');
		});

		// Regression: BUG-07-098 — a renamed route's redirect dropped the query
		// string, so a shared filtered link (e.g. `/jobs?status=error`) lost its
		// filter the moment the legacy alias redirected to the renamed route.
		it('should carry the query string across a redirect from route config', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error');

			expect(result.success).toBe(true);
			expect(result.location?.pathname).toBe('/activity');
			expect(result.location?.search).toBe('?status=error');
			expect(result.location?.path).toBe('/activity?status=error');
			// RouteMatcher's contract stays pathname-only: the re-match after the
			// redirect is called with the bare pathname, never the query.
			expect(mockMatcher.match).toHaveBeenNthCalledWith(2, '/activity', 'authenticated');
		});

		it('should carry the hash across a redirect from route config', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs#section-2');

			expect(result.location?.path).toBe('/activity#section-2');
		});

		it('should carry both the query string and the hash across a redirect', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error#section-2');

			expect(result.location?.path).toBe('/activity?status=error#section-2');
		});

		it('should not carry a query across a redirect when the original request had none', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs');

			// Negative pin: no query on the request means no query gets invented
			// on the redirect target.
			expect(result.location?.path).toBe('/activity');
		});

		it('should not double up a query when the redirect target already declares its own', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity?scope=default' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error');

			// Negative pin: a redirect target that already carries its own query
			// wins; the original request's query is never blindly appended on top.
			expect(result.location?.path).toBe('/activity?scope=default');
		});

		it('should not double up a hash when the redirect target already declares its own', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity#top' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs#section-2');

			expect(result.location?.path).toBe('/activity#top');
		});

		it('should place a carried query before a target-declared hash, never after', async () => {
			const targetRoute = createMockRoute('/activity');

			// The target owns only its hash; the original request's query has no
			// declared component to compete with, so it fills the gap. A naive
			// string-append implementation would produce the invalid ordering
			// `/activity#top?status=error` (hash before query) here.
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity#top' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error');

			expect(result.location?.path).toBe('/activity?status=error#top');
		});

		it('should carry the original hash when the target owns only its own query', async () => {
			const targetRoute = createMockRoute('/activity');

			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity?scope=default' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs#section-2');

			expect(result.location?.path).toBe('/activity?scope=default#section-2');
		});

		it('should carry both target-declared components when the target owns query and hash', async () => {
			const targetRoute = createMockRoute('/activity');

			// Neither precedent case above pins a target that owns BOTH
			// components at once — a fix that only checked one component before
			// falling back to the original request could still pass both
			// single-component cases while dropping the other here.
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/activity?scope=default#top' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error#section-2');

			expect(result.location?.path).toBe('/activity?scope=default#top');
		});

		it('should NOT carry the query across a no-match-to-default redirect (different mechanism)', async () => {
			mockGetResolvedDefault.mockReturnValue('/dashboard');
			const dashboardRoute = createMockRoute('/dashboard');

			mockMatcher.match
				.mockReturnValueOnce(null)
				.mockReturnValueOnce({ route: dashboardRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/totally-unknown?foo=bar');

			// Negative pin: BUG-07-098's fix is scoped to the config-redirect branch
			// only. A path with no match at all has no defined query mapping onto an
			// unrelated default path, so this branch's existing behavior is unchanged.
			expect(result.location?.path).toBe('/dashboard');
		});

		it('should carry the query through a two-hop config-redirect chain', async () => {
			const targetRoute = createMockRoute('/activity');

			// Each hop reparses the CURRENT request's path, so a second redirect
			// entry chained onto the first must see the already-merged query from
			// hop one and carry it forward again, rather than the fix only
			// applying at the outermost call.
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/legacy-alias' })
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error');

			expect(result.location?.path).toBe('/activity?status=error');
			expect(mockMatcher.match).toHaveBeenCalledTimes(3);
		});

		it('should carry a hop-one target-owned query through hop two, not the original request query', async () => {
			const targetRoute = createMockRoute('/activity');

			// Hop one's target declares its own query, which wins over the original
			// request's per §03.4's single-hop precedence rule. That per-component
			// win has to survive being reparsed as hop two's own request, so hop
			// two's merge sees hop one's query as ITS "original request" query,
			// carrying `?scope=default` — never `?status=error` — to the end.
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/legacy-alias?scope=default' })
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error');

			expect(result.location?.path).toBe('/activity?scope=default');
		});

		it('should carry a hop-one target-owned hash through hop two, not the original request hash', async () => {
			const targetRoute = createMockRoute('/activity');

			// Mirror of the query case above, for hash: hop one's target declares
			// its own hash, winning per §03.4's single-hop precedence, and that
			// win has to survive being reparsed as hop two's own request rather
			// than losing to the true original request's hash.
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/legacy-alias#top' })
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs#section-2');

			expect(result.location?.path).toBe('/activity#top');
		});

		it('should carry a hop-one target owning both components through hop two', async () => {
			const targetRoute = createMockRoute('/activity');

			// Combines the two-hop cases above with the single-hop
			// both-components-owned case: hop one's target declares both its own
			// query and hash, and that combined win has to survive being
			// reparsed as hop two's own request.
			mockMatcher.match
				.mockReturnValueOnce({ redirect: '/legacy-alias?scope=default#top' })
				.mockReturnValueOnce({ redirect: '/activity' })
				.mockReturnValueOnce({ route: targetRoute, params: {}, state: 'authenticated' });

			const result = await navigator.navigate('/jobs?status=error#section-2');

			expect(result.location?.path).toBe('/activity?scope=default#top');
		});

		it('should return TOO_MANY_REDIRECTS after 10 redirects', async () => {
			// Always return redirect
			mockMatcher.match.mockReturnValue({ redirect: '/loop' });

			const result = await navigator.navigate('/start');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.TOO_MANY_REDIRECTS);
		});

		it('should return STATE_MISMATCH when route exists in different state and no default path', async () => {
			// Mock no default path for current state
			mockMatcher.getStateConfig.mockReturnValue(createMockStateConfig(null));
			mockMatcher.match.mockReturnValue({
				stateMismatch: true,
				requestedState: 'authenticated',
				availableInState: 'admin',
				pathname: '/admin-only'
			});

			const result = await navigator.navigate('/admin-only');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.STATE_MISMATCH);
		});

		it('should redirect to state default when route exists in different state', async () => {
			const dashboardRoute = createMockRoute('/dashboard');

			// Configure getResolvedDefault to return the default path
			mockGetResolvedDefault.mockReturnValue('/dashboard');

			// First call returns state mismatch, second call (redirect) returns route match
			mockMatcher.match
				.mockReturnValueOnce({
					stateMismatch: true,
					requestedState: 'authenticated',
					availableInState: 'admin',
					pathname: '/admin-only'
				})
				.mockReturnValueOnce({
					route: dashboardRoute,
					params: {},
					state: 'authenticated'
				});

			const result = await navigator.navigate('/admin-only');

			expect(result.success).toBe(true);
			// Should have navigated to /dashboard (the default path)
			expect(mockProviders.browser.replace).toHaveBeenCalled();
		});

		it('should call lifecycle hooks in order', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			const callOrder: string[] = [];
			mockLifecycle.runBeforeNavigate.mockImplementation(async () => {
				callOrder.push('before');
				return { proceed: true };
			});
			mockLifecycle.runOnNavigate.mockImplementation(async () => {
				callOrder.push('on');
			});
			mockLifecycle.runAfterNavigate.mockImplementation(() => {
				callOrder.push('after');
			});

			await navigator.navigate('/dashboard');

			expect(callOrder).toEqual(['before', 'on', 'after']);
		});

		it('should use replace when option is set', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard', { replace: true });

			expect(mockProviders.browser.replace).toHaveBeenCalled();
			expect(mockProviders.browser.push).not.toHaveBeenCalled();
		});

		it('should use push by default', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard');

			expect(mockProviders.browser.push).toHaveBeenCalled();
			expect(mockProviders.browser.replace).not.toHaveBeenCalled();
		});

		it('should load component via lazy import', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard');

			expect(route.component).toHaveBeenCalled();
			expect(mockSetLoadedComponents).toHaveBeenCalledWith(MockComponent, null);
		});

		it('should resolve layout', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});
			mockLayoutManager.resolveLayout.mockResolvedValue(MockLayout);

			await navigator.navigate('/dashboard');

			expect(mockLayoutManager.resolveLayout).toHaveBeenCalledWith(route, expect.any(Object));
			expect(mockSetLoadedComponents).toHaveBeenCalledWith(MockComponent, MockLayout);
		});

		it('should update PageState on successful navigation', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: { id: '123' },
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard?tab=settings#section');

			expect(mockPageState.update).toHaveBeenCalledWith(
				expect.objectContaining({
					pathname: '/dashboard',
					search: '?tab=settings',
					hash: '#section',
					params: { id: '123' }
				})
			);
		});

		it('should fire navigation complete callback', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard');

			expect(mockFireNavigationComplete).toHaveBeenCalledWith(
				expect.objectContaining({
					to: expect.objectContaining({ pathname: '/dashboard' })
				})
			);
		});
	});

	describe('blockers', () => {
		it('should return BLOCKED when blocker returns false', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});
			mockCheckBlockers.mockResolvedValue({ proceed: false });

			const result = await navigator.navigate('/dashboard');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.BLOCKED);
		});

		it('should call onBlocked for pop navigations', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});
			mockCheckBlockers.mockResolvedValue({ proceed: false });

			const onBlocked = vi.fn();
			await navigator.handlePopState(null, 'back', onBlocked);

			expect(onBlocked).toHaveBeenCalled();
		});
	});

	describe('beforeNavigate hooks', () => {
		it('should return ABORTED when hook returns abort', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});
			mockLifecycle.runBeforeNavigate.mockResolvedValue({ proceed: false });

			const result = await navigator.navigate('/dashboard');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.ABORTED);
		});

		it('should redirect when hook returns redirect path', async () => {
			const oldRoute = createMockRoute('/old');
			const newRoute = createMockRoute('/new');

			mockMatcher.match
				.mockReturnValueOnce({ route: oldRoute, params: {}, state: 'authenticated' })
				.mockReturnValueOnce({ route: newRoute, params: {}, state: 'authenticated' });

			mockLifecycle.runBeforeNavigate
				.mockResolvedValueOnce({ proceed: false, redirect: '/new' })
				.mockResolvedValueOnce({ proceed: true });

			const result = await navigator.navigate('/old');

			expect(result.success).toBe(true);
			expect(result.location?.pathname).toBe('/new');
		});
	});

	describe('cancellation', () => {
		it('should cancel when a new navigation starts', async () => {
			const dashboardRoute = createMockRoute('/dashboard');
			const otherRoute = createMockRoute('/other');

			// First match returns dashboard, subsequent returns other
			mockMatcher.match
				.mockReturnValueOnce({ route: dashboardRoute, params: {}, state: 'authenticated' })
				.mockReturnValue({ route: otherRoute, params: {}, state: 'authenticated' });

			// Dashboard component starts a new navigation during load
			dashboardRoute.component = vi.fn().mockImplementation(async () => {
				// Fire and forget - don't await to avoid blocking
				void navigator.navigate('/other');
				return { default: MockComponent };
			});

			const result = await navigator.navigate('/dashboard');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.CANCELLED);
		});

		it('should cancel when state changes during navigation', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			let stateId = 1;
			mockStateMachine.getStateId.mockImplementation(() => stateId);

			// Simulate state change during component load
			route.component = vi.fn().mockImplementation(async () => {
				stateId = 2; // State changed!
				return { default: MockComponent };
			});

			const result = await navigator.navigate('/dashboard');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.CANCELLED);
		});
	});

	describe('error handling', () => {
		it('should return LOAD_FAILED when component fails to load', async () => {
			const route = createMockRoute('/dashboard');
			route.component = vi.fn().mockRejectedValue(new Error('Network error'));
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			const result = await navigator.navigate('/dashboard');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe(NavigationErrorCode.LOAD_FAILED);
			expect(result.error?.message).toBe('[/dashboard] Network error');
		});

		it('should call onError for load failures', async () => {
			const route = createMockRoute('/dashboard');
			route.component = vi.fn().mockRejectedValue(new Error('Network error'));
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard');

			expect(mockOnError).toHaveBeenCalledWith(
				expect.objectContaining({ code: NavigationErrorCode.LOAD_FAILED }),
				expect.any(Object)
			);
		});
	});

	describe('navigateAfterStateChange', () => {
		it('should navigate to provided path', async () => {
			const route = createMockRoute('/new-state-path');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'newState'
			});

			const result = await navigator.navigateAfterStateChange('newState', '/new-state-path');

			expect(result.success).toBe(true);
			expect(result.location?.pathname).toBe('/new-state-path');
		});

		it('should navigate to resolved path when provided', async () => {
			// Note: WarpKit now resolves function defaults before calling navigateAfterStateChange,
			// so Navigator receives the resolved path directly
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			const result = await navigator.navigateAfterStateChange('authenticated', '/dashboard');

			expect(result.success).toBe(true);
			expect(result.location?.pathname).toBe('/dashboard');
		});

		it('should succeed without navigation when state has no default', async () => {
			mockMatcher.getStateConfig.mockReturnValue({ default: null, routes: [] });

			const result = await navigator.navigateAfterStateChange('initializing');

			expect(result.success).toBe(true);
			expect(result.location).toBeUndefined();
			expect(mockMatcher.match).not.toHaveBeenCalled();
		});
	});

	describe('handlePopState', () => {
		it('should handle back navigation', async () => {
			const route = createMockRoute('/previous');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});
			mockProviders.browser.getLocation.mockReturnValue({
				pathname: '/previous',
				search: '',
				hash: ''
			});

			const historyState: HistoryState = {
				__warpkit: true,
				id: 5,
				position: 4,
				appState: 'authenticated'
			};

			const result = await navigator.handlePopState(historyState, 'back');

			expect(result.success).toBe(true);
			// Should not push/replace for pop navigation
			expect(mockProviders.browser.push).not.toHaveBeenCalled();
			expect(mockProviders.browser.replace).not.toHaveBeenCalled();
		});

		it('should restore scroll position on back navigation', async () => {
			// Mock window for scroll handling
			const scrollToMock = vi.fn();
			(globalThis as any).window = { scrollX: 0, scrollY: 0, scrollTo: scrollToMock };

			try {
				const route = createMockRoute('/previous');
				mockMatcher.match.mockReturnValue({
					route,
					params: {},
					state: 'authenticated'
				});
				mockProviders.browser.getLocation.mockReturnValue({
					pathname: '/previous',
					search: '',
					hash: ''
				});
				mockProviders.storage.getScrollPosition.mockReturnValue({ x: 0, y: 500 });

				const historyState: HistoryState = {
					__warpkit: true,
					id: 5,
					position: 4,
					appState: 'authenticated'
				};

				await navigator.handlePopState(historyState, 'back');

				expect(mockProviders.storage.getScrollPosition).toHaveBeenCalledWith(5);
				expect(scrollToMock).toHaveBeenCalledWith(0, 500);
			} finally {
				delete (globalThis as any).window;
			}
		});
	});

	describe('path parsing', () => {
		it('should parse pathname only', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard');

			expect(mockPageState.update).toHaveBeenCalledWith(
				expect.objectContaining({
					pathname: '/dashboard',
					search: '',
					hash: ''
				})
			);
		});

		it('should parse pathname with search', async () => {
			const route = createMockRoute('/dashboard');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/dashboard?tab=settings&view=list');

			expect(mockPageState.update).toHaveBeenCalledWith(
				expect.objectContaining({
					pathname: '/dashboard',
					search: '?tab=settings&view=list',
					hash: ''
				})
			);
		});

		it('should parse pathname with hash', async () => {
			const route = createMockRoute('/docs');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/docs#getting-started');

			expect(mockPageState.update).toHaveBeenCalledWith(
				expect.objectContaining({
					pathname: '/docs',
					search: '',
					hash: '#getting-started'
				})
			);
		});

		it('should parse pathname with search and hash', async () => {
			const route = createMockRoute('/docs');
			mockMatcher.match.mockReturnValue({
				route,
				params: {},
				state: 'authenticated'
			});

			await navigator.navigate('/docs?version=2#api-reference');

			expect(mockPageState.update).toHaveBeenCalledWith(
				expect.objectContaining({
					pathname: '/docs',
					search: '?version=2',
					hash: '#api-reference'
				})
			);
		});
	});
});
