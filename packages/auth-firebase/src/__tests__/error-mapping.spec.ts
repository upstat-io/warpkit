/**
 * Error Mapping Unit Tests
 *
 * Tests the Firebase error code to user-friendly message mapping.
 */

import { describe, it, expect } from 'vitest';
import { getErrorMessage, mapFirebaseError, isFirebaseAuthError, FirebaseAuthError } from '../error-mapping';

describe('getErrorMessage', () => {
	describe('authentication errors', () => {
		it('should return same message for wrong-password and user-not-found to prevent enumeration', () => {
			const wrongPassword = getErrorMessage('auth/wrong-password');
			const userNotFound = getErrorMessage('auth/user-not-found');

			expect(wrongPassword).toBe('Invalid email or password');
			expect(userNotFound).toBe('Invalid email or password');
			expect(wrongPassword).toBe(userNotFound);
		});

		it('should map auth/invalid-credential to generic auth error', () => {
			expect(getErrorMessage('auth/invalid-credential')).toBe('Invalid email or password');
		});

		it('should map auth/invalid-email to specific message', () => {
			expect(getErrorMessage('auth/invalid-email')).toBe('Invalid email address');
		});
	});

	describe('account errors', () => {
		it('should map auth/email-already-in-use', () => {
			expect(getErrorMessage('auth/email-already-in-use')).toBe('An account with this email already exists');
		});

		it('should map auth/user-disabled', () => {
			expect(getErrorMessage('auth/user-disabled')).toBe('This account has been disabled');
		});
	});

	describe('password errors', () => {
		it('should map auth/weak-password', () => {
			expect(getErrorMessage('auth/weak-password')).toBe('Password must be at least 6 characters');
		});
	});

	describe('rate limiting', () => {
		it('should map auth/too-many-requests', () => {
			expect(getErrorMessage('auth/too-many-requests')).toBe('Too many attempts. Please try again later');
		});
	});

	describe('network errors', () => {
		it('should map auth/network-request-failed', () => {
			expect(getErrorMessage('auth/network-request-failed')).toBe('Network error. Check your connection');
		});
	});

	describe('OAuth/popup errors', () => {
		it('should map auth/popup-closed-by-user', () => {
			expect(getErrorMessage('auth/popup-closed-by-user')).toBe('Sign-in cancelled');
		});

		it('should map auth/popup-blocked', () => {
			expect(getErrorMessage('auth/popup-blocked')).toBe('Sign-in popup was blocked. Please allow popups');
		});

		it('should map auth/cancelled-popup-request', () => {
			expect(getErrorMessage('auth/cancelled-popup-request')).toBe('Sign-in cancelled');
		});
	});

	describe('MFA', () => {
		it('should map auth/multi-factor-auth-required', () => {
			expect(getErrorMessage('auth/multi-factor-auth-required')).toBe('Multi-factor authentication required');
		});
	});

	describe('unknown errors', () => {
		it('should return default message for unknown codes', () => {
			expect(getErrorMessage('auth/unknown-error')).toBe('Authentication failed. Please try again.');
		});

		it('should return default message for non-auth codes', () => {
			expect(getErrorMessage('some/other-error')).toBe('Authentication failed. Please try again.');
		});

		it('should return default message for empty code', () => {
			expect(getErrorMessage('')).toBe('Authentication failed. Please try again.');
		});
	});
});

describe('mapFirebaseError', () => {
	it('should create FirebaseAuthError with user-friendly message', () => {
		const firebaseError = {
			code: 'auth/wrong-password',
			message: 'Firebase: Error (auth/wrong-password).'
		};

		const result = mapFirebaseError(firebaseError);

		expect(result).toBeInstanceOf(FirebaseAuthError);
		expect(result.message).toBe('Invalid email or password');
		expect(result.code).toBe('auth/wrong-password');
		expect(result.originalMessage).toBe('Firebase: Error (auth/wrong-password).');
	});

	it('should preserve unknown error code', () => {
		const error = { code: 'auth/some-new-error', message: 'Some new error' };

		const result = mapFirebaseError(error);

		expect(result.code).toBe('auth/some-new-error');
		expect(result.message).toBe('Authentication failed. Please try again.');
	});

	it('should handle errors without code property', () => {
		const error = { message: 'Network error' };

		const result = mapFirebaseError(error);

		expect(result.code).toBe('unknown');
		expect(result.message).toBe('Authentication failed. Please try again.');
		expect(result.originalMessage).toBe('Network error');
	});

	it('should handle errors without message property', () => {
		const error = { code: 'auth/wrong-password' };

		const result = mapFirebaseError(error);

		expect(result.originalMessage).toBe('[object Object]');
	});

	it('should handle non-object errors', () => {
		const error = 'String error';

		const result = mapFirebaseError(error);

		expect(result.code).toBe('unknown');
		expect(result.originalMessage).toBe('String error');
	});
});

describe('isFirebaseAuthError', () => {
	it('should return true for valid Firebase auth errors', () => {
		expect(isFirebaseAuthError({ code: 'auth/wrong-password' })).toBe(true);
		expect(isFirebaseAuthError({ code: 'auth/user-not-found' })).toBe(true);
		expect(isFirebaseAuthError({ code: 'auth/email-already-in-use' })).toBe(true);
	});

	it('should return false for non-auth error codes', () => {
		expect(isFirebaseAuthError({ code: 'storage/unauthorized' })).toBe(false);
		expect(isFirebaseAuthError({ code: 'firestore/permission-denied' })).toBe(false);
	});

	it('should return false for errors without code', () => {
		expect(isFirebaseAuthError({ message: 'error' })).toBe(false);
		expect(isFirebaseAuthError({})).toBe(false);
	});

	it('should return false for non-object errors', () => {
		expect(isFirebaseAuthError('error')).toBe(false);
		expect(isFirebaseAuthError(null)).toBe(false);
		expect(isFirebaseAuthError(undefined)).toBe(false);
	});

	it('should return false for errors with non-string code', () => {
		expect(isFirebaseAuthError({ code: 123 })).toBe(false);
		expect(isFirebaseAuthError({ code: null })).toBe(false);
	});
});

describe('FirebaseAuthError', () => {
	it('should have correct name property', () => {
		const error = new FirebaseAuthError('auth/test', 'Test message', 'Original');

		expect(error.name).toBe('FirebaseAuthError');
	});

	it('should be instanceof Error', () => {
		const error = new FirebaseAuthError('auth/test', 'Test message', 'Original');

		expect(error).toBeInstanceOf(Error);
	});

	it('should preserve all properties', () => {
		const error = new FirebaseAuthError('auth/code', 'User message', 'Original message');

		expect(error.code).toBe('auth/code');
		expect(error.message).toBe('User message');
		expect(error.originalMessage).toBe('Original message');
	});
});
