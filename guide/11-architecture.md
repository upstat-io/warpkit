# Architecture & Design Decisions

This chapter explains the reasoning behind WarpKit's architecture. Understanding these decisions will help you use the framework effectively, diagnose issues when they arise, and contribute improvements. Each section covers a specific design choice, why we made it, and what alternatives we considered.

## Why a New Framework?

SvelteKit handles SSR, SSG, and full-stack applications brilliantly. If you are building a public-facing website, SvelteKit is the right choice. Full stop.

But a large class of applications does not need SSR:

- Admin dashboards behind authentication
- Internal tools and back-office applications
- SaaS products where every page requires a logged-in user
- Real-time monitoring consoles
- CRM and project management tools

These applications share common characteristics. They never need SEO. They never benefit from server-side rendering because the first thing every page does is fetch user-specific data. Their routing requirements are fundamentally different from content websites -- they need routes organized by application state, not by URL patterns.

SvelteKit is file-based and server-centric by design. Adapting it for a pure SPA means fighting the framework: disabling SSR, working around file-based routing for auth guards, building your own data layer, adding your own form management. You end up writing a client-side framework on top of a server-side framework.

WarpKit is what you would build if you started from the other direction: a client-only framework designed specifically for SPAs behind authentication, where application state determines routing, data fetching happens entirely on the client, and forms are a first-class concern.

## Core Architecture

### The Facade Pattern

WarpKit's main class is a thin facade. It does not parse URLs, match routes, manage layouts, or execute navigation. It delegates to specialized components, each with a single responsibility:

```
WarpKit (facade)
  |
  |-- StateMachine
  |     Tracks current application state ('authenticated', 'unauthenticated', etc.)
  |     Increments stateId on every transition for cancellation detection.
  |
  |-- RouteMatcher
  |     Compiles path patterns to RegExp at construction time.
  |     Sorts routes by specificity score for deterministic matching.
  |     Handles redirects and cross-state mismatch detection.
  |
  |-- Navigator
  |     Executes the 9-phase navigation pipeline.
  |     Checks dual cancellation (navigationId + stateId) between async phases.
  |     Delegates to all other components during the pipeline.
  |
  |-- PageState
  |     Reactive state container using Svelte 5 $state runes.
  |     Holds pathname, params, search, hash, error, isNavigating.
  |
  |-- NavigationLifecycle
  |     Manages beforeNavigate (parallel), onNavigate (sequential),
  |     and afterNavigate (fire-and-forget) hooks.
  |
  |-- LayoutManager
  |     Resolves layouts (route-level > state-level > none).
  |     Caches loaded layouts by ID to avoid redundant imports.
  |
  |-- EventEmitter
  |     Type-safe pub/sub with error isolation.
  |     Handlers that throw do not affect other handlers.
  |
  |-- Providers
       |-- BrowserProvider     -- history/URL abstraction
       |-- StorageProvider     -- scroll positions, intended paths
       |-- ConfirmDialogProvider -- blocking confirmation dialogs
```

The `WarpKit` class itself is about 350 lines. It handles initialization, coordinates state changes, and exposes a public API. Everything else is delegated.

Why this matters in practice:

1. **Testability.** Each component is testable in isolation. The `RouteMatcher` has its own test suite that verifies matching logic without creating a WarpKit instance. The `StateMachine` is tested independently. The `Navigator` can be tested with mock dependencies.

2. **Maintainability.** When you change how scroll restoration works, you only touch `StorageProvider`. When you change how routes are matched, you only touch `RouteMatcher` and `RouteCompiler`. The blast radius of any change is contained.

3. **Extensibility.** New providers can be added without modifying core. The `ProviderRegistry` accepts any object that implements the `Provider` interface. Custom providers initialize alongside core providers and receive a `WarpKitCore` reference for reading state.

### Svelte 5 Reactivity Integration

WarpKit bridges imperative state management with Svelte 5's reactive system. The navigation pipeline is imperative -- phases execute sequentially, each doing specific work. But the output of that pipeline is reactive.

`PageState` is a class whose properties are Svelte 5 `$state` fields:

```typescript
export class PageState {
  path = $state('');
  pathname = $state('');
  search = $state(new SvelteURLSearchParams());
  hash = $state('');
  params = $state<Record<string, string>>({});
  route = $state<Route | null>(null);
  appState = $state('');
  isNavigating = $state(false);
  error = $state<NavigationError | null>(null);
}
```

When the Navigator completes Phase 6 (Load & Activate), it calls `pageState.update(location)`, which atomically sets all location-related fields. Svelte 5 components that read `warpkit.page.pathname` or `warpkit.page.params` automatically re-render.

Similarly, `loadedComponent` and `loadedLayout` are `$state` fields on the WarpKit class. When the Navigator loads a new component, setting these fields triggers `RouterView` to render the new component.

The key insight is that the navigation pipeline is a complex imperative process (check blockers, run hooks, load components, commit to history), but its final effect is a simple reactive assignment. Components only see the finished result and respond to it naturally through Svelte 5's reactivity.

### SvelteURLSearchParams

URLSearchParams is not reactive. If you read `params.get('tab')` in a Svelte 5 component, changing the param later does not trigger re-render because `URLSearchParams` has no reactivity hooks.

`SvelteURLSearchParams` wraps `URLSearchParams` with a version counter that is a `$state` field:

```typescript
export class SvelteURLSearchParams {
  #params: URLSearchParams;
  #version = $state<number>(0);

  get(key: string): string | null {
    void this.#version; // Read version to establish reactive dependency
    return this.#params.get(key);
  }

  set(key: string, value: string): void {
    this.#params.set(key, value);
    this.#version++; // Trigger reactive updates
  }
}
```

Reading any method first reads `#version` (establishing a Svelte reactive dependency), then delegates to the underlying `URLSearchParams`. Writing any method delegates the mutation, then increments `#version` to trigger Svelte updates.

This avoids creating new `URLSearchParams` objects on every mutation, which would be wasteful. The version counter is the lightest possible reactivity bridge.

### Route Compilation

Routes are compiled once during WarpKit construction, not on every navigation:

1. Each path pattern like `/projects/[id]/tasks/[taskId]` is converted to a RegExp (`/^\/projects\/([^\/]+)\/tasks\/([^\/]+)\/?$/`).
2. Parameter names are extracted into an ordered array (`['id', 'taskId']`).
3. A specificity score is computed based on segment types.
4. Routes within each state are sorted by score, with definition order breaking ties.

The scoring system ensures deterministic matching:

| Segment Type | Example | Score |
|-------------|---------|-------|
| Static | `projects` | +100 |
| Required param | `[id]` | +10 |
| Optional param | `[id?]` | +5 |
| Required catch-all | `[...rest]` | +2 |
| Optional catch-all | `[...rest?]` | +1 |

This means the route `/about` (score 100) always beats `/[slug]` (score 10) when matching the path `/about`. The route `/projects/[id]` (score 110) beats `/[...rest]` (score 2) when matching `/projects/123`.

For static routes (no params), RouteMatcher builds an O(1) lookup table in addition to the sorted regex list. Most navigations in a typical application hit static routes, making the common case a hash map lookup rather than a linear regex scan.

### The State Machine

WarpKit's state machine is deliberately minimal:

```typescript
export class StateMachine<TAppState extends string> {
  private currentState: TAppState;
  private stateId: number = 0;

  setState(newState: TAppState): StateTransition<TAppState> {
    const previous = this.currentState;
    this.currentState = newState;
    this.stateId++;
    // Notify listeners...
  }
}
```

There are no transition guards, no intermediate states, no parallel states, and no hierarchical states. The application has ONE current state, and that state determines which routes are available.

Why not use XState or a more sophisticated state machine? Because WarpKit's state machine serves a single, specific purpose: tracking which set of routes is active. It does not need parallel states (the app is in one state at a time). It does not need transition guards (the auth adapter decides when to change state, not the state machine). It does not need effects or actions (the navigation pipeline handles those).

The `stateId` counter is the one clever bit. It increments on every transition and is used by the Navigator for cancellation detection. If a navigation starts in stateId 5 and a state transition bumps it to 6 before the navigation completes, the Navigator detects the mismatch and cancels the stale navigation. This prevents a common class of race conditions where a user logs out while a navigation to an authenticated route is still in progress.

### The Navigation Pipeline

Every navigation in WarpKit flows through the same 9-phase pipeline. This is true for push navigations, popstate (back/forward), state change navigations, and redirects. The consistency simplifies reasoning about navigation behavior.

The phases are:

1. **INITIATE** -- Generate a unique navigationId, capture the current stateId, set `isNavigating = true`.
2. **MATCH ROUTE** -- Find the matching route for the path in the current state. Handle redirects, state mismatches, and 404s.
3. **CHECK BLOCKERS** -- Run all registered `NavigationBlocker` functions. Show the confirm dialog if any blocker returns a message string.
4. **BEFORE NAVIGATE** -- Run all `beforeNavigate` hooks in parallel. Any hook can abort (return `false`) or redirect (return a path string).
5. **DEACTIVATE CURRENT** -- Save scroll position for the current page's history entry.
6. **LOAD & ACTIVATE** -- Load the route component and layout via lazy import. Update `PageState` with the new location.
7. **ON NAVIGATE** -- Run `onNavigate` hooks sequentially. These are for View Transitions and similar DOM-manipulating operations.
8. **COMMIT** -- Update browser history (push or replace). Handle scroll restoration.
9. **AFTER NAVIGATE** -- Set `isNavigating = false`, run `afterNavigate` hooks (fire-and-forget).

Between every async phase, the Navigator checks for cancellation using a dual condition:

```typescript
const isCancelled = (): boolean =>
  navigationId !== this.currentNavigationId ||
  capturedStateId !== this.stateMachine.getStateId();
```

This catches two cancellation scenarios:
- A newer navigation started (navigationId changed).
- A state transition occurred (stateId changed).

Without the stateId check, a navigation started in the `authenticated` state could complete even though the user logged out during the component load phase. The dual check prevents this.

## Design Decisions

### Why Not File-Based Routing?

SvelteKit and Next.js use file-based routing where the filesystem structure determines the URL structure. WarpKit uses code-defined routes for several reasons:

1. **State organization.** Files do not naturally express "these routes are for authenticated state and those are for unauthenticated state." You could use folder conventions, but that is implicit rather than explicit.

2. **Type inference.** `createRoute({ path: '/projects/[id]' })` infers the param type `{ id: string }` at the call site. File-based routing cannot provide this because the type information is derived from a filename, not a TypeScript expression.

3. **Dynamic routes.** Routes can be computed at runtime. If your application loads plugins that contribute routes, code-defined routes handle this naturally. File-based routing cannot.

4. **Explicit over implicit.** Code-defined routes are visible in one place. There are no naming conventions to learn, no special files like `+page.svelte` or `+layout.ts`, and no magic behavior based on folder names.

The trade-off is that you do not get automatic route discovery. You must explicitly register every route. We consider this acceptable because the routes definition is typically 20-50 lines of code in a single file, and it serves as a clear map of your application's URL structure.

### Why Lazy Loading by Default?

Every route component in WarpKit is defined as a function that returns a dynamic import:

```typescript
createRoute({
  path: '/dashboard',
  component: () => import('./Dashboard.svelte')
})
```

This is not optional. There is no `component: Dashboard` syntax for eager loading. The reason is that lazy loading is the correct default for SPAs:

1. **Code splitting.** Vite automatically creates separate chunks for each dynamic import. Only the code for the current route is loaded initially.
2. **Loading pipeline integration.** Component loading is a phase of the navigation pipeline. Errors during load are caught cleanly and reported through `page.error`.
3. **Layout caching.** Layouts are loaded once and cached by ID. When navigating between routes that share a layout, the layout component is reused without re-import.
4. **Consistent behavior.** Every navigation, whether initial or subsequent, follows the same async loading path. There are no edge cases where a component is "already loaded" versus "needs loading."

If you want to preload components for performance, you can call the import function ahead of time. Vite's module cache ensures the second call is a cache hit.

### Why StandardSchema?

WarpKit's form system does not include its own validation library. Instead, it uses the [StandardSchema](https://github.com/standard-schema/standard-schema) specification, which defines a common interface that validation libraries can implement:

```typescript
import { useForm } from '@warpkit/forms';
import { Type } from '@sinclair/typebox';

// TypeBox schema that conforms to StandardSchema
const schema = Type.Object({
  email: Type.String({ format: 'email' }),
  name: Type.String({ minLength: 1 })
});

const form = useForm({ schema, defaults: { email: '', name: '' } });
```

You can use TypeBox, Zod, Valibot, ArkType, or any library that implements StandardSchema. WarpKit does not care which one you choose.

Why this approach instead of building validation into the framework?

1. **No lock-in.** You are not forced to learn a WarpKit-specific validation API. Use whatever validation library your backend already uses.
2. **Reusable schemas.** If your backend uses TypeBox for request validation, those same schemas can be used directly in WarpKit forms. No translation layer.
3. **Independent evolution.** Validation libraries evolve faster than frameworks. By depending on an interface rather than an implementation, WarpKit benefits from improvements to Zod, TypeBox, and others without framework updates.

### Why Not Stores?

WarpKit uses Svelte 5 runes (`$state`, `$derived`) exclusively. There are no Svelte 4 stores anywhere in the codebase.

The reasons:

1. **Runes are the future.** Svelte 5 runes are the recommended approach for reactive state in Svelte. Building on stores would mean building on a deprecated API.
2. **`$state` is simpler.** A `$state` field is a plain property assignment. No `writable()`, no `.set()`, no `.update()`, no `$` prefix for auto-subscribing.
3. **Better TypeScript integration.** `$state<NavigationError | null>(null)` gives you full type inference. Store-based approaches require more type gymnastics.
4. **No subscription boilerplate.** Components that read `warpkit.page.pathname` automatically react to changes. No `$page` store subscription, no `get()` calls.

### Why Deep Proxy for Forms?

WarpKit's form system uses a deep proxy to make form data reactive and compatible with Svelte 5's `bind:value`:

```svelte
<input bind:value={form.data.address.street} />
<input bind:value={form.data.tags[0].name} />
```

Alternative approaches and why they do not work well for Svelte:

- **`register()` with refs** (React Hook Form pattern) -- Does not work with Svelte's `bind:value`, which expects a mutable lvalue, not a ref registration call.
- **`setFieldValue(path, value)`** (Formik pattern) -- Imperative, does not integrate with `bind:value`. You end up writing `on:input` handlers instead of bindings.
- **Store-based** (Svelte Superforms) -- Built for Svelte 4 stores. Works but adds subscription complexity for deeply nested data.
- **Deep Proxy** (WarpKit) -- Works natively with `bind:value` because the proxy provides a mutable lvalue at every level of nesting. The proxy intercepts `set` operations to track dirty fields and trigger validation.

The proxy approach is the most natural for Svelte because it preserves the ergonomics of two-way binding while adding form management capabilities (dirty tracking, validation, array operations) transparently.

## Event System Architecture

WarpKit includes a typed event emitter for decoupled cross-component communication:

```typescript
// Define custom events via TypeScript module augmentation
declare module '@warpkit/core' {
  interface WarpKitEventRegistry {
    'monitor:created': { uuid: string; name: string };
    'monitor:deleted': { uuid: string };
  }
}

// Emit from anywhere
warpkit.events.emit('monitor:created', { uuid: '123', name: 'API Health' });

// Subscribe in a component (auto-cleanup with useEvent hook)
useEvent('monitor:created', ({ uuid, name }) => {
  console.log(`Monitor ${name} created`);
});
```

Why events instead of a global store?

1. **Decoupling.** The component that creates a monitor does not need to know which components care about that event. The list page, the sidebar counter, and the notification toast all subscribe independently.
2. **Type safety.** Event payloads are typed via the `WarpKitEventRegistry` interface. TypeScript catches payload mismatches at compile time.
3. **Auto-cleanup.** The `useEvent` hook (used in Svelte components) automatically unsubscribes when the component is destroyed.
4. **Error isolation.** If one event handler throws, other handlers still execute. Errors are logged but do not cascade.
5. **Cross-package communication.** Events work across packages. The `@warpkit/data` package listens for invalidation events to refetch data. Your application code emits those events when mutations complete.

Built-in events follow a `namespace:event-name` convention in lowercase kebab-case:

| Event | Payload | Emitted When |
|-------|---------|-------------|
| `auth:signed-in` | `{ userId: string }` | User completes authentication |
| `auth:signed-out` | `void` | User signs out |
| `auth:token-refreshed` | `void` | Auth token is refreshed |
| `app:state-changed` | `{ from: string; to: string }` | Application state transitions |
| `app:error` | `{ error: Error; context?: string }` | Unhandled application error |
| `query:invalidated` | `{ key: string; params?: ... }` | Data cache is invalidated |
| `query:fetched` | `{ key: string; fromCache: boolean }` | Data is fetched |

## Error Architecture

Navigation errors in WarpKit are categorized into two groups based on whether they should be displayed in the UI:

**Visual errors** (displayed by `RouterView`):
- `NOT_FOUND` -- No route matches the path in any state.
- `LOAD_FAILED` -- Component or layout import failed.
- `STATE_MISMATCH` -- Route exists in another state (falls back to default path, or errors if no default).
- `TOO_MANY_REDIRECTS` -- Redirect loop detected (max 10 redirects).

**Non-visual errors** (flow control, no UI):
- `CANCELLED` -- Navigation was superseded by a newer navigation or state change.
- `BLOCKED` -- User declined the confirmation dialog for a navigation blocker.
- `ABORTED` -- A `beforeNavigate` hook returned `false`.

Visual errors set `page.error` on `PageState`, which `RouterView` checks when rendering. If `page.error` is set, `RouterView` renders the error slot instead of the route component.

Non-visual errors are returned in the `NavigationResult` but do not set `page.error`. They are normal flow control and do not indicate a problem with the application.

The global `onError` handler (configured via `createWarpKit`) receives all visual errors with full context. This handler is for external error reporting (Sentry, LogRocket, etc.), not for UI display. `RouterView` handles the UI side. This separation prevents double-displaying errors.

## Package Architecture

WarpKit is a monorepo with focused, independent packages:

```
@warpkit/core          Required. Router, state machine, events, components.
@warpkit/data          Optional. DataClient, useData, useMutation, cache integration.
@warpkit/cache         Optional. MemoryCache, StorageCache, ETagCacheProvider.
@warpkit/forms         Optional. useForm, deep proxy, validation, array fields.
@warpkit/validation    Optional. StandardSchema validation utilities.
@warpkit/websocket     Optional. SocketClient with reconnection and room subscriptions.
@warpkit/auth-firebase Optional. Firebase authentication adapter.
@warpkit/errors        Internal. Error reporting channel used across packages.
@warpkit/types         Internal. Shared TypeScript types.
```

Only `@warpkit/core` is required. Everything else is opt-in.

Packages communicate through typed interfaces, not implementation details. The `@warpkit/data` package does not import from `@warpkit/core`'s internal modules. It uses the `EventEmitterAPI` interface to subscribe to events and the `WarpKitCore` interface to read navigation state.

This means you can use `@warpkit/core` for routing and bring your own data fetching library (TanStack Query, custom hooks, etc.). You can use `@warpkit/forms` with any validation library that implements StandardSchema. You can replace `@warpkit/auth-firebase` with your own auth adapter by implementing the `AuthAdapter` interface.

## Performance Considerations

WarpKit is designed for applications that navigate frequently (dashboards, admin panels) and need navigation to feel instant:

1. **Route compilation at startup.** Routes are compiled to RegExp once during construction. Matching at navigation time is a hash table lookup (for static routes) or a linear scan of pre-compiled regex patterns (for parameterized routes).

2. **Layout caching.** Layouts are loaded via dynamic import once and cached by their string ID. Navigating between `/dashboard` and `/settings` with the same layout does not re-import or re-mount the layout component.

3. **Dual cancellation.** The Navigator checks both `navigationId` and `stateId` between every async phase. This prevents wasted work: if the user clicks a second link before the first navigation completes, the first is cancelled immediately at the next checkpoint.

4. **Lazy loading.** Only the current route's component is loaded. Vite splits each dynamic import into a separate chunk automatically.

5. **Search param updates without navigation.** `updateSearch()` modifies the URL and PageState directly without running the full navigation pipeline. This makes tabs, filters, and pagination feel instant because there is no route matching, no hook execution, and no component loading.

6. **Static path O(1) lookup.** Routes without parameters are stored in a hash map in addition to the sorted regex list. The common case -- navigating to `/dashboard`, `/settings`, `/users` -- is a single hash map lookup.

## Contributing to WarpKit

If you are interested in contributing, here is the codebase layout:

```
src/
  core/              Router, state machine, navigator, page state, route compiler
  components/        RouterView, Link, WarpKitProvider (Svelte components)
  events/            EventEmitter and type definitions
  providers/         Browser, storage, confirm providers (interfaces + defaults)
  auth/              Auth adapter type definitions
  errors/            Error store and global error handlers
  testing/           Mock providers, assertion helpers, render helpers
  shared/            Shared utilities (formatPath, etc.)
  hooks/             Svelte hooks (useWarpKit, usePage, useEvent)

packages/
  auth-firebase/     Firebase auth adapter implementation
  cache/             MemoryCache, StorageCache, ETagCacheProvider
  data/              DataClient, useData, useMutation
  errors/            Error reporting channel
  forms/             useForm, deep proxy, validation integration
  types/             Shared TypeScript type definitions
  validation/        StandardSchema utilities
  websocket/         SocketClient with reconnection
```

The core source files and their responsibilities:

| File | Lines | Purpose |
|------|-------|---------|
| `WarpKit.svelte.ts` | ~350 | Main facade. Initialization, public API, provider coordination. |
| `Navigator.ts` | ~350 | The 9-phase navigation pipeline. All navigation flows through here. |
| `RouteMatcher.ts` | ~200 | Route compilation, specificity sorting, state-aware matching. |
| `RouteCompiler.ts` | ~100 | Path pattern to RegExp conversion with scoring. |
| `StateMachine.ts` | ~90 | Simple state tracker with stateId for cancellation detection. |
| `PageState.svelte.ts` | ~80 | Reactive state container using Svelte 5 $state. |
| `NavigationLifecycle.ts` | ~160 | Hook registration and execution (before, on, after). |
| `LayoutManager.ts` | ~100 | Layout resolution and caching. |

Tests live alongside their source files in `__tests__/` directories. Every component has unit tests. The testing utilities in `src/testing/` are themselves tested.

## Next Steps

- [Introduction & Philosophy](./01-introduction.md) -- Revisit the design principles with deeper understanding
- [The Navigation Pipeline](./04-navigation-pipeline.md) -- Detailed walkthrough of all 9 phases
- [The Provider System](./05-provider-system.md) -- How providers enable testability and customization
- [Testing](./10-testing.md) -- Put this architectural knowledge into practice
