/**
 * Firebase Auth Adapter
 *
 * Implements WarpKit's AuthAdapter interface for Firebase Authentication.
 * Consumer provides the Firebase app instance; this adapter handles auth.
 *
 * The consumer app is responsible for:
 * - Creating and configuring the Firebase app
 * - Fetching user data from their backend after auth
 * - Setting up user stores
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { AppCheck } from 'firebase/app-check';
import type { AuthAdapter, AuthInitResult } from '@warpkit/types';
import {
	getAuth,
	connectAuthEmulator,
	onAuthStateChanged as firebaseOnAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signInWithPopup,
	signOut as firebaseSignOut,
	setPersistence,
	inMemoryPersistence,
	browserLocalPersistence,
	GoogleAuthProvider,
	type User as FirebaseAuthUser
} from 'firebase/auth';
import { getToken } from 'firebase/app-check';
import type { FirebaseTokens, FirebaseUser, FirebaseSignInResult } from './types';
import { mapFirebaseError, isFirebaseAuthError } from './error-mapping';

/**
 * Convert Firebase Auth User to minimal FirebaseUser type
 */
function toFirebaseUser(user: FirebaseAuthUser): FirebaseUser {
	return {
		uid: user.uid,
		email: user.email,
		displayName: user.displayName,
		photoURL: user.photoURL,
		emailVerified: user.emailVerified
	};
}

/**
 * Firebase Auth Adapter for WarpKit
 *
 * This adapter handles Firebase-specific auth logic and provides a clean
 * interface for WarpKit's auth system. The consumer app provides the Firebase
 * app instance and callbacks for user data fetching and state transitions.
 *
 * @typeParam TAppState - Union of valid app state names
 * @typeParam TStateData - Data associated with app state
 *
 * @example
 * ```typescript
 * import { initializeApp } from 'firebase/app';
 * import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';
 *
 * // Consumer creates Firebase app
 * const firebaseApp = initializeApp({
 *   apiKey: 'your-api-key',
 *   authDomain: 'your-project.firebaseapp.com',
 *   projectId: 'your-project',
 *   appId: 'your-app-id',
 *   storageBucket: 'your-bucket' // if needed
 * });
 *
 * // Pass app to adapter
 * const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
 *   getInitialState: async (user) => ({
 *     state: user ? 'authenticated' : 'unauthenticated'
 *   })
 * });
 * ```
 */
export class FirebaseAuthAdapter<
	TAppState extends string = 'authenticated' | 'unauthenticated',
	TStateData = unknown
> implements AuthAdapter<unknown, TAppState, TStateData, FirebaseTokens>
{
	private readonly app: FirebaseApp;
	private readonly auth: Auth;
	private readonly appCheck: AppCheck | null;
	private readonly googleProvider = new GoogleAuthProvider();
	private currentUser: FirebaseUser | null = null;
	private initializePromise: Promise<void> | null = null;
	private initializeResolve: (() => void) | null = null;

	/**
	 * Callback to determine initial app state based on user
	 * Consumer provides this to map Firebase user → app state
	 */
	private readonly getInitialState: (
		user: FirebaseUser | null
	) => Promise<AuthInitResult<TAppState, TStateData>>;

	/**
	 * Callback to determine state after auth changes
	 * Consumer provides this to map Firebase user → app state
	 */
	private readonly getStateChange: (
		user: FirebaseUser | null
	) => Promise<AuthInitResult<TAppState, TStateData> | undefined>;

	public constructor(
		app: FirebaseApp,
		options: {
			/**
			 * Called during initialize() to determine initial app state
			 * @param user - Firebase user if authenticated, null otherwise
			 * @returns Initial app state and optional state data
			 */
			getInitialState: (user: FirebaseUser | null) => Promise<AuthInitResult<TAppState, TStateData>>;
			/**
			 * Called on auth state changes after initialization
			 * @param user - Firebase user if authenticated, null otherwise
			 * @returns State change result, or undefined to skip state transition
			 */
			getStateChange?: (
				user: FirebaseUser | null
			) => Promise<AuthInitResult<TAppState, TStateData> | undefined>;
			/**
			 * AppCheck instance if using Firebase AppCheck
			 */
			appCheck?: AppCheck | null;
			/**
			 * Connect to auth emulator at this URL (e.g., 'http://127.0.0.1:9099')
			 */
			authEmulatorUrl?: string;
		}
	) {
		this.app = app;
		this.auth = getAuth(app);
		this.appCheck = options.appCheck ?? null;
		this.getInitialState = options.getInitialState;
		this.getStateChange =
			options.getStateChange ??
			(async (user) =>
				user
					? ({ state: 'authenticated' as TAppState } as AuthInitResult<TAppState, TStateData>)
					: ({ state: 'unauthenticated' as TAppState } as AuthInitResult<TAppState, TStateData>));

		// Connect to emulator if configured
		if (options.authEmulatorUrl && !this.auth.emulatorConfig) {
			connectAuthEmulator(this.auth, options.authEmulatorUrl, { disableWarnings: true });
		}
	}

	/**
	 * Get the Firebase app instance
	 *
	 * Useful for consumers who need access to the app for other Firebase services.
	 */
	public getApp(): FirebaseApp {
		return this.app;
	}

	/**
	 * Initialize and determine initial auth state
	 *
	 * Waits for Firebase to determine the initial auth state (checking
	 * for existing session) before returning.
	 */
	public async initialize(): Promise<AuthInitResult<TAppState, TStateData>> {
		// Create a promise that resolves when we get the initial auth state
		this.initializePromise = new Promise<void>((resolve) => {
			this.initializeResolve = resolve;
		});

		// Set up one-time listener for initial state
		const unsubscribe = firebaseOnAuthStateChanged(this.auth, (fbUser) => {
			this.currentUser = fbUser ? toFirebaseUser(fbUser) : null;

			// Resolve the initialize promise and clean up
			if (this.initializeResolve) {
				this.initializeResolve();
				this.initializeResolve = null;
			}
			unsubscribe();
		});

		// Wait for initial auth state
		await this.initializePromise;
		this.initializePromise = null;

		// Let consumer determine the initial state
		return this.getInitialState(this.currentUser);
	}

	/**
	 * Get current authentication tokens
	 *
	 * Returns both the Firebase ID token and AppCheck token (if configured).
	 * Note: There's a known Firebase quirk where the ID token may come back
	 * null on full reload unless AppCheck token is fetched with force refresh.
	 */
	public async getTokens(): Promise<FirebaseTokens> {
		let idToken: string | null = null;
		let appCheckToken: string | null = null;

		// Get AppCheck token first (with force refresh if no user)
		// This works around a Firebase quirk where ID token is null on reload
		if (this.appCheck) {
			try {
				const forceRefresh = !this.auth.currentUser;
				const result = await getToken(this.appCheck, forceRefresh);
				appCheckToken = result.token;
			} catch (error) {
				console.error('Failed to get AppCheck token:', error);
			}
		}

		// Get ID token
		if (this.auth.currentUser) {
			try {
				idToken = await this.auth.currentUser.getIdToken();
			} catch (error) {
				console.error('Failed to get ID token:', error);
			}
		}

		return { idToken, appCheckToken };
	}

	/**
	 * Subscribe to auth state changes
	 *
	 * Called after initialize() completes. The callback receives state
	 * change notifications for subsequent sign-in/sign-out events.
	 */
	public onAuthStateChanged(
		callback: (result: AuthInitResult<TAppState, TStateData> | undefined) => void | Promise<void>
	): () => void {
		// Skip the first call since initialize() already handled initial state
		let isFirstCall = true;

		const unsubscribe = firebaseOnAuthStateChanged(this.auth, async (fbUser) => {
			if (isFirstCall) {
				isFirstCall = false;
				return;
			}

			this.currentUser = fbUser ? toFirebaseUser(fbUser) : null;

			// Let consumer determine state change
			const result = await this.getStateChange(this.currentUser);
			await callback(result);
		});

		return unsubscribe;
	}

	/**
	 * Sign out the current user
	 */
	public async signOut(): Promise<void> {
		await firebaseSignOut(this.auth);
		this.currentUser = null;
	}

	// ============================================================================
	// Sign In Methods (for use by login components)
	// ============================================================================

	/**
	 * Sign in with email and password
	 *
	 * If the user doesn't exist and the auth provider allows it,
	 * this will create a new account.
	 */
	public async signInWithEmail(email: string, password: string): Promise<FirebaseSignInResult> {
		try {
			const credential = await signInWithEmailAndPassword(this.auth, email, password);
			const user = toFirebaseUser(credential.user);
			this.currentUser = user;
			return {
				user,
				isNewUser: false
			};
		} catch (error: unknown) {
			const firebaseError = error as { code?: string };
			// If user not found, attempt to create account
			if (firebaseError.code === 'auth/user-not-found') {
				try {
					const credential = await createUserWithEmailAndPassword(this.auth, email, password);
					const user = toFirebaseUser(credential.user);
					this.currentUser = user;
					return {
						user,
						isNewUser: true
					};
				} catch (createError: unknown) {
					// Map Firebase error to user-friendly message
					if (isFirebaseAuthError(createError)) {
						throw mapFirebaseError(createError);
					}
					throw createError;
				}
			}
			// Map Firebase error to user-friendly message
			if (isFirebaseAuthError(error)) {
				throw mapFirebaseError(error);
			}
			throw error;
		}
	}

	/**
	 * Sign in with Google OAuth popup
	 */
	public async signInWithGoogle(): Promise<FirebaseSignInResult> {
		try {
			const credential = await signInWithPopup(this.auth, this.googleProvider);

			// Check if this is a new user
			// @ts-expect-error - _tokenResponse exists but is not typed
			const isNewUser = credential._tokenResponse?.isNewUser ?? false;

			const user = toFirebaseUser(credential.user);
			this.currentUser = user;
			return {
				user,
				isNewUser
			};
		} catch (error: unknown) {
			// Map Firebase error to user-friendly message
			if (isFirebaseAuthError(error)) {
				throw mapFirebaseError(error);
			}
			throw error;
		}
	}

	/**
	 * Create a new user with email and password
	 */
	public async createUserWithEmail(email: string, password: string): Promise<FirebaseSignInResult> {
		try {
			const credential = await createUserWithEmailAndPassword(this.auth, email, password);

			const user = toFirebaseUser(credential.user);
			this.currentUser = user;
			return {
				user,
				isNewUser: true
			};
		} catch (error: unknown) {
			// Map Firebase error to user-friendly message
			if (isFirebaseAuthError(error)) {
				throw mapFirebaseError(error);
			}
			throw error;
		}
	}

	/**
	 * Get the current Firebase user
	 */
	public getCurrentUser(): FirebaseUser | null {
		return this.currentUser;
	}

	/**
	 * Alias for createUserWithEmail (for AuthContext compatibility)
	 */
	public async signUpWithEmail(email: string, password: string): Promise<FirebaseSignInResult> {
		return this.createUserWithEmail(email, password);
	}

	/**
	 * Get the ID token only (for AuthContext compatibility)
	 */
	public async getIdToken(): Promise<string | null> {
		const tokens = await this.getTokens();
		return tokens.idToken;
	}

	/**
	 * Refresh the current user's profile from Firebase
	 */
	public async refreshUser(): Promise<FirebaseUser | null> {
		if (this.auth.currentUser) {
			await this.auth.currentUser.reload();
			this.currentUser = toFirebaseUser(this.auth.currentUser);
		}
		return this.currentUser;
	}

	// ============================================================================
	// Persistence Control (for atomic sign-in with enrichment)
	// ============================================================================

	/**
	 * Set persistence to memory-only.
	 *
	 * Call this BEFORE sign-in when doing atomic sign-in with enrichment.
	 * The session will only be in memory until you call commitSession().
	 *
	 * @example
	 * ```typescript
	 * await adapter.useMemoryPersistence();
	 * await adapter.signInWithEmail(email, password);
	 * // ... do enrichment ...
	 * await adapter.commitSession(); // Promotes to localStorage
	 * ```
	 */
	public async useMemoryPersistence(): Promise<void> {
		await setPersistence(this.auth, inMemoryPersistence);
	}

	/**
	 * Commit the current session to localStorage.
	 *
	 * Call this AFTER successful enrichment to persist the session.
	 * This promotes the in-memory session to localStorage so it
	 * survives page refreshes.
	 */
	public async commitSession(): Promise<void> {
		await setPersistence(this.auth, browserLocalPersistence);
	}

	/**
	 * Set persistence to localStorage (the default).
	 *
	 * This is the normal Firebase behavior. Sessions are persisted
	 * in localStorage and survive page refreshes.
	 */
	public async useLocalPersistence(): Promise<void> {
		await setPersistence(this.auth, browserLocalPersistence);
	}
}
