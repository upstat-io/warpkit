/**
 * Two-tier E-Tag aware cache provider.
 *
 * Combines MemoryCache (L1, fast) and StorageCache (L2, persistent) for
 * optimal cache performance with persistence across page reloads.
 *
 * Lookup order: Memory -> Storage -> undefined
 * Write strategy: Write-through to both tiers
 * Promotion: Storage hits are promoted to memory
 *
 * @example
 * const cache = new ETagCacheProvider({
 *   memory: { maxEntries: 200 },
 *   storage: { prefix: 'myapp:cache:' }
 * });
 *
 * await cache.set('key', { data: 'value', timestamp: Date.now() });
 * const entry = await cache.get('key');
 */

import type { CacheProvider, CacheEntry } from '@warpkit/data';
import type { ETagCacheProviderOptions } from './types.js';
import { MemoryCache } from './MemoryCache.js';
import { StorageCache } from './StorageCache.js';

export class ETagCacheProvider implements CacheProvider {
	private readonly memory: MemoryCache;
	private readonly storage: StorageCache;

	constructor(options?: ETagCacheProviderOptions) {
		this.memory = new MemoryCache(options?.memory);
		this.storage = new StorageCache(options?.storage);
	}

	/**
	 * Get a cached entry by key.
	 * Checks memory first, then storage. Storage hits are promoted to memory.
	 * @param key - Cache key to retrieve
	 * @returns The cached entry, or undefined if not found in either tier
	 */
	async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
		// Check memory first (fast path)
		const memoryEntry = this.memory.get<T>(key);
		if (memoryEntry) {
			return memoryEntry;
		}

		// Check storage (slower, but persists across page reloads)
		const storageEntry = this.storage.get<T>(key);
		if (storageEntry) {
			// Promote to memory for faster subsequent access
			this.memory.set(key, storageEntry);
			return storageEntry;
		}

		return undefined;
	}

	/**
	 * Store an entry in both cache tiers (write-through).
	 * @param key - Cache key to store under
	 * @param entry - Cache entry containing data and metadata
	 */
	async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
		// Write-through to both tiers
		this.memory.set(key, entry);
		this.storage.set(key, entry);
	}

	/**
	 * Delete an entry from both cache tiers.
	 * @param key - Cache key to delete
	 */
	async delete(key: string): Promise<void> {
		this.memory.delete(key);
		this.storage.delete(key);
	}

	/**
	 * Delete all entries matching a key prefix from both tiers.
	 * @param prefix - Key prefix to match for deletion
	 */
	async deleteByPrefix(prefix: string): Promise<void> {
		this.memory.deleteByPrefix(prefix);
		this.storage.deleteByPrefix(prefix);
	}

	/**
	 * Clear all entries from both cache tiers.
	 */
	async clear(): Promise<void> {
		this.memory.clear();
		this.storage.clear();
	}
}
