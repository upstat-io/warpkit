/**
 * Browser Tests: useForm array operations
 *
 * Tests for the useForm hook array field operations.
 * Uses Playwright browser mode since hooks require Svelte component context.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import ArrayFieldTestWrapper from './ArrayFieldTestWrapper.svelte';

describe('useForm array operations', () => {
	afterEach(() => {
		cleanup();
	});

	describe('push', () => {
		it('should add item to end of array', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: { items: [{ id: '1', name: 'Item 1' }] }
				}
			});

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('1');

			await screen.getByTestId('add').click();
			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('2');
			await expect.element(screen.getByTestId('item-1-name')).toHaveTextContent('Item 2');
		});

		it('should add multiple items', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: { items: [] }
				}
			});

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('0');

			await screen.getByTestId('add').click();
			await screen.getByTestId('add').click();
			await screen.getByTestId('add').click();

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('3');
		});
	});

	describe('remove', () => {
		it('should remove item at index', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' },
							{ id: '3', name: 'Item 3' }
						]
					}
				}
			});

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('3');

			// Remove middle item
			await screen.getByTestId('remove-1').click();

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('2');
			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 1');
			await expect.element(screen.getByTestId('item-1-name')).toHaveTextContent('Item 3');
		});

		it('should reindex errors when item is removed', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' },
							{ id: '3', name: 'Item 3' }
						]
					}
				}
			});

			// Set errors on items 1 and 2
			await screen.getByTestId('set-error-1').click();
			await screen.getByTestId('set-error-2').click();

			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.1.name');
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.2.name');

			// Remove item 0 - errors should shift down
			await screen.getByTestId('remove-0').click();

			// Error that was on item 1 should now be on item 0
			// Error that was on item 2 should now be on item 1
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.0.name');
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.1.name');
		});

		it('should remove error for the removed item', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' }
						]
					}
				}
			});

			// Set error on item 0
			await screen.getByTestId('set-error-0').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.0.name');

			// Remove item 0 - its error should be gone
			await screen.getByTestId('remove-0').click();

			// The error for the removed item should be gone
			// (and no error should be present since original item 1 had no error)
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('{}');
		});
	});

	describe('insert', () => {
		it('should insert item at specific index', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' }
						]
					}
				}
			});

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('2');

			// Insert before index 1
			await screen.getByTestId('insert-before-1').click();

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('3');
			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 1');
			await expect.element(screen.getByTestId('item-1-name')).toHaveTextContent('Inserted at 1');
			await expect.element(screen.getByTestId('item-2-name')).toHaveTextContent('Item 2');
		});

		it('should reindex errors when item is inserted', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' }
						]
					}
				}
			});

			// Set error on item 1
			await screen.getByTestId('set-error-1').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.1.name');

			// Insert before item 1 - error should shift up
			await screen.getByTestId('insert-before-1').click();

			// Error that was on item 1 should now be on item 2
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('items.2.name');
		});
	});

	describe('move', () => {
		it('should move item from one position to another', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' },
							{ id: '3', name: 'Item 3' }
						]
					}
				}
			});

			// Move item 0 to position 1
			await screen.getByTestId('move-0-1').click();

			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 2');
			await expect.element(screen.getByTestId('item-1-name')).toHaveTextContent('Item 1');
			await expect.element(screen.getByTestId('item-2-name')).toHaveTextContent('Item 3');
		});

		it('should move item in reverse direction', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' },
							{ id: '3', name: 'Item 3' }
						]
					}
				}
			});

			// Move item 1 to position 0
			await screen.getByTestId('move-1-0').click();

			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 2');
			await expect.element(screen.getByTestId('item-1-name')).toHaveTextContent('Item 1');
			await expect.element(screen.getByTestId('item-2-name')).toHaveTextContent('Item 3');
		});
	});

	describe('swap', () => {
		it('should swap two items', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' },
							{ id: '3', name: 'Item 3' }
						]
					}
				}
			});

			// Swap items 0 and 1
			await screen.getByTestId('swap-0-1').click();

			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 2');
			await expect.element(screen.getByTestId('item-1-name')).toHaveTextContent('Item 1');
			await expect.element(screen.getByTestId('item-2-name')).toHaveTextContent('Item 3');
		});

		it('should swap items back to original position', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: {
						items: [
							{ id: '1', name: 'Item 1' },
							{ id: '2', name: 'Item 2' }
						]
					}
				}
			});

			// Swap twice should return to original
			await screen.getByTestId('swap-0-1').click();
			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 2');

			await screen.getByTestId('swap-0-1').click();
			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 1');
		});
	});

	describe('empty array', () => {
		it('should handle empty initial array', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: { items: [] }
				}
			});

			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('0');
		});

		it('should add to empty array', async () => {
			const screen = render(ArrayFieldTestWrapper, {
				props: {
					initialValues: { items: [] }
				}
			});

			await screen.getByTestId('add').click();
			await expect.element(screen.getByTestId('items-count')).toHaveTextContent('1');
			await expect.element(screen.getByTestId('item-0-name')).toHaveTextContent('Item 1');
		});
	});
});
