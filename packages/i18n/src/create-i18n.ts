import { IntlMessageFormat, type Formatters } from 'intl-messageformat';
import { validateCatalogue } from './catalogue';
import { validateLocales } from './locale';
import { I18nError, type I18n, type I18nOptions, type Messages, type ParameterType, type ParameterValue } from './types';

function validateValues(parameters: Readonly<Record<string, ParameterType>>, input: unknown): Record<string, ParameterValue> {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new I18nError('Message values must be an object');
	const entries = new Map<string, unknown>(Object.entries(input));
	if (entries.size !== Object.keys(parameters).length) throw new I18nError('Message parameters must exactly match the contract');
	const values: Record<string, ParameterValue> = Object.create(null);
	for (const [key, kind] of Object.entries(parameters)) {
		const value = entries.get(key);
		if (kind === 'string' && typeof value === 'string') values[key] = value;
		else if (kind === 'number' && typeof value === 'number' && Number.isFinite(value)) values[key] = value;
		else if (kind === 'date' && value instanceof Date && Number.isFinite(value.getTime())) values[key] = value;
		else throw new I18nError(`Invalid message parameter: ${key}`);
	}
	return values;
}

/** Create one instance per application root, SSR request or email recipient. No global mutable state. */
export function createI18n<M extends Messages>(options: I18nOptions<M>): I18n<M> {
	const locales = validateLocales(options.locales, options.fallbackLocale);
	const timeZone = options.timeZone;
	if (!timeZone) throw new I18nError('An explicit time zone is required');
	new Intl.DateTimeFormat(options.fallbackLocale, { timeZone });
	const initial = locales.find((item) => item.code === options.locale);
	if (!initial) throw new I18nError('Initial locale must be supported');
	let current = initial;
	const listeners = new Set<() => void>();
	// Snapshot contracts and compile every catalogue before publishing a usable instance.
	const parameters = new Map(Object.entries(options.messages).map(([key, value]) => [key, { ...value.params }]));
	validateCatalogue(options.messages, Object.fromEntries(Object.entries(options.messages).map(([key, value]) => [key, value.message])));
	if (Object.keys(options.catalogues).length !== locales.length) throw new I18nError('Supply exactly one catalogue per supported locale');
	const catalogues = new Map<string, Map<string, IntlMessageFormat>>();
	for (const locale of locales) {
		if (!Object.hasOwn(options.catalogues, locale.code)) throw new I18nError(`Missing catalogue: ${locale.code}`);
		const asts = validateCatalogue(options.messages, options.catalogues[locale.code]);
		const formatters: Formatters = {
			getNumberFormat: (languages, config) => new Intl.NumberFormat(languages, config),
			getDateTimeFormat: (languages, config) => new Intl.DateTimeFormat(languages, { ...config, timeZone }),
			getPluralRules: (languages, config) => new Intl.PluralRules(languages, config)
		};
		catalogues.set(locale.code, new Map([...asts].map(([key, ast]) => [key, new IntlMessageFormat(ast, locale.code, undefined, { formatters })])));
	}
	return {
		get locale() { return current.code; },
		get direction() { return current.direction; },
		locales, timeZone,
		t(key, ...args) {
			const message = catalogues.get(current.code)?.get(key);
			const contract = parameters.get(key);
			if (!message || !contract) throw new I18nError(`Unknown message key: ${key}`);
			const values = validateValues(contract, args.at(0) ?? {});
			const result = message.format(values);
			if (typeof result !== 'string') throw new I18nError(`Message did not produce text: ${key}`);
			return result;
		},
		number(value, config) {
			if (!Number.isFinite(value)) throw new I18nError('Number must be finite');
			return new Intl.NumberFormat(current.code, config).format(value);
		},
		dateTime(value, config) {
			if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new I18nError('Date must be valid');
			return new Intl.DateTimeFormat(current.code, { ...config, timeZone }).format(value);
		},
		relativeTime(value, unit, config) {
			if (!Number.isFinite(value)) throw new I18nError('Relative time must be finite');
			return new Intl.RelativeTimeFormat(current.code, config).format(value, unit);
		},
		setLocale(locale) {
			const next = locales.find((item) => item.code === locale);
			if (!next) throw new I18nError(`Unsupported locale: ${locale}`);
			if (next === current) return;
			current = next;
			// Snapshot listeners so subscribe/unsubscribe during notification cannot extend this delivery.
			const errors: unknown[] = [];
			for (const listener of [...listeners]) {
				try { listener(); } catch (error) { errors.push(error); }
			}
			if (errors.length) throw new AggregateError(errors, 'Locale committed, but a subscriber failed');
		},
		subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
	};
}
