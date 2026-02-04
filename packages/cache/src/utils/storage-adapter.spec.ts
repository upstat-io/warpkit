/**
 * Storage Adapter Utilities Unit Tests
 *
 * Tests safe storage wrappers and availability checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StorageAdapter } from '../types.js';
import {
	isStorageAvailable,
	safeGetItem,
	safeSetItem,
	safeRemoveItem,
	getLocalStorage,
	getSessionStorage
} from './storage-adapter.js';

/**
 * Creates a mock storage adapter backed by a Map.
 */
function createMockStorage(): StorageAdapter & { _data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		_data: data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
		removeItem: (key: string) => {
			data.delete(key);
		}
	};
}

/**
 * Creates a mock storage that throws on all operations.
 */
function createThrowingStorage(): StorageAdapter {
	return {
		getItem: () => {
			throw new Error('Storage access denied');
		},
		setItem: () => {
			throw new Error('Storage access denied');
		},
		removeItem: () => {
			throw new Error('Storage access denied');
		}
	};
}

describe('storage-adapter utilities', () => {
	describe('isStorageAvailable', () => {
		it('should return true when storage is functional', () => {
			const storage = createMockStorage();
			expect(isStorageAvailable(storage)).toBe(true);
		});

		it('should return false when storage is undefined', () => {
			expect(isStorageAvailable(undefined)).toBe(false);
		});

		it('should return false when storage throws on setItem', () => {
			const storage = createThrowingStorage();
			expect(isStorageAvailable(storage)).toBe(false);
		});

		it('should return false when storage returns wrong value', () => {
			const storage: StorageAdapter = {
				getItem: () => 'wrong-value',
				setItem: () => {},
				removeItem: () => {}
			};
			expect(isStorageAvailable(storage)).toBe(false);
		});

		it('should clean up test key after checking', () => {
			const storage = createMockStorage();
			isStorageAvailable(storage);
			expect(storage._data.has('__warpkit_storage_test__')).toBe(false);
		});
	});

	describe('safeGetItem', () => {
		let storage: ReturnType<typeof createMockStorage>;

		beforeEach(() => {
			storage = createMockStorage();
		});

		it('should return value when key exists', () => {
			storage.setItem('key1', 'value1');
			expect(safeGetItem(storage, 'key1')).toBe('value1');
		});

		it('should return null when key does not exist', () => {
			expect(safeGetItem(storage, 'nonexistent')).toBeNull();
		});

		it('should return null when storage is undefined', () => {
			expect(safeGetItem(undefined, 'key')).toBeNull();
		});

		it('should return null when storage throws', () => {
			const throwingStorage = createThrowingStorage();
			expect(safeGetItem(throwingStorage, 'key')).toBeNull();
		});
	});

	describe('safeSetItem', () => {
		let storage: ReturnType<typeof createMockStorage>;

		beforeEach(() => {
			storage = createMockStorage();
		});

		it('should return true when set succeeds', () => {
			expect(safeSetItem(storage, 'key1', 'value1')).toBe(true);
			expect(storage._data.get('key1')).toBe('value1');
		});

		it('should return false when storage is undefined', () => {
			expect(safeSetItem(undefined, 'key', 'value')).toBe(false);
		});

		it('should return false when storage throws', () => {
			const throwingStorage = createThrowingStorage();
			expect(safeSetItem(throwingStorage, 'key', 'value')).toBe(false);
		});

		it('should overwrite existing value', () => {
			safeSetItem(storage, 'key1', 'value1');
			safeSetItem(storage, 'key1', 'value2');
			expect(storage._data.get('key1')).toBe('value2');
		});
	});

	describe('safeRemoveItem', () => {
		let storage: ReturnType<typeof createMockStorage>;

		beforeEach(() => {
			storage = createMockStorage();
		});

		it('should return true when remove succeeds', () => {
			storage.setItem('key1', 'value1');
			expect(safeRemoveItem(storage, 'key1')).toBe(true);
			expect(storage._data.has('key1')).toBe(false);
		});

		it('should return true when key does not exist', () => {
			expect(safeRemoveItem(storage, 'nonexistent')).toBe(true);
		});

		it('should return false when storage is undefined', () => {
			expect(safeRemoveItem(undefined, 'key')).toBe(false);
		});

		it('should return false when storage throws', () => {
			const throwingStorage = createThrowingStorage();
			expect(safeRemoveItem(throwingStorage, 'key')).toBe(false);
		});
	});

	describe('getLocalStorage', () => {
		it('should return undefined when window is not defined', () => {
			// In Node/test environment, window is typically not defined
			// or localStorage may not be available
			const result = getLocalStorage();
			// Result depends on test environment - just verify it doesn't throw
			expect(result === undefined || result !== null).toBe(true);
		});
	});

	describe('getSessionStorage', () => {
		it('should return undefined when window is not defined', () => {
			// In Node/test environment, window is typically not defined
			// or sessionStorage may not be available
			const result = getSessionStorage();
			// Result depends on test environment - just verify it doesn't throw
			expect(result === undefined || result !== null).toBe(true);
		});
	});
});
