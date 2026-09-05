import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { createI18n } from '@warpkit/i18n';
import { messages } from './context';
import Provider from './Provider.svelte';

afterEach(cleanup);
function controller() {
	return createI18n({
		messages,
		locales: [{ code: 'en', direction: 'ltr' }, { code: 'fr', direction: 'ltr' }, { code: 'ar', direction: 'rtl' }],
		fallbackLocale: 'en', locale: 'en', timeZone: 'UTC',
		catalogues: { en: { name: 'Name', save: 'Save' }, fr: { name: 'Nom', save: 'Enregistrer' }, ar: { name: 'الاسم', save: 'حفظ' } }
	});
}

it('updates compiled Svelte consumers without remounting or losing dirty input/focus', async () => {
	const i18n = controller();
	const screen = await render(Provider, { controller: i18n });
	await screen.getByTestId('name').fill('Unfinished <draft>');
	const operation = screen.getByTestId('operation').element().textContent;
	i18n.setLocale('fr');
	await expect.element(screen.getByTestId('save')).toHaveTextContent('Enregistrer');
	await expect.element(screen.getByTestId('name')).toHaveValue('Unfinished <draft>');
	await expect.element(screen.getByTestId('name')).toHaveFocus();
	await expect.element(screen.getByTestId('operation')).toHaveTextContent(operation ?? '');
	i18n.setLocale('ar');
	await expect.element(screen.getByTestId('locale')).toHaveAttribute('dir', 'rtl');
	await expect.element(screen.getByTestId('save')).toHaveTextContent('حفظ');
});

it('isolates simultaneously mounted providers and cleans up subscriptions', async () => {
	const first = controller();
	const second = controller();
	let active = 0;
	const originalSubscribe = first.subscribe;
	first.subscribe = (listener) => {
		active += 1;
		const unsubscribe = originalSubscribe(listener);
		return () => { active -= 1; unsubscribe(); };
	};
	const one = await render(Provider, { controller: first });
	const two = await render(Provider, { controller: second });
	expect(active).toBe(1);
	first.setLocale('fr');
	await expect.element(one.locator.getByTestId('save')).toHaveTextContent('Enregistrer');
	await expect.element(two.locator.getByTestId('save')).toHaveTextContent('Save');
	await cleanup();
	expect(active).toBe(0);
	first.setLocale('ar');
});
