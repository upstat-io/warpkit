import { describe, expect, it } from 'vitest';
// Self-reference resolves the package's compiled exports, as it does for a consumer.
import { createI18n, defineMessages, resolveLocale, validateCatalogue, type Catalogue, type Locale } from '@warpkit/i18n';

const messages = defineMessages({
	hello: { message: 'Hello {name}', params: { name: 'string' } },
	items: { message: '{count, plural, one {# item} other {# items}}', params: { count: 'number' } },
	status: { message: '{status, select, open {Open} other {Closed}}', params: { status: 'string' } },
	date: { message: '{date, date, short} {date, time, short}', params: { date: 'date' } },
	save: { message: 'Save' }
});
const en: Catalogue<typeof messages> = {
	hello: 'Hello {name}', items: '{count, plural, one {# item} other {# items}}',
	status: '{status, select, open {Open} other {Closed}}', date: '{date, date, short} {date, time, short}', save: 'Save'
};
const fr: Catalogue<typeof messages> = {
	hello: 'Bonjour {name}', items: '{count, plural, one {# élément} other {# éléments}}',
	status: '{status, select, open {Ouvert} other {Fermé}}', date: '{date, date, short} {date, time, short}', save: 'Enregistrer'
};
const locales: readonly Locale[] = [{ code: 'en-GB', direction: 'ltr' }, { code: 'fr-FR', direction: 'ltr' }];
const options = { messages, locales, fallbackLocale: 'en-GB', locale: 'en-GB', timeZone: 'UTC', catalogues: { 'en-GB': en, 'fr-FR': fr } };

describe('compiled consumer API', () => {
	it('formats ICU plural/select messages and treats interpolated markup as text', () => {
		const i18n = createI18n(options);
		expect(i18n.t('items', { count: 2 })).toBe('2 items');
		i18n.setLocale('fr-FR');
		expect(i18n.t('items', { count: 0 })).toBe('0 élément');
		expect(i18n.t('items', { count: 2 })).toBe('2 éléments');
		expect(i18n.t('status', { status: 'open' })).toBe('Ouvert');
		expect(i18n.t('hello', { name: '<img src=x onerror=alert(1)>' })).toBe('Bonjour <img src=x onerror=alert(1)>');
	});
	it('negotiates canonical browser languages while rejecting malformed preferences', () => {
		expect(resolveLocale({ locales, fallbackLocale: 'en-GB', preferred: 'fr-FR', requested: ['en-US'] })).toBe('fr-FR');
		expect(resolveLocale({ locales, fallbackLocale: 'en-GB', preferred: 'bad', requested: ['*', 'fr-CA'] })).toBe('fr-FR');
		expect(resolveLocale({ locales, fallbackLocale: 'en-GB', requested: ['invalid_!'] })).toBe('en-GB');
		expect(() => createI18n({ ...options, locale: 'de' })).toThrow();
		expect(() => createI18n({ ...options, locales: [...locales, locales[0]] })).toThrow();
	});
	it('rejects incomplete, extra, invalid ICU, wrong-parameter and rich-text catalogues', () => {
		for (const candidate of [null, [], { ...fr, extra: 'extra' }, { ...fr, save: '' },
			{ ...fr, hello: 'Bonjour' }, { ...fr, hello: '{otherName}' }, { ...fr, hello: '{name, number}' },
			{ ...fr, items: '{count, plural, one {un}}' }, { ...fr, date: '{date}' }, { ...fr, save: '<b>Save</b>' }]) {
			expect(() => validateCatalogue(messages, candidate)).toThrow();
		}
		const { save, ...missing } = fr;
		expect(save).toBe('Enregistrer');
		expect(() => validateCatalogue(messages, missing)).toThrow();
		expect(() => createI18n({ ...options, catalogues: { 'en-GB': en } })).toThrow();
	});
	it('validates values from untyped consumers at runtime', () => {
		const i18n = createI18n(options);
		expect(() => i18n.t('items', { count: NaN })).toThrow();
		expect(() => i18n.t('date', { date: new Date(NaN) })).toThrow();
		const extra = { name: 'Sam', extra: 'unexpected' };
		expect(() => i18n.t('hello', extra)).toThrow();
	});
	it('commits once, isolates instances and unsubscribes', async () => {
		const first = createI18n(options);
		const second = createI18n({ ...options, locale: 'fr-FR' });
		let notifications = 0;
		const off = first.subscribe(() => { notifications += 1; });
		first.setLocale('fr-FR');
		first.setLocale('fr-FR');
		expect(() => first.setLocale('xx')).toThrow();
		expect(first.locale).toBe('fr-FR');
		expect(notifications).toBe(1);
		off();
		first.setLocale('en-GB');
		const results = await Promise.all([Promise.resolve().then(() => first.t('save')), Promise.resolve().then(() => second.t('save'))]);
		expect(results).toEqual(['Save', 'Enregistrer']);
		expect(notifications).toBe(1);
	});
	it('delivers to other subscribers even when a subscriber fails', () => {
		const i18n = createI18n(options);
		let notified = false;
		i18n.subscribe(() => { throw new Error('consumer failure'); });
		i18n.subscribe(() => { notified = true; });
		expect(() => i18n.setLocale('fr-FR')).toThrow(AggregateError);
		expect(i18n.locale).toBe('fr-FR');
		expect(notified).toBe(true);
	});
	it('formats numbers and instants with explicit instance locale/time zone', () => {
		const i18n = createI18n({ ...options, locale: 'fr-FR' });
		const date = new Date('2026-01-01T23:45:00Z');
		expect(i18n.number(1234.5, { style: 'currency', currency: 'EUR' })).toBe(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1234.5));
		expect(i18n.dateTime(date, { timeStyle: 'short', timeZone: 'Pacific/Auckland' })).toBe('23:45');
		expect(i18n.t('date', { date })).toContain('23:45');
		expect(i18n.relativeTime(-1, 'day', { numeric: 'auto' })).toBe('hier');
	});
	it('does not permit mutation of caller-owned configuration to change the compiled contract', () => {
		const params: { name: 'string' | 'number' } = { name: 'string' };
		const contract = { hello: { message: 'Hello {name}', params } };
		const source = { hello: 'Hello {name}' };
		const i18n = createI18n({ ...options, messages: contract, catalogues: { 'en-GB': source, 'fr-FR': source } });
		params.name = 'number';
		source.hello = 'Modified';
		expect(i18n.t('hello', { name: 'Sam' })).toBe('Hello Sam');
		expect(Object.isFrozen(i18n.locales)).toBe(true);
	});
});
