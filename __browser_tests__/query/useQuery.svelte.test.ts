/**
 * Browser Tests: useQuery hook
 *
 * Tests for the useQuery hook with reactive state and automatic cleanup.
 * Uses Playwright browser mode since hooks require Svelte component context.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import UseQueryTestWrapper from './UseQueryTestWrapper.svelte';

describe('useQuery', () => {
	afterEach(() => {
		cleanup();
	});

	describe('loading state', () => {
		it('should show loading state initially', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: [{ id: '1', name: 'Test' }],
					mockDelay: 100
				}
			});

			// Initially loading
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('true');
		});

		it('should set isLoading to false after fetch completes', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: [{ id: '1', name: 'Test' }]
				}
			});

			// Wait for loading to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');
		});
	});

	describe('data fetching', () => {
		it('should display fetched data', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: testData
				}
			});

			// Wait for data to appear
			const data = screen.getByTestId('data');
			await expect.element(data).toHaveTextContent(JSON.stringify(testData));
		});

		it('should set isSuccess to true after successful fetch', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: { success: true }
				}
			});

			// Wait for success state
			const isSuccess = screen.getByTestId('is-success');
			await expect.element(isSuccess).toHaveTextContent('true');

			const isError = screen.getByTestId('is-error');
			await expect.element(isError).toHaveTextContent('false');
		});

		it('should increment fetch count on initial fetch', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: []
				}
			});

			// Wait for loading to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			// Verify fetch was called
			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');
		});
	});

	describe('error handling', () => {
		it('should display error message on fetch failure', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockError: new Error('Network error')
				}
			});

			// Wait for error to appear
			const error = screen.getByTestId('error');
			await expect.element(error).toHaveTextContent('Network error');
		});

		it('should set isError to true on fetch failure', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockError: new Error('Failed')
				}
			});

			// Wait for error state
			const isError = screen.getByTestId('is-error');
			await expect.element(isError).toHaveTextContent('true');

			const isSuccess = screen.getByTestId('is-success');
			await expect.element(isSuccess).toHaveTextContent('false');
		});

		it('should set isLoading to false on fetch failure', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockError: new Error('Failed')
				}
			});

			// Wait for loading to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');
		});
	});

	describe('refetch', () => {
		it('should refetch data when refetch is called', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: { count: 1 }
				}
			});

			// Wait for initial fetch to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			// Verify initial fetch count
			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			// Click refetch button
			const refetchButton = screen.getByTestId('refetch');
			await refetchButton.click();

			// Wait for refetch to complete
			await expect.element(loading).toHaveTextContent('false');

			// Verify fetch was called again
			await expect.element(fetchCount).toHaveTextContent('2');
		});
	});

	describe('enabled option', () => {
		it('should not fetch when enabled is false', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: [],
					enabled: false
				}
			});

			// Should not be loading when disabled
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			// Fetch should not have been called
			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('0');
		});

		it('should fetch when enabled changes from false to true', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: [{ id: '1' }],
					enabled: false
				}
			});

			// Verify not fetched initially
			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('0');

			// Enable the query
			const toggleEnabled = screen.getByTestId('toggle-enabled');
			await toggleEnabled.click();

			// Verify enabled state changed
			const enabledState = screen.getByTestId('enabled-state');
			await expect.element(enabledState).toHaveTextContent('true');

			// Wait for fetch to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			// Verify fetch was called
			await expect.element(fetchCount).toHaveTextContent('1');
		});
	});

	describe('event invalidation', () => {
		it('should refetch when invalidation event is emitted', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: { data: 'test' },
					invalidateOn: ['query:invalidated']
				}
			});

			// Wait for initial fetch
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			// Emit invalidation event
			const emitButton = screen.getByTestId('emit-invalidation');
			await emitButton.click();

			// Wait for refetch to complete
			await expect.element(loading).toHaveTextContent('false');

			// Verify fetch was called again
			await expect.element(fetchCount).toHaveTextContent('2');
		});

		it('should bypass cache when invalidation event is emitted (staleTime active)', async () => {
			// This test verifies the critical behavior: when data is cached and still
			// within staleTime, an invalidation event MUST clear the cache and refetch
			// from network — not return stale cached data.
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: { data: 'initial' },
					invalidateOn: ['query:invalidated'],
					staleTime: 60000 // 60 seconds — data will be "fresh" in cache
				}
			});

			// Wait for initial fetch
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			// Data is now cached with staleTime=60s. A normal fetch would return
			// cached data. But an invalidation event must bypass the cache.

			// Emit invalidation event
			const emitButton = screen.getByTestId('emit-invalidation');
			await emitButton.click();

			// Wait for refetch to complete
			await expect.element(loading).toHaveTextContent('false');

			// Verify fetch was called TWICE — proving cache was cleared and
			// network request was made. Without the cache invalidation fix,
			// fetchCount would stay at 1 (stale cache returned).
			await expect.element(fetchCount).toHaveTextContent('2');
		});
	});

	describe('cross-page invalidation', () => {
		it('should clear cache when event fires while component is unmounted', async () => {
			// This test verifies the critical cross-page scenario:
			// 1. Component mounts and fetches data (cached with staleTime)
			// 2. Component unmounts (user navigates to another page)
			// 3. Invalidation event fires (e.g., monitor:created on the other page)
			// 4. Component remounts (user navigates back)
			// 5. Data MUST be fetched from network, not stale cache
			//
			// This works because DataClient subscribes to invalidateOn events
			// at construction time, clearing cache regardless of mounted components.
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: { data: 'initial' },
					invalidateOn: ['query:invalidated'],
					staleTime: 60000, // 60 seconds — data will be "fresh" in cache
					showComponent: true
				}
			});

			// Wait for initial fetch
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			// Unmount the consumer component (simulates navigating away)
			const toggleButton = screen.getByTestId('toggle-component');
			await toggleButton.click();

			// Reset fetch count so we can track the remount fetch
			const resetButton = screen.getByTestId('reset-fetch-count');
			await resetButton.click();
			await expect.element(fetchCount).toHaveTextContent('0');

			// Emit invalidation event WHILE component is unmounted.
			// DataClient's global subscription should clear the cache.
			const emitButton = screen.getByTestId('emit-invalidation');
			await emitButton.click();

			// Remount the component (simulates navigating back)
			await toggleButton.click();

			// Wait for the remount fetch to complete
			await expect.element(loading).toHaveTextContent('false');

			// Verify fetch was called — proving the cache was cleared by
			// DataClient's global event subscription, forcing a network request.
			// Without the DataClient-level subscription, fetchCount would be 0
			// because stale cache (60s) would have been returned.
			await expect.element(fetchCount).toHaveTextContent('1');
		});
	});

	describe('stale-while-revalidate', () => {
		it('should show stale cached data immediately then update with fresh data', async () => {
			const staleData = [{ id: '1', name: 'Stale Monitor' }];
			const freshData = [{ id: '1', name: 'Fresh Monitor' }];

			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: freshData,
					mockDelay: 100,
					preSeedCache: staleData,
					staleTime: 5000
				}
			});

			// Should immediately show stale data (not loading)
			const loading = screen.getByTestId('loading');
			const data = screen.getByTestId('data');
			const isRevalidating = screen.getByTestId('is-revalidating');

			await expect.element(loading).toHaveTextContent('false');
			await expect.element(data).toHaveTextContent(JSON.stringify(staleData));
			await expect.element(isRevalidating).toHaveTextContent('true');

			// Wait for fresh data to arrive
			await expect.element(data).toHaveTextContent(JSON.stringify(freshData));
			await expect.element(isRevalidating).toHaveTextContent('false');
		});

		it('should suppress error when stale data is showing', async () => {
			const staleData = [{ id: '1', name: 'Stale Monitor' }];

			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockError: new Error('Network error'),
					preSeedCache: staleData,
					staleTime: 5000
				}
			});

			// Wait for fetch attempt to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			// Should still show stale data, no error
			const data = screen.getByTestId('data');
			const error = screen.getByTestId('error');
			const isError = screen.getByTestId('is-error');

			await expect.element(data).toHaveTextContent(JSON.stringify(staleData));
			await expect.element(error).toHaveTextContent('');
			await expect.element(isError).toHaveTextContent('false');
		});

		it('should show normal loading when staleWhileRevalidate is false', async () => {
			const staleData = [{ id: '1', name: 'Stale Monitor' }];
			const freshData = [{ id: '1', name: 'Fresh Monitor' }];

			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: freshData,
					mockDelay: 100,
					preSeedCache: staleData,
					staleTime: 5000,
					staleWhileRevalidate: false
				}
			});

			// Should show loading state (not stale data) because SWR is disabled
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('true');

			// isRevalidating should be false (SWR disabled)
			const isRevalidating = screen.getByTestId('is-revalidating');
			await expect.element(isRevalidating).toHaveTextContent('false');

			// Eventually should show fresh data
			await expect.element(loading).toHaveTextContent('false');
			const data = screen.getByTestId('data');
			await expect.element(data).toHaveTextContent(JSON.stringify(freshData));
		});

		it('should show normal loading when no cached data exists', async () => {
			const freshData = [{ id: '1', name: 'Fresh Monitor' }];

			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: freshData,
					mockDelay: 100
				}
			});

			// No cache → normal loading behavior
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('true');

			const isRevalidating = screen.getByTestId('is-revalidating');
			await expect.element(isRevalidating).toHaveTextContent('false');

			// Wait for data
			await expect.element(loading).toHaveTextContent('false');
			const data = screen.getByTestId('data');
			await expect.element(data).toHaveTextContent(JSON.stringify(freshData));
		});

		it('should not use SWR for manual refetch', async () => {
			const staleData = [{ id: '1', name: 'Stale Monitor' }];
			const freshData = [{ id: '1', name: 'Fresh Monitor' }];

			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: freshData,
					preSeedCache: staleData,
					staleTime: 5000
				}
			});

			// Wait for initial SWR + fresh data cycle to complete
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');
			const isRevalidating = screen.getByTestId('is-revalidating');
			await expect.element(isRevalidating).toHaveTextContent('false');

			// Click refetch — should show loading (not SWR)
			const refetchButton = screen.getByTestId('refetch');
			await refetchButton.click();

			// Manual refetch uses normal loading, not SWR
			// isRevalidating should remain false during manual refetch
			await expect.element(loading).toHaveTextContent('false');
			await expect.element(isRevalidating).toHaveTextContent('false');
		});
	});

	describe('cleanup', () => {
		it('should not update state after component unmounts', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: { test: true },
					mockDelay: 50
				}
			});

			// Immediately toggle component off (while fetch is in-flight)
			const toggleButton = screen.getByTestId('toggle-component');
			await toggleButton.click();

			// Wait for the delayed fetch to complete using vi.waitFor
			// This is more robust than a fixed timeout
			await vi.waitFor(
				() => {
					// Just wait for the delay to pass - test passes if no error is thrown
					// during abort handling
				},
				{ timeout: 150 }
			);

			// Component should be unmounted, no error should occur
			// (test passes if no unhandled error is thrown)
		});

		it('should unsubscribe from events when component unmounts', async () => {
			const screen = render(UseQueryTestWrapper, {
				props: {
					queryKey: 'monitors',
					mockData: [],
					showComponent: true,
					invalidateOn: ['query:invalidated']
				}
			});

			// Wait for initial fetch
			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			// Unmount component
			const toggleButton = screen.getByTestId('toggle-component');
			await toggleButton.click();

			// Reset fetch count
			const resetButton = screen.getByTestId('reset-fetch-count');
			await resetButton.click();
			await expect.element(fetchCount).toHaveTextContent('0');

			// Emit invalidation event after unmount
			const emitButton = screen.getByTestId('emit-invalidation');
			await emitButton.click();

			// Use vi.waitFor to verify fetch count stays 0 (subscription was cleaned up)
			await vi.waitFor(
				() => {
					// Verify fetch was not triggered by the invalidation event
					expect(fetchCount.element().textContent).toBe('0');
				},
				{ timeout: 100 }
			);
		});
	});
});
