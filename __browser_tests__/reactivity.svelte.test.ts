/**
 * Browser Test: Svelte 5 Reactivity
 *
 * Verifies that Svelte 5 runes work correctly in browser tests.
 */
import { render } from 'vitest-browser-svelte';
import { expect, test, describe } from 'vitest';
import TestReactivity from './TestReactivity.svelte';

describe('Svelte 5 Reactivity', () => {
	test('should render initial state', async () => {
		const screen = render(TestReactivity);
		await expect.element(screen.getByTestId('count')).toHaveTextContent('0');
	});

	test('should update state on interaction', async () => {
		const screen = render(TestReactivity);

		await screen.getByTestId('increment').click();
		await expect.element(screen.getByTestId('count')).toHaveTextContent('1');

		await screen.getByTestId('increment').click();
		await expect.element(screen.getByTestId('count')).toHaveTextContent('2');
	});
});
