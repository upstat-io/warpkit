import { createContext, onDestroy } from 'svelte';
import type { I18n, Messages } from '../types';

/** Create once in a consumer-owned context module; provide once per component subtree. */
export function createI18nContext<M extends Messages>(): {
	provide: (controller: I18n<M>) => I18n<M>;
	use: () => I18n<M>;
} {
	const [use, set] = createContext<I18n<M>>();
	return {
		use,
		provide(controller) {
			let revision = $state(0);
			onDestroy(controller.subscribe(() => { revision += 1; }));
			return set({
				get locale() { revision; return controller.locale; },
				get direction() { revision; return controller.direction; },
				get locales() { return controller.locales; },
				get timeZone() { return controller.timeZone; },
				t(key, ...args) { revision; return controller.t(key, ...args); },
				number(value, options) { revision; return controller.number(value, options); },
				dateTime(value, options) { revision; return controller.dateTime(value, options); },
				relativeTime(value, unit, options) { revision; return controller.relativeTime(value, unit, options); },
				setLocale: (locale) => controller.setLocale(locale),
				subscribe: (listener) => controller.subscribe(listener)
			});
		}
	};
}
