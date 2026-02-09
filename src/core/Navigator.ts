/**
 * Navigator - 9-Phase Navigation Pipeline
 *
 * Executes the navigation pipeline for all navigations (push, pop, state-change).
 * Implements dual cancellation checking (navigationId AND stateId) to detect
 * stale navigations during async operations.
 *
 * Pipeline phases:
 * 1. INITIATE - Generate navigationId, capture stateId, set isNavigating
 * 2. MATCH ROUTE - Find matching route, handle redirects
 * 3. CHECK BLOCKERS - Run NavigationBlocker functions, show confirm dialog
 * 4. BEFORE NAVIGATE - Run beforeNavigate hooks (parallel, can abort/redirect)
 * 5. DEACTIVATE CURRENT - Save scroll position for current navigation
 * 6. LOAD & ACTIVATE - Load component/layout, update PageState
 * 7. ON NAVIGATE - Run onNavigate hooks (sequential, View Transitions)
 * 8. COMMIT - Update browser history (push/replace)
 * 9. AFTER NAVIGATE - Set isNavigating=false, run afterNavigate hooks
 */

import type { Component } from 'svelte';
import type {
	NavigationRequest,
	NavigationResult,
	NavigationContext,
	NavigationError,
	NavigationErrorContext,
	ResolvedLocation,
	ResolvedProviders,
	Route,
	SetStateOptions,
	StateConfig,
	StateMachineReader
} from './types.js';
import { NavigationErrorCode } from './types.js';
import type { RouteMatcher } from './RouteMatcher.js';
import type { PageState } from './PageState.svelte.js';
import type { NavigationLifecycle } from './NavigationLifecycle.js';
import type { LayoutManager } from './LayoutManager.js';
import type { HistoryState } from '../providers/interfaces.js';

/** Maximum number of redirects before TOO_MANY_REDIRECTS error */
const MAX_REDIRECTS = 10;

/**
 * Configuration for Navigator constructor.
 */
export interface NavigatorDeps {
	matcher: RouteMatcher;
	stateMachine: StateMachineReader;
	pageState: PageState;
	lifecycle: NavigationLifecycle;
	layoutManager: LayoutManager;
	providers: ResolvedProviders;
	/** Blocker check delegated from WarpKit */
	checkBlockers: () => Promise<{ proceed: boolean }>;
	/** Callback to set loaded components on WarpKit's $state fields */
	setLoadedComponents: (
		component: Component | null,
		layout: Component | null,
		hmrMeta?: { componentHmrId?: string | null; layoutHmrId?: string | null }
	) => void;
	/** Global error handler */
	onError?: (error: NavigationError, context: NavigationErrorContext) => void;
	/** Callback to fire navigation complete events */
	fireNavigationComplete?: (context: NavigationContext) => void;
	/** Callback to get resolved default path for a state (handles caching and function defaults) */
	getResolvedDefault?: (state: string) => string | null;
}

/**
 * Executes the 9-phase navigation pipeline.
 *
 * Used internally by WarpKit - consumers use WarpKit.navigate() instead.
 */
export class Navigator {
	private navigationCounter = 0;
	private currentNavigationId = 0;
	private historyPosition = 0;

	private readonly matcher: RouteMatcher;
	private readonly stateMachine: StateMachineReader;
	private readonly pageState: PageState;
	private readonly lifecycle: NavigationLifecycle;
	private readonly layoutManager: LayoutManager;
	private readonly providers: ResolvedProviders;
	private readonly checkBlockers: () => Promise<{ proceed: boolean }>;
	private readonly setLoadedComponents: (
		component: Component | null,
		layout: Component | null,
		hmrMeta?: { componentHmrId?: string | null; layoutHmrId?: string | null }
	) => void;
	private readonly onError?: (error: NavigationError, context: NavigationErrorContext) => void;
	private readonly fireNavigationComplete?: (context: NavigationContext) => void;
	private readonly getResolvedDefault?: (state: string) => string | null;

	public constructor(config: NavigatorDeps) {
		this.matcher = config.matcher;
		this.stateMachine = config.stateMachine;
		this.pageState = config.pageState;
		this.lifecycle = config.lifecycle;
		this.layoutManager = config.layoutManager;
		this.providers = config.providers;
		this.checkBlockers = config.checkBlockers;
		this.setLoadedComponents = config.setLoadedComponents;
		this.onError = config.onError;
		this.fireNavigationComplete = config.fireNavigationComplete;
		this.getResolvedDefault = config.getResolvedDefault;
	}

	/**
	 * Navigate to a path.
	 * @param path - Target path (e.g., '/dashboard')
	 * @param options - Navigation options (replace, state, scrollPosition)
	 */
	public async navigate(
		path: string,
		options: {
			replace?: boolean;
			state?: Record<string, unknown>;
			scrollPosition?: { x: number; y: number } | 'preserve';
		} = {}
	): Promise<NavigationResult> {
		return this.runPipeline({
			path,
			type: 'push',
			replace: options.replace ?? false,
			state: options.state,
			scrollPosition: options.scrollPosition
		});
	}

	/**
	 * Handle state change with optional path navigation.
	 *
	 * Note: The StateMachine.setState call is done by WarpKit BEFORE calling this.
	 * This method only handles the navigation part after state has changed.
	 *
	 * @param newState - The new app state (already set on StateMachine)
	 * @param path - Optional target path (already resolved by WarpKit if not provided)
	 * @param options - Navigation options
	 */
	public async navigateAfterStateChange(
		newState: string,
		path?: string,
		options: SetStateOptions = {}
	): Promise<NavigationResult> {
		// Determine target path (null/undefined = no navigation)
		// Note: WarpKit resolves function defaults before calling this method
		const targetPath = path;

		if (targetPath === null || targetPath === undefined) {
			// State changed but no navigation.
			// Used for states with no routes (e.g., 'initializing' with routes: [], default: null)
			return { success: true };
		}

		return this.runPipeline({
			path: targetPath,
			type: 'state-change',
			replace: options.replace ?? false,
			state: options.state
		});
	}

	/**
	 * Handle popstate (back/forward) navigation.
	 * @param state - History state from popstate event
	 * @param direction - Navigation direction
	 * @param onBlocked - Callback if navigation is blocked (to restore URL)
	 */
	public async handlePopState(
		state: HistoryState | null,
		direction: 'back' | 'forward',
		onBlocked?: () => void
	): Promise<NavigationResult> {
		// Get current path from browser
		const location = this.providers.browser.getLocation();
		const path = location.pathname + location.search + location.hash;

		return this.runPipeline({
			path,
			type: 'pop',
			replace: false,
			direction,
			restoredNavigationId: state?.id,
			onBlocked
		});
	}

	/**
	 * Get current navigation ID (for testing/debugging).
	 */
	public getCurrentNavigationId(): number {
		return this.currentNavigationId;
	}

	/**
	 * Run the 9-phase navigation pipeline.
	 */
	private async runPipeline(request: NavigationRequest): Promise<NavigationResult> {
		// ========================================================================
		// Phase 1: INITIATE
		// ========================================================================
		const navigationId = ++this.navigationCounter;
		this.currentNavigationId = navigationId;
		const capturedStateId = this.stateMachine.getStateId();

		// Dual cancellation check: BOTH conditions must be checked
		const isCancelled = (): boolean =>
			navigationId !== this.currentNavigationId || capturedStateId !== this.stateMachine.getStateId();

		this.pageState.setNavigating(true);

		// Capture "from" location BEFORE any pipeline phases modify PageState
		const fromLocation = this.buildCurrentLocation();

		try {
			// Parse path into components
			const parsed = this.parsePath(request.path);

			// ========================================================================
			// Phase 2: MATCH ROUTE
			// ========================================================================
			const currentState = this.stateMachine.getState();
			const match = this.matcher.match(parsed.pathname, currentState);

			// Handle no match (null)
			if (match === null) {
				return this.notFoundError(parsed.pathname, request.path);
			}

			// Handle redirect (discriminated by presence of redirect property with truthy value)
			if ('redirect' in match && match.redirect !== undefined) {
				const redirectCount = (request.redirectCount ?? 0) + 1;
				if (redirectCount > MAX_REDIRECTS) {
					return this.tooManyRedirectsError(request.path);
				}
				return this.runPipeline({ ...request, path: match.redirect, redirectCount });
			}

			// Handle state mismatch (discriminated by stateMismatch: true)
			// Route exists in another state - redirect to current state's default path
			if ('stateMismatch' in match && match.stateMismatch === true) {
				// Get resolved default from WarpKit (handles caching and function defaults)
				const defaultPath = this.getResolvedDefault?.(currentState) ?? null;

				if (defaultPath) {
					// Redirect to the default path for the current state
					const redirectCount = (request.redirectCount ?? 0) + 1;
					if (redirectCount > MAX_REDIRECTS) {
						return this.tooManyRedirectsError(request.path);
					}
					return this.runPipeline({ ...request, path: defaultPath, redirectCount, replace: true });
				}

				// No default path - fall back to error
				// Properties exist because we're in stateMismatch branch
				return this.stateMismatchError(
					parsed.pathname,
					match.availableInState,
					match.requestedState,
					request.path
				);
			}

			// At this point, match must be a successful route match
			// Use type guard to narrow the union
			if (!('route' in match) || !match.route) {
				// This should never happen given the logic above, but satisfies TypeScript
				return this.notFoundError(parsed.pathname, request.path);
			}

			const matchedRoute = match.route;
			const matchedParams = match.params;

			// Build navigation context
			const context: NavigationContext = {
				from: fromLocation,
				to: {
					path: request.path,
					pathname: parsed.pathname,
					search: parsed.search,
					hash: parsed.hash,
					params: matchedParams,
					route: matchedRoute,
					appState: currentState
				},
				type: request.type,
				direction: this.resolveDirection(request),
				navigationId
			};

			// ========================================================================
			// Phase 3: CHECK BLOCKERS
			// ========================================================================
			if (isCancelled()) return this.cancelledResult(request.path);

			const blockerResult = await this.checkBlockers();
			if (!blockerResult.proceed) {
				this.pageState.setNavigating(false);
				if (request.type === 'pop' && request.onBlocked) {
					request.onBlocked();
				}
				return this.blockedError(request.path);
			}

			// ========================================================================
			// Phase 4: BEFORE NAVIGATE
			// ========================================================================
			if (isCancelled()) return this.cancelledResult(request.path);

			const beforeResult = await this.lifecycle.runBeforeNavigate(context);

			if (!beforeResult.proceed) {
				// Check if it's an abort or redirect
				if (beforeResult.redirect) {
					// Redirect from hook
					const redirectCount = (request.redirectCount ?? 0) + 1;
					if (redirectCount > MAX_REDIRECTS) {
						return this.tooManyRedirectsError(request.path);
					}
					return this.runPipeline({ ...request, path: beforeResult.redirect, redirectCount });
				}
				// Explicit abort
				this.pageState.setNavigating(false);
				return this.abortedError(request.path);
			}

			// ========================================================================
			// Phase 5: DEACTIVATE CURRENT
			// ========================================================================
			if (isCancelled()) return this.cancelledResult(request.path);

			// Save scroll position for OLD navigation's history ID
			if (context.from?.route) {
				const oldHistoryState = this.providers.browser.getHistoryState();
				if (oldHistoryState) {
					this.providers.storage.saveScrollPosition(oldHistoryState.id, {
						x: typeof window !== 'undefined' ? window.scrollX : 0,
						y: typeof window !== 'undefined' ? window.scrollY : 0
					});
				}
			}

			// ========================================================================
			// Phase 6: LOAD & ACTIVATE
			// ========================================================================
			if (isCancelled()) return this.cancelledResult(request.path);

			// Load component
			const { component, hmrId: componentHmrId } = await this.loadComponent(matchedRoute);
			if (isCancelled()) return this.cancelledResult(request.path);

			// Load layout
			const stateConfig = this.matcher.getStateConfig(currentState);
			const layout = await this.layoutManager.resolveLayout(matchedRoute, stateConfig);
			const layoutHmrId = this.layoutManager.getLayoutHmrId();
			if (isCancelled()) return this.cancelledResult(request.path);

			// Set loaded components on WarpKit's $state fields
			this.setLoadedComponents(component, layout, { componentHmrId, layoutHmrId });

			// Clear any previous navigation error
			this.pageState.clearError();

			// Update PageState (triggers Svelte 5 reactivity)
			this.pageState.update(context.to);

			// ========================================================================
			// Phase 7: ON NAVIGATE
			// ========================================================================
			await this.lifecycle.runOnNavigate(context);

			if (isCancelled()) return this.cancelledResult(request.path);

			// ========================================================================
			// Phase 8: COMMIT
			// ========================================================================
			const historyState = this.createHistoryState(navigationId, currentState, request.state);

			if (request.type !== 'pop') {
				if (request.replace) {
					this.providers.browser.replace(request.path, historyState);
				} else {
					this.providers.browser.push(request.path, historyState);
					this.historyPosition++;
				}
			}

			// Handle scroll restoration
			this.handleScroll(request, context);

			// ========================================================================
			// Phase 9: AFTER NAVIGATE
			// ========================================================================
			this.pageState.setNavigating(false);
			this.lifecycle.runAfterNavigate(context);

			// Fire navigation complete for provider observers
			this.fireNavigationComplete?.(context);

			return { success: true, location: context.to };
		} catch (error) {
			// LOAD_FAILED covers component/layout loading errors
			const navError: NavigationError = {
				code: NavigationErrorCode.LOAD_FAILED,
				message: error instanceof Error ? error.message : 'Navigation failed',
				cause: error instanceof Error ? error : undefined,
				requestedPath: request.path
			};
			this.pageState.setError(navError);

			// Fire global onError handler
			this.onError?.(navError, {
				from: fromLocation,
				to: null,
				type: request.type
			});

			return { success: false, error: navError };
		}
	}

	/**
	 * Parse path into pathname, search, and hash components.
	 */
	private parsePath(path: string): { pathname: string; search: string; hash: string } {
		const hashIndex = path.indexOf('#');
		const searchIndex = path.indexOf('?');

		let pathname = path;
		let search = '';
		let hash = '';

		if (hashIndex !== -1) {
			hash = path.slice(hashIndex);
			pathname = path.slice(0, hashIndex);
		}

		if (searchIndex !== -1 && (hashIndex === -1 || searchIndex < hashIndex)) {
			const endIndex = hashIndex !== -1 ? hashIndex : path.length;
			search = path.slice(searchIndex, endIndex);
			pathname = path.slice(0, searchIndex);
		}

		return { pathname, search, hash };
	}

	/**
	 * Build current location from PageState.
	 */
	private buildCurrentLocation(): ResolvedLocation | null {
		if (!this.pageState.route) {
			return null;
		}

		return {
			path: this.pageState.path,
			pathname: this.pageState.pathname,
			search: this.pageState.search.toString(),
			hash: this.pageState.hash,
			params: this.pageState.params,
			route: this.pageState.route,
			appState: this.pageState.appState
		};
	}

	/**
	 * Resolve navigation direction from request.
	 */
	private resolveDirection(request: NavigationRequest): 'forward' | 'back' | 'replace' {
		if (request.replace) return 'replace';
		if (request.type === 'pop') {
			return request.direction ?? 'back';
		}
		return 'forward';
	}

	/**
	 * Load route component via lazy import.
	 */
	private async loadComponent(route: Route): Promise<{ component: Component; hmrId: string | null }> {
		try {
			const module = await route.component();
			return {
				component: module.default,
				hmrId: (module as Record<string, unknown>).__warpkitHmrId as string ?? null
			};
		} catch (error) {
			throw this.enhanceLoadError(error, route.path, 'component');
		}
	}

	/**
	 * Wrap load error with route context.
	 */
	private enhanceLoadError(error: unknown, routePath: string, type: 'component' | 'layout'): Error {
		const message = error instanceof Error ? error.message : String(error);
		const enhanced = new Error(`[${routePath}] ${message}`);
		if (error instanceof Error) {
			enhanced.cause = error;
		}
		return enhanced;
	}

	/**
	 * Create history state for browser.
	 */
	private createHistoryState(
		navigationId: number,
		appState: string,
		data?: Record<string, unknown>
	): HistoryState {
		return {
			__warpkit: true,
			id: navigationId,
			position: this.historyPosition,
			appState,
			data
		};
	}

	/**
	 * Handle scroll restoration/positioning after navigation.
	 */
	private handleScroll(request: NavigationRequest, context: NavigationContext): void {
		if (typeof window === 'undefined') return;

		// 'preserve' = don't change scroll
		if (request.scrollPosition === 'preserve') return;

		// Explicit scroll position
		if (request.scrollPosition && typeof request.scrollPosition === 'object') {
			window.scrollTo(request.scrollPosition.x, request.scrollPosition.y);
			return;
		}

		// Pop navigation = restore saved position
		if (request.type === 'pop' && request.restoredNavigationId) {
			const savedPosition = this.providers.storage.getScrollPosition(request.restoredNavigationId);
			if (savedPosition) {
				window.scrollTo(savedPosition.x, savedPosition.y);
				return;
			}
		}

		// Hash navigation = scroll to element
		if (context.to.hash) {
			const element = document.getElementById(context.to.hash.slice(1));
			if (element) {
				element.scrollIntoView();
				return;
			}
		}

		// Default = scroll to top
		window.scrollTo(0, 0);
	}

	// ========================================================================
	// Error helpers
	// ========================================================================

	private cancelledResult(requestedPath: string): NavigationResult {
		this.pageState.setNavigating(false);
		return {
			success: false,
			error: {
				code: NavigationErrorCode.CANCELLED,
				message: 'Navigation cancelled',
				requestedPath
			}
		};
	}

	private notFoundError(pathname: string, requestedPath: string): NavigationResult {
		const error: NavigationError = {
			code: NavigationErrorCode.NOT_FOUND,
			message: `No route matches '${pathname}' in any state`,
			requestedPath
		};
		this.pageState.setError(error);
		this.pageState.setNavigating(false);
		this.onError?.(error, { from: null, to: null, type: 'push' });
		return { success: false, error };
	}

	private stateMismatchError(
		pathname: string,
		availableInState: string,
		requestedState: string,
		requestedPath: string
	): NavigationResult {
		const error: NavigationError = {
			code: NavigationErrorCode.STATE_MISMATCH,
			message: `Route '${pathname}' exists in state '${availableInState}' but current state is '${requestedState}'`,
			requestedPath
		};
		this.pageState.setError(error);
		this.pageState.setNavigating(false);
		this.onError?.(error, { from: null, to: null, type: 'push' });
		return { success: false, error };
	}

	private tooManyRedirectsError(requestedPath: string): NavigationResult {
		const error: NavigationError = {
			code: NavigationErrorCode.TOO_MANY_REDIRECTS,
			message: `Too many redirects (max ${MAX_REDIRECTS}) while navigating to '${requestedPath}'`,
			requestedPath
		};
		this.pageState.setError(error);
		this.pageState.setNavigating(false);
		this.onError?.(error, { from: null, to: null, type: 'push' });
		return { success: false, error };
	}

	private blockedError(requestedPath: string): NavigationResult {
		return {
			success: false,
			error: {
				code: NavigationErrorCode.BLOCKED,
				message: 'Navigation blocked by user',
				requestedPath
			}
		};
	}

	private abortedError(requestedPath: string): NavigationResult {
		return {
			success: false,
			error: {
				code: NavigationErrorCode.ABORTED,
				message: 'Navigation aborted by beforeNavigate hook',
				requestedPath
			}
		};
	}
}
