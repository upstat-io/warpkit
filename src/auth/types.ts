/**
 * Auth Adapter Types
 *
 * WarpKit provides an auth adapter interface that consumers implement.
 * The adapter handles async initialization and auth state changes.
 *
 * This keeps auth concerns in the consumer app while WarpKit handles
 * the coordination of auth state → app state transitions and ready state.
 */

import type { EventEmitterAPI, WarpKitEventRegistry } from '../events/types';

/**
 * Context passed to auth adapter during initialization.
 */
export interface AuthAdapterContext {
	/** WarpKit's event emitter for auth events */
	events: EventEmitterAPI<WarpKitEventRegistry>;
}

/**
 * Result of auth adapter initialization.
 * Tells WarpKit the initial app state and any associated data.
 *
 * @typeParam TAppState - Union of valid app state names
 * @typeParam TStateData - Data associated with app state (for dynamic defaults)
 */
export interface AuthInitResult<TAppState extends string, TStateData = unknown> {
	/** The initial app state based on auth check */
	state: TAppState;
	/** Optional state data (e.g., projectAlias for dynamic route defaults) */
	stateData?: TStateData;
}

/**
 * Auth adapter interface for WarpKit.
 *
 * Consumers implement this interface to integrate their auth provider
 * (Firebase, Auth0, custom, etc.) with WarpKit's state management.
 *
 * The adapter is responsible for:
 * 1. Checking initial auth state (from localStorage, cookies, etc.)
 * 2. Fetching any required user data before the app becomes "ready"
 * 3. Notifying WarpKit of subsequent auth state changes
 *
 * @typeParam TAppState - Union of valid app state names
 * @typeParam TStateData - Data associated with app state (for dynamic defaults)
 *
 * @example
 * ```typescript
 * class MyAuthAdapter implements AuthAdapter<'authenticated' | 'unauthenticated', { projectAlias: string }> {
 *   async initialize(context) {
 *     const session = localStorage.getItem('session');
 *     if (!session) {
 *       return { state: 'unauthenticated' };
 *     }
 *
 *     // Fetch user data before app is ready
 *     const userData = await fetchUserData(session);
 *     setUserStore(userData);
 *
 *     return {
 *       state: 'authenticated',
 *       stateData: { projectAlias: userData.projectAlias }
 *     };
 *   }
 *
 *   onAuthStateChanged(callback) {
 *     // Subscribe to auth changes...
 *     return () => { };
 *   }
 * }
 * ```
 */
export interface AuthAdapter<TAppState extends string, TStateData = unknown> {
	/**
	 * Initialize auth state.
	 *
	 * Called once during WarpKit.start() before the app becomes "ready".
	 * This is where you should:
	 * - Check for existing session (localStorage, cookies, etc.)
	 * - Fetch user data if session exists
	 * - Set up any user stores/context
	 *
	 * WarpKit will wait for this promise to resolve before:
	 * - Setting the initial app state
	 * - Rendering the app content
	 * - Performing initial navigation
	 *
	 * @param context - Context containing WarpKit's event emitter
	 * @returns Initial auth state and optional state data
	 */
	initialize(context: AuthAdapterContext): Promise<AuthInitResult<TAppState, TStateData>>;

	/**
	 * Subscribe to auth state changes after initialization.
	 *
	 * Called after initialize() completes. The callback receives state change
	 * notifications that occur after the initial load (sign in/out events).
	 *
	 * The callback should return an AuthInitResult so WarpKit knows which
	 * app state to transition to. Return undefined to skip state transition
	 * (e.g., if you're handling it manually).
	 *
	 * @param callback - Called when auth state changes
	 * @returns Unsubscribe function
	 */
	onAuthStateChanged(
		callback: (result: AuthInitResult<TAppState, TStateData> | undefined) => void | Promise<void>
	): () => void;

	/**
	 * Sign out the current user.
	 *
	 * Optional. If provided, WarpKit can call this for programmatic sign out.
	 */
	signOut?(): Promise<void>;
}
