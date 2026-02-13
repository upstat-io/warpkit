<script lang="ts">
	import { setContext } from 'svelte';
	import { DATA_CLIENT_CONTEXT } from '../../packages/data/src/context.js';
	import { DataClient } from '../../packages/data/src/DataClient.js';
	import type { CacheEntry, CacheProvider, DataClientConfig, DataKey, DataKeyConfig, DataEventEmitter } from '../../packages/data/src/types.js';
	import UseDataTestConsumer from './UseDataTestConsumer.svelte';
	import { EventEmitter } from '../../src/events/EventEmitter.js';
	import type { WarpKitEventRegistry } from '../../src/events/types.js';

	/** Simple in-memory cache for testing cache + invalidation behavior */
	class MemoryCache implements CacheProvider {
		private store = new Map<string, CacheEntry<unknown>>();
		async get<T>(key: string) { return this.store.get(key) as CacheEntry<T> | undefined; }
		async set<T>(key: string, entry: CacheEntry<T>) { this.store.set(key, entry as CacheEntry<unknown>); }
		async delete(key: string) { this.store.delete(key); }
		async deleteByPrefix(prefix: string) { for (const k of this.store.keys()) { if (k.startsWith(prefix)) this.store.delete(k); } }
		async clear() { this.store.clear(); }
	}

	interface Props {
		dataKey: string;
		showComponent?: boolean;
		mockData?: unknown;
		mockError?: Error | null;
		mockDelay?: number;
		invalidateOn?: string[];
		staleTime?: number;
		staleWhileRevalidate?: boolean;
		preSeedCache?: unknown;
	}

	let {
		dataKey,
		showComponent = true,
		mockData = null,
		mockError = null,
		mockDelay = 0,
		invalidateOn = [],
		staleTime = 0,
		staleWhileRevalidate,
		preSeedCache
	}: Props = $props();

	let fetchCount = $state(0);

	// Create event emitter for testing invalidation
	const events = new EventEmitter<WarpKitEventRegistry>();

	// Adapter to make EventEmitter work as DataEventEmitter
	const dataEventAdapter: DataEventEmitter = {
		on: (event: string, handler: () => void | Promise<void>) => {
			return events.on(event as keyof WarpKitEventRegistry, handler as () => void);
		}
	};

	// Create config with test key (include staleTime and staleWhileRevalidate if provided)
	const config: DataClientConfig = {
		baseUrl: 'http://localhost/api',
		keys: {
			[dataKey]: {
				key: dataKey,
				url: `/${dataKey}`,
				invalidateOn: invalidateOn.length > 0 ? invalidateOn : undefined,
				...(staleTime > 0 ? { staleTime } : {}),
				...(staleWhileRevalidate !== undefined ? { staleWhileRevalidate } : {})
			}
		} as Record<DataKey, DataKeyConfig<DataKey>>
	};

	// Create client — use MemoryCache when staleTime is set or preSeedCache is provided
	const useCache = staleTime > 0 || preSeedCache !== undefined;
	const cache = useCache ? new MemoryCache() : undefined;
	const client = new DataClient(config, { events: dataEventAdapter, cache });

	// Pre-seed cache with stale data for SWR testing
	if (preSeedCache !== undefined && cache) {
		cache.set(dataKey, {
			data: preSeedCache,
			timestamp: Date.now() - 10000, // 10 seconds ago (stale)
			staleTime: 5000 // Stale after 5 seconds
		});
	}

	// Mock the fetch method
	const originalFetch = globalThis.fetch;
	const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		fetchCount++;

		// Handle abort
		if (init?.signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		// Simulate delay
		if (mockDelay > 0) {
			await new Promise(resolve => setTimeout(resolve, mockDelay));

			// Check abort again after delay
			if (init?.signal?.aborted) {
				throw new DOMException('Aborted', 'AbortError');
			}
		}

		// Simulate error
		if (mockError) {
			throw mockError;
		}

		// Return mock data
		return new Response(JSON.stringify(mockData), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	};
	// @ts-expect-error - mock fetch doesn't have preconnect but it's not needed for tests
	globalThis.fetch = mockFetch;

	// Cleanup on unmount
	$effect(() => {
		return () => {
			globalThis.fetch = originalFetch;
		};
	});

	// Provide context
	setContext(DATA_CLIENT_CONTEXT, client);

	function emitInvalidationEvent() {
		if (invalidateOn.length > 0) {
			events.emit(invalidateOn[0] as keyof WarpKitEventRegistry, {} as never);
		}
	}

	function toggleComponent() {
		showComponent = !showComponent;
	}

	function resetFetchCount() {
		fetchCount = 0;
	}
</script>

{#if showComponent}
	<UseDataTestConsumer {dataKey} {invalidateOn} />
{/if}

<div data-testid="fetch-count">{fetchCount}</div>
<button data-testid="emit-invalidation" onclick={emitInvalidationEvent}>Emit Invalidation</button>
<button data-testid="toggle-component" onclick={toggleComponent}>Toggle</button>
<button data-testid="reset-fetch-count" onclick={resetFetchCount}>Reset Fetch Count</button>
