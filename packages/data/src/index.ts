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
// ============================================================================

// Deprecated type aliases (re-exported from types.ts)
export type {
	QueryKeyRegistry,
	QueryKey,
	QueryKeyConfig,
	QueryClientConfig,
	QueryClientOptions,
	QueryEventEmitter
} from './types.js';

// Deprecated context exports
export { QUERY_CLIENT_CONTEXT, getQueryClient } from './context.js';

// Deprecated class alias
export { DataClient as QueryClient } from './DataClient.js';

// Deprecated component
export { default as QueryClientProvider } from './QueryClientProvider.svelte';
