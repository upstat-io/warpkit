/**
 * @warpkit/data Type Definitions
 *
 * Core types for the WarpKit data fetching and mutation system.
 * Provides type-safe data keys via module augmentation with support
 * for both queries and mutations.
 */

import type { ValidatedType } from '@warpkit/validation';

// ============================================================================
// Data Registry (Module Augmentation)
// ============================================================================

/**
 * Registry for type-safe data keys with query and mutation types.
 * Consumers extend this via module augmentation to define their keys.
 *
 * @example
 * declare module '@warpkit/data' {
 *   interface DataRegistry {
 *     monitors: {
 *       data: Monitor[];
 *       mutations: {
 *         create: { input: CreateMonitorInput; output: Monitor };
 *         update: { input: UpdateMonitorInput; output: Monitor };
 *         remove: { input: string; output: void };
 *       };
 *     };
 *   }
 * }
 */
export interface DataRegistry {
	// Extended by consumer via module augmentation
}

/**
 * Union type of all registered data keys.
 * Becomes `never` if no keys are registered.
 */
export type DataKey = keyof DataRegistry & string;

/**
 * Extract query data type from registry.
 * Returns the 'data' field if registry entry is object with data, otherwise the entry itself.
 */
export type DataType<K extends DataKey> = DataRegistry[K] extends { data: infer D } ? D : DataRegistry[K];

/**
 * Extract mutations config from registry.
 * Returns the mutations object if defined, otherwise never.
 */
export type MutationsConfig<K extends DataKey> = DataRegistry[K] extends { mutations: infer M } ? M : never;

// ============================================================================
// Backwards Compatibility (Deprecated)
// ============================================================================

/**
 * @deprecated Use DataRegistry instead
 */
export interface QueryKeyRegistry extends DataRegistry {}

/**
 * @deprecated Use DataKey instead
 */
export type QueryKey = DataKey;

// ============================================================================
// Mutation Config Types
// ============================================================================

/**
 * Definition for a single mutation's input and output types.
 */
export interface MutationDef<TInput = unknown, TOutput = unknown> {
	input: TInput;
	output: TOutput;
}

/**
 * Configuration for a mutation endpoint.
 */
export interface MutationConfig {
	/** HTTP method for the mutation */
	method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/**
	 * URL for the mutation. If omitted, uses the base data URL.
	 * Can be a string with :param placeholders or a function.
	 */
	url?: string | ((input: unknown) => string);
}

// ============================================================================
// Data Configuration
// ============================================================================

/**
 * Configuration for a single data key.
 * Defines the URL pattern and caching behavior.
 */
export interface DataKeyConfig<K extends DataKey> {
	/** The data key identifier */
	key: K;
	/** URL or function that builds URL from params */
	url: string | ((params: Record<string, string>) => string);
	/** Event names that trigger cache invalidation */
	invalidateOn?: string[];
	/** Default time in ms before data is considered stale. Copied to CacheEntry at cache time. */
	staleTime?: number;
	/** Whether to cache responses. Defaults to true. Set to false for point-in-time queries with dynamic params. */
	cache?: boolean;
	/** Optional ValidatedType for response validation */
	responseSchema?: ValidatedType<DataType<K>>;
}

/**
 * @deprecated Use DataKeyConfig instead
 */
export type QueryKeyConfig<K extends DataKey> = DataKeyConfig<K>;

/**
 * Configuration for DataClient initialization.
 *
 * @example
 * const config: DataClientConfig = {
 *   baseUrl: '/api',
 *   timeout: 10000,
 *   keys: {
 *     monitors: { key: 'monitors', url: '/monitors', staleTime: 30000 },
 *     'monitors/:id': {
 *       key: 'monitors/:id',
 *       url: (params) => `/monitors/${params.id}`,
 *       invalidateOn: ['monitor:updated']
 *     }
 *   }
 * };
 */
export interface DataClientConfig {
	/** Map of data keys to their configurations */
	keys: Record<DataKey, DataKeyConfig<DataKey>>;
	/** Base URL prepended to all data URLs */
	baseUrl?: string;
	/** Default timeout for fetch requests in ms */
	timeout?: number;
	/** Request interceptor for adding headers, auth, etc. */
	onRequest?: (request: Request) => Request | Promise<Request>;
}

/**
 * @deprecated Use DataClientConfig instead
 */
export type QueryClientConfig = DataClientConfig;

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Interface for pluggable cache implementations.
 * DataClient uses this to store and retrieve cached data.
 *
 * @example
 * class MyCache implements CacheProvider {
 *   private storage = new Map<string, CacheEntry<unknown>>();
 *
 *   async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
 *     return this.storage.get(key) as CacheEntry<T> | undefined;
 *   }
 *   async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
 *     this.storage.set(key, entry);
 *   }
 *   async delete(key: string): Promise<void> {
 *     this.storage.delete(key);
 *   }
 *   async deleteByPrefix(prefix: string): Promise<void> {
 *     for (const key of this.storage.keys()) {
 *       if (key.startsWith(prefix)) this.storage.delete(key);
 *     }
 *   }
 *   async clear(): Promise<void> {
 *     this.storage.clear();
 *   }
 * }
 */
export interface CacheProvider {
	/** Get a cached entry by key */
	get<T>(key: string): Promise<CacheEntry<T> | undefined>;
	/** Store an entry in the cache */
	set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
	/** Delete a specific entry */
	delete(key: string): Promise<void>;
	/** Delete all entries matching a prefix */
	deleteByPrefix(prefix: string): Promise<void>;
	/** Clear all cached entries */
	clear(): Promise<void>;
	/** Create a new cache provider scoped to a key. Optional. */
	createScoped?(scope: string): CacheProvider;
}

/**
 * A cached data entry with metadata.
 */
export interface CacheEntry<T = unknown> {
	/** The cached data */
	data: T;
	/** E-Tag header value for conditional requests */
	etag?: string;
	/** When the entry was cached (epoch ms) */
	timestamp: number;
	/** Time in ms before this entry is considered stale. Copied from DataKeyConfig when cached. */
	staleTime?: number;
}

// ============================================================================
// Fetch Result Types
// ============================================================================

/**
 * Result of a fetch operation from DataClient.
 */
export interface FetchResult<T> {
	/** The fetched data */
	data: T;
	/** Whether data was served from cache */
	fromCache: boolean;
	/** Whether server returned 304 Not Modified */
	notModified: boolean;
}

// ============================================================================
// Query State (useQuery Return Type)
// ============================================================================

/**
 * Reactive state returned by useQuery hook.
 * Uses readonly properties for Svelte 5 reactivity pattern.
 *
 * @example
 * const monitors = useQuery({ key: 'monitors' });
 *
 * {#if monitors.isLoading}
 *   <Spinner />
 * {:else if monitors.isError}
 *   <Error error={monitors.error} />
 * {:else}
 *   {#each monitors.data as monitor}
 *     <MonitorCard {monitor} />
 *   {/each}
 * {/if}
 */
export interface QueryState<T> {
	/** The fetched data, undefined while loading */
	readonly data: T | undefined;
	/** Error if fetch failed, null otherwise */
	readonly error: Error | null;
	/** True while initial fetch is in progress */
	readonly isLoading: boolean;
	/** True if fetch resulted in error */
	readonly isError: boolean;
	/** True if data was fetched successfully */
	readonly isSuccess: boolean;
	/** Manually trigger a refetch */
	refetch: () => Promise<void>;
}

// ============================================================================
// useData Types
// ============================================================================

/**
 * Configuration for useData hook.
 */
export interface UseDataConfig<K extends DataKey> {
	/** URL or function that builds URL from params */
	url: string | ((params: Record<string, string>) => string);
	/** Time in ms before data is considered stale */
	staleTime?: number;
	/** Event names that trigger cache invalidation */
	invalidateOn?: string[];
	/** Mutation configurations keyed by mutation name */
	mutations?: Record<string, MutationConfig>;
	/** Whether the query is enabled (default: true). Can be boolean or getter function. */
	enabled?: boolean | (() => boolean);
}

/**
 * Single mutation's state and callable handle.
 * Can be called directly to execute the mutation, with state properties attached.
 *
 * @example
 * // Call the mutation
 * await monitors.create({ name: 'New Monitor' });
 *
 * // Check mutation state
 * if (monitors.create.isPending) {
 *   // Show loading
 * }
 * if (monitors.create.error) {
 *   // Show error
 * }
 */
export interface MutationHandle<TInput, TOutput> {
	/** Execute the mutation */
	(input: TInput): Promise<TOutput>;
	/** True while mutation is executing */
	readonly isPending: boolean;
	/** Error if mutation failed */
	readonly error: Error | null;
	/** Last successful result */
	readonly data: TOutput | undefined;
	/** Reset mutation state */
	reset: () => void;
}

/**
 * Return type of useData hook - combines query state with typed mutations.
 *
 * @example
 * const monitors = useData('monitors', config);
 *
 * // Query state at root level
 * monitors.data              // Monitor[]
 * monitors.isLoading         // boolean
 * monitors.error             // Error | null
 * monitors.refetch()         // manual refetch
 *
 * // Mutations as callable handles
 * monitors.create(input)     // Promise<Monitor>
 * monitors.create.isPending  // boolean
 * monitors.create.error      // Error | null
 */
export type DataState<K extends DataKey> = {
	/** The fetched data, undefined while loading */
	readonly data: DataType<K> | undefined;
	/** True while initial fetch is in progress */
	readonly isLoading: boolean;
	/** Error if fetch failed, null otherwise */
	readonly error: Error | null;
	/** True if data was fetched successfully */
	readonly isSuccess: boolean;
	/** True if fetch resulted in error */
	readonly isError: boolean;
	/** Manually trigger a refetch */
	refetch: () => Promise<void>;
} & {
	/** Mutations as typed callable handles */
	[M in keyof MutationsConfig<K>]: MutationsConfig<K>[M] extends MutationDef<infer TInput, infer TOutput>
		? MutationHandle<TInput, TOutput>
		: never;
};

// ============================================================================
// Hook Options
// ============================================================================

/**
 * Options for useQuery hook.
 *
 * @example
 * // Basic query
 * useQuery({ key: 'monitors' });
 *
 * @example
 * // Dynamic route with params
 * useQuery({ key: 'monitors/:id', params: { id: monitorId } });
 *
 * @example
 * // Conditional fetching (static)
 * useQuery({ key: 'monitors/:id', params: { id }, enabled: !!id });
 *
 * @example
 * // Conditional fetching (reactive - use getter for Svelte 5 reactivity)
 * useQuery({ key: 'monitors/:id', params: { id }, enabled: () => !!id });
 */
export interface UseQueryOptions<K extends DataKey> {
	/** The data key to fetch */
	key: K;
	/** URL parameters for dynamic routes */
	params?: Record<string, string>;
	/**
	 * If false, query will not execute.
	 * Can be a boolean or a getter function for reactive behavior.
	 */
	enabled?: boolean | (() => boolean);
	/**
	 * Automatically refetch data on this interval (in ms).
	 * Bypasses cache on each interval fetch to always get fresh data.
	 * The initial fetch still uses cache for fast first paint.
	 * Timer is cleaned up when the component unmounts or enabled becomes false.
	 */
	refetchInterval?: number;
}

// ============================================================================
// Mutation Hook Types
// ============================================================================

/**
 * Options for useMutation hook (standalone mutations).
 */
export interface UseMutationOptions<TData, TError = Error, TVariables = void> {
	/** Function that performs the mutation */
	mutationFn: (variables: TVariables) => Promise<TData>;
	/** Called when mutation succeeds */
	onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
	/** Called when mutation fails */
	onError?: (error: TError, variables: TVariables) => void | Promise<void>;
	/** Called when mutation completes (success or error) */
	onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void | Promise<void>;
}

/**
 * State returned by useMutation hook.
 */
export interface MutationState<TData, TError = Error, TVariables = void> {
	/** Execute the mutation */
	mutate: (variables: TVariables) => Promise<TData>;
	/** Execute mutation and return promise (alias for mutate) */
	mutateAsync: (variables: TVariables) => Promise<TData>;
	/** True while mutation is executing */
	readonly isPending: boolean;
	/** True if mutation succeeded */
	readonly isSuccess: boolean;
	/** True if mutation failed */
	readonly isError: boolean;
	/** True if mutation hasn't been called yet */
	readonly isIdle: boolean;
	/** Error if mutation failed */
	readonly error: TError | null;
	/** Last successful result */
	readonly data: TData | undefined;
	/** Reset mutation state to idle */
	reset: () => void;
}

// ============================================================================
// Event Integration
// ============================================================================

/**
 * Minimal interface for event subscriptions.
 * Decoupled from WarpKit events to keep @warpkit/data independent.
 */
export interface DataEventEmitter {
	/** Subscribe to an event, returns unsubscribe function */
	on(event: string, handler: () => void | Promise<void>): () => void;
}

/**
 * @deprecated Use DataEventEmitter instead
 */
export type QueryEventEmitter = DataEventEmitter;

/**
 * Options for DataClient constructor.
 *
 * @example
 * // With custom cache provider
 * const options: DataClientOptions = {
 *   cache: new ETagCacheProvider(memoryCache, storageCache)
 * };
 *
 * @example
 * // With event-driven invalidation
 * const options: DataClientOptions = {
 *   cache: cacheProvider,
 *   events: { on: (event, handler) => warpkitEvents.on(event, handler) }
 * };
 */
export interface DataClientOptions {
	/** Cache provider for storing fetched data */
	cache?: CacheProvider;
	/** Event emitter for invalidation subscriptions */
	events?: DataEventEmitter;
}

/**
 * @deprecated Use DataClientOptions instead
 */
export type QueryClientOptions = DataClientOptions;
