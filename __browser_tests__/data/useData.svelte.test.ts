/**
 * Browser Tests: useData hook
 *
 * Tests for the useData hook query functionality.
 * Uses Playwright browser mode since hooks require Svelte component context.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import UseDataTestWrapper from './UseDataTestWrapper.svelte';

describe('useData', () => {
	afterEach(() => {
		cleanup();
	});

	describe('loading state', () => {
		it('should show loading state initially', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: [{ id: '1', name: 'Test' }],
					mockDelay: 100
				}
			});

			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('true');
		});

		it('should set isLoading to false after fetch completes', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: [{ id: '1', name: 'Test' }]
				}
			});

			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');
		});
	});

	describe('data fetching', () => {
		it('should display fetched data', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: testData
				}
			});

			const data = screen.getByTestId('data');
			await expect.element(data).toHaveTextContent(JSON.stringify(testData));
		});

		it('should set isSuccess to true after successful fetch', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: { success: true }
				}
			});

			const isSuccess = screen.getByTestId('is-success');
			await expect.element(isSuccess).toHaveTextContent('true');

			const isError = screen.getByTestId('is-error');
			await expect.element(isError).toHaveTextContent('false');
		});

		it('should increment fetch count on initial fetch', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: []
				}
			});

			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');
		});
	});

	describe('error handling', () => {
		it('should display error message on fetch failure', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockError: new Error('Network error')
				}
			});

			const error = screen.getByTestId('error');
			await expect.element(error).toHaveTextContent('Network error');
		});

		it('should set isError to true on fetch failure', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockError: new Error('Failed')
				}
			});

			const isError = screen.getByTestId('is-error');
			await expect.element(isError).toHaveTextContent('true');

			const isSuccess = screen.getByTestId('is-success');
			await expect.element(isSuccess).toHaveTextContent('false');
		});

		it('should set isLoading to false on fetch failure', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockError: new Error('Failed')
				}
			});

			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');
		});
	});

	describe('refetch', () => {
		it('should refetch data when refetch is called', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: { count: 1 }
				}
			});

			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			const refetchButton = screen.getByTestId('refetch');
			await refetchButton.click();

			await expect.element(loading).toHaveTextContent('false');
			await expect.element(fetchCount).toHaveTextContent('2');
		});
	});

	describe('event invalidation', () => {
		it('should refetch when invalidation event is emitted', async () => {
			const screen = render(UseDataTestWrapper, {
				props: {
					dataKey: 'monitors',
					mockData: { data: 'test' },
					invalidateOn: ['query:invalidated']
				}
			});

			const loading = screen.getByTestId('loading');
			await expect.element(loading).toHaveTextContent('false');

			const fetchCount = screen.getByTestId('fetch-count');
			await expect.element(fetchCount).toHaveTextContent('1');

			const emitButton = screen.getByTestId('emit-invalidation');
			await emitButton.click();

			await expect.element(loading).toHaveTextContent('false');
			await expect.element(fetchCount).toHaveTextContent('2');
		});
	});
});
