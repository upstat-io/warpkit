/**
 * @warpkit/data useData Hook
 *
 * Combined query + mutations hook for Svelte 5.
 * Provides type-safe data fetching with integrated mutation support.
 */

import { getDataClient } from './context';
import { reportError } from '@warpkit/errors';
import type {
	DataKey,
	DataState,
	DataType,
	UseDataConfig
} from './types';

/**
 * Query hook with call-site invalidation and enabled config for Svelte 5.
 *
 * Fetches data via DataClient with optional call-site `invalidateOn` events
 * and `enabled` flag on top of the key config.
 *
 * For mutations, use `useMutation` instead.
 *
 * @param key - The data key for the query
 * @param config - Call-site configuration (invalidateOn, enabled)
 * @returns Reactive query state
 *
 * @example
 * const monitors = useData('monitors', {
 *   invalidateOn: ['monitor:created'],
 *   enabled: () => !!userId
 * });
 *
 * monitors.data       // Monitor[]
 * monitors.isLoading  // boolean
 * monitors.refetch()  // manual refetch
 */
export function useData<K extends DataKey>(key: K, config: UseDataConfig<K>): DataState<K> {
	const client = getDataClient();

	// Capture config values once at initialization
	const configInvalidateOn = config.invalidateOn ?? [];

	// Reactive state using $state rune (same as useQuery)
	let data = $state<DataType<K> | undefined>(undefined);
	let error = $state<Error | null>(null);
	let isLoading = $state(true);
	let isRevalidating = $state(false);

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
	 *
	 * @param opts.swr - Pre-populate from cache before network fetch (stale-while-revalidate)
	 */
	async function doFetch(opts?: { swr?: boolean; invalidate?: boolean }): Promise<void> {
		// Increment fetch ID to track this specific fetch
		const currentFetchId = ++fetchId;

		// Abort any in-flight request (same as useQuery)
		abortController?.abort();
		abortController = new AbortController();

		isLoading = true;
		error = null;

		// SWR: pre-populate from cache before network fetch
		let hasStaleData = false;
		if (opts?.swr) {
			try {
				const cachedData = await client.getQueryData(key);
				if (currentFetchId !== fetchId) return;
				if (cachedData !== undefined) {
					data = cachedData;
					isLoading = false;
					isRevalidating = true;
					hasStaleData = true;
				}
			} catch (e) {
				// Cache read failed, continue with normal fetch
				console.warn('[WarpKit data:query] SWR cache read failed for key:', key, e);
			}
		}

		// Clear cache before fetching to ensure fresh data from network
		if (opts?.invalidate) {
			await client.invalidate(key);
		}

		try {
			// Use client.fetch with the key (same as useQuery)
			const result = await client.fetch(key);

			// Only update state if this is still the current fetch
			if (currentFetchId === fetchId) {
				data = result.data;
			}
		} catch (e) {
			// Only update error if this is still the current fetch
			// and it wasn't an abort
			if (currentFetchId === fetchId) {
				if (e instanceof Error && e.name === 'AbortError') {
					// Ignore abort errors - component unmounted or new fetch started
					return;
				}
				// SWR: if we have stale data showing, suppress the error
				if (hasStaleData) {
					return;
				}
				error = e instanceof Error ? e : new Error(String(e));
				reportError('data:query', error, {
					handledLocally: true,
					showUI: false,
					context: { key }
				});
			}
		} finally {
			// Only update loading if this is still the current fetch
			if (currentFetchId === fetchId) {
				isLoading = false;
				isRevalidating = false;
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

		// Check if SWR is enabled for this key (default: true)
		const keyConfig = client.getKeyConfig(key);
		const swrEnabled = keyConfig?.staleWhileRevalidate !== false;

		doFetch(swrEnabled ? { swr: true } : undefined);

		// Cleanup: abort fetch on unmount or re-run
		return () => {
			abortController?.abort();
		};
	});

	// Event subscription effect (matches useQuery's 3-layer pattern)
	$effect(() => {
		const events = client.getEvents();
		if (!events) return;
		if (!isEnabled()) return;

		// Layer 1: Global cache invalidation (e.g., data boundary change)
		const unsubscribes: Array<() => void> = [
			events.on('data:cache-invalidated', () => {
				doFetch();
			})
		];

		// Layer 2: Key-config invalidation events
		const keyConfig = client.getKeyConfig(key);
		const keyInvalidateOn = keyConfig?.invalidateOn ?? [];
		for (const event of keyInvalidateOn) {
			unsubscribes.push(
				events.on(event, () => {
					doFetch({ invalidate: true });
				})
			);
		}

		// Layer 3: Call-site invalidation events (additive, deduped against key-config)
		const keyEventSet = new Set(keyInvalidateOn);
		for (const event of configInvalidateOn) {
			if (keyEventSet.has(event)) continue; // already subscribed via key-config
			unsubscribes.push(
				events.on(event, () => {
					doFetch({ invalidate: true });
				})
			);
		}

		return () => {
			unsubscribes.forEach((unsub) => unsub());
		};
	});

	// Return object with getters for Svelte 5 reactivity (same as useQuery)
	// IMPORTANT: Do NOT destructure $state - use getters to maintain reactivity
	return {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get isLoading() {
			return isLoading;
		},
		get isRevalidating() {
			return isRevalidating;
		},
		get isError() {
			return isError;
		},
		get isSuccess() {
			return isSuccess;
		},
		refetch: () => doFetch()
	} satisfies DataState<K>;
}
