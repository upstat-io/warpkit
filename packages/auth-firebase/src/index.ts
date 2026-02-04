/**
 * @warpkit/auth-firebase
 *
 * Firebase Authentication adapter for WarpKit.
 *
 * This package provides a WarpKit AuthAdapter implementation for Firebase Auth.
 * It handles:
 * - Auth state synchronization with WarpKit
 * - Token retrieval (ID token + AppCheck token)
 * - Sign-in methods (email/password, Google OAuth)
 *
 * The consumer app is responsible for:
 * - Creating and configuring the Firebase app
 * - Fetching user data from their backend after auth
 * - Setting up user stores
 *
 * @example
 * ```typescript
 * import { initializeApp } from 'firebase/app';
 * import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';
 * import type { FirebaseUser } from '@warpkit/auth-firebase';
 *
 * // Consumer creates Firebase app with their config
 * const firebaseApp = initializeApp({
 *   apiKey: 'your-api-key',
 *   authDomain: 'your-project.firebaseapp.com',
 *   projectId: 'your-project',
 *   appId: 'your-app-id',
 *   storageBucket: 'your-bucket' // if needed for storage
 * });
 *
 * // Pass app to adapter
 * const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
 *   getInitialState: async (user: FirebaseUser | null) => {
 *     if (!user) return { state: 'unauthenticated' };
 *
 *     // Fetch your app's user data
 *     const userData = await fetchUserData(user.uid);
 *     setUserStore(userData);
 *
 *     return {
 *       state: 'authenticated',
 *       stateData: { projectAlias: userData.projectAlias }
 *     };
 *   }
 * });
 *
 * // Consumer can use same app for other Firebase services
 * const storage = getStorage(firebaseApp);
 * ```
 *
 * @packageDocumentation
 */

// Adapter
export { FirebaseAuthAdapter } from './adapter';

// Types
export type { FirebaseTokens, FirebaseUser, FirebaseSignInResult, FirebaseMfaError } from './types';

// Error handling
export { FirebaseAuthError, getErrorMessage, mapFirebaseError, isFirebaseAuthError } from './error-mapping';
