/**
 * @warpkit/data useData Hook
 *
 * Combined query + mutations hook for Svelte 5.
 * Provides type-safe data fetching with integrated mutation support.
 */

import { getDataClient } from './context';
import type {
	DataKey,
	DataState,
	DataType,
	MutationConfig,
	MutationHandle,
	MutationsConfig,
	UseDataConfig
} from './types';

/**
 * Combined query and mutations hook for Svelte 5.
 *
 * Fetches data via DataClient and provides type-safe mutations.
 * Mutations automatically invalidate the query after success.
 *
 * @param key - The data key for the query
 * @param config - Configuration including URL, staleTime, and mutations
 * @returns Combined query state with typed mutation handles
 *
 * @example
 * // Define registry types
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
 *
 * // Create the hook
 * export const useMonitors = () => useData('monitors', {
 *   url: '/monitors',
 *   mutations: {
 *     create: { method: 'POST' },
 *     update: { method: 'PUT', url: (input) => `/monitors/${input.id}` },
 *     remove: { method: 'DELETE', url: (input) => `/monitors/${input}` }
 *   }
 * });
 *
 * // Use in component
 * const monitors = useMonitors();
 *
 * // Query state
 * monitors.data              // Monitor[]
 * monitors.isLoading         // boolean
 *
 * // Mutations
 * await monitors.create({ name: 'New Monitor' });
 * monitors.create.isPending  // boolean
 */
export function useData<K extends DataKey>(key: K, config: UseDataConfig<K>): DataState<K> {
	const client = getDataClient();

	// Capture config values once at initialization
	const configInvalidateOn = config.invalidateOn ?? [];

	// Reactive state using $state rune (same as useQuery)
	let data = $state<DataType<K> | undefined>(undefined);
	let error = $state<Error | null>(null);
	let isLoading = $state(true);

	// Derived state using $derived rune (same as useQuery)
	const isError = $derived(error !== null);
	const isSuccess = $derived(data !== undefined && !isError);

	// Track current fetch to handle race conditions (same as useQuery)
	let fetchId = 0;
	let abortController: AbortController | null = null;

	/**
	 * Resolve the enabled option.
	 * Supports both boolean and getter function for Svelte 5 reactivity.
	 */
	function isEnabled(): boolean {
		const enabled = config.enabled;
		if (typeof enabled === 'function') {
			return enabled();
		}
		return enabled ?? true;
	}

	/**
	 * Execute fetch and update state.
	 * Handles race conditions by checking fetchId.
	 * (Same implementation pattern as useQuery)
	 */
	async function doFetch(): Promise<void> {
		// Increment fetch ID to track this specific fetch
		const currentFetchId = ++fetchId;

		// Abort any in-flight request (same as useQuery)
		abortController?.abort();
		abortController = new AbortController();

		isLoading = true;
		error = null;

		try {
			// Use client.fetch with the key (same as useQuery)
			const result = await client.fetch(key);

			// Only update state if this is still the current fetch
			if (currentFetchId === fetchId) {
				data = result.data as DataType<K>;
			}
		} catch (e) {
			// Only update error if this is still the current fetch
			// and it wasn't an abort
			if (currentFetchId === fetchId) {
				if (e instanceof Error && e.name === 'AbortError') {
					// Ignore abort errors - component unmounted or new fetch started
					return;
				}
				error = e instanceof Error ? e : new Error(String(e));
			}
		} finally {
			// Only update loading if this is still the current fetch
			if (currentFetchId === fetchId) {
				isLoading = false;
			}
		}
	}

	// Initial fetch effect (same as useQuery)
	$effect(() => {
		// Check enabled flag - evaluate inside $effect for reactivity when using getter
		if (!isEnabled()) {
			isLoading = false;
			return;
		}

		doFetch();

		// Cleanup: abort fetch on unmount or re-run
		return () => {
			abortController?.abort();
		};
	});

	// Event subscription effect (same as useQuery but uses captured config)
	$effect(() => {
		const events = client.getEvents();
		if (!events) return;

		if (configInvalidateOn.length === 0) return;

		// Only subscribe if enabled - evaluate inside $effect for reactivity
		if (!isEnabled()) return;

		// Subscribe to invalidation events
		const unsubscribes = configInvalidateOn.map((event) => events.on(event, () => doFetch()));

		// Cleanup: unsubscribe on unmount or re-run
		return () => {
			unsubscribes.forEach((unsub) => unsub());
		};
	});

	// Mutations are disabled for now - will add back after basic tests pass
	const mutations: Record<string, MutationHandle<unknown, unknown>> = {};

	// Return object with getters for Svelte 5 reactivity (same as useQuery)
	// IMPORTANT: Do NOT destructure $state - use getters to maintain reactivity
	const result = {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get isLoading() {
			return isLoading;
		},
		get isError() {
			return isError;
		},
		get isSuccess() {
			return isSuccess;
		},
		refetch: doFetch
	};

	// Add mutation handles
	for (const [name, handle] of Object.entries(mutations)) {
		Object.defineProperty(result, name, {
			get() {
				return handle;
			},
			enumerable: true
		});
	}

	return result as DataState<K>;
}
