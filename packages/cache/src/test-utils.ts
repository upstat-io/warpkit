/**
 * Shared test utilities for @warpkit/cache tests.
 *
 * NOT exported from index.ts - for internal test use only.
 */

import type { CacheEntry } from '@warpkit/data';
import type { StorageAdapter } from './types.js';

/**
 * Creates a cache entry with the given data.
 * @param data - The data to cache
 * @param etag - Optional E-Tag value
 * @param staleTime - Optional stale time in milliseconds
 */
export function createEntry<T>(data: T, etag?: string, staleTime?: number): CacheEntry<T> {
	return {
		data,
		timestamp: Date.now(),
		etag,
		staleTime
	};
}

/**
 * Creates a mock storage adapter backed by a Map.
 * Implements full Storage interface for testing deleteByPrefix iteration.
 */
export function createMockStorage(): StorageAdapter & { _data: Map<string, string> } & Storage {
	const data = new Map<string, string>();
	return {
		_data: data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
		removeItem: (key: string) => {
			data.delete(key);
		},
		// For deleteByPrefix iteration
		get length() {
			return data.size;
		},
		key: (index: number) => {
			const keys = Array.from(data.keys());
			return keys[index] ?? null;
		},
		clear: () => {
			data.clear();
		}
	};
}
