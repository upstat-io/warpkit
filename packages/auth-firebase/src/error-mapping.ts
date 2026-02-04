/**
 * Firebase Auth Error Mapping
 *
 * Maps Firebase's cryptic error codes to user-friendly messages.
 * These messages are suitable for displaying directly to end users.
 */

/**
 * Firebase auth error codes and their user-friendly messages
 */
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
	// Authentication errors - use same message to prevent user enumeration
	'auth/wrong-password': 'Invalid email or password',
	'auth/user-not-found': 'Invalid email or password',
	'auth/invalid-credential': 'Invalid email or password',
	'auth/invalid-email': 'Invalid email address',

	// Account errors
	'auth/email-already-in-use': 'An account with this email already exists',
	'auth/user-disabled': 'This account has been disabled',

	// Password errors
	'auth/weak-password': 'Password must be at least 6 characters',

	// Rate limiting
	'auth/too-many-requests': 'Too many attempts. Please try again later',

	// Network errors
	'auth/network-request-failed': 'Network error. Check your connection',

	// OAuth/popup errors
	'auth/popup-closed-by-user': 'Sign-in cancelled',
	'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups',
	'auth/cancelled-popup-request': 'Sign-in cancelled',

	// MFA
	'auth/multi-factor-auth-required': 'Multi-factor authentication required'
};

/**
 * Default message when no mapping is found
 */
const DEFAULT_ERROR_MESSAGE = 'Authentication failed. Please try again.';

/**
 * Custom error class for Firebase auth errors with user-friendly messages
 */
export class FirebaseAuthError extends Error {
	public readonly code: string;
	public readonly originalMessage: string;

	public constructor(code: string, userMessage: string, originalMessage: string) {
		super(userMessage);
		this.name = 'FirebaseAuthError';
		this.code = code;
		this.originalMessage = originalMessage;
	}
}

/**
 * Maps a Firebase error code to a user-friendly message
 *
 * @param code - Firebase error code (e.g., 'auth/wrong-password')
 * @returns User-friendly error message
 */
export function getErrorMessage(code: string): string {
	return FIREBASE_ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGE;
}

/**
 * Maps a Firebase error to a user-friendly FirebaseAuthError
 *
 * @param error - The original error from Firebase
 * @returns A FirebaseAuthError with user-friendly message
 */
export function mapFirebaseError(error: unknown): FirebaseAuthError {
	const firebaseError = error as { code?: string; message?: string };
	const code = firebaseError.code ?? 'unknown';
	const originalMessage = firebaseError.message ?? String(error);
	const userMessage = getErrorMessage(code);

	return new FirebaseAuthError(code, userMessage, originalMessage);
}

/**
 * Checks if an error is a known Firebase auth error that should be mapped
 *
 * @param error - The error to check
 * @returns True if this is a Firebase auth error
 */
export function isFirebaseAuthError(error: unknown): boolean {
	if (error === null || error === undefined || typeof error !== 'object') {
		return false;
	}
	const firebaseError = error as { code?: string };
	return typeof firebaseError.code === 'string' && firebaseError.code.startsWith('auth/');
}
