/**
 * @warpkit/data NoCacheProvider
 *
 * A no-op cache provider for when caching is disabled.
 * Used as the default cache provider in DataClient.
 */

import type { CacheEntry, CacheProvider } from './types';

/**
 * No-op cache provider that never stores or returns data.
 * Used when caching is disabled or as a fallback.
 *
 * @example
 * const client = new DataClient(config, { cache: new NoCacheProvider() });
 * // All fetches will hit the network, no caching
 */
export class NoCacheProvider implements CacheProvider {
	/**
	 * Create a new NoCacheProvider.
	 */
	public constructor() {
		// No initialization needed
	}

	/**
	 * Always returns undefined - no data is cached.
	 */
	public async get<T>(_key: string): Promise<CacheEntry<T> | undefined> {
		return undefined;
	}

	/**
	 * No-op - data is not stored.
	 */
	public async set<T>(_key: string, _entry: CacheEntry<T>): Promise<void> {
		// No-op
	}

	/**
	 * No-op - nothing to delete.
	 */
	public async delete(_key: string): Promise<void> {
		// No-op
	}

	/**
	 * No-op - nothing to delete.
	 */
	public async deleteByPrefix(_prefix: string): Promise<void> {
		// No-op
	}

	/**
	 * No-op - nothing to clear.
	 */
	public async clear(): Promise<void> {
		// No-op
	}
}
