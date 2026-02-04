/**
 * @warpkit/cache Type Definitions
 *
 * Configuration types for cache implementations.
 */

// ============================================================================
// Memory Cache Options
// ============================================================================

/**
 * Options for MemoryCache configuration.
 */
export interface MemoryCacheOptions {
	/** Maximum number of entries before LRU eviction (default: 100) */
	maxEntries?: number;
}

// ============================================================================
// Storage Cache Options
// ============================================================================

/**
 * Minimal storage interface compatible with localStorage/sessionStorage.
 * Allows custom implementations for SSR or testing.
 */
export interface StorageAdapter {
	/** Get an item by key */
	getItem(key: string): string | null;
	/** Set an item */
	setItem(key: string, value: string): void;
	/** Remove an item */
	removeItem(key: string): void;
}

/**
 * Options for StorageCache configuration.
 */
export interface StorageCacheOptions {
	/** Key prefix for localStorage entries (default: 'warpkit:') */
	prefix?: string;
	/** Storage implementation (default: localStorage) */
	storage?: StorageAdapter;
}

// ============================================================================
// E-Tag Cache Provider Options
// ============================================================================

/**
 * Options for ETagCacheProvider configuration.
 * Combines memory and storage cache options for two-tier caching.
 *
 * @example
 * const cache = new ETagCacheProvider({
 *   memory: { maxEntries: 200 },
 *   storage: { prefix: 'myapp:cache:' }
 * });
 */
export interface ETagCacheProviderOptions {
	/** Memory cache (L1) options */
	memory?: MemoryCacheOptions;
	/** Storage cache (L2) options */
	storage?: StorageCacheOptions;
}
