/** A production message contract; translations supply strings with the same parameters. */
export type ParameterType = 'string' | 'number' | 'date';
export type ParameterValue = string | number | Date;
export interface MessageDefinition {
	readonly message: string;
	readonly params?: Readonly<Record<string, ParameterType>>;
}
export type Messages = Readonly<Record<string, MessageDefinition>>;
export type Catalogue<M extends Messages> = { readonly [K in keyof M]: string };
export type MessageArguments<D extends MessageDefinition> = D extends { readonly params: infer P }
	? [values: { [K in keyof P]: P[K] extends 'number' ? number : P[K] extends 'date' ? Date : string }]
	: [];

export interface Locale {
	/** Canonical BCP 47 tag, e.g. en-GB. Application-owned; no built-in language list. */
	readonly code: string;
	readonly direction: 'ltr' | 'rtl';
}
export interface I18nOptions<M extends Messages> {
	readonly messages: M;
	readonly locales: readonly Locale[];
	readonly fallbackLocale: string;
	readonly locale: string;
	/** Include every locale, including the source locale. */
	readonly catalogues: Readonly<Record<string, unknown>>;
	/** Explicit IANA time zone; never inferred from a server's machine configuration. */
	readonly timeZone: string;
}
export interface I18n<M extends Messages> {
	readonly locale: string;
	readonly direction: 'ltr' | 'rtl';
	readonly locales: readonly Locale[];
	readonly timeZone: string;
	t<K extends Extract<keyof M, string>>(key: K, ...args: MessageArguments<M[K]>): string;
	number(value: number, options?: Intl.NumberFormatOptions): string;
	dateTime(value: Date, options?: Intl.DateTimeFormatOptions): string;
	relativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions): string;
	/** Synchronous and atomic: invalid choices throw before changing the current locale. */
	setLocale(locale: string): void;
	/** Subscribe to committed locale changes. The returned function removes the subscription. */
	subscribe(listener: () => void): () => void;
}

/** Preserve literal keys and parameter types without a separately authored TypeScript interface. */
export function defineMessages<const M extends Messages>(messages: M): M {
	return messages;
}

export class I18nError extends Error {
	override readonly name = 'I18nError';
}
