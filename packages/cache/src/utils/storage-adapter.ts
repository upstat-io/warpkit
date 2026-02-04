/**
 * Storage Adapter Utilities
 *
 * Safe wrappers for browser storage operations.
 * Handles errors gracefully and checks storage availability.
 */

import type { StorageAdapter } from '../types.js';

/**
 * Check if a storage implementation is available and functional.
 * Tests by attempting to write/read/delete a test key.
 *
 * @param storage - Storage to check (e.g., localStorage, sessionStorage)
 * @returns true if storage is available and functional
 */
export function isStorageAvailable(storage: StorageAdapter | undefined): boolean {
	if (!storage) return false;

	const testKey = '__warpkit_storage_test__';
	try {
		storage.setItem(testKey, 'test');
		const result = storage.getItem(testKey);
		storage.removeItem(testKey);
		return result === 'test';
	} catch {
		return false;
	}
}

/**
 * Safely get an item from storage.
 *
 * @param storage - Storage to read from
 * @param key - Key to retrieve
 * @returns The stored value or null if not found/error
 */
export function safeGetItem(storage: StorageAdapter | undefined, key: string): string | null {
	if (!storage) return null;

	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

/**
 * Safely set an item in storage.
 *
 * @param storage - Storage to write to
 * @param key - Key to set
 * @param value - Value to store
 * @returns true if successful, false if failed (e.g., quota exceeded)
 */
export function safeSetItem(storage: StorageAdapter | undefined, key: string, value: string): boolean {
	if (!storage) return false;

	try {
		storage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

/**
 * Safely remove an item from storage.
 *
 * @param storage - Storage to remove from
 * @param key - Key to remove
 * @returns true if operation completed (even if key didn't exist), false on error
 */
export function safeRemoveItem(storage: StorageAdapter | undefined, key: string): boolean {
	if (!storage) return false;

	try {
		storage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get localStorage if available, otherwise undefined.
 */
export function getLocalStorage(): StorageAdapter | undefined {
	if (typeof window !== 'undefined' && window.localStorage) {
		return isStorageAvailable(window.localStorage) ? window.localStorage : undefined;
	}
	return undefined;
}

/**
 * Get sessionStorage if available, otherwise undefined.
 */
export function getSessionStorage(): StorageAdapter | undefined {
	if (typeof window !== 'undefined' && window.sessionStorage) {
		return isStorageAvailable(window.sessionStorage) ? window.sessionStorage : undefined;
	}
	return undefined;
}
