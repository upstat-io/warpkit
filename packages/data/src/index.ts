/**
 * @warpkit/data
 *
 * Type-safe data fetching and mutations with pluggable caching for WarpKit.
 */

// ============================================================================
// Primary Exports (New API)
// ============================================================================

// Types
export type {
	// Data Registry
	DataRegistry,
	DataKey,
	DataType,
	MutationsConfig,
	// Configuration
	DataKeyConfig,
	DataClientConfig,
	DataClientOptions,
	DataEventEmitter,
	// Cache
	CacheProvider,
	CacheEntry,
	FetchResult,
	// useData types
	UseDataConfig,
	MutationConfig,
	MutationDef,
	MutationHandle,
	DataState,
	// useQuery types
	QueryState,
	UseQueryOptions,
	// useMutation types
	UseMutationOptions,
	MutationState
} from './types.js';

// Context
export { DATA_CLIENT_CONTEXT, getDataClient } from './context.js';

// Classes
export { DataClient } from './DataClient.js';
export { NoCacheProvider } from './NoCacheProvider.js';

// Components
export { default as DataClientProvider } from './DataClientProvider.svelte';

// Hooks
export { useData } from './useData.svelte.js';
export { useMutation } from './useMutation.svelte.js';
export { useQuery } from './hooks.svelte.js';

// ============================================================================
// Backwards Compatibility (Deprecated)
// These exports are maintained for backwards compatibility only.
// Please migrate to the new API:
//   - QueryClient -> DataClient
//   - QueryClientProvider -> DataClientProvider
//   - QueryKeyRegistry -> DataRegistry
//   - getQueryClient -> getDataClient
// ============================================================================

/**
 * @deprecated Use `DataRegistry` instead. Will be removed in v1.0.
 */
export type { QueryKeyRegistry } from './types.js';

/**
 * @deprecated Use `DataKey` instead. Will be removed in v1.0.
 */
export type { QueryKey } from './types.js';

/**
 * @deprecated Use `DataKeyConfig` instead. Will be removed in v1.0.
 */
export type { QueryKeyConfig } from './types.js';

/**
 * @deprecated Use `DataClientConfig` instead. Will be removed in v1.0.
 */
export type { QueryClientConfig } from './types.js';

/**
 * @deprecated Use `DataClientOptions` instead. Will be removed in v1.0.
 */
export type { QueryClientOptions } from './types.js';

/**
 * @deprecated Use `DataEventEmitter` instead. Will be removed in v1.0.
 */
export type { QueryEventEmitter } from './types.js';

/**
 * @deprecated Use `DATA_CLIENT_CONTEXT` instead. Will be removed in v1.0.
 */
export { QUERY_CLIENT_CONTEXT } from './context.js';

/**
 * @deprecated Use `getDataClient` instead. Will be removed in v1.0.
 */
export { getQueryClient } from './context.js';

/**
 * @deprecated Use `DataClient` instead. Will be removed in v1.0.
 */
export { DataClient as QueryClient } from './DataClient.js';

/**
 * @deprecated Use `DataClientProvider` instead. Will be removed in v1.0.
 */
export { default as QueryClientProvider } from './QueryClientProvider.svelte';
