# Internationalisation

WarpKit's optional `@warpkit/i18n` package provides typed ICU messages, catalogue validation, locale negotiation and locale-aware formatting. `@warpkit/i18n/svelte` supplies a reactive context without coupling locale changes to navigation or form lifetime.

The [package guide](https://github.com/upstat-io/warpkit/blob/feat/i18n/packages/i18n/README.md) owns the full API, validation rules, server isolation, formatting and Svelte examples. This feature is developed on `feat/i18n`; it is not a claim that an npm release is available.

Applications own their supported languages, translations, preference persistence and URL policy. Keep product concepts out of the framework. A validated catalogue proves structure and parameter compatibility, not translation quality. Exercise complete rendered flows, including error states, accessible text and dirty forms, for each language your application ships.
