/**
 * @warpkit/cache
 *
 * Cache implementations for @warpkit/data.
 * Provides E-Tag support with two-tier caching (memory + localStorage).
 */

// Types from this package
export type {
	StorageAdapter,
	MemoryCacheOptions,
	StorageCacheOptions,
	ETagCacheProviderOptions
} from './types.js';

// Re-export CacheProvider interface from @warpkit/data for convenience
export type { CacheProvider, CacheEntry } from '@warpkit/data';

// Cache implementations
export { MemoryCache } from './MemoryCache.js';
export { StorageCache } from './StorageCache.js';
export { ETagCacheProvider } from './ETagCacheProvider.js';

// Storage utilities
export {
	isStorageAvailable,
	safeGetItem,
	safeSetItem,
	safeRemoveItem,
	getLocalStorage,
	getSessionStorage
} from './utils/storage-adapter.js';
