/**
 * Firebase Auth Adapter Integration Tests
 *
 * These tests run against a real Firebase Auth emulator in a Docker container.
 * They verify the actual Firebase SDK behavior, not mocks.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getFirebaseEmulator, stopFirebaseEmulator } from './firebase-emulator-container';
import { FirebaseAuthAdapter } from '../adapter';
import { FirebaseAuthError } from '../error-mapping';

describe('FirebaseAuthAdapter with Emulator', () => {
	let emulatorUrl: string;
	let projectId: string;
	let firebaseApp: FirebaseApp;
	let adapter: FirebaseAuthAdapter<'authenticated' | 'unauthenticated'>;
	let emulatorContainer: Awaited<ReturnType<typeof getFirebaseEmulator>>['container'];
	let unsubscribeAuthState: (() => void) | null = null;
	const stateChanges: Array<'authenticated' | 'unauthenticated'> = [];

	beforeAll(async () => {
		// Start the Firebase emulator container
		const result = await getFirebaseEmulator();
		emulatorUrl = result.emulatorUrl;
		projectId = result.projectId;
		emulatorContainer = result.container;

		console.log(`Firebase Auth emulator running at ${emulatorUrl}`);

		// Create Firebase app
		firebaseApp = initializeApp({
			apiKey: 'fake-api-key',
			authDomain: `${projectId}.firebaseapp.com`,
			projectId,
			appId: 'fake-app-id'
		});

		// Create adapter with the app
		adapter = new FirebaseAuthAdapter<'authenticated' | 'unauthenticated'>(firebaseApp, {
			getInitialState: async (user) => ({
				state: user ? 'authenticated' : 'unauthenticated'
			}),
			getStateChange: async (user) => {
				const state = user ? 'authenticated' : 'unauthenticated';
				stateChanges.push(state);
				return { state };
			},
			authEmulatorUrl: emulatorUrl
		});

		// Initialize once
		await adapter.initialize();

		// Register auth state change listener
		unsubscribeAuthState = adapter.onAuthStateChanged(() => {
			// The getStateChange callback handles pushing to stateChanges
		});
	}, 120_000); // 2 minute timeout for container startup

	afterAll(async () => {
		if (unsubscribeAuthState) {
			unsubscribeAuthState();
		}
		if (firebaseApp) {
			await deleteApp(firebaseApp);
		}
		await stopFirebaseEmulator();
	});

	beforeEach(async () => {
		// Sign out and clear users between tests
		try {
			await adapter.signOut();
		} catch {
			// Ignore - might not be signed in
		}

		try {
			await emulatorContainer.clearUsers();
		} catch (error) {
			console.warn('Failed to clear users:', error);
		}

		// Clear state changes tracking
		stateChanges.length = 0;
	});

	describe('initialize()', () => {
		it('should have initialized with unauthenticated state (no user)', () => {
			// After initialization with no prior session, should be unauthenticated
			const currentUser = adapter.getCurrentUser();
			expect(currentUser).toBeNull();
		});
	});

	describe('signInWithEmail()', () => {
		it('should create a new user and return user info', async () => {
			const result = await adapter.signInWithEmail('test@example.com', 'password123');

			expect(result.user.email).toBe('test@example.com');
			expect(result.isNewUser).toBe(true);
			expect(adapter.getCurrentUser()).not.toBeNull();
			expect(adapter.getCurrentUser()?.email).toBe('test@example.com');
		});

		it('should sign in existing user', async () => {
			// Create user first
			await adapter.signInWithEmail('existing@example.com', 'password123');
			await adapter.signOut();

			// Sign in again
			const result = await adapter.signInWithEmail('existing@example.com', 'password123');

			expect(result.user.email).toBe('existing@example.com');
			expect(result.isNewUser).toBe(false);
		});
	});

	describe('signOut()', () => {
		it('should clear current user after sign out', async () => {
			await adapter.signInWithEmail('test@example.com', 'password123');
			expect(adapter.getCurrentUser()).not.toBeNull();

			await adapter.signOut();

			expect(adapter.getCurrentUser()).toBeNull();
		});
	});

	describe('getTokens()', () => {
		it('should return null idToken when not signed in', async () => {
			const tokens = await adapter.getTokens();
			expect(tokens.idToken).toBeNull();
		});

		it('should return valid idToken when signed in', async () => {
			await adapter.signInWithEmail('test@example.com', 'password123');

			const tokens = await adapter.getTokens();

			expect(tokens.idToken).not.toBeNull();
			expect(typeof tokens.idToken).toBe('string');
		});
	});

	describe('onAuthStateChanged()', () => {
		it('should notify callback when user signs in', async () => {
			// Sign in should trigger state change
			await adapter.signInWithEmail('test@example.com', 'password123');

			// Wait for async callback
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(stateChanges).toContain('authenticated');
		});

		it('should notify callback when user signs out', async () => {
			await adapter.signInWithEmail('test@example.com', 'password123');
			stateChanges.length = 0; // Clear the sign-in state change

			await adapter.signOut();

			// Wait for async callback
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(stateChanges).toContain('unauthenticated');
		});
	});

	describe('createUserWithEmail()', () => {
		it('should create a new user', async () => {
			const result = await adapter.createUserWithEmail('new@example.com', 'password123');

			expect(result.user.email).toBe('new@example.com');
			expect(result.isNewUser).toBe(true);
		});
	});

	describe('getIdToken()', () => {
		it('should return null when not signed in', async () => {
			const token = await adapter.getIdToken();
			expect(token).toBeNull();
		});

		it('should return token when signed in', async () => {
			await adapter.signInWithEmail('test@example.com', 'password123');

			const token = await adapter.getIdToken();

			expect(token).not.toBeNull();
			expect(typeof token).toBe('string');
		});
	});

	// ============================================================================
	// Error Handling Tests (with real Firebase errors from emulator)
	// ============================================================================

	describe('error handling', () => {
		describe('signInWithEmail() errors', () => {
			it('should throw user-friendly error for wrong password', async () => {
				// Create user first
				await adapter.createUserWithEmail('wrongpass@example.com', 'correctPassword123');
				await adapter.signOut();

				// Try to sign in with wrong password
				let error: Error | null = null;
				try {
					await adapter.signInWithEmail('wrongpass@example.com', 'wrongPassword');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				expect(error).toBeInstanceOf(FirebaseAuthError);
				expect(error!.message).toBe('Invalid email or password');

				const authError = error as FirebaseAuthError;
				expect(authError.code).toBe('auth/wrong-password');
			});

			it('should throw user-friendly error for invalid email format', async () => {
				let error: Error | null = null;
				try {
					await adapter.signInWithEmail('not-an-email', 'password123');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				expect(error).toBeInstanceOf(FirebaseAuthError);
				expect(error!.message).toBe('Invalid email address');

				const authError = error as FirebaseAuthError;
				expect(authError.code).toBe('auth/invalid-email');
			});
		});

		describe('createUserWithEmail() errors', () => {
			it('should throw user-friendly error when email already in use', async () => {
				// Create user first
				await adapter.createUserWithEmail('duplicate@example.com', 'password123');
				await adapter.signOut();

				// Try to create again with same email
				let error: Error | null = null;
				try {
					await adapter.createUserWithEmail('duplicate@example.com', 'differentPassword');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				expect(error).toBeInstanceOf(FirebaseAuthError);
				expect(error!.message).toBe('An account with this email already exists');

				const authError = error as FirebaseAuthError;
				expect(authError.code).toBe('auth/email-already-in-use');
			});

			it('should throw user-friendly error for weak password', async () => {
				let error: Error | null = null;
				try {
					// Firebase requires at least 6 characters
					await adapter.createUserWithEmail('weakpass@example.com', '12345');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				expect(error).toBeInstanceOf(FirebaseAuthError);
				expect(error!.message).toBe('Password must be at least 6 characters');

				const authError = error as FirebaseAuthError;
				expect(authError.code).toBe('auth/weak-password');
			});

			it('should throw user-friendly error for invalid email format', async () => {
				let error: Error | null = null;
				try {
					await adapter.createUserWithEmail('bad-email', 'password123');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				expect(error).toBeInstanceOf(FirebaseAuthError);
				expect(error!.message).toBe('Invalid email address');

				const authError = error as FirebaseAuthError;
				expect(authError.code).toBe('auth/invalid-email');
			});
		});

		describe('signUpWithEmail() errors', () => {
			it('should throw user-friendly error when email already in use (via signUpWithEmail)', async () => {
				// Create user first
				await adapter.signUpWithEmail('signup-dup@example.com', 'password123');
				await adapter.signOut();

				// Try to sign up again with same email
				let error: Error | null = null;
				try {
					await adapter.signUpWithEmail('signup-dup@example.com', 'password456');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				expect(error).toBeInstanceOf(FirebaseAuthError);
				expect(error!.message).toBe('An account with this email already exists');
			});
		});

		describe('error properties', () => {
			it('should preserve original Firebase error message in originalMessage', async () => {
				let error: Error | null = null;
				try {
					await adapter.createUserWithEmail('weak@example.com', '123');
				} catch (e) {
					error = e as Error;
				}

				expect(error).not.toBeNull();
				const authError = error as FirebaseAuthError;

				// The original Firebase message should be preserved
				expect(authError.originalMessage).toBeDefined();
				expect(authError.originalMessage.length).toBeGreaterThan(0);
			});
		});
	});

	// ============================================================================
	// Additional Method Tests
	// ============================================================================

	describe('refreshUser()', () => {
		it('should refresh and return the current user', async () => {
			await adapter.signInWithEmail('refresh@example.com', 'password123');

			const refreshedUser = await adapter.refreshUser();

			expect(refreshedUser).not.toBeNull();
			expect(refreshedUser?.email).toBe('refresh@example.com');
		});

		it('should return null when not signed in', async () => {
			const refreshedUser = await adapter.refreshUser();

			expect(refreshedUser).toBeNull();
		});
	});

	describe('persistence methods', () => {
		it('should support useMemoryPersistence()', async () => {
			// Should not throw
			await adapter.useMemoryPersistence();
		});

		it('should support commitSession()', async () => {
			// Should not throw
			await adapter.commitSession();
		});

		it('should support useLocalPersistence()', async () => {
			// Should not throw
			await adapter.useLocalPersistence();
		});

		it('should allow atomic sign-in flow with memory persistence', async () => {
			// Use memory persistence before sign-in
			await adapter.useMemoryPersistence();

			// Sign in (session in memory only)
			await adapter.signInWithEmail('atomic@example.com', 'password123');

			// Commit session to localStorage
			await adapter.commitSession();

			// Should still be signed in
			expect(adapter.getCurrentUser()).not.toBeNull();
		});
	});

	describe('default getStateChange callback', () => {
		it('should use default state change handler when not provided', async () => {
			// Create adapter without getStateChange callback (reuse existing app)
			const adapterWithDefaults = new FirebaseAuthAdapter<'authenticated' | 'unauthenticated'>(
				firebaseApp,
				{
					getInitialState: async (user) => ({
						state: user ? 'authenticated' : 'unauthenticated'
					})
					// No getStateChange provided - will use default
				}
			);

			// The default handler should work without errors
			expect(adapterWithDefaults).toBeDefined();
		});

		it('should invoke default getStateChange on auth changes', async () => {
			const stateResults: Array<{ state: string }> = [];

			// Create adapter without getStateChange callback (reuse existing app)
			const adapterWithDefaults = new FirebaseAuthAdapter<'authenticated' | 'unauthenticated'>(
				firebaseApp,
				{
					getInitialState: async (user) => ({
						state: user ? 'authenticated' : 'unauthenticated'
					})
					// No getStateChange - uses default
				}
			);

			// Subscribe to auth changes
			const unsubscribe = adapterWithDefaults.onAuthStateChanged(async (result) => {
				if (result) {
					stateResults.push({ state: result.state });
				}
			});

			// Sign in should trigger default getStateChange
			await adapterWithDefaults.signInWithEmail('default-test@example.com', 'password123');

			// Wait for async callback
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Sign out should trigger default getStateChange
			await adapterWithDefaults.signOut();

			// Wait for async callback
			await new Promise((resolve) => setTimeout(resolve, 200));

			unsubscribe();

			// Default handler should have been called for both transitions
			expect(stateResults.length).toBeGreaterThanOrEqual(1);
		});
	});
});
