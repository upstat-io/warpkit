/**
 * Test WarpKit Factory
 *
 * Provides a complete WarpKit test setup without requiring Svelte context.
 * Use this for testing auth flows, router integration, and state machine behavior.
 *
 * Usage:
 * ```typescript
 * import { createTestWarpKit } from '@upstat/warpkit/testing';
 *
 * const { actor, authProvider, cleanup } = createTestWarpKit({
 *   authState: 'authenticated'
 * });
 *
 * // Test auth state changes
 * authProvider.simulateLogout();
 * await waitForState(actor, 'unauthenticated');
 *
 * // Always cleanup
 * cleanup();
 * ```
 */

import { fromCallback, fromPromise } from '@warpkit/state-machine';
import type { Route } from '../src/types';
import { createAppActor, createConfiguredDataLayer, type AppActor } from '../src/init';
import type { AppEvents, UserDataResult } from '../src/app-state/types';
import type { DataLayerAPI } from '../src/data/types';
import {
	createMockAuthProvider,
	createMockDataLayer,
	createMockUserData,
	type MockAuthProvider
} from './authHelpers';

// ============================================================================
// Types
// ============================================================================

export type TestAuthState = 'initializing' | 'authenticated' | 'unauthenticated';

export interface TestWarpKitOptions<TUserData = unknown> {
	/**
	 * Initial auth state to set up.
	 * - 'initializing': Actor is in initializing state (auth not yet resolved)
	 * - 'authenticated': User is authenticated and ready
	 * - 'unauthenticated': No user logged in
	 *
	 * Default: 'initializing'
	 */
	authState?: TestAuthState;

	/**
	 * Mock user data for authenticated states.
	 * Used when authState is 'authenticated'.
	 */
	userData?: TUserData;

	/**
	 * Routes to register for route-type lookups.
	 * Useful for testing navigation guards.
	 */
	routes?: Route[];

	/**
	 * Whether to auto-start the actor.
	 * Default: true
	 */
	autoStart?: boolean;

	/**
	 * Custom mock auth provider.
	 * If not provided, a default mock is created.
	 */
	authProvider?: MockAuthProvider;

	/**
	 * Custom mock data layer.
	 * If not provided, a default mock is created.
	 */
	dataLayer?: DataLayerAPI;
}

export interface TestWarpKitResult {
	/** The app state machine actor */
	actor: AppActor;

	/** Mock auth provider (for triggering auth events) */
	authProvider: MockAuthProvider;

	/** Mock data layer */
	dataLayer: DataLayerAPI;

	/**
	 * Cleanup function - MUST call in afterEach.
	 * Stops the actor and resets all module-level state.
	 */
	cleanup: () => void;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a test WarpKit setup without Svelte context.
 *
 * This function creates a complete test environment for WarpKit,
 * including the app actor, mock auth provider, mock data layer,
 * and router state. No Svelte component context is required.
 *
 * @param options - Test configuration options
 * @returns Test WarpKit result with actor, mocks, and helpers
 *
 * @example
 * describe('Auth + Router Integration', () => {
 *   let warpkit: TestWarpKitResult;
 *
 *   afterEach(() => {
 *     warpkit?.cleanup();
 *   });
 *
 *   it('should handle auth state transitions', async () => {
 *     warpkit = createTestWarpKit({ authState: 'unauthenticated' });
 *     await waitForState(warpkit.actor, 'unauthenticated');
 *     // Test state-based behavior
 *   });
 * });
 */
export function createTestWarpKit<TUserData = unknown>(
	options: TestWarpKitOptions<TUserData> = {}
): TestWarpKitResult {
	const {
		authState = 'initializing',
		userData,
		routes = [],
		autoStart = true,
		authProvider: customAuthProvider,
		dataLayer: customDataLayer
	} = options;

	// Create mock auth provider
	const authProvider = customAuthProvider ?? createMockAuthProvider();

	// Create mock user data based on auth state
	const mockUserData = createUserDataForState<TUserData>(authState, userData);

	// Create mock data layer that returns appropriate user data
	const dataLayer =
		customDataLayer ??
		createMockDataLayer({
			async fetch<T>(): Promise<{ data: T; fromCache: boolean; notModified: boolean }> {
				return {
					data: mockUserData as T,
					fromCache: false,
					notModified: false
				};
			}
		});

	// Create custom actors based on desired auth state
	const actors = createActorsForState(authState, authProvider, mockUserData);

	// Create the app actor with mock actors
	const actor = createAppActor({
		authProvider,
		dataLayer: dataLayer as any, // eslint-disable-line @typescript-eslint/no-explicit-any
		actors,
		autoStart
	});

	// Create cleanup function
	const cleanup = () => {
		actor.stop();
	};

	return {
		actor,
		authProvider,
		dataLayer,
		cleanup
	};
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create user data based on the desired auth state.
 */
function createUserDataForState<TUserData>(
	authState: TestAuthState,
	customData?: TUserData
): TUserData | null {
	if (authState === 'unauthenticated' || authState === 'initializing') {
		return null;
	}

	// If custom data provided, use it; otherwise create generic mock data
	if (customData) {
		return customData;
	}

	return createMockUserData() as TUserData;
}

/**
 * Create custom actors that produce the desired auth state.
 */
function createActorsForState<TUserData>(
	authState: TestAuthState,
	authProvider: MockAuthProvider,
	mockUserData: TUserData | null
): { listenToAuth: unknown; checkUserData: unknown; signOut: unknown } {
	// Create a listenToAuth actor that immediately sends the right event
	const listenToAuthActor = fromCallback<AppEvents, { authProvider: unknown }>(({ sendBack }) => {
		// Small delay to allow machine to initialize
		queueMicrotask(() => {
			if (authState === 'initializing') {
				// Don't send any event - stay in initializing
				return;
			}

			if (authState === 'unauthenticated') {
				sendBack({ type: 'NO_USER' });
			} else {
				// authenticated
				const user = authProvider.getCurrentUser() ?? {
					uid: 'test-user-id',
					email: 'test@example.com',
					displayName: 'Test User',
					photoURL: null,
					emailVerified: true
				};
				sendBack({ type: 'USER_DETECTED', user, token: 'mock-token' });
			}
		});

		return () => {};
	});

	// Create a checkUserData actor that returns the mock user data
	const checkUserDataActor = fromPromise<UserDataResult, { signal: AbortSignal }>(async () => {
		if (!mockUserData) {
			throw new Error('No user data available');
		}
		return mockUserData;
	});

	// Create a signOut actor
	const signOutActor = fromPromise<void, { authProvider: unknown }>(async () => {
		// No-op for testing
	});

	return {
		listenToAuth: listenToAuthActor,
		checkUserData: checkUserDataActor,
		signOut: signOutActor
	};
}
