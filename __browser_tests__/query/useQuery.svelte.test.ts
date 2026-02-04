/**
 * Browser Tests: useQuery hook
 *
 * Tests for the useQuery hook with reactive state and automatic cleanup.
 * Uses Playwright browser mode since hooks require Svelte component context.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

			// Wait for the delayed fetch to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

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

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Fetch should NOT have been called (subscription cleaned up)
			await expect.element(fetchCount).toHaveTextContent('0');
		});
	});
});
