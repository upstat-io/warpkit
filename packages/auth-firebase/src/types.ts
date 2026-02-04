/**
 * Firebase Auth Types
 *
 * Type definitions for Firebase authentication adapter.
 */

/**
 * Tokens returned by FirebaseAuthAdapter.getTokens()
 */
export interface FirebaseTokens {
	/** Firebase ID token for user authentication */
	idToken: string | null;
	/** Firebase AppCheck token for app verification */
	appCheckToken: string | null;
}

/**
 * Minimal user info from Firebase Auth
 *
 * A subset of Firebase User with the most commonly needed fields.
 * Consumers will typically fetch additional user data from their backend
 * using the uid.
 */
export interface FirebaseUser {
	/** Firebase user ID */
	uid: string;
	/** User's email address */
	email: string | null;
	/** User's display name */
	displayName: string | null;
	/** User's photo URL */
	photoURL: string | null;
	/** Whether the user's email has been verified */
	emailVerified: boolean;
}

/**
 * Result of a sign-in operation
 */
export interface FirebaseSignInResult {
	/** The signed-in user */
	user: FirebaseUser;
	/** Whether this is a new user (first sign-in) */
	isNewUser: boolean;
}

/**
 * Multi-factor authentication error
 * Thrown when MFA verification is required
 */
export interface FirebaseMfaError {
	/** Error code indicating MFA is required */
	code: 'auth/multi-factor-auth-required';
	/** The original Firebase error for MFA resolution */
	resolver: unknown;
}
