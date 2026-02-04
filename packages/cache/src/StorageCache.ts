/**
 * localStorage-backed cache implementation.
 *
 * Stores cache entries as JSON in localStorage (or custom storage).
 * Handles quota exceeded and corrupted JSON gracefully.
 *
 * @example
 * const cache = new StorageCache({ prefix: 'myapp:' });
 * cache.set('key', { data: 'value', timestamp: Date.now() });
 * const entry = cache.get('key');
 */

import type { CacheEntry } from '@warpkit/data';
import type { StorageCacheOptions, StorageAdapter } from './types.js';

const DEFAULT_PREFIX = 'warpkit:';

/**
 * Check if we're in a browser environment with localStorage available.
 */
function getDefaultStorage(): StorageAdapter | undefined {
	if (typeof window !== 'undefined' && window.localStorage) {
		return window.localStorage;
	}
	return undefined;
}

/**
 * Type guard to check if storage supports iteration (has length and key methods).
 * Full Storage interface (localStorage/sessionStorage) supports these, minimal StorageAdapter does not.
 */
function isIterableStorage(storage: StorageAdapter): storage is Storage {
	return 'length' in storage && 'key' in storage;
}

export class StorageCache {
	private readonly prefix: string;
	private readonly storage: StorageAdapter | undefined;

	constructor(options?: StorageCacheOptions) {
		this.prefix = options?.prefix ?? DEFAULT_PREFIX;
		this.storage = options?.storage ?? getDefaultStorage();
	}

	/**
	 * Get a cached entry by key.
	 * Returns undefined if not found or if JSON is corrupted.
	 * @param key - Cache key to retrieve
	 * @returns The cached entry, or undefined if not found or corrupted
	 */
	public get<T>(key: string): CacheEntry<T> | undefined {
		if (!this.storage) return undefined;

		const fullKey = this.prefix + key;
		try {
			const raw = this.storage.getItem(fullKey);
			if (!raw) return undefined;
			return JSON.parse(raw) as CacheEntry<T>;
		} catch {
			// Corrupted JSON - delete and return undefined
			try {
				this.storage.removeItem(fullKey);
			} catch {
				// Ignore removal errors
			}
			return undefined;
		}
	}

	/**
	 * Store an entry in the cache.
	 * Fails silently if quota is exceeded.
	 * @param key - Cache key to store under
	 * @param entry - Cache entry containing data and metadata
	 */
	public set<T>(key: string, entry: CacheEntry<T>): void {
		if (!this.storage) return;

		const fullKey = this.prefix + key;
		try {
			this.storage.setItem(fullKey, JSON.stringify(entry));
		} catch {
			// Quota exceeded or other error - fail silently in production
			if (import.meta.env?.DEV) {
				console.warn(`[WarpKit Cache] Failed to store ${key} (quota exceeded?)`);
			}
		}
	}

	/**
	 * Delete a specific entry.
	 * @param key - Cache key to delete
	 */
	public delete(key: string): void {
		if (!this.storage) return;

		const fullKey = this.prefix + key;
		try {
			this.storage.removeItem(fullKey);
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Delete all entries matching a key prefix.
	 * Note: This iterates all localStorage keys, which may be slow for large storage.
	 * @param prefix - Key prefix to match for deletion
	 */
	public deleteByPrefix(prefix: string): void {
		if (!this.storage) return;

		const fullPrefix = this.prefix + prefix;
		const keysToDelete: string[] = [];

		// Collect keys to delete (can't modify during iteration in all browsers)
		try {
			// localStorage/sessionStorage support iteration via length/key()
			if (isIterableStorage(this.storage)) {
				for (let i = 0; i < this.storage.length; i++) {
					const key = this.storage.key(i);
					if (key && key.startsWith(fullPrefix)) {
						keysToDelete.push(key);
					}
				}
			}
		} catch {
			// If iteration fails, bail out
			return;
		}

		// Delete collected keys
		for (const key of keysToDelete) {
			try {
				this.storage.removeItem(key);
			} catch {
				// Ignore individual removal errors
			}
		}
	}

	/**
	 * Clear all entries with our prefix.
	 */
	public clear(): void {
		this.deleteByPrefix('');
	}
}
