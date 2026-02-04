/**
 * In-memory LRU cache implementation.
 *
 * Uses Map's insertion order to implement LRU eviction.
 * When capacity is reached, the oldest (least recently used) entry is evicted.
 *
 * @example
 * const cache = new MemoryCache({ maxEntries: 100 });
 * cache.set('key', { data: 'value', timestamp: Date.now() });
 * const entry = cache.get('key');
 */

import type { CacheEntry } from '@warpkit/data';
import type { MemoryCacheOptions } from './types.js';

const DEFAULT_MAX_ENTRIES = 100;

export class MemoryCache {
	private readonly cache = new Map<string, CacheEntry<unknown>>();
	private readonly maxEntries: number;

	constructor(options?: MemoryCacheOptions) {
		this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
	}

	/**
	 * Get a cached entry by key.
	 * Moves the entry to the end of the Map (most recently used).
	 * @param key - Cache key to retrieve
	 * @returns The cached entry, or undefined if not found
	 */
	public get<T>(key: string): CacheEntry<T> | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		// Move to end (most recently used) by deleting and re-setting
		this.cache.delete(key);
		this.cache.set(key, entry);

		return entry as CacheEntry<T>;
	}

	/**
	 * Store an entry in the cache.
	 * Evicts the oldest entry if cache is at capacity.
	 * @param key - Cache key to store under
	 * @param entry - Cache entry containing data and metadata
	 */
	public set<T>(key: string, entry: CacheEntry<T>): void {
		// If key already exists, delete it first to update position
		this.cache.delete(key);

		// Evict oldest entry if at capacity
		if (this.cache.size >= this.maxEntries && this.maxEntries > 0) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}

		// Only set if maxEntries > 0 (maxEntries = 0 means cache disabled)
		if (this.maxEntries > 0) {
			this.cache.set(key, entry);
		}
	}

	/**
	 * Delete a specific entry.
	 * @param key - Cache key to delete
	 */
	public delete(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Delete all entries matching a key prefix.
	 * @param prefix - Key prefix to match for deletion
	 */
	public deleteByPrefix(prefix: string): void {
		for (const key of this.cache.keys()) {
			if (key.startsWith(prefix)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cached entries.
	 */
	public clear(): void {
		this.cache.clear();
	}

	/**
	 * Get the current number of entries in the cache.
	 */
	public size(): number {
		return this.cache.size;
	}
}
