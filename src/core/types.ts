/**
 * WarpKit v2 Core Types
 *
 * Type definitions for routes, navigation, state, and errors.
 * This is the single source of truth for all WarpKit v2 types.
 */

import type { Component, Snippet } from 'svelte';
import type {
	Provider,
	BrowserProvider,
	ConfirmDialogProvider,
	StorageProvider,
	WarpKitCore
} from '../providers/interfaces';
import type { SvelteURLSearchParams } from './SvelteURLSearchParams.svelte';
import type { AuthAdapter } from '../auth/types';

// ============================================================================
// Route Types
// ============================================================================

/**
 * Metadata attached to routes - open interface for consumer extension.
 */
export interface RouteMeta {
	title?: string;
	[key: string]: unknown;
}

/**
 * Layout configuration for a state or route.
 * Note: We use Component<any> for lazy-loaded components because the exact
 * props type is not known at definition time. The consumer is responsible
 * for ensuring the component conforms to LayoutProps.
 */
export interface LayoutConfig {
	/** Unique identifier for this layout - used for caching and transitions */
	id: string;
	/** Lazy loader for the layout component */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	load: () => Promise<{ default: Component<any> }>;
}

/**
 * Base route type used in StateConfig.routes.
 * TypedRoute<TPath, TMeta> is the parameterized version returned by createRoute.
 * Note: We use Component<any> for lazy-loaded components because page components
 * may have various props injected by the framework or none at all.
 */
export interface Route {
	readonly path: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly component: () => Promise<{ default: Component<any> }>;
	readonly layout?: LayoutConfig;
	readonly meta: RouteMeta;
}

/**
 * Route configuration input for createRoute.
 */
export interface RouteConfig<TPath extends string, TMeta extends RouteMeta> {
	path: TPath;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: () => Promise<{ default: Component<any> }>;
	/** Route-level layout override (uses same LayoutConfig as state-level for consistent identity) */
	layout?: LayoutConfig;
	meta?: TMeta;
}

/**
 * Route with type-safe param accessor, returned by createRoute.
 */
export interface TypedRoute<TPath extends string, TMeta extends RouteMeta> {
	readonly path: TPath;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly component: () => Promise<{ default: Component<any> }>;
	readonly layout?: LayoutConfig;
	readonly meta: TMeta;

	/** Extract typed params from the generic params object */
	getParams(allParams: Record<string, string>): ExtractParams<TPath>;

	/** Build path with params (type-safe) */
	buildPath(params: ExtractParams<TPath>): string;
}

/**
 * Extract param names from path pattern.
 * e.g., '/projects/[id]/[...rest?]' => { id: string; rest: string }
 *
 * Note: Optional params ([param?]) are typed as `string` (not `string | undefined`)
 * because the router always provides an empty string '' for unmatched optional segments.
 */
export type ExtractParams<Path extends string> = Path extends `${string}[${infer Param}]${infer Rest}`
	? Param extends `...${infer CatchAll}?`
		? { [K in CatchAll]: string } & ExtractParams<Rest>
		: Param extends `...${infer CatchAll}`
			? { [K in CatchAll]: string } & ExtractParams<Rest>
			: Param extends `${infer Name}?`
				? { [K in Name]: string } & ExtractParams<Rest>
				: { [K in Param]: string } & ExtractParams<Rest>
	: object;

// ============================================================================
// State & Route Configuration Types
// ============================================================================

/**
 * Configuration for a single app state.
 *
 * @typeParam TStateData - Data type associated with application state (for dynamic defaults)
 */
export interface StateConfig<TStateData = unknown> {
	/** Routes available in this state */
	routes: Route[];
	/**
	 * Default path when entering this state without explicit path.
	 * Can be:
	 * - string: Static default path (e.g., '/login')
	 * - function: Dynamic default that receives state data (e.g., (data) => `/${data.projectAlias}/`)
	 * - null: No default (used for states with no routes like 'initializing')
	 */
	default: string | ((data: TStateData) => string) | null;
	/** Layout component for all routes in this state (uses explicit ID for identity) */
	layout?: LayoutConfig;
	/** Path redirects within this state */
	redirects?: Record<string, string>;
}

/**
 * Map of app states to their configurations.
 *
 * @typeParam TAppState - Union of valid app state names
 * @typeParam TStateData - Data type associated with application state (for dynamic defaults)
 */
export type StateRoutes<TAppState extends string, TStateData = unknown> = {
	[K in TAppState]: StateConfig<TStateData>;
};

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Options passed to navigate().
 */
export interface NavigateOptions {
	replace?: boolean;
	state?: Record<string, unknown>;
	scrollPosition?: ScrollPosition | 'preserve';
}

/**
 * Options passed to setState().
 */
export interface SetStateOptions {
	/** Replace current history entry instead of pushing (default: false) */
	replace?: boolean;
	/** Consumer-provided state data to attach to history entry */
	state?: Record<string, unknown>;
}

/**
 * Scroll position coordinates.
 */
export interface ScrollPosition {
	x: number;
	y: number;
}

/**
 * Internal request passed through the navigation pipeline.
 */
export interface NavigationRequest {
	path: string;
	type: 'push' | 'pop' | 'state-change';
	replace: boolean;
	state?: Record<string, unknown>;
	scrollPosition?: ScrollPosition | 'preserve';
	/** Tracks redirect depth to prevent infinite loops (max 10) */
	redirectCount?: number;
	/** For pop navigations: the navigation ID to restore scroll position from */
	restoredNavigationId?: number;
	/** Direction for pop navigations */
	direction?: 'back' | 'forward';
	/** Callback when navigation is blocked during popstate (to restore URL) */
	onBlocked?: () => void;
}

/**
 * Context passed to navigation hooks.
 */
export interface NavigationContext {
	from: ResolvedLocation | null;
	to: ResolvedLocation;
	/** Navigation type - describes why navigation happened */
	type: 'push' | 'pop' | 'state-change';
	/**
	 * Navigation direction for View Transitions support.
	 * Derived from type and options:
	 * - push => 'forward'
	 * - pop back => 'back'
	 * - pop forward => 'forward'
	 * - replace => 'replace'
	 * - state-change => 'forward'
	 */
	direction: 'forward' | 'back' | 'replace';
	navigationId: number;
}

/**
 * Result of a navigation attempt.
 */
export interface NavigationResult {
	success: boolean;
	error?: NavigationError;
	location?: ResolvedLocation;
}

/**
 * A navigation blocker function.
 * Return a string message to show a confirmation dialog, or return true to block silently.
 * Return false/void/undefined to allow navigation.
 *
 * Blockers take no arguments - they check their own component state
 * (e.g., unsaved changes flag) rather than inspecting the navigation target.
 * This keeps blockers simple and component-scoped.
 */
export type NavigationBlocker = () => boolean | string | void;

/**
 * Registration handle returned by registerBlocker.
 */
export interface BlockerRegistration {
	/** Remove this blocker. Navigation will no longer be blocked by this registration. */
	unregister(): void;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Runs in parallel. Return false to abort, string to redirect, void/true to continue.
 */
export type BeforeNavigateHook = (
	context: NavigationContext
) => boolean | string | void | Promise<boolean | string | void>;

/**
 * Runs sequentially. Async hooks are awaited. Use for View Transitions.
 */
export type OnNavigateHook = (context: NavigationContext) => void | Promise<void>;

/**
 * Fire-and-forget. NOT awaited. Use for analytics, logging.
 */
export type AfterNavigateHook = (context: NavigationContext) => void;

// ============================================================================
// State Types
// ============================================================================

/**
 * Snapshot of a matched route location.
 * Used in NavigationContext and PageState.update.
 */
export interface ResolvedLocation {
	/** Full path (pathname + search + hash) */
	path: string;
	pathname: string;
	/** Search string (e.g., '?tab=settings') */
	search: string;
	hash: string;
	params: Record<string, string>;
	route: Route;
	/** App state name (matches TAppState). Named 'appState' to avoid confusion with browser history state. */
	appState: string;
}

/**
 * Result of matching a path against routes.
 * Full discriminated union type including redirect and state mismatch variants.
 */
export type RouteMatch =
	| { route: Route; params: Record<string, string>; state: string; redirect?: never; stateMismatch?: never }
	| { redirect: string; route?: never; params?: never; state?: never; stateMismatch?: never }
	| {
			stateMismatch: true;
			requestedState: string;
			availableInState: string;
			pathname: string;
			route?: never;
			redirect?: never;
	  };

/**
 * State transition record.
 */
export interface StateTransition<TAppState extends string> {
	previous: TAppState;
	current: TAppState;
	id: number;
	timestamp: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes use sequential values (not bitflags).
 * Each navigation failure has exactly one code; they are never combined.
 * Unlike Vue Router's bitflag approach, WarpKit uses simple enums because
 * a navigation can only fail in one way.
 *
 * Errors are categorized as "visual" or "non-visual":
 * - Visual errors (ABORTED, NOT_FOUND, STATE_MISMATCH, LOAD_FAILED,
 *   TOO_MANY_REDIRECTS, RENDER_ERROR) are displayed by RouterView.
 * - Non-visual errors (CANCELLED, BLOCKED) are flow-control outcomes
 *   that don't warrant user-facing error UI.
 */
export enum NavigationErrorCode {
	/**
	 * Another navigation started before this one completed (non-visual).
	 * This is normal during rapid navigation (e.g., user clicks quickly).
	 * Source: Any pipeline phase (via isCancelled check).
	 */
	CANCELLED = 1,

	/**
	 * A beforeNavigate hook explicitly returned false (visual).
	 * The hook author is responsible for user feedback if needed.
	 * Source: Phase 4 (beforeNavigate hooks).
	 */
	ABORTED = 2,

	/**
	 * User cancelled navigation via blocker/confirm dialog (non-visual).
	 * The user chose to stay on the current page. If triggered by popstate,
	 * the browser URL is restored to the current page.
	 * Source: Phase 3 (blocker check).
	 */
	BLOCKED = 3,

	/**
	 * No route matches the requested path in the current app state (visual).
	 * This is a true 404 -- the path doesn't match any route pattern.
	 * Source: Phase 2 (route matching).
	 */
	NOT_FOUND = 4,

	/**
	 * Route exists in a different app state but not the current one (visual).
	 * Example: navigating to '/dashboard' while in 'unauthenticated' state
	 * when '/dashboard' only exists in 'authenticated' state.
	 * Note: Invalid state names are caught at definition time, not runtime.
	 * Source: Phase 2 (route matching with state check).
	 */
	STATE_MISMATCH = 5,

	/**
	 * Component or layout lazy import failed (visual, retryable).
	 * Typically a network error, missing chunk, or import resolution failure.
	 * The global onError handler is called for this error.
	 * Source: Phase 6 (component/layout loading).
	 */
	LOAD_FAILED = 6,

	/**
	 * Exceeded maximum redirect count of 10 (visual).
	 * Indicates a redirect loop in route configuration or beforeNavigate hooks.
	 * This is a developer error that needs fixing in the route config.
	 * Source: Phase 2/4 (redirect processing).
	 */
	TOO_MANY_REDIRECTS = 7,

	/**
	 * Component loaded and rendered but threw a runtime error (visual, retryable).
	 * Caught by svelte:boundary in RouterView. Unlike other errors, this does NOT
	 * set PageState.error -- it lives entirely within svelte:boundary's {#snippet failed}.
	 * The error is converted to NavigationError format so the consumer's error snippet
	 * handles all errors uniformly.
	 * Source: Post-pipeline (svelte:boundary in RouterView).
	 */
	RENDER_ERROR = 8
}

/**
 * Navigation error with code, message, and optional cause.
 */
export interface NavigationError {
	/** Which error occurred */
	code: NavigationErrorCode;
	/** Human-readable error description */
	message: string;
	/** Original error if wrapping a caught exception (e.g., import() failure, component throw) */
	cause?: Error;
	/** The path that was being navigated to when the error occurred */
	requestedPath: string;
}

/**
 * Context provided to the global onError handler.
 * Includes navigation metadata for error tracking and diagnostics.
 */
export interface NavigationErrorContext {
	/** Location the user was navigating from (null on initial navigation) */
	from: ResolvedLocation | null;
	/** Location the user was navigating to (null if matching failed before resolution) */
	to: ResolvedLocation | null;
	/** Uses same type values as NavigationContext.type for consistency */
	type: 'push' | 'pop' | 'state-change';
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for createWarpKit.
 *
 * @typeParam TAppState - Union of valid app state names
 * @typeParam TStateData - Data type associated with application state (for dynamic defaults)
 */
export interface WarpKitConfig<TAppState extends string, TStateData = unknown> {
	routes: StateRoutes<TAppState, TStateData>;
	/**
	 * Initial app state. Required if authAdapter is not provided.
	 * When authAdapter is provided, this is used as fallback if initialize() fails.
	 */
	initialState: TAppState;
	providers?: ProviderRegistry;
	/** Error handler with full navigation context */
	onError?: (error: NavigationError, context: NavigationErrorContext) => void;
	/**
	 * Auth adapter for handling authentication state.
	 *
	 * When provided, WarpKit will:
	 * 1. Call authAdapter.initialize() during start()
	 * 2. Wait for initialization before becoming "ready"
	 * 3. Subscribe to auth state changes via onAuthStateChanged
	 *
	 * This removes the need for manual `{#if ready}` wrappers.
	 */
	authAdapter?: AuthAdapter<TAppState, TStateData>;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Compiled route used internally by RouteMatcher.
 * RouteMatcher adds a transient `definitionOrder` field during construction
 * for sorting; it is not part of this interface because it is only needed
 * during the initial sort, not at match time.
 */
export interface CompiledRoute {
	route: Route;
	pattern: RegExp;
	paramNames: string[];
	state: string;
	score: number; // Higher = more specific. See Route Matching > Specificity Scoring.
}

/**
 * Navigator constructor configuration.
 */
export interface NavigatorConfig {
	matcher: RouteMatcher;
	stateMachine: StateMachine<string>;
	pageState: PageState;
	lifecycle: NavigationLifecycle;
	layoutManager: LayoutManager;
	providers: ResolvedProviders;
	/** Blocker check delegated from WarpKit */
	checkBlockers: () => Promise<{ proceed: boolean }>;
	/** Callback to set loaded components on WarpKit's $state fields */
	setLoadedComponents: (component: Component | null, layout: Component | null) => void;
	/** Global error handler delegated from WarpKit config.onError */
	onError?: (error: NavigationError, context: NavigationErrorContext) => void;
	/** Callback to fire navigation complete events for WarpKitCore.onNavigationComplete */
	fireNavigationComplete?: (context: NavigationContext) => void;
}

// ============================================================================
// Component Types
// ============================================================================

/**
 * Props that all layout components receive.
 */
export interface LayoutProps {
	children: Snippet;
	route: Route;
}

/**
 * Type for layout components - use for type checking.
 */
export type LayoutComponent = Component<LayoutProps>;

// ============================================================================
// Forward Declarations (implemented in other modules)
// ============================================================================

// These interfaces are defined here for type references in NavigatorConfig.
// Actual implementations are in their respective modules.

/** Forward declaration for RouteMatcher */
export interface RouteMatcher {
	match(pathname: string, state: string): RouteMatch | null;
	getStateConfig(state: string): StateConfig<unknown> | undefined;
	getStates(): string[];
	tryExpandPath(pathname: string, state: string, stateData: Record<string, unknown> | undefined): string | null;
}

/** Forward declaration for StateMachine (covariant - uses string for flexibility with Navigator) */
export interface StateMachine<TAppState extends string = string> {
	getState(): TAppState;
	getStateId(): number;
	setState(state: TAppState): StateTransition<TAppState>;
}

/**
 * Read-only StateMachine interface for Navigator.
 * Navigator only reads state values, never writes TAppState-specific values back,
 * so it can accept any StateMachine<TAppState> safely.
 */
export interface StateMachineReader {
	getState(): string;
	getStateId(): number;
}

/** Forward declaration for PageState */
export interface PageState {
	path: string;
	pathname: string;
	search: SvelteURLSearchParams;
	hash: string;
	params: Record<string, string>;
	route: Route | null;
	error: NavigationError | null;
	isNavigating: boolean;
	appState: string;
	update(location: ResolvedLocation): void;
	setNavigating(isNavigating: boolean): void;
	setError(error: NavigationError | null): void;
	clearError(): void;
}

/** Forward declaration for NavigationLifecycle */
export interface NavigationLifecycle {
	registerBeforeNavigate(hook: BeforeNavigateHook): () => void;
	registerOnNavigate(hook: OnNavigateHook): () => void;
	registerAfterNavigate(hook: AfterNavigateHook): () => void;
	runBeforeNavigate(context: NavigationContext): Promise<{ proceed: boolean; redirect?: string }>;
	runOnNavigate(context: NavigationContext): Promise<void>;
	runAfterNavigate(context: NavigationContext): void;
}

/** Forward declaration for LayoutManager */
export interface LayoutManager {
	resolveLayout(route: Route, stateConfig?: StateConfig): Promise<Component | null>;
	willLayoutChange(route: Route, stateConfig?: StateConfig): boolean;
	getCurrentLayoutId(): string | null;
	clearCache(): void;
}

/** Forward declaration for ProviderRegistry */
export interface ProviderRegistry {
	browser?: BrowserProvider;
	confirmDialog?: ConfirmDialogProvider;
	storage?: StorageProvider;
	[key: string]: Provider | undefined;
}

/** Forward declaration for ResolvedProviders */
export interface ResolvedProviders {
	browser: BrowserProvider;
	confirmDialog: ConfirmDialogProvider;
	storage: StorageProvider;
	[key: string]: Provider;
}

// Re-export provider types from interfaces.ts (single source of truth)
export type {
	Provider,
	BrowserProvider,
	ConfirmDialogProvider,
	StorageProvider,
	WarpKitCore
} from '../providers/interfaces';

// Re-export auth types
export type { AuthAdapter, AuthAdapterContext, AuthInitResult } from '../auth/types';
