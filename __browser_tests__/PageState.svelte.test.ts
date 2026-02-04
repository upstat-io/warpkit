/**
 * Browser Test: PageState Reactivity
 *
 * Verifies that PageState $state fields trigger reactive updates.
 */
import { render } from 'vitest-browser-svelte';
import { expect, test, describe } from 'vitest';
import TestPageState from './TestPageState.svelte';

describe('PageState Reactivity', () => {
	test('should render initial empty state', async () => {
		const screen = render(TestPageState);
		await expect.element(screen.getByTestId('path')).toHaveTextContent('');
		await expect.element(screen.getByTestId('pathname')).toHaveTextContent('');
		await expect.element(screen.getByTestId('isNavigating')).toHaveTextContent('false');
		await expect.element(screen.getByTestId('error')).toHaveTextContent('null');
	});

	test('should reactively update path on navigation', async () => {
		const screen = render(TestPageState);
		await expect.element(screen.getByTestId('path')).toHaveTextContent('');

		await screen.getByTestId('navigate').click();

		await expect.element(screen.getByTestId('path')).toHaveTextContent('/dashboard');
		await expect.element(screen.getByTestId('pathname')).toHaveTextContent('/dashboard');
		await expect.element(screen.getByTestId('appState')).toHaveTextContent('authenticated');
	});

	test('should reactively update isNavigating flag', async () => {
		const screen = render(TestPageState);
		await expect.element(screen.getByTestId('isNavigating')).toHaveTextContent('false');

		await screen.getByTestId('setNavigating').click();
		await expect.element(screen.getByTestId('isNavigating')).toHaveTextContent('true');

		await screen.getByTestId('clearNavigating').click();
		await expect.element(screen.getByTestId('isNavigating')).toHaveTextContent('false');
	});

	test('should reactively update error state', async () => {
		const screen = render(TestPageState);
		await expect.element(screen.getByTestId('error')).toHaveTextContent('null');

		await screen.getByTestId('setError').click();
		await expect.element(screen.getByTestId('error')).toHaveTextContent('Not found');
		await expect.element(screen.getByTestId('isNavigating')).toHaveTextContent('false');

		await screen.getByTestId('clearError').click();
		await expect.element(screen.getByTestId('error')).toHaveTextContent('null');
	});

	test('should reactively update params and search', async () => {
		const screen = render(TestPageState);

		await screen.getByTestId('setParams').click();

		await expect.element(screen.getByTestId('path')).toHaveTextContent('/users/123');
		await expect.element(screen.getByTestId('pathname')).toHaveTextContent('/users/123');
		await expect.element(screen.getByTestId('search')).toHaveTextContent('tab=settings');
		await expect.element(screen.getByTestId('hash')).toHaveTextContent('#section');
		await expect.element(screen.getByTestId('params')).toHaveTextContent('{"id":"123"}');
	});
});
