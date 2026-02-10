# Components and Hooks

Technical specification for WarpKit's Svelte component layer and context/hooks system. This document covers every component, the context bridge, all hooks, and shared utilities that connect WarpKit's core navigation engine to Svelte's rendering and reactivity model.

Source files covered:
- `src/components/WarpKitProvider.svelte`
- `src/components/WarpKitAppBoundary.svelte`
- `src/components/RouterView.svelte`
- `src/components/Link.svelte`
- `src/components/NavLink.svelte`
- `src/context.ts`
- `src/hooks.ts`
- `src/events/useEvent.svelte.ts`
- `src/shared/shouldHandleClick.ts`

---

## Architecture Overview

The component layer is a thin bridge between WarpKit's core (the `WarpKit` class, `Navigator`, `RouteMatcher`, `PageState`) and Svelte's rendering system. The dependency flow is strictly one-directional:

```
context.ts  <--  WarpKitProvider  <--  RouterView / Link / NavLink
    ^                                        ^
    |                                        |
    +--- hooks.ts  <-- consumer components --+
```

`context.ts` defines the shape of the context and the `WarpKit` interface (a forward declaration -- the real class lives in `src/core/WarpKit.svelte.ts`). `WarpKitProvider` creates the context and sets it. All other components and hooks consume it via `getContext(WARPKIT_CONTEXT)`.

Reactivity flows through Svelte 5's `$state` and `$derived` runes. The `WarpKit` class uses `$state` internally for `page`, `loadedComponent`, `loadedLayout`, `ready`, and `stateId`. The context object uses getter functions that read these `$state` fields, making all downstream `$derived` bindings reactive without explicit subscriptions.

---

## Context Layer

### `WARPKIT_CONTEXT` (`src/context.ts`)

A `unique symbol` used as the Svelte context key. All context operations use this symbol:

```typescript
export const WARPKIT_CONTEXT: unique symbol = Symbol('warpkit-v2');
```

Using a symbol (rather than a string) prevents collisions with other libraries that might use Svelte context.

### `WarpKit` Interface (`src/context.ts`)

Forward declaration of the WarpKit instance. The actual implementation is `WarpKit.svelte.ts` in `src/core/`. This interface exists at the top of the dependency hierarchy so that `context.ts` can reference `WarpKit` without importing the full core module (which would create circular dependencies).

Generic type parameters:
- `TAppState extends string` -- union of valid application state names (e.g., `'unauthenticated' | 'onboarding' | 'authenticated'`)
- `TStateData` -- optional data type associated with state transitions (used for dynamic default paths)

Properties and methods:

| Member | Type | Description |
|--------|------|-------------|
| `page` | `readonly PageState` | Reactive page state (`$state` backed). Contains `pathname`, `search`, `hash`, `params`, `route`, `error`, `isNavigating`, `appState`. |
| `events` | `readonly EventEmitterAPI<WarpKitEventRegistry>` | Event emitter for cross-component communication. |
| `ready` | `readonly boolean` | `false` until `start()` completes. When `authAdapter` is configured, remains `false` until auth initialization finishes. |
| `loadedComponent` | `readonly Component \| null` | Currently loaded route component. `null` during navigation or on error. |
| `loadedLayout` | `readonly Component \| null` | Currently loaded layout component. `null` if the route has no layout. |
| `navigate(path, options?)` | `Promise<NavigationResult>` | Navigate to a path. Options: `replace`, `state`, `scrollPosition`. |
| `setState(state, options?)` | `Promise<void>` | Change app state. |
| `setAppState(state, data?, options?)` | `Promise<NavigationResult>` | Change app state with optional state data (for dynamic default paths). |
| `buildUrl(path)` | `string` | Build a URL using the browser provider's strategy (hash vs path). |
| `registerBlocker(blocker)` | `BlockerRegistration` | Register a navigation blocker. Returns `{ unregister() }`. |
| `getState()` | `TAppState` | Get current app state. |
| `getStateId()` | `number` | Get current state ID (monotonically incremented on each state change). |
| `start()` | `Promise<void>` | Initialize providers, perform initial navigation. Called once at mount. |
| `destroy()` | `void` | Clean up providers and event listeners. |
| `retry()` | `Promise<NavigationResult>` | Retry the last navigation (for error recovery after `LOAD_FAILED`). |

### `WarpKitContext` Interface (`src/context.ts`)

The actual shape stored in Svelte context. This is the bridge between `WarpKit` (core) and the component layer (RouterView, Link, hooks).

| Member | Type | Description |
|--------|------|-------------|
| `warpkit` | `WarpKit` | Full WarpKit instance. Provides `navigate`, `setState`, `buildUrl`, etc. |
| `page` | `readonly PageState` | Reactive page state. Shorthand backed by a getter reading `warpkit.page`. |
| `routeComponent` | `readonly Component \| null` | Maps to `warpkit.loadedComponent`. Renamed for template clarity. |
| `layoutComponent` | `readonly Component \| null` | Maps to `warpkit.loadedLayout`. Renamed for template clarity. |
| `stateId` | `readonly number` | Maps to `warpkit.getStateId()`. Used by `RouterView` with `{#key}` to force remount on state changes. |
| `retryLoad` | `() => void` | Calls `warpkit.retry()`. Passed to error snippets in RouterView. |

All `readonly` properties are implemented as getters on the context object, which means they re-evaluate on every access. Since they read `$state` fields on the WarpKit instance, Svelte's fine-grained reactivity tracks them automatically.

---

## Components

### WarpKitProvider (`src/components/WarpKitProvider.svelte`)

Root context provider. Must wrap all components that use `useWarpKit()`, `usePage()`, or `useWarpKitContext()`.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `warpkit` | `WarpKit` | Yes | The WarpKit instance to provide. |
| `children` | `Snippet` | Yes | Child content. |

**Behavior:**
1. Creates a `WarpKitContext` object with getter-backed reactive properties.
2. Calls `setContext(WARPKIT_CONTEXT, context)` once during component initialization.
3. Renders children via `{@render children()}`.

The `warpkit` prop is not expected to change after mount. The JSDoc comment in the source explicitly states this is intentional -- WarpKit is a singleton created once at app startup.

**Key implementation detail:** The context object uses JavaScript getters (not Svelte `$derived`), which means reactivity propagates through property access rather than subscription. When a consumer component reads `ctx.page.pathname` inside a `$derived` or template expression, Svelte's compiler tracks the dependency chain: `ctx.page` (getter) -> `warpkit.page` (`$state`) -> `page.pathname` (`$state`).

---

### WarpKitAppBoundary (`src/components/WarpKitAppBoundary.svelte`)

All-in-one application boundary that combines error handling, readiness gating, and context provision. This is the recommended entry point for most applications.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `warpkit` | `WarpKit` | Yes | The WarpKit instance. |
| `children` | `Snippet` | Yes | Application content (typically `<RouterView />`). |
| `loading` | `Snippet` | No | Custom loading UI shown while WarpKit initializes. If omitted, nothing renders until ready. |

**Render logic:**

```
ErrorOverlay (always rendered, outside WarpKitProvider)
  |
  +-- if warpkit.ready:
  |     WarpKitProvider -> children
  |
  +-- else if loading snippet provided:
        loading snippet
```

**Design decisions:**

1. `ErrorOverlay` is rendered **outside** `WarpKitProvider`. This ensures that errors during provider initialization or context setup are still captured and displayed. The overlay subscribes to a global `errorStore` (in `src/errors/error-store.svelte.ts`), not to WarpKit context.

2. `WarpKitProvider` is only rendered when `warpkit.ready` is `true`. This prevents child components from calling hooks before the navigation engine has initialized, which would result in null page state or unresolved routes.

3. The `loading` snippet is rendered **without** WarpKit context. This means `useWarpKit()` and `usePage()` are not available inside the loading snippet -- only plain Svelte rendering.

**Note:** `WarpKitAppBoundary` does **not** call `warpkit.start()`. The consumer is responsible for calling `start()` before or after mounting. This allows the consumer to control the initialization sequence (e.g., setting up auth adapters or data clients before starting).

---

### RouterView (`src/components/RouterView.svelte`)

Renders the currently matched route's component, optionally wrapped in a layout.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `loading` | `Snippet` | No | Shown while navigating (`page.isNavigating` is true). |
| `error` | `Snippet<[{ error: NavigationError \| null; retry: () => void }]>` | No | Custom error UI. Receives the navigation error and a `retry` function. |
| `fallback` | `Snippet` | No | Shown when no route matches and no error exists. |

**Render priority (top to bottom, first match wins):**

1. `page.error && error` -- if there is a navigation error and the consumer provided an `error` snippet, render it with `{ error, retry: ctx.retryLoad }`.
2. `page.isNavigating && loading` -- if navigating and a `loading` snippet is provided, show it.
3. `routeComponent` exists -- render the route component. If a `layoutComponent` also exists, wrap it: `<Layout><Route {...page.params} /></Layout>`.
4. `fallback` exists -- render the fallback snippet.
5. None of the above -- render nothing.

**State-keyed remounting:**

The entire render tree is wrapped in `{#key stateId}`. When `stateId` changes (after a `setState` / `setAppState` call), Svelte destroys the entire subtree and recreates it from scratch. This ensures that:
- Component state from the previous app state is not carried over.
- Layout components are freshly mounted with the new state's configuration.
- Any stale reactive state in child components is discarded.

**Route params as component props:**

Route components receive `page.params` as spread props: `<Route {...page.params} />`. This means a route component for `/users/[id]` can declare `let { id }: { id: string } = $props()` and receive the param directly.

**Layout wrapping pattern:**

When a layout is present, RouterView uses Svelte's `{@const}` for component aliasing:

```svelte
{@const Layout = layoutComponent}
{@const Route = routeComponent}
<Layout>
  <Route {...page.params} />
</Layout>
```

The `{@const}` assignment is necessary because Svelte's template compiler requires component references to be `PascalCase` identifiers, not arbitrary expressions.

---

### Link (`src/components/Link.svelte`)

Declarative client-side navigation component. Replaces `<a>` tags for internal navigation.

**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `href` | `string` | Yes | -- | Target path. |
| `replace` | `boolean` | No | `false` | Replace history entry instead of pushing. |
| `disabled` | `boolean` | No | `false` | Prevents navigation and applies disabled styling. |
| `children` | `Snippet` | No | -- | Link content. |
| `class` | `string` | No | `''` | CSS class. |
| `...rest` | `HTMLAnchorAttributes` | No | -- | All other anchor attributes are spread through. |

**Click handling flow:**

1. If `disabled` is true, `event.preventDefault()` and return.
2. Call `shouldHandleClick(event, href)` to determine if WarpKit should handle navigation.
3. If yes: `event.preventDefault()` and call `warpkit.navigate(href, { replace: replaceHistory })`.
4. If no: let the browser handle the click natively (external link, modifier key, etc.).

**Accessibility:**

- Renders a native `<a>` element (preserving all anchor semantics).
- Sets `aria-disabled` when disabled.
- The `href` attribute is always set on the `<a>`, so right-click -> "Copy Link" and middle-click work correctly even though left-clicks are intercepted.

**Scoped styles:**

The component includes a `.disabled` style that sets `pointer-events: none` and `opacity: 0.5`. These are scoped to the component via Svelte's style scoping.

---

### NavLink (`src/components/NavLink.svelte`)

Active-aware navigation link. Same navigation behavior as `Link`, with additional CSS class application based on whether the current URL matches the link's `href`.

**Props:**

All `Link` props plus:

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `activeClass` | `string` | No | `''` | Class applied when the current pathname starts with `href` (partial match). |
| `exactActiveClass` | `string` | No | `''` | Class applied when the current pathname exactly equals `href`. |

**Active matching logic:**

```typescript
const isExactActive = $derived(page.pathname === href);
const isActive = $derived(
  isExactActive || (page.pathname.startsWith(href + '/') && href !== '/')
);
```

- `isExactActive`: pathname is identical to `href`.
- `isActive`: pathname starts with `href + '/'` (prevents `/` from matching everything). Also true when `isExactActive` is true.
- Root path (`/`) is special-cased: it only matches exactly, never as a prefix. Without this, every path would be "active" relative to `/`.

**Class composition:**

Classes are combined by filtering and joining:

```typescript
const computedClass = $derived(
  [className, isActive ? activeClass : '', isExactActive ? exactActiveClass : '']
    .filter(Boolean)
    .join(' ')
);
```

**ARIA attributes:**

- `aria-current="page"` when `isExactActive` is true.
- `aria-current="true"` when `isActive` but not exact.
- `undefined` (attribute omitted) when inactive.

---

## Hooks

All hooks are defined in `src/hooks.ts` and must be called during component initialization (inside `<script>` at the top level, not inside event handlers or callbacks).

### `useWarpKit<TAppState, TStateData>()`

Returns the `WarpKit` instance from context.

**Source:** `src/hooks.ts`

**Behavior:**
1. Calls `getContext<WarpKitContext>(WARPKIT_CONTEXT)`.
2. If context is `null`/`undefined`, throws: `[WarpKit] useWarpKit must be called within WarpKitProvider`.
3. Returns `ctx.warpkit` cast to `WarpKit<TAppState, TStateData>`.

**Usage pattern:** Components that need to call `navigate()`, `setState()`, `registerBlocker()`, or other WarpKit methods.

### `usePage()`

Returns the reactive `PageState` from context.

**Source:** `src/hooks.ts`

**Behavior:**
1. Calls `getContext<WarpKitContext>(WARPKIT_CONTEXT)`.
2. Throws if outside provider.
3. Returns `ctx.page` (the getter-backed reactive property).

**Return type fields:**

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Full path (pathname + search + hash). |
| `pathname` | `string` | Pathname portion only. |
| `search` | `SvelteURLSearchParams` | Reactive search params wrapper. |
| `hash` | `string` | Hash fragment. |
| `params` | `Record<string, string>` | Matched route params. |
| `route` | `Route \| null` | Matched route object (null during error). |
| `error` | `NavigationError \| null` | Current navigation error. |
| `isNavigating` | `boolean` | Whether a navigation is in progress. |
| `appState` | `string` | Current application state name. |

**Usage pattern:** Components that need to read current URL, params, or navigation state reactively without needing the full WarpKit API.

### `useWarpKitContext()`

Returns the full `WarpKitContext` object. Intended for internal or advanced use.

**Source:** `src/hooks.ts`

**Behavior:** Same as `useWarpKit()` but returns the entire context object instead of just the `warpkit` property. Provides access to `routeComponent`, `layoutComponent`, `stateId`, and `retryLoad` -- fields that are typically only needed by `RouterView`.

### `useEvent<K>(event, handler, options?)`

Subscribe to WarpKit events with automatic cleanup tied to the component lifecycle.

**Source:** `src/events/useEvent.svelte.ts` (re-exported from `src/hooks.ts`)

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `event` | `keyof WarpKitEventRegistry` | Event name to subscribe to. |
| `handler` | `EventHandler<WarpKitEventRegistry[K]>` | Callback when event fires. |
| `options.enabled` | `boolean \| (() => boolean)` | Control whether the subscription is active. Supports both static booleans and reactive getter functions. Defaults to `true`. |

**Implementation:**

Uses a Svelte 5 `$effect()` rune. The `enabled` option is evaluated inside the effect for reactivity when a getter function is used. When `enabled` becomes `false`, the cleanup function (returned by `warpkit.events.on()`) is called, removing the subscription. When the component is destroyed, `$effect`'s automatic cleanup removes the subscription.

```typescript
$effect(() => {
  const enabled = typeof options.enabled === 'function' ? options.enabled() : (options.enabled ?? true);
  if (!enabled) return;
  const off = warpkit.events.on(event, handler);
  return off;
});
```

The `.svelte.ts` file extension is required because this module uses the `$effect` rune, which is only available in Svelte 5's rune-aware compilation mode.

---

## Shared Utilities

### `shouldHandleClick(event, href)` (`src/shared/shouldHandleClick.ts`)

Determines whether a click event should be handled by WarpKit's client-side navigation or left to the browser's default behavior.

**Parameters:**
- `event: MouseEvent` -- the click event from an anchor element.
- `href: string` -- the href attribute of the anchor.

**Returns:** `true` if WarpKit should intercept the navigation, `false` to let the browser handle it.

**Conditions that return `false` (browser handles):**

| Condition | Rationale |
|-----------|-----------|
| `event.defaultPrevented` | Another handler already handled this event. |
| `event.button !== 0` | Right-click or middle-click (context menu / new tab). |
| `event.metaKey \|\| event.ctrlKey \|\| event.shiftKey \|\| event.altKey` | User wants new tab/window (Cmd+Click, Ctrl+Click, etc.). |
| `href.startsWith('http://') \|\| href.startsWith('https://') \|\| href.startsWith('//')` | External URL. |
| `href` matches `/^[a-z][a-z0-9+.-]*:/i` | Protocol URL (mailto:, tel:, javascript:, etc.). |
| `target.hasAttribute('download')` | Download link. |
| `target.target === '_blank'` | Explicit new-tab target. |

The protocol URL regex (`/^[a-z][a-z0-9+.-]*:/i`) follows RFC 3986's scheme syntax. It catches `mailto:`, `tel:`, `ftp:`, and any other valid URI scheme. The external URL checks (`http://`, `https://`, `//`) are handled separately for clarity and performance, since they are the most common cases.

The function reads `event.currentTarget` (cast to `HTMLAnchorElement | null`) to check for `download` and `target` attributes. This correctly reads from the element the handler is attached to, not the element that was clicked (which might be a child element like an `<img>` or `<span>` inside the anchor).

---

## Error Handling in the Component Layer

### ErrorOverlay (`src/errors/ErrorOverlay.svelte`)

Global error overlay rendered by `WarpKitAppBoundary`. Not directly configurable by consumers -- it subscribes to `errorStore` (a global Svelte store in `src/errors/error-store.svelte.ts`).

Key behaviors:
- Renders as a fixed overlay at `z-index: 9999` with a dark semi-transparent backdrop.
- Displays the error message and a cleaned stack trace (Vite dev server URLs are rewritten to local file paths).
- Provides "Dismiss" and "Reload Page" buttons.
- Includes keyboard handling: Escape to dismiss, Tab/Shift+Tab focus trap within the dialog.
- Styles use `all: initial` on the root element to prevent host application CSS from leaking in.
- WCAG compliance: `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, focus management on appearance.

This component is placed outside `WarpKitProvider` in `WarpKitAppBoundary` intentionally. If an error occurs during WarpKitProvider initialization (or in any child component), the overlay can still render because it depends only on the global error store, not on WarpKit context.

### RouterView Error Handling

RouterView handles navigation-specific errors (not runtime JS errors) via its `error` snippet prop. When `page.error` is non-null and the consumer provided an `error` snippet, RouterView renders it with:

```typescript
{ error: page.error, retry: ctx.retryLoad }
```

The `retry` function calls `warpkit.retry()`, which re-attempts the last navigation. This is primarily useful for `LOAD_FAILED` errors (network failures during lazy component loading) where retrying may succeed.

Navigation error codes that can appear in `page.error`:
- `ABORTED` (2) -- a `beforeNavigate` hook returned `false`.
- `NOT_FOUND` (4) -- no route matched the path.
- `STATE_MISMATCH` (5) -- route exists but in a different app state.
- `LOAD_FAILED` (6) -- component or layout import failed.
- `TOO_MANY_REDIRECTS` (7) -- redirect loop detected.

Non-visual errors (`CANCELLED` = 1, `BLOCKED` = 3) do not set `page.error` and therefore do not trigger the error snippet.

`RENDER_ERROR` (8) is a special case: it is caught by `svelte:boundary` inside the component, not by the navigation engine. It does not appear in `page.error`.

---

## Dependency Order

The dependency hierarchy for the component/context layer, from bottom to top:

```
src/core/types.ts          -- PageState, NavigationError, Route, etc.
src/providers/interfaces.ts -- Provider interfaces
src/events/types.ts        -- EventEmitterAPI, WarpKitEventRegistry
        |
src/context.ts             -- WARPKIT_CONTEXT, WarpKit interface, WarpKitContext
        |
src/hooks.ts               -- useWarpKit, usePage, useWarpKitContext
src/events/useEvent.svelte.ts -- useEvent (re-exported by hooks.ts)
src/shared/shouldHandleClick.ts
        |
src/components/WarpKitProvider.svelte
src/components/RouterView.svelte
src/components/Link.svelte
src/components/NavLink.svelte
src/components/WarpKitAppBoundary.svelte
src/errors/ErrorOverlay.svelte
```

**Circular dependency prevention:** `context.ts` only imports types from `core/types.ts`, `providers/interfaces.ts`, and `events/types.ts`. It never imports from `core/WarpKit.svelte.ts`. The `WarpKit` interface in `context.ts` is a forward declaration -- the actual class in `core/WarpKit.svelte.ts` implements this interface. This breaks what would otherwise be a circular dependency between the context and core modules.
