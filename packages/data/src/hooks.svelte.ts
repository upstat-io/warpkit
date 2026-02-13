/**
 * @warpkit/data Hooks
 *
 * Svelte 5 hooks for data fetching with automatic caching and invalidation.
 * Uses runes ($state, $derived, $effect) for reactivity.
 */

import { getDataClient } from './context';
import { reportError } from '@warpkit/errors';
import type { DataKey, DataRegistry, DataType, QueryState, UseQueryOptions } from './types';

/**
 * Reactive data fetching hook for Svelte 5.
 *
 * Fetches data via DataClient and maintains reactive state.
 * Automatically refetches when invalidation events fire.
 *
 * @param options - Query options including key, params, and enabled flag
 * @returns Reactive query state with data, error, loading status, and refetch function
 *
 * @example
 * // Basic usage
 * const monitors = useQuery({ key: 'monitors' });
 *
 * @example
 * // With URL parameters
 * const monitor = useQuery({ key: 'monitors/:id', params: { id: monitorId } });
 *
 * @example
 * // Reactive params (re-fetches when page/order change)
 * const monitors = useQuery({
 *   key: 'monitors',
 *   params: () => ({ page: String(page), order })
 * });
 *
 * @example
 * // Conditional fetching
 * const monitor = useQuery({ key: 'monitors/:id', params: { id }, enabled: !!id });
 */
export function useQuery<K extends DataKey>(options: UseQueryOptions<K>): QueryState<DataType<K>> {
	const client = getDataClient();

	// Reactive state using $state rune
	let data = $state<DataType<K> | undefined>(undefined);
	let error = $state<Error | null>(null);
	let isLoading = $state(true);
	let isRevalidating = $state(false);

	// Derived state using $derived rune
	const isError = $derived(error !== null);
	const isSuccess = $derived(data !== undefined && !isError);

	// Track current fetch to handle race conditions
	let fetchId = 0;
	let abortController: AbortController | null = null;

	/**
	 * Resolve params from either a static object or getter function.
	 */
	function resolveParams(): Record<string, string> | undefined {
		const p = options.params;
		if (typeof p === 'function') {
			return p();
		}
		return p;
	}

	/**
	 * Execute fetch and update state.
	 * Handles race conditions by checking fetchId.
	 *
	 * @param resolvedParams - Pre-resolved params (resolved synchronously in $effect for tracking)
	 * @param opts.silent - Skip setting isLoading (used by refetchInterval to avoid UI flash)
	 * @param opts.invalidate - Clear cache before fetching (used by refetchInterval to bypass cache)
	 * @param opts.swr - Pre-populate from cache before network fetch (stale-while-revalidate)
	 */
	async function doFetch(
		resolvedParams: Record<string, string> | undefined,
		opts?: { silent?: boolean; invalidate?: boolean; swr?: boolean }
	): Promise<void> {
		// Increment fetch ID to track this specific fetch
		const currentFetchId = ++fetchId;

		// Abort any in-flight request
		abortController?.abort();
		abortController = new AbortController();

		if (!opts?.silent) {
			isLoading = true;
		}
		error = null;

		// SWR: pre-populate from cache before network fetch
		let hasStaleData = false;
		if (opts?.swr) {
			try {
				const cachedData = await client.getQueryData(options.key, resolvedParams);
				if (currentFetchId !== fetchId) return;
				if (cachedData !== undefined) {
					data = cachedData;
					isLoading = false;
					isRevalidating = true;
					hasStaleData = true;
				}
			} catch {
				// Cache read failed, continue with normal fetch
			}
		}

		// Clear cache before fetching to ensure fresh data from network
		if (opts?.invalidate) {
			await client.invalidate(options.key, resolvedParams);
		}

		try {
			// Apply delay before fetching (e.g. for previewing loading skeletons)
			if (options.delay && options.delay > 0) {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, options.delay);
					abortController!.signal.addEventListener('abort', () => {
						clearTimeout(timer);
						reject(new DOMException('Delay aborted', 'AbortError'));
					});
				});
			}

			const result = await client.fetch(options.key, resolvedParams);

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
				// SWR: if we have stale data showing, suppress the error
				if (hasStaleData) {
					return;
				}
				error = e instanceof Error ? e : new Error(String(e));
				reportError('data:query', error, {
					handledLocally: true,
					showUI: false,
					context: { key: options.key }
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

	/**
	 * Resolve the enabled option.
	 * Supports both boolean and getter function for Svelte 5 reactivity.
	 */
	function isEnabled(): boolean {
		const enabled = options.enabled;
		if (typeof enabled === 'function') {
			return enabled();
		}
		return enabled ?? true;
	}

	// Initial fetch effect
	// Resolve params synchronously so $effect tracks reactive dependencies.
	$effect(() => {
		// Check enabled flag - evaluate inside $effect for reactivity when using getter
		if (!isEnabled()) {
			isLoading = false;
			return;
		}

		// Resolve params synchronously for Svelte 5 dependency tracking
		const params = resolveParams();

		// Check if SWR is enabled for this key (default: true)
		const keyConfig = client.getKeyConfig(options.key);
		const swrEnabled = keyConfig?.staleWhileRevalidate !== false;

		doFetch(params, swrEnabled ? { swr: true } : undefined);

		// Cleanup: abort fetch on unmount or re-run
		return () => {
			abortController?.abort();
		};
	});

	// Event subscription effect
	$effect(() => {
		const events = client.getEvents();
		if (!events) return;

		const keyConfig = client.getKeyConfig(options.key);
		const invalidateOn = keyConfig?.invalidateOn ?? [];
		if (invalidateOn.length === 0) return;

		// Only subscribe if enabled - evaluate inside $effect for reactivity
		if (!isEnabled()) return;

		// Subscribe to invalidation events — refetch when events fire.
		// Cache is already cleared by DataClient's global subscription,
		// so doFetch() will always hit the network.
		const unsubscribes = invalidateOn.map((event) =>
			events.on(event, () => {
				doFetch(resolveParams());
			})
		);

		// Cleanup: unsubscribe on unmount or re-run
		return () => {
			unsubscribes.forEach((unsub) => unsub());
		};
	});

	// Polling effect — refetch on interval while enabled, bypassing cache
	$effect(() => {
		const interval = options.refetchInterval;
		if (!interval || !isEnabled()) return;

		const timerId = setInterval(() => {
			doFetch(resolveParams(), { silent: true, invalidate: true });
		}, interval);

		return () => clearInterval(timerId);
	});

	// Return object with getters for Svelte 5 reactivity
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
		refetch: () => doFetch(resolveParams())
	};
}

// Re-export for backwards compatibility with old QueryKeyRegistry augmentation
export type { DataRegistry as QueryKeyRegistry };
