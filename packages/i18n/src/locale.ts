import { match } from '@formatjs/intl-localematcher';
import { I18nError, type Locale } from './types';

export function validateLocales(locales: readonly Locale[], fallbackLocale: string): readonly Locale[] {
	const codes = new Set<string>();
	const copy = locales.map((locale) => {
		if (Intl.getCanonicalLocales(locale.code)[0] !== locale.code || codes.has(locale.code)) {
			throw new I18nError(`Locale must be unique and canonical: ${locale.code}`);
		}
		if (locale.direction !== 'ltr' && locale.direction !== 'rtl') throw new I18nError('Invalid locale direction');
		if (Intl.NumberFormat.supportedLocalesOf(locale.code).length === 0 || Intl.PluralRules.supportedLocalesOf(locale.code).length === 0) {
			throw new I18nError(`Runtime lacks Intl data for locale: ${locale.code}`);
		}
		codes.add(locale.code);
		return Object.freeze({ ...locale });
	});
	if (!codes.has(fallbackLocale)) throw new I18nError('Fallback locale must be supported');
	return Object.freeze(copy);
}

/** Explicit supported preference > ordered requested languages > configured fallback. */
export function resolveLocale(options: {
	locales: readonly Locale[];
	fallbackLocale: string;
	preferred?: string | null;
	requested?: readonly string[];
}): string {
	const locales = validateLocales(options.locales, options.fallbackLocale);
	const codes = locales.map((locale) => locale.code);
	if (options.preferred && codes.includes(options.preferred)) return options.preferred;
	const requested: string[] = [];
	for (const language of options.requested ?? []) {
		try { requested.push(...Intl.getCanonicalLocales(language)); }
		catch { /* Malformed external preferences do not invalidate the configured fallback. */ }
	}
	return match(requested, codes, options.fallbackLocale);
}
