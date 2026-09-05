# @warpkit/i18n

Optional WarpKit localisation for browsers, servers and Svelte 5. Applications own their languages, message contracts, translations and preference policy. There are no built-in product strings or fixed locales.

```ts
import { createI18n, defineMessages, type Catalogue } from '@warpkit/i18n';

const messages = defineMessages({
  greeting: { message: 'Hello {name}', params: { name: 'string' } },
  items: { message: '{count, plural, one {# item} other {# items}}', params: { count: 'number' } },
  save: { message: 'Save' }
});
const french: Catalogue<typeof messages> = {
  greeting: 'Bonjour {name}',
  items: '{count, plural, one {# élément} other {# éléments}}',
  save: 'Enregistrer'
};
const i18n = createI18n({
  messages,
  locales: [{ code: 'en-GB', direction: 'ltr' }, { code: 'fr-FR', direction: 'ltr' }],
  fallbackLocale: 'en-GB', locale: 'fr-FR', timeZone: 'UTC',
  catalogues: {
    'en-GB': { greeting: messages.greeting.message, items: messages.items.message, save: messages.save.message },
    'fr-FR': french
  }
});
i18n.t('greeting', { name: 'Sam' });
i18n.t('items', { count: 2 });
i18n.t('save');
```

## Contracts and validation

`defineMessages` preserves literal keys and parameter kinds (`string`, `number`, `date`). `t` requires the corresponding parameters; dates accept valid `Date` instances and numbers must be finite. Runtime validation also rejects extra parameters from JavaScript callers. `Catalogue<typeof messages>` provides translation key checking; `validateCatalogue(messages, unknown)` validates downloaded JSON.

Creation validates source messages and **every** supported catalogue before returning an instance. Missing/extra keys, empty messages, invalid ICU syntax, missing/undeclared parameters and incompatible ICU argument types throw `I18nError`. A fallback locale is a negotiation default, not permission to conceal untranslated keys. Plural/select messages require `other`; translators supply language-appropriate branches. This is structural validation, not a linguistic or legal review.

Messages use [ICU MessageFormat](https://formatjs.github.io/docs/intl-messageformat/), including plural, ordinal, select and number/date skeletons. The API returns plain text. It rejects rich-text tags and does not accept interpolation callbacks. Render text normally in Svelte; **never** put results into `{@html}` or an HTML email without the renderer's normal escaping. Interpolated strings are not HTML-escaped by this package; escaping belongs to the output context.

All catalogues are loaded eagerly and compiled once per instance; storage is bounded by the configured catalogue set. Load remote resources before construction and validate them before rendering. Lazy catalogue loading, extraction tooling, HTML translation, locale URL routing and polyfills are outside this initial API. Runtimes need Intl data for their configured languages.

## Locale lifecycle and formatting

`resolveLocale({locales, fallbackLocale, preferred, requested})` chooses an exact supported preference, then negotiates an ordered array of BCP 47 language tags, then the fallback. Malformed external tags are ignored. Parse an HTTP Accept-Language header into an ordered language list before calling; a raw header is not a language tag. Locales must be unique canonical tags with explicit `ltr`/`rtl` direction.

`setLocale(code)` synchronously commits a supported locale and notifies subscribers; choosing the current locale is a no-op. An invalid choice leaves state unchanged. It does not navigate, reload, persist, remount components or mutate document metadata. If subscribers throw, all listeners are notified and an `AggregateError` reports that the locale **has committed**. `subscribe` returns an unsubscribe function.

`number`, `dateTime` and `relativeTime` use the current locale. Currency is an explicit number-format option. The instance's required `timeZone` controls both standalone dates and ICU date/time arguments, overriding per-call timezone options. Date parameters require ICU date/time syntax; bare interpolation is rejected to prevent machine-timezone stringification. Create a new instance for a different timezone. No machine timezone is inferred.

Create a fresh instance for each SSR request or email recipient. No mutable locale lives at module scope. The root export imports no Svelte code and works independently of a router. Browser storage, cookies, locale routes and recipient preference selection remain application policies.

## Svelte integration

In one application-owned context module:

```ts
import { createI18nContext } from '@warpkit/i18n/svelte';
// MessageContract is typeof your production messages.
export const { provide: provideI18n, use: useI18n } = createI18nContext<MessageContract>();
```

During a root component's initialisation, call `const i18n = provideI18n(controller)`. Descendants call `const i18n = useI18n()`. Render `{i18n.t('save')}` and call `i18n.setLocale(code)` from your accessible language control. Keep the returned object intact; destructuring a reactive property captures its current value. All message/format methods and locale/direction getters track locale changes through Svelte runes. The provider unsubscribes when destroyed. Nested providers and concurrent SSR roots remain isolated.

Use `<svelte:head>` or a root effect to apply `i18n.locale` and `i18n.direction` to your document. Persist a validated preference using your application's storage policy; handle unavailable storage without preventing an in-memory choice. Keep the router and form components mounted when switching languages. Validation and provider errors should store stable codes and translate at render time.

Both exports ship compiled JavaScript and declarations. Consumers never compile WarpKit source. Package tests import the compiled public API; browser tests exercise the compiled Svelte bridge with a real form.
