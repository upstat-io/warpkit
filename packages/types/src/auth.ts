/**
 * Auth Adapter Types
 *
 * WarpKit provides an auth adapter interface that consumers implement.
 * The adapter handles async initialization and auth state changes.
 *
 * This keeps auth concerns in the consumer app while WarpKit handles
 * the coordination of auth state → app state transitions and ready state.
 */

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
 * 4. Providing auth tokens for authenticated API/WebSocket calls
 *
 * @typeParam TContext - Context type passed to initialize (WarpKit provides event emitter)
 * @typeParam TAppState - Union of valid app state names
 * @typeParam TStateData - Data associated with app state (for dynamic defaults)
 * @typeParam TTokens - Token type returned by getTokens (default: { idToken: string | null })
 *
 * @example
 * ```typescript
 * // Simple adapter with just ID token
 * class MyAuthAdapter implements AuthAdapter<MyContext, 'authenticated' | 'unauthenticated'> {
 *   async initialize(context) {
 *     const session = localStorage.getItem('session');
 *     if (!session) {
 *       return { state: 'unauthenticated' };
 *     }
 *     const userData = await fetchUserData(session);
 *     return { state: 'authenticated', stateData: { projectAlias: userData.projectAlias } };
 *   }
 *
 *   async getTokens() {
 *     const idToken = await firebase.auth().currentUser?.getIdToken() ?? null;
 *     return { idToken };
 *   }
 *
 *   onAuthStateChanged(callback) {
 *     return firebase.auth().onAuthStateChanged(async (user) => {
 *       callback(user ? { state: 'authenticated' } : { state: 'unauthenticated' });
 *     });
 *   }
 *
 *   async signOut() {
 *     await firebase.auth().signOut();
 *   }
 * }
 *
 * // Firebase adapter with AppCheck token
 * class FirebaseAdapter implements AuthAdapter<
 *   MyContext,
 *   'authenticated' | 'unauthenticated',
 *   unknown,
 *   { idToken: string | null; appCheckToken: string | null }
 * > {
 *   async getTokens() {
 *     return { idToken: await getIdToken(), appCheckToken: await getAppCheckToken() };
 *   }
 * }
 * ```
 */
export interface AuthAdapter<
	TContext = unknown,
	TAppState extends string = string,
	TStateData = unknown,
	TTokens = { idToken: string | null }
> {
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
	 * Optional for adapters that don't need WarpKit integration (e.g., WebSocket-only).
	 *
	 * @param context - Context provided by the consumer (WarpKit provides event emitter)
	 * @returns Initial auth state and optional state data
	 */
	initialize?(context: TContext): Promise<AuthInitResult<TAppState, TStateData>>;

	/**
	 * Get authentication tokens.
	 *
	 * Used by WebSocket client and API calls to authenticate requests.
	 * The TTokens type parameter controls what tokens are returned.
	 *
	 * Common patterns:
	 * - Simple JWT: `{ idToken: string | null }`
	 * - Firebase with AppCheck: `{ idToken: string | null; appCheckToken: string | null }`
	 *
	 * @returns The auth tokens, shape determined by TTokens generic
	 */
	getTokens(): Promise<TTokens>;

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
