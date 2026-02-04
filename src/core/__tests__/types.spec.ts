/**
 * WarpKit v2 Core Types Tests
 *
 * These tests verify type definitions compile correctly and type inference works.
 * Since types have no runtime behavior (except enums), tests focus on:
 * - Type inference correctness
 * - Enum value correctness
 * - Discriminated union exhaustiveness
 */
import { describe, it, expect } from 'bun:test';
import type {
	Route,
	RouteConfig,
	TypedRoute,
	ExtractParams,
	StateConfig,
	StateRoutes,
	NavigateOptions,
	NavigationRequest,
	NavigationContext,
	NavigationResult,
	NavigationBlocker,
	BlockerRegistration,
	BeforeNavigateHook,
	OnNavigateHook,
	AfterNavigateHook,
	ResolvedLocation,
	RouteMatch,
	StateTransition,
	NavigationError,
	NavigationErrorContext,
	WarpKitConfig,
	CompiledRoute,
	LayoutConfig,
	LayoutProps,
	LayoutComponent,
	RouteMeta
} from '../types';
import { NavigationErrorCode } from '../types';

describe('WarpKit v2 Core Types', () => {
	describe('NavigationErrorCode enum', () => {
		it('should have correct error code values', () => {
			expect(NavigationErrorCode.CANCELLED).toBe(1);
			expect(NavigationErrorCode.ABORTED).toBe(2);
			expect(NavigationErrorCode.BLOCKED).toBe(3);
			expect(NavigationErrorCode.NOT_FOUND).toBe(4);
			expect(NavigationErrorCode.STATE_MISMATCH).toBe(5);
			expect(NavigationErrorCode.LOAD_FAILED).toBe(6);
			expect(NavigationErrorCode.TOO_MANY_REDIRECTS).toBe(7);
			expect(NavigationErrorCode.RENDER_ERROR).toBe(8);
		});

		it('should have 8 error codes total', () => {
			const codes = Object.values(NavigationErrorCode).filter((v) => typeof v === 'number');
			expect(codes).toHaveLength(8);
		});
	});

	describe('ExtractParams type inference', () => {
		it('should extract single param from path', () => {
			// Type-level test - if this compiles, the type works
			type Params = ExtractParams<'/users/[id]'>;
			const params: Params = { id: '123' };
			expect(params.id).toBe('123');
		});

		it('should extract multiple params from path', () => {
			type Params = ExtractParams<'/users/[userId]/posts/[postId]'>;
			const params: Params = { userId: 'u1', postId: 'p1' };
			expect(params.userId).toBe('u1');
			expect(params.postId).toBe('p1');
		});

		it('should extract optional param from path', () => {
			type Params = ExtractParams<'/users/[id?]'>;
			const params: Params = { id: '' }; // Optional params default to empty string
			expect(params.id).toBe('');
		});

		it('should extract catch-all param from path', () => {
			type Params = ExtractParams<'/files/[...path]'>;
			const params: Params = { path: 'a/b/c' };
			expect(params.path).toBe('a/b/c');
		});

		it('should extract optional catch-all param from path', () => {
			type Params = ExtractParams<'/files/[...path?]'>;
			const params: Params = { path: '' };
			expect(params.path).toBe('');
		});

		it('should return empty object for static path', () => {
			type Params = ExtractParams<'/about'>;
			const params: Params = {};
			expect(Object.keys(params)).toHaveLength(0);
		});
	});

	describe('RouteMatch discriminated union', () => {
		it('should allow successful route match', () => {
			const match: RouteMatch = {
				route: {
					path: '/test',
					component: () => Promise.resolve({ default: {} as never }),
					meta: {}
				},
				params: { id: '123' },
				state: 'authenticated'
			};
			expect(match.route).toBeDefined();
			expect(match.redirect).toBeUndefined();
			expect(match.stateMismatch).toBeUndefined();
		});

		it('should allow redirect match', () => {
			const match: RouteMatch = {
				redirect: '/login'
			};
			expect(match.redirect).toBe('/login');
			expect(match.route).toBeUndefined();
			expect(match.stateMismatch).toBeUndefined();
		});

		it('should allow state mismatch match', () => {
			const match: RouteMatch = {
				stateMismatch: true,
				requestedState: 'authenticated',
				availableInState: 'unauthenticated',
				pathname: '/dashboard'
			};
			expect(match.stateMismatch).toBe(true);
			expect(match.route).toBeUndefined();
			expect(match.redirect).toBeUndefined();
		});
	});

	describe('NavigationError structure', () => {
		it('should create error with required fields', () => {
			const error: NavigationError = {
				code: NavigationErrorCode.NOT_FOUND,
				message: 'Route not found',
				requestedPath: '/unknown'
			};
			expect(error.code).toBe(NavigationErrorCode.NOT_FOUND);
			expect(error.message).toBe('Route not found');
			expect(error.requestedPath).toBe('/unknown');
			expect(error.cause).toBeUndefined();
		});

		it('should create error with optional cause', () => {
			const originalError = new Error('Import failed');
			const error: NavigationError = {
				code: NavigationErrorCode.LOAD_FAILED,
				message: 'Failed to load component',
				requestedPath: '/page',
				cause: originalError
			};
			expect(error.cause).toBe(originalError);
		});
	});

	describe('StateTransition structure', () => {
		it('should track state transitions', () => {
			const transition: StateTransition<'anonymous' | 'authenticated'> = {
				previous: 'anonymous',
				current: 'authenticated',
				id: 1,
				timestamp: Date.now()
			};
			expect(transition.previous).toBe('anonymous');
			expect(transition.current).toBe('authenticated');
			expect(transition.id).toBe(1);
			expect(typeof transition.timestamp).toBe('number');
		});
	});

	describe('NavigationContext structure', () => {
		it('should have required fields for navigation hooks', () => {
			const context: NavigationContext = {
				from: null,
				to: {
					path: '/dashboard',
					pathname: '/dashboard',
					search: '',
					hash: '',
					params: {},
					route: {
						path: '/dashboard',
						component: () => Promise.resolve({ default: {} as never }),
						meta: {}
					},
					appState: 'authenticated'
				},
				type: 'push',
				direction: 'forward',
				navigationId: 1
			};
			expect(context.from).toBeNull();
			expect(context.to.pathname).toBe('/dashboard');
			expect(context.type).toBe('push');
			expect(context.direction).toBe('forward');
		});
	});

	describe('WarpKitConfig structure', () => {
		it('should accept valid configuration', () => {
			const config: WarpKitConfig<'anon' | 'auth'> = {
				routes: {
					anon: {
						routes: [],
						default: '/login'
					},
					auth: {
						routes: [],
						default: '/dashboard'
					}
				},
				initialState: 'anon'
			};
			expect(config.initialState).toBe('anon');
			expect(config.routes.anon.default).toBe('/login');
		});

		it('should accept optional error handler', () => {
			const config: WarpKitConfig<'test'> = {
				routes: {
					test: { routes: [], default: '/' }
				},
				initialState: 'test',
				onError: (_error, _context) => {
					// Type inference test: compile success = pass
					// error: NavigationError, context: NavigationErrorContext
				}
			};
			expect(config.onError).toBeDefined();
		});
	});

	describe('Hook types', () => {
		it('should allow BeforeNavigateHook to return boolean', () => {
			const hook: BeforeNavigateHook = () => false;
			expect(hook({} as NavigationContext)).toBe(false);
		});

		it('should allow BeforeNavigateHook to return string for redirect', () => {
			const hook: BeforeNavigateHook = () => '/login';
			expect(hook({} as NavigationContext)).toBe('/login');
		});

		it('should allow BeforeNavigateHook to return void', () => {
			const hook: BeforeNavigateHook = () => undefined;
			expect(hook({} as NavigationContext)).toBeUndefined();
		});

		it('should allow BeforeNavigateHook to return Promise', async () => {
			const hook: BeforeNavigateHook = async () => true;
			await expect(hook({} as NavigationContext)).resolves.toBe(true);
		});

		it('should allow OnNavigateHook to be async', async () => {
			const hook: OnNavigateHook = async () => {
				// Async operation
			};
			await expect(hook({} as NavigationContext)).resolves.toBeUndefined();
		});

		it('should allow AfterNavigateHook to be sync only', () => {
			const hook: AfterNavigateHook = () => {
				// Fire and forget
			};
			expect(hook({} as NavigationContext)).toBeUndefined();
		});
	});

	describe('NavigationBlocker type', () => {
		it('should allow returning string message', () => {
			const blocker: NavigationBlocker = () => 'Are you sure?';
			expect(blocker()).toBe('Are you sure?');
		});

		it('should allow returning boolean', () => {
			const blocker: NavigationBlocker = () => true;
			expect(blocker()).toBe(true);
		});

		it('should allow returning void', () => {
			const blocker: NavigationBlocker = () => undefined;
			expect(blocker()).toBeUndefined();
		});
	});
});
