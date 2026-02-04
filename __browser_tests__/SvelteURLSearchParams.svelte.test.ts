/**
 * Browser Test: SvelteURLSearchParams Reactivity
 *
 * Verifies that SvelteURLSearchParams $state triggers reactive updates.
 */
import { render } from 'vitest-browser-svelte';
import { expect, test, describe } from 'vitest';
import TestSvelteURLSearchParams from './TestSvelteURLSearchParams.svelte';

describe('SvelteURLSearchParams Reactivity', () => {
	test('should render initial empty state', async () => {
		const screen = render(TestSvelteURLSearchParams);
		await expect.element(screen.getByTestId('toString')).toHaveTextContent('');
		await expect.element(screen.getByTestId('size')).toHaveTextContent('0');
		await expect.element(screen.getByTestId('hasFoo')).toHaveTextContent('false');
		await expect.element(screen.getByTestId('getFoo')).toHaveTextContent('null');
	});

	test('should reactively update on set', async () => {
		const screen = render(TestSvelteURLSearchParams);

		await screen.getByTestId('setFoo').click();

		await expect.element(screen.getByTestId('toString')).toHaveTextContent('foo=bar');
		await expect.element(screen.getByTestId('size')).toHaveTextContent('1');
		await expect.element(screen.getByTestId('hasFoo')).toHaveTextContent('true');
		await expect.element(screen.getByTestId('getFoo')).toHaveTextContent('bar');
	});

	test('should reactively update on append', async () => {
		const screen = render(TestSvelteURLSearchParams);

		await screen.getByTestId('setFoo').click();
		await expect.element(screen.getByTestId('size')).toHaveTextContent('1');

		await screen.getByTestId('appendFoo').click();
		await expect.element(screen.getByTestId('size')).toHaveTextContent('2');
		await expect.element(screen.getByTestId('toString')).toHaveTextContent('foo=bar&foo=baz');
	});

	test('should reactively update on delete', async () => {
		const screen = render(TestSvelteURLSearchParams);

		await screen.getByTestId('setFoo').click();
		await expect.element(screen.getByTestId('hasFoo')).toHaveTextContent('true');

		await screen.getByTestId('deleteFoo').click();
		await expect.element(screen.getByTestId('hasFoo')).toHaveTextContent('false');
		await expect.element(screen.getByTestId('size')).toHaveTextContent('0');
	});

	test('should reactively update on replaceAll', async () => {
		const screen = render(TestSvelteURLSearchParams);

		await screen.getByTestId('setFoo').click();
		await expect.element(screen.getByTestId('toString')).toHaveTextContent('foo=bar');

		await screen.getByTestId('replaceAll').click();
		await expect.element(screen.getByTestId('toString')).toHaveTextContent('a=1&b=2&c=3');
		await expect.element(screen.getByTestId('size')).toHaveTextContent('3');
		await expect.element(screen.getByTestId('hasFoo')).toHaveTextContent('false');
	});
});
