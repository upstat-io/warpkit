/**
 * Auth Test Helpers
 *
 * Mock implementations for authentication-related types used in tests.
 * These allow testing auth flows without real auth providers.
 *
 * Usage:
 * ```typescript
 * import { createMockAuthProvider, createMockDataLayer } from '@upstat/warpkit/testing';
 *
 * const authProvider = createMockAuthProvider();
 * authProvider.simulateLogin({ uid: 'user-123' });
 * ```
 */

import type { AppAuthProvider, AppUser, AppEvents } from '../src/app-state/types';
import type { DataLayerAPI, FetchOptions, FetchResult } from '../src/data/types';

// ============================================================================
// Mock Auth Provider
// ============================================================================

/**
 * Extended auth provider interface for testing.
 * Adds methods to programmatically trigger auth events.
 */
export interface MockAuthProvider extends AppAuthProvider {
	/** Trigger USER_DETECTED event with optional user data */
	simulateLogin(user?: Partial<AppUser>): void;

	/** Trigger NO_USER event */
	simulateLogout(): void;

	/** Get the sendBack function for manual event control */
	getSendBack(): ((event: AppEvents) => void) | null;

	/** Get current mock user */
	getCurrentUser(): AppUser | null;
}

/**
 * Create a mock auth provider for testing.
 *
 * The mock provider allows programmatic control over auth state changes,
 * making it easy to test auth flows without real authentication.
 *
 * @param initialUser - Optional initial user (null = unauthenticated)
 * @returns Mock auth provider with test control methods
 *
 * @example
 * const authProvider = createMockAuthProvider();
 *
 * // Start unauthenticated, then login
 * authProvider.simulateLogin({ uid: 'user-123', email: 'test@example.com' });
 *
 * // Later logout
 * authProvider.simulateLogout();
 */
export function createMockAuthProvider(initialUser: AppUser | null = null): MockAuthProvider {
	let currentUser: AppUser | null = initialUser;
	let authCallback: ((user: AppUser | null) => void) | null = null;
	let sendBackFn: ((event: AppEvents) => void) | null = null;

	const mockProvider: MockAuthProvider = {
		onAuthStateChanged(callback) {
			authCallback = callback;
			// Immediately report initial state
			queueMicrotask(() => callback(currentUser));
			return () => {
				authCallback = null;
			};
		},

		async signOut() {
			currentUser = null;
			authCallback?.(null);
		},

		async getTokens() {
			return { idToken: currentUser ? 'mock-token' : null };
		},

		async getIdToken() {
			const tokens = await this.getTokens();
			return tokens.idToken;
		},

		async getAuthHeaders(): Promise<Record<string, string>> {
			const token = await this.getIdToken();
			if (token) {
				return { Authorization: `Bearer ${token}` };
			}
			return {};
		},

		simulateLogin(user = {}) {
			currentUser = {
				uid: user.uid ?? 'mock-user-id',
				email: user.email ?? 'mock@example.com',
				displayName: user.displayName ?? 'Mock User',
				photoURL: user.photoURL ?? null,
				emailVerified: user.emailVerified ?? true
			};

			if (authCallback) {
				authCallback(currentUser);
			}

			if (sendBackFn) {
				sendBackFn({ type: 'USER_DETECTED', user: currentUser, token: 'mock-token' });
			}
		},

		simulateLogout() {
			currentUser = null;
			authCallback?.(null);

			if (sendBackFn) {
				sendBackFn({ type: 'NO_USER' });
			}
		},

		getSendBack() {
			return sendBackFn;
		},

		getCurrentUser() {
			return currentUser;
		}
	};

	// Allow setting sendBack for direct event control
	(mockProvider as MockAuthProvider & { setSendBack: (fn: (event: AppEvents) => void) => void }).setSendBack =
		(fn: (event: AppEvents) => void) => {
			sendBackFn = fn;
		};

	return mockProvider;
}

// ============================================================================
// Mock Data Layer
// ============================================================================

/**
 * Create a mock data layer for testing.
 *
 * The mock data layer allows you to control what data is returned
 * from fetch calls, making it easy to test different scenarios.
 *
 * @param overrides - Optional partial overrides for DataLayerAPI methods
 * @returns Mock data layer
 *
 * @example
 * const dataLayer = createMockDataLayer({
 *   fetch: async () => ({
 *     data: { isOnboarded: true },
 *     fromCache: false,
 *     notModified: false
 *   })
 * });
 */
export function createMockDataLayer(overrides?: Partial<DataLayerAPI>): DataLayerAPI {
	return {
		async fetch<T>(_key: string, _options?: FetchOptions): Promise<FetchResult<T>> {
			return {
				data: {} as T,
				fromCache: false,
				notModified: false
			};
		},

		invalidate(_key: string, _params?: Record<string, string>): void {
			// No-op
		},

		invalidateAll(): void {
			// No-op
		},

		async prefetch(_key: string, _options?: FetchOptions): Promise<void> {
			// No-op
		},

		getCached<T>(_key: string, _params?: Record<string, string>): T | undefined {
			return undefined;
		},

		...overrides
	};
}

// ============================================================================
// Mock User Data
// ============================================================================

/**
 * Create mock user data for testing.
 * Returns generic user data that can be used for any WarpKit app.
 *
 * @param overrides - Optional partial overrides
 * @returns Mock user data object
 *
 * @example
 * const userData = createMockUserData({ email: 'test@example.com' });
 */
export function createMockUserData<T extends Record<string, unknown> = Record<string, unknown>>(
	overrides?: Partial<T>
): T {
	return {
		email: 'mock@example.com',
		displayName: 'Mock User',
		...overrides
	} as T;
}

/**
 * Create a mock app user for testing.
 *
 * @param overrides - Optional partial overrides
 * @returns Mock AppUser
 *
 * @example
 * const user = createMockAppUser({ email: 'custom@test.com' });
 */
export function createMockAppUser(overrides?: Partial<AppUser>): AppUser {
	return {
		uid: 'mock-user-id',
		email: 'mock@example.com',
		displayName: 'Mock User',
		photoURL: null,
		emailVerified: true,
		...overrides
	};
}
