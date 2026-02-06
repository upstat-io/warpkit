/**
 * @warpkit/data DataClient
 *
 * Core data client that coordinates fetching, caching, mutations, and invalidation.
 * Supports config-driven queries with URL interpolation, E-Tag handling,
 * and event-driven cache invalidation.
 */

import type {
	CacheEntry,
	CacheProvider,
	DataClientConfig,
	DataClientOptions,
	DataEventEmitter,
	DataKey,
	DataKeyConfig,
	DataType,
	FetchResult
} from './types';
import { NoCacheProvider } from './NoCacheProvider';

/**
 * Options for mutation execution.
 */
export interface MutateOptions {
	/** HTTP method for the mutation */
	method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** Request body (will be JSON stringified) */
	body?: unknown;
}

/**
 * Data client for config-driven data fetching and mutations with caching.
 *
 * @example
 * const config: DataClientConfig = {
 *   baseUrl: '/api',
 *   keys: {
 *     monitors: { key: 'monitors', url: '/monitors' },
 *     'monitors/:id': { key: 'monitors/:id', url: '/monitors/:id' }
 *   }
 * };
 *
 * const client = new DataClient(config, { cache: new ETagCacheProvider() });
 * const result = await client.fetch('monitors/:id', { id: '123' });
 *
 * // Execute mutations
 * await client.mutate('/monitors', { method: 'POST', body: { name: 'New Monitor' } });
 */
export class DataClient {
	private readonly config: DataClientConfig;
	private cache: CacheProvider;
	private events: DataEventEmitter | null;
	private readonly timeout: number;
	private eventUnsubscribes: Array<() => void> = [];

	/**
	 * Create a new DataClient.
	 *
	 * Automatically subscribes to invalidateOn events for all configured keys.
	 * When an event fires, the corresponding cache entries are cleared immediately,
	 * regardless of which components are currently mounted. This ensures that
	 * when a component mounts and calls fetch(), it always gets fresh data
	 * after an invalidation event.
	 *
	 * @param config - Data configuration with keys and base URL
	 * @param options - Optional cache and event emitter
	 */
	public constructor(config: DataClientConfig, options?: DataClientOptions) {
		this.config = config;
		this.cache = options?.cache ?? new NoCacheProvider();
		this.events = options?.events ?? null;
		this.timeout = config.timeout ?? 30000;

		// Subscribe to invalidation events at the DataClient level.
		// This ensures cache is cleared even when no component is mounted.
		this.subscribeToInvalidationEvents();
	}

	/**
	 * Subscribe to invalidateOn events for all configured keys.
	 * Clears cache entries when events fire so subsequent fetches
	 * hit the network instead of returning stale data.
	 */
	private subscribeToInvalidationEvents(): void {
		if (!this.events) return;

		// Build a map: event → keys to invalidate
		const eventToKeys = new Map<string, DataKey[]>();

		for (const [key, keyConfig] of Object.entries(this.config.keys)) {
			const invalidateOn = (keyConfig as DataKeyConfig<DataKey>).invalidateOn;
			if (!invalidateOn) continue;

			for (const event of invalidateOn) {
				const existing = eventToKeys.get(event) ?? [];
				existing.push(key as DataKey);
				eventToKeys.set(event, existing);
			}
		}

		// Subscribe once per event, invalidating all affected keys
		for (const [event, keys] of eventToKeys) {
			const unsub = this.events.on(event, async () => {
				for (const key of keys) {
					await this.invalidate(key);
				}
			});
			this.eventUnsubscribes.push(unsub);
		}
	}

	/**
	 * Fetch data for a configured data key.
	 *
	 * @param key - The data key to fetch
	 * @param params - URL parameters for dynamic routes
	 * @returns Fetch result with data and cache metadata
	 * @throws Error if key is not configured or params are missing
	 *
	 * @example
	 * // Simple fetch
	 * const { data } = await client.fetch('monitors');
	 *
	 * @example
	 * // With URL parameters
	 * const { data, fromCache } = await client.fetch('monitors/:id', { id: '123' });
	 */
	public async fetch<K extends DataKey>(
		key: K,
		params?: Record<string, string>
	): Promise<FetchResult<unknown>> {
		const keyConfig = this.config.keys[key];
		if (!keyConfig) {
			throw new Error(`Unknown data key: ${key}`);
		}

		const url = this.resolveUrl(keyConfig.url, params);
		const cacheKey = this.buildCacheKey(key, params);

		// Check cache first
		const cached = await this.cache.get<unknown>(cacheKey);

		// If we have fresh cached data, return it immediately
		if (cached && this.isFresh(cached)) {
			return { data: cached.data, fromCache: true, notModified: false };
		}

		// Build request with E-Tag if available (for stale-while-revalidate)
		const headers: HeadersInit = {};
		if (cached?.etag) {
			headers['If-None-Match'] = cached.etag;
		}

		// Execute fetch with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			let request = new Request(url, { headers, signal: controller.signal });

			// Apply onRequest hook if configured
			if (this.config.onRequest) {
				request = await this.config.onRequest(request);
			}

			const response = await fetch(request);
			clearTimeout(timeoutId);

			// Handle 304 Not Modified
			if (response.status === 304 && cached) {
				return { data: cached.data, fromCache: true, notModified: true };
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			const etag = response.headers.get('etag') ?? undefined;

			// Store in cache
			await this.cache.set(cacheKey, {
				data,
				etag,
				timestamp: Date.now(),
				staleTime: keyConfig.staleTime
			});

			return { data, fromCache: false, notModified: false };
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Execute a mutation (POST/PUT/PATCH/DELETE).
	 *
	 * @param url - The URL to send the mutation to
	 * @param options - Mutation options including method and body
	 * @returns The response data
	 * @throws Error if request fails
	 *
	 * @example
	 * // Create a new resource
	 * const monitor = await client.mutate('/monitors', {
	 *   method: 'POST',
	 *   body: { name: 'New Monitor', url: 'https://example.com' }
	 * });
	 *
	 * @example
	 * // Update a resource
	 * await client.mutate('/monitors/123', {
	 *   method: 'PUT',
	 *   body: { name: 'Updated Name' }
	 * });
	 *
	 * @example
	 * // Delete a resource
	 * await client.mutate('/monitors/123', { method: 'DELETE' });
	 */
	public async mutate<T>(url: string, options: MutateOptions): Promise<T> {
		const fullUrl = this.config.baseUrl ? `${this.config.baseUrl}${url}` : url;

		const headers: HeadersInit = {
			'Content-Type': 'application/json'
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			let request = new Request(fullUrl, {
				method: options.method,
				headers,
				body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
				signal: controller.signal
			});

			// Apply onRequest hook if configured
			if (this.config.onRequest) {
				request = await this.config.onRequest(request);
			}

			const response = await fetch(request);
			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Handle 204 No Content
			if (response.status === 204) {
				return undefined as T;
			}

			return (await response.json()) as T;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Get cached data without fetching.
	 *
	 * @param key - The data key
	 * @param params - URL parameters for dynamic routes
	 * @returns The cached data or undefined if not cached
	 *
	 * @example
	 * const cached = await client.getQueryData('monitors');
	 */
	public async getQueryData<K extends DataKey>(
		key: K,
		params?: Record<string, string>
	): Promise<DataType<K> | undefined> {
		const cacheKey = this.buildCacheKey(key, params);
		const cached = await this.cache.get<DataType<K>>(cacheKey);
		return cached?.data;
	}

	/**
	 * Set data in cache (for optimistic updates).
	 *
	 * @param key - The data key
	 * @param data - The data to cache
	 * @param params - URL parameters for dynamic routes
	 *
	 * @example
	 * // Optimistic update
	 * const newMonitor = { id: '123', name: 'New Monitor' };
	 * await client.setQueryData('monitors/:id', newMonitor, { id: '123' });
	 */
	public async setQueryData<K extends DataKey>(
		key: K,
		data: DataType<K>,
		params?: Record<string, string>
	): Promise<void> {
		const cacheKey = this.buildCacheKey(key, params);
		const keyConfig = this.config.keys[key];
		await this.cache.set(cacheKey, {
			data,
			timestamp: Date.now(),
			staleTime: keyConfig?.staleTime
		});
	}

	/**
	 * Invalidate a cached data key.
	 *
	 * @param key - The data key to invalidate
	 * @param params - URL parameters if the key has dynamic segments
	 *
	 * @example
	 * await client.invalidate('monitors/:id', { id: '123' });
	 */
	public async invalidate(key: DataKey, params?: Record<string, string>): Promise<void> {
		const cacheKey = this.buildCacheKey(key, params);
		await this.cache.delete(cacheKey);
	}

	/**
	 * Invalidate all cached entries matching a prefix.
	 *
	 * @param prefix - The key prefix to match
	 *
	 * @example
	 * // Invalidate all monitor-related data
	 * await client.invalidateByPrefix('monitors');
	 */
	public async invalidateByPrefix(prefix: string): Promise<void> {
		await this.cache.deleteByPrefix(prefix);
	}

	/**
	 * Get the configuration for a data key.
	 *
	 * @param key - The data key
	 * @returns The key configuration or undefined if not found
	 */
	public getKeyConfig<K extends DataKey>(key: K): DataKeyConfig<K> | undefined {
		return this.config.keys[key] as DataKeyConfig<K> | undefined;
	}

	/**
	 * Get the event emitter for invalidation subscriptions.
	 *
	 * @returns The event emitter or null if not configured
	 */
	public getEvents(): DataEventEmitter | null {
		return this.events;
	}

	/**
	 * Get the base URL for this client.
	 *
	 * @returns The base URL or empty string if not configured
	 */
	public getBaseUrl(): string {
		return this.config.baseUrl ?? '';
	}

	/**
	 * Clear all cached data from memory and storage.
	 */
	public async clearCache(): Promise<void> {
		await this.cache.clear();
	}

	/**
	 * Scope cache to a key. Requires cache with createScoped support.
	 * If the cache doesn't support scoping, this is a no-op.
	 * @param scope - Scope identifier (e.g., user ID)
	 */
	public scopeCache(scope: string): void {
		const scoped = this.cache.createScoped?.(scope);
		if (scoped) {
			this.cache = scoped;
		}
	}

	/**
	 * Set the cache provider (for late injection).
	 *
	 * @param cache - The cache provider to use
	 */
	public setCache(cache: CacheProvider): void {
		this.cache = cache;
	}

	/**
	 * Set the event emitter (for late injection).
	 *
	 * @param events - The event emitter to use
	 */
	public setEvents(events: DataEventEmitter): void {
		this.events = events;
	}

	/**
	 * Resolve a URL template with parameters.
	 *
	 * Supports two URL patterns:
	 * 1. String template with `:param` placeholders (e.g., `/monitors/:id`)
	 * 2. Function that receives params and returns URL
	 *
	 * Note: For function URLs, the consumer is responsible for encoding.
	 * This enables custom encoding strategies for complex URLs.
	 */
	public resolveUrl(
		urlTemplate: string | ((params: Record<string, string>) => string),
		params?: Record<string, string>
	): string {
		if (typeof urlTemplate === 'function') {
			return (this.config.baseUrl ?? '') + urlTemplate(params ?? {});
		}

		let url = urlTemplate;
		const paramMatches = url.match(/:(\w+)/g) ?? [];

		for (const match of paramMatches) {
			const paramName = match.slice(1);
			const value = params?.[paramName];
			if (value === undefined) {
				throw new Error(`Missing param: ${paramName}`);
			}
			url = url.replace(match, encodeURIComponent(value));
		}

		return (this.config.baseUrl ?? '') + url;
	}

	/**
	 * Check if a cache entry is still fresh (within staleTime).
	 *
	 * An entry is considered fresh if it has a staleTime defined and
	 * the elapsed time since caching is less than the staleTime.
	 * Entries without staleTime are always considered stale.
	 *
	 * @param entry - The cache entry to check
	 * @returns True if the entry is fresh, false if stale
	 */
	private isFresh(entry: CacheEntry<unknown>): boolean {
		if (!entry.staleTime) {
			return false; // No staleTime means always stale
		}
		const age = Date.now() - entry.timestamp;
		return age < entry.staleTime;
	}

	/**
	 * Build a cache key from data key and params.
	 *
	 * Creates a deterministic cache key by sorting parameters alphabetically.
	 * Parameter values are URL-encoded to handle special characters safely.
	 */
	private buildCacheKey(key: DataKey, params?: Record<string, string>): string {
		if (!params || Object.keys(params).length === 0) {
			return key;
		}

		// Sort params for consistent cache keys, encode values for safety
		const sortedParams = Object.keys(params)
			.sort()
			.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
			.join('&');

		return `${key}?${sortedParams}`;
	}
}

/**
 * @deprecated Use DataClient instead
 */
export const QueryClient = DataClient;
