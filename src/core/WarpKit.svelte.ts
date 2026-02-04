/**
 * WarpKit - Main Facade Class
 *
 * Orchestrates all WarpKit components: routing, state, providers, navigation.
 * Uses Svelte 5 $state for reactive component/layout fields.
 *
 * Implements WarpKitCore interface for provider access to read-only state.
 */

import type { Component } from 'svelte';
import type {
	WarpKitConfig,
	StateRoutes,
	NavigateOptions,
	SetStateOptions,
	NavigationResult,
	NavigationContext,
	NavigationError,
	NavigationErrorContext,
	ResolvedLocation,
	RouteMatch,
	BeforeNavigateHook,
	AfterNavigateHook,
	NavigationBlocker,
	BlockerRegistration,
	AuthAdapter
} from './types.js';
import type {
	WarpKitCore,
	Provider,
	ResolvedProviders,
	ProviderRegistry,
	HistoryState
} from '../providers/interfaces.js';
import { EventEmitter } from '../events/EventEmitter.js';
import type { EventEmitterAPI, WarpKitEventRegistry } from '../events/types.js';
import { PageState } from './PageState.svelte.js';
import { StateMachine } from './StateMachine.js';
import { RouteMatcher } from './RouteMatcher.js';
import { NavigationLifecycle } from './NavigationLifecycle.js';
import { LayoutManager } from './LayoutManager.js';
import { Navigator } from './Navigator.js';
import { DefaultBrowserProvider } from '../providers/browser/BrowserProvider.js';
import { DefaultConfirmDialogProvider } from '../providers/confirm/ConfirmDialogProvider.js';
import { DefaultStorageProvider } from '../providers/storage/StorageProvider.js';
import { errorStore } from '../errors/error-store.js';
import { setupGlobalErrorHandlers } from '../errors/global-handlers.js';

/**
 * Queued state change request (for pre-start calls).
 */
interface QueuedStateChange<TAppState extends string, TStateData> {
	state: TAppState;
	data?: TStateData;
	path?: string;
	options?: SetStateOptions;
}

/**
 * Main WarpKit facade class.
 * Orchestrates routing, state management, navigation, and providers.
 *
 * @typeParam TAppState - Union of valid app state names (e.g., 'authenticated' | 'unauthenticated')
 * @typeParam TStateData - Data type associated with application state (for dynamic defaults)
 */
export class WarpKit<TAppState extends string, TStateData = unknown> implements WarpKitCore {
	// ============================================================================
	// Public State ($state fields for Svelte 5 reactivity)
	// ============================================================================

	/** Currently loaded route component (null during navigation or error) */
	loadedComponent = $state<Component | null>(null);

	/** Currently loaded layout component (null if route has no layout) */
	loadedLayout = $state<Component | null>(null);

	/**
	 * Whether the app is ready to render.
	 * When an authAdapter is provided, this is false until auth initialization completes.
	 * When no authAdapter is provided, this is true immediately after start().
	 */
	ready = $state(false);

	/** Event emitter for cross-component communication */
	public readonly events: EventEmitterAPI<WarpKitEventRegistry> = new EventEmitter<WarpKitEventRegistry>();

	// ============================================================================
	// Private State
	// ============================================================================

	private readonly pageState: PageState;
	private readonly stateMachine: StateMachine<TAppState>;
	private readonly matcher: RouteMatcher;
	private readonly lifecycle: NavigationLifecycle;
	private readonly layoutManager: LayoutManager;
	private navigator!: Navigator; // Initialized in constructor after providers resolve
	private providers!: ResolvedProviders;

	/** Navigation blockers (unsaved changes, etc.) */
	private readonly blockers = new Set<NavigationBlocker>();

	/** Listeners for search param changes via updateSearch() */
	private readonly searchChangeListeners = new Set<(params: Record<string, string>, path: string) => void>();

	/** Listeners for navigation completion (for WarpKitCore.onNavigationComplete) */
	private readonly navigationCompleteListeners = new Set<(context: NavigationContext) => void>();

	/** Counter for search-only history entries (negative to avoid collision with Navigator) */
	private searchUpdateCounter = 0;

	/** True after start() has been called */
	private started = false;

	/** Queued state changes from pre-start setAppState calls */
	private preStartQueue: QueuedStateChange<TAppState, TStateData>[] = [];

	/** Current state data (passed to function defaults) */
	private stateData: TStateData | undefined;

	/**
	 * Cached resolved default paths.
	 * - Static string defaults are cached immediately on construction.
	 * - Function defaults are cached after first resolution with state data.
	 * - Cache key is the state name.
	 * - Cache is invalidated when state data changes.
	 */
	private readonly defaultPathCache = new Map<TAppState, string | null>();

	/** Tracks the last state data used to resolve defaults (for cache invalidation) */
	private lastCachedStateData: TStateData | undefined;

	/** Global error handler from config */
	private readonly onError?: (error: NavigationError, context: NavigationErrorContext) => void;

	/** Popstate unsubscribe function */
	private popstateUnsubscribe?: () => void;

	/** beforeunload handler reference */
	private beforeUnloadHandler?: (e: BeforeUnloadEvent) => void;

	/** Global error handlers cleanup function */
	private globalErrorHandlersCleanup?: () => void;

	/** Routes configuration (stored for retry functionality and default resolution) */
	private readonly routes: StateRoutes<TAppState, TStateData>;

	/** Auth adapter for handling authentication state */
	private readonly authAdapter?: AuthAdapter<TAppState, TStateData>;

	/** Auth state change unsubscribe function */
	private authUnsubscribe?: () => void;

	// ============================================================================
	// Constructor
	// ============================================================================

	/**
	 * Create a new WarpKit instance.
	 * Call start() after construction to initialize providers and perform initial navigation.
	 *
	 * @param config - WarpKit configuration
	 */
	public constructor(config: WarpKitConfig<TAppState, TStateData>) {
		this.routes = config.routes;
		this.authAdapter = config.authAdapter;

		// Use errorStore by default if no onError handler is provided
		this.onError =
			config.onError ??
			((navError) => {
				// Convert NavigationError to Error for the error store
				const error = navError.cause ?? new Error(navError.message);
				errorStore.setError(error, {
					source: 'router',
					context: {
						code: navError.code,
						requestedPath: navError.requestedPath
					}
				});
			});

		// Initialize core components
		this.pageState = new PageState();
		this.stateMachine = new StateMachine(config.initialState);
		// RouteMatcher stores config but doesn't call function defaults - WarpKit handles that
		this.matcher = new RouteMatcher(config.routes as StateRoutes<string, unknown>);
		this.lifecycle = new NavigationLifecycle();
		this.layoutManager = new LayoutManager();

		// Pre-cache static defaults (strings are immutable, never need rebuilding)
		for (const [state, stateConfig] of Object.entries(config.routes) as [
			TAppState,
			(typeof config.routes)[TAppState]
		][]) {
			if (typeof stateConfig.default === 'string') {
				this.defaultPathCache.set(state, stateConfig.default);
			} else if (stateConfig.default === null) {
				this.defaultPathCache.set(state, null);
			}
			// Function defaults are not cached until state data is available
		}

		// Resolve providers (apply defaults)
		this.providers = this.resolveProviders(config.providers ?? {});

		// Initialize Navigator with all dependencies
		this.navigator = new Navigator({
			matcher: this.matcher,
			stateMachine: this.stateMachine,
			pageState: this.pageState,
			lifecycle: this.lifecycle,
			layoutManager: this.layoutManager,
			providers: this.providers,
			checkBlockers: () => this.checkBlockers(),
			setLoadedComponents: (component, layout) => {
				this.loadedComponent = component;
				this.loadedLayout = layout;
			},
			onError: this.onError,
			fireNavigationComplete: (context) => this.fireNavigationComplete(context),
			getResolvedDefault: (state) => this.getResolvedDefault(state as TAppState)
		});
	}

	// ============================================================================
	// Public Properties (WarpKitCore implementation)
	// ============================================================================

	/**
	 * Reactive page state (route, params, search, error, isNavigating).
	 * Components can derive from these properties for automatic updates.
	 */
	public get page(): PageState {
		return this.pageState;
	}

	/**
	 * Current app state name.
	 */
	public getState(): TAppState {
		return this.stateMachine.getState();
	}

	/**
	 * Current state ID (increments on every state change).
	 * Used for cancellation detection.
	 */
	public getStateId(): number {
		return this.stateMachine.getStateId();
	}

	// ============================================================================
	// Lifecycle
	// ============================================================================

	/**
	 * Initialize WarpKit: start providers and perform initial navigation.
	 * Must be called once after construction.
	 *
	 * @throws If called more than once
	 */
	public async start(): Promise<void> {
		if (this.started) {
			throw new Error('[WarpKit] start() has already been called');
		}
		this.started = true;

		// Install global error handlers FIRST (before anything else can fail)
		this.globalErrorHandlersCleanup = setupGlobalErrorHandlers();

		// Initialize providers
		await this.initializeProviders();

		// Set up popstate listener
		this.popstateUnsubscribe = this.providers.browser.onPopState((state, direction) => {
			void this.handlePopState(state, direction);
		});

		// Set up beforeunload for blockers
		this.setupBeforeUnload();

		// Initialize auth adapter if provided
		if (this.authAdapter) {
			try {
				const result = await this.authAdapter.initialize({ events: this.events });

				// Update state and state data from auth initialization
				if (result.stateData !== undefined) {
					this.updateStateData(result.stateData);
				}
				this.stateMachine.setState(result.state);

				// Subscribe to subsequent auth state changes
				this.authUnsubscribe = this.authAdapter.onAuthStateChanged((changeResult) => {
					if (changeResult) {
						void this.handleAuthStateChange(changeResult);
					}
				});
			} catch (error) {
				// Auth initialization failed - fall back to initial state from config
				console.error('[WarpKit] Auth adapter initialization failed:', error);
			}
		}

		// Process queued state changes (these override auth adapter state)
		for (const { state, data, path, options } of this.preStartQueue) {
			// Update state data if provided
			if (data !== undefined) {
				this.updateStateData(data);
			}
			this.stateMachine.setState(state);
			// Resolve path: explicit path > resolved default from routes
			const resolvedPath = path ?? this.getResolvedDefault(state);
			await this.navigator.navigateAfterStateChange(state, resolvedPath ?? undefined, options);
		}
		this.preStartQueue = [];

		// Perform initial navigation based on current URL
		const location = this.providers.browser.getLocation();
		const initialPath = location.pathname + location.search + location.hash;
		await this.navigator.navigate(initialPath, { replace: true });

		// Mark as ready after initial navigation
		this.ready = true;
	}

	/**
	 * Handle auth state changes after initialization.
	 */
	private async handleAuthStateChange(result: { state: TAppState; stateData?: TStateData }): Promise<void> {
		// Update state data if provided
		if (result.stateData !== undefined) {
			this.updateStateData(result.stateData);
		}

		// Transition app state if different
		if (this.stateMachine.getState() !== result.state) {
			await this.setAppState(result.state, result.stateData);
		}
	}

	/**
	 * Clean up WarpKit: remove listeners, destroy providers.
	 * Call when unmounting the application.
	 */
	public destroy(): void {
		// Remove popstate listener
		this.popstateUnsubscribe?.();

		// Remove beforeunload listener
		if (this.beforeUnloadHandler && typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', this.beforeUnloadHandler);
		}

		// Remove global error handlers
		this.globalErrorHandlersCleanup?.();

		// Unsubscribe from auth state changes
		this.authUnsubscribe?.();

		// Destroy providers
		for (const provider of Object.values(this.providers)) {
			provider.destroy?.();
		}

		// Clear internal state
		this.blockers.clear();
		this.searchChangeListeners.clear();
		this.navigationCompleteListeners.clear();
	}

	// ============================================================================
	// Core Navigation
	// ============================================================================

	/**
	 * Navigate to a path.
	 *
	 * Supports automatic path expansion: if `/incidents` doesn't match directly
	 * but `/[projectAlias]/incidents` exists and stateData has `projectAlias`,
	 * automatically expands to `/ip/incidents`.
	 *
	 * @param path - Target path (e.g., '/dashboard' or '/incidents')
	 * @param options - Navigation options (replace, state, scrollPosition)
	 * @returns Navigation result
	 */
	public async navigate(path: string, options?: NavigateOptions): Promise<NavigationResult> {
		// Resolve relative paths against current location using standard URL resolution
		let resolvedPath = path;
		if (!path.startsWith('/')) {
			const base = new URL(this.page.pathname, 'http://x');
			const resolved = new URL(path, base);
			resolvedPath = resolved.pathname;
		}

		// Try to expand path if it doesn't match directly
		const expandedPath = this.tryExpandPath(resolvedPath);
		return this.navigator.navigate(expandedPath, options);
	}

	/**
	 * Try to expand a path using state data.
	 *
	 * If `/incidents` doesn't match but `/[projectAlias]/incidents` exists
	 * and stateData.projectAlias is 'ip', returns '/ip/incidents'.
	 *
	 * @param path - The path to potentially expand
	 * @returns The expanded path, or the original path if no expansion needed/possible
	 */
	private tryExpandPath(path: string): string {
		// Parse pathname from full path (strip search/hash)
		const hashIndex = path.indexOf('#');
		const searchIndex = path.indexOf('?');
		let pathname = path;
		let suffix = '';

		if (hashIndex !== -1) {
			suffix = path.slice(hashIndex);
			pathname = path.slice(0, hashIndex);
		}
		if (searchIndex !== -1 && (hashIndex === -1 || searchIndex < hashIndex)) {
			const endIndex = hashIndex !== -1 ? hashIndex : path.length;
			suffix = path.slice(searchIndex);
			pathname = path.slice(0, searchIndex);
		}

		// Try expansion FIRST - this handles paths like /incidents -> /ip/incidents
		// We check expansion before direct match because param routes like /[projectAlias]
		// would otherwise greedily match /incidents (treating "incidents" as a project alias)
		const expanded = this.matcher.tryExpandPath(
			pathname,
			this.stateMachine.getState(),
			this.stateData as Record<string, unknown> | undefined
		);

		if (expanded) {
			return expanded + suffix;
		}

		// No expansion needed/possible - return original path
		return path;
	}

	/**
	 * Change application state and navigate to the state's default path.
	 *
	 * If called before start(), the state change is queued.
	 *
	 * @param state - New application state
	 * @param dataOrPath - State data (for dynamic defaults) or target path string
	 * @param options - Navigation options
	 */
	public async setAppState(
		state: TAppState,
		dataOrPath?: TStateData | string,
		options?: SetStateOptions
	): Promise<NavigationResult> {
		// Determine if second arg is data or path
		const isPath = typeof dataOrPath === 'string';
		const data = isPath ? undefined : dataOrPath;
		const explicitPath = isPath ? dataOrPath : undefined;

		// Update state data if provided
		if (data !== undefined) {
			this.updateStateData(data);
		}

		// Queue if called before start()
		if (!this.started) {
			this.preStartQueue.push({ state, data, path: explicitPath, options });
			return { success: true };
		}

		// Update state machine
		this.stateMachine.setState(state);

		// Resolve path: explicit path > resolved default from routes
		const resolvedPath = explicitPath ?? this.getResolvedDefault(state);

		// Navigate after state change
		return this.navigator.navigateAfterStateChange(state, resolvedPath ?? undefined, options);
	}

	/**
	 * Change application state (interface-compatible version).
	 *
	 * @param state - New application state
	 * @param options - Set state options
	 */
	public async setState(state: TAppState, options?: SetStateOptions): Promise<void> {
		await this.setAppState(state, undefined, options);
	}

	/**
	 * Go back in browser history.
	 */
	public back(): void {
		this.providers.browser.go(-1);
	}

	/**
	 * Go forward in browser history.
	 */
	public forward(): void {
		this.providers.browser.go(1);
	}

	/**
	 * Go to a specific point in browser history.
	 * @param delta - Number of entries to move (negative = back, positive = forward)
	 */
	public go(delta: number): void {
		this.providers.browser.go(delta);
	}

	/**
	 * Retry a failed navigation (e.g., after LOAD_FAILED error).
	 * Re-navigates to the current path with replace semantics.
	 */
	public async retry(): Promise<NavigationResult> {
		return this.navigator.navigate(this.pageState.path, { replace: true });
	}

	// ============================================================================
	// Search Params
	// ============================================================================

	/**
	 * Update search params without triggering full navigation.
	 * Only updates URL and PageState.search - does NOT run hooks or set isNavigating.
	 *
	 * Use for: filters, tabs, pagination, sorting
	 * Don't use for: actual page changes (use navigate() instead)
	 *
	 * @param params - Params to update (null value removes the param)
	 * @param options - Options (replace: false to push new history entry)
	 */
	public updateSearch(params: Record<string, string | null>, options?: { replace?: boolean }): void {
		const newSearch = new URLSearchParams(this.pageState.search.toString());

		for (const [key, value] of Object.entries(params)) {
			if (value === null) {
				newSearch.delete(key);
			} else {
				newSearch.set(key, value);
			}
		}

		// Build new path
		const searchStr = newSearch.toString();
		const newPath = this.pageState.pathname + (searchStr ? '?' + searchStr : '') + this.pageState.hash;

		// Update PageState (reactive)
		this.pageState.search.replaceAll(searchStr ? '?' + searchStr : '');
		this.pageState.path = newPath;

		// Update browser URL
		const currentState = this.providers.browser.getHistoryState();
		if (!currentState) {
			// Edge case: non-WarpKit history entry
			return;
		}

		// Default: replace (correct for tabs/filters/pagination)
		const shouldReplace = options?.replace ?? true;
		if (shouldReplace) {
			this.providers.browser.replace(newPath, currentState);
		} else {
			// Create new history entry with unique negative ID
			const newHistoryState: HistoryState = {
				...currentState,
				id: this.nextSearchUpdateId()
			};
			this.providers.browser.push(newPath, newHistoryState);
		}

		// Notify search change listeners
		const paramsObj = this.getSearchParams();
		for (const listener of this.searchChangeListeners) {
			listener(paramsObj, newPath);
		}
	}

	/**
	 * Get a single search param by key.
	 * @param key - The search param key
	 * @returns The value or null if not present
	 */
	public getSearchParam(key: string): string | null {
		return this.pageState.search.get(key);
	}

	/**
	 * Get all search params as a plain object.
	 * Multi-value params use the last value.
	 */
	public getSearchParams(): Record<string, string> {
		const result: Record<string, string> = {};
		this.pageState.search.forEach((value, key) => {
			result[key] = value;
		});
		return result;
	}

	/**
	 * Subscribe to search param changes via updateSearch().
	 * Does NOT fire on full navigations (use afterNavigate for that).
	 *
	 * @param callback - Called when search params change
	 * @returns Unsubscribe function
	 */
	public onSearchChange(callback: (params: Record<string, string>, path: string) => void): () => void {
		this.searchChangeListeners.add(callback);
		return () => this.searchChangeListeners.delete(callback);
	}

	// ============================================================================
	// Deep Links
	// ============================================================================

	/**
	 * Get and clear the intended path (for deep link support).
	 * Returns the path the user was trying to access before auth redirect.
	 */
	public getIntendedPath(): string | null {
		return this.providers.storage.popIntendedPath();
	}

	/**
	 * Save the intended path (for deep link support).
	 * Call before redirecting to login when user is unauthenticated.
	 *
	 * @param path - The path to save
	 */
	public setIntendedPath(path: string): void {
		this.providers.storage.saveIntendedPath(path);
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Match a path against routes without navigating.
	 * Useful for checking if a path would match before navigating.
	 *
	 * @param path - The path to match
	 * @returns Match result or null if no match
	 */
	public matchRoute(path: string): RouteMatch | null {
		// Parse pathname from full path
		const hashIndex = path.indexOf('#');
		const searchIndex = path.indexOf('?');
		let pathname = path;
		if (hashIndex !== -1) pathname = path.slice(0, hashIndex);
		if (searchIndex !== -1 && (hashIndex === -1 || searchIndex < hashIndex)) {
			pathname = path.slice(0, searchIndex);
		}

		return this.matcher.match(pathname, this.stateMachine.getState());
	}

	/**
	 * Build a URL using the browser provider's strategy (base path, hash mode, etc.).
	 *
	 * @param path - The internal path
	 * @returns The browser URL
	 */
	public buildUrl(path: string): string {
		return this.providers.browser.buildUrl(path);
	}

	/**
	 * Get a provider by ID.
	 *
	 * @param id - The provider ID
	 * @returns The provider or undefined if not found
	 */
	public getProvider<T extends Provider>(id: string): T | undefined {
		return this.providers[id] as T | undefined;
	}

	/**
	 * Get all valid app state names.
	 */
	public getValidStates(): TAppState[] {
		return this.matcher.getStates() as TAppState[];
	}

	// ============================================================================
	// Lifecycle Hooks
	// ============================================================================

	/**
	 * Register a beforeNavigate hook.
	 * Runs in parallel. Return false to abort, string to redirect, void to continue.
	 *
	 * @param callback - The hook function
	 * @returns Unsubscribe function
	 */
	public beforeNavigate(callback: BeforeNavigateHook): () => void {
		return this.lifecycle.registerBeforeNavigate(callback);
	}

	/**
	 * Register an afterNavigate hook.
	 * Fire-and-forget. Used for analytics, logging.
	 *
	 * @param callback - The hook function
	 * @returns Unsubscribe function
	 */
	public afterNavigate(callback: AfterNavigateHook): () => void {
		return this.lifecycle.registerAfterNavigate(callback);
	}

	/**
	 * Register a navigation blocker.
	 * Blockers are checked before navigation. Return a string to show confirm dialog,
	 * true to block silently, or false/void to allow.
	 *
	 * @param fn - The blocker function
	 * @returns Registration with unregister() method
	 */
	public registerBlocker(fn: NavigationBlocker): BlockerRegistration {
		this.blockers.add(fn);
		return {
			unregister: () => this.blockers.delete(fn)
		};
	}

	/**
	 * Subscribe to navigation completion events (fires after Phase 9).
	 * This is for provider observation - NOT a lifecycle hook.
	 *
	 * @param callback - Called after each successful navigation
	 * @returns Unsubscribe function
	 */
	public onNavigationComplete(callback: (context: NavigationContext) => void): () => void {
		this.navigationCompleteListeners.add(callback);
		return () => this.navigationCompleteListeners.delete(callback);
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	/**
	 * Resolve providers with defaults.
	 */
	private resolveProviders(registry: ProviderRegistry): ResolvedProviders {
		return {
			browser: registry.browser ?? new DefaultBrowserProvider(),
			confirmDialog: registry.confirmDialog ?? new DefaultConfirmDialogProvider(),
			storage: registry.storage ?? new DefaultStorageProvider(),
			...registry
		};
	}

	/**
	 * Initialize all providers in dependency order.
	 */
	private async initializeProviders(): Promise<void> {
		// Build dependency graph
		const providers = Object.values(this.providers);
		const initialized = new Set<string>();
		const warpkitCore: WarpKitCore = this;

		const initializeProvider = async (provider: Provider): Promise<void> => {
			if (initialized.has(provider.id)) return;

			// Initialize dependencies first
			if (provider.dependsOn) {
				for (const depId of provider.dependsOn) {
					const dep = this.providers[depId];
					if (dep) {
						await initializeProvider(dep);
					}
				}
			}

			// Initialize this provider
			await provider.initialize?.(warpkitCore);
			initialized.add(provider.id);
		};

		// Initialize all providers
		await Promise.all(providers.map((p) => initializeProvider(p)));
	}

	/**
	 * Check all blockers and show confirm dialog if needed.
	 * @returns Object with proceed: boolean
	 */
	private async checkBlockers(): Promise<{ proceed: boolean }> {
		for (const blocker of this.blockers) {
			const result = blocker();
			if (result === true) {
				// Block silently
				return { proceed: false };
			}
			if (typeof result === 'string') {
				// Show confirm dialog
				const confirmed = await this.providers.confirmDialog.confirm(result);
				if (!confirmed) {
					return { proceed: false };
				}
			}
		}
		return { proceed: true };
	}

	/**
	 * Handle popstate (back/forward) navigation.
	 */
	private async handlePopState(state: HistoryState | null, direction: 'back' | 'forward'): Promise<void> {
		await this.navigator.handlePopState(state, direction, () => {
			// Restore URL if navigation was blocked
			this.providers.browser.go(direction === 'back' ? 1 : -1);
		});
	}

	/**
	 * Set up beforeunload handler for blockers.
	 */
	private setupBeforeUnload(): void {
		if (typeof window === 'undefined') return;

		this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
			for (const blocker of this.blockers) {
				const result = blocker();
				if (result === true || typeof result === 'string') {
					// Standard way to show browser's built-in dialog
					e.preventDefault();
					return;
				}
			}
		};

		window.addEventListener('beforeunload', this.beforeUnloadHandler);
	}

	/**
	 * Fire navigation complete event to all listeners.
	 */
	private fireNavigationComplete(context: NavigationContext): void {
		for (const listener of this.navigationCompleteListeners) {
			try {
				listener(context);
			} catch (error) {
				console.error('[WarpKit] Navigation complete listener threw:', error);
			}
		}
	}

	/**
	 * Generate unique ID for search-only history entries.
	 * Uses negative numbers to avoid collision with Navigator's positive IDs.
	 */
	private nextSearchUpdateId(): number {
		return --this.searchUpdateCounter;
	}

	/**
	 * Update state data and invalidate function default caches if data changed.
	 */
	private updateStateData(data: TStateData): void {
		this.stateData = data;

		// Invalidate function default caches if data changed
		// We compare by reference - if the consumer passes new data, we recache
		if (this.lastCachedStateData !== data) {
			// Clear cached function defaults (but not static ones)
			for (const [state, stateConfig] of Object.entries(this.routes) as [
				TAppState,
				(typeof this.routes)[TAppState]
			][]) {
				if (typeof stateConfig.default === 'function') {
					this.defaultPathCache.delete(state);
				}
			}
			this.lastCachedStateData = data;
		}
	}

	/**
	 * Get resolved default path for a state.
	 * Handles caching: static defaults are pre-cached, function defaults are cached after resolution.
	 */
	private getResolvedDefault(state: TAppState): string | null {
		// Check cache first
		if (this.defaultPathCache.has(state)) {
			return this.defaultPathCache.get(state) ?? null;
		}

		// Not in cache - must be a function default (static ones were pre-cached)
		const stateConfig = this.routes[state];
		if (!stateConfig) {
			return null;
		}

		const defaultValue = stateConfig.default;
		if (typeof defaultValue === 'function') {
			// Resolve function default with current state data
			if (this.stateData === undefined) {
				// No state data yet - can't resolve function default
				return null;
			}
			const resolved = defaultValue(this.stateData);
			// Cache the resolved value
			this.defaultPathCache.set(state, resolved);
			return resolved;
		}

		// Shouldn't reach here (static defaults are pre-cached)
		return defaultValue;
	}

	/**
	 * Get current state data.
	 */
	public getStateData(): TStateData | undefined {
		return this.stateData;
	}
}

/**
 * Factory function for creating WarpKit instances.
 * Preferred over direct constructor usage.
 *
 * @param config - WarpKit configuration
 * @returns New WarpKit instance
 */
export function createWarpKit<TAppState extends string, TStateData = unknown>(
	config: WarpKitConfig<TAppState, TStateData>
): WarpKit<TAppState, TStateData> {
	return new WarpKit(config);
}
