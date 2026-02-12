# WarpKit Core Internals

Technical specification for the core runtime of WarpKit. This document covers the classes in `src/core/` that implement routing, navigation, state management, and layout resolution. It is written for framework maintainers and contributors who need to understand the internal architecture before making changes.

All descriptions are derived directly from the source code. File paths are relative to the WarpKit package root.

---

## Table of Contents

1. [WarpKit Facade](#1-warpkit-facade)
2. [Navigator -- 9-Phase Navigation Pipeline](#2-navigator----9-phase-navigation-pipeline)
3. [StateMachine](#3-statemachine)
4. [RouteCompiler](#4-routecompiler)
5. [RouteMatcher](#5-routematcher)
6. [PageState](#6-pagestate)
7. [SvelteURLSearchParams](#7-svelteurlsearchparams)
8. [LayoutManager](#8-layoutmanager)
9. [NavigationLifecycle](#9-navigationlifecycle)

---

## 1. WarpKit Facade

**File:** `src/core/WarpKit.svelte.ts`

The central orchestrator. All consumer interaction with WarpKit flows through this class. It owns every core subsystem, wires them together, and exposes the public API surface.

### Generics

```ts
class WarpKit<TAppState extends string, TStateData = unknown> implements WarpKitCore
```

- `TAppState` -- union of valid app state names (e.g., `'authenticated' | 'unauthenticated' | 'onboarding'`).
- `TStateData` -- data type passed to function-based default path resolvers and exposed via `getStateData()`.

### Reactive Fields (Svelte 5 `$state`)

| Field | Type | Purpose |
|---|---|---|
| `loadedComponent` | `Component \| null` | Currently loaded route component. Set by Navigator via callback in Phase 6. |
| `loadedLayout` | `Component \| null` | Currently loaded layout component. `null` when route has no layout. |
| `ready` | `boolean` | `false` until `start()` completes initial navigation. When an `authAdapter` is provided, remains `false` until auth initialization finishes. |

These are the only `$state` fields on WarpKit itself. `RouterView` (the Svelte component) reads these reactively to render the current page.

### Owned Subsystems

Constructed in the constructor, in this order:

1. **PageState** -- reactive route state container (`$state` fields for path, params, route, error, etc.)
2. **StateMachine** -- FSM tracking current `TAppState` with stateId counter
3. **RouteMatcher** -- pre-compiles all routes, provides `match()` and `tryExpandPath()`
4. **NavigationLifecycle** -- hook registration and execution (before/on/after navigate)
5. **LayoutManager** -- layout resolution with ID-based caching
6. **Navigator** -- the 9-phase pipeline executor (initialized after providers resolve)

### Constructor

```ts
constructor(config: WarpKitConfig<TAppState, TStateData>)
```

Key operations:

1. Stores `routes`, `authAdapter`, `dataConfig`, `onError` from config.
2. Instantiates all core subsystems.
3. Pre-caches static default paths: iterates `config.routes` and caches any `default` value that is a `string` or `null`. Function defaults are deferred until `stateData` is available.
4. Resolves providers via `resolveProviders()`, applying defaults:
   - `browser` -- `DefaultBrowserProvider` (History API)
   - `confirmDialog` -- `DefaultConfirmDialogProvider` (`window.confirm`)
   - `storage` -- `DefaultStorageProvider` (in-memory LRU)
5. Creates `Navigator` with all dependencies, passing callbacks for:
   - `setLoadedComponents` -- sets `$state` fields on WarpKit
   - `checkBlockers` -- delegates to WarpKit's blocker set
   - `fireNavigationComplete` -- notifies navigation complete listeners
   - `getResolvedDefault` -- delegates to WarpKit's default path cache/resolver

### `start()`

```ts
public async start(): Promise<void>
```

Must be called exactly once after construction. Throws on double-call.

Execution order:

1. Sets `started = true`.
2. **Dev mode**: exposes `window.__WARPKIT_INSTANCE__` for debugging.
3. **Global error handlers**: calls `setupGlobalErrorHandlers()` (installs `window.onerror` and `window.onunhandledrejection`).
4. **Provider initialization**: resolves provider dependency graph and initializes in dependency order via `initializeProviders()`. Providers with `dependsOn` arrays wait for their dependencies; all others initialize in parallel.
5. **Popstate listener**: subscribes to `browser.onPopState()`, delegates to `handlePopState()`.
6. **beforeunload handler**: installs `window.beforeunload` that checks all registered blockers.
7. **Auth adapter** (if provided):
   - Calls `authAdapter.initialize({ events })` -- awaited.
   - Updates `stateData` and `StateMachine` from the result.
   - Scopes data cache if `dataConfig.scopeKey` returns a value.
   - Subscribes to `authAdapter.onAuthStateChanged()` for subsequent transitions.
   - On failure: reports error via `reportError()`, falls back to `config.initialState`.
8. **Pre-start queue**: processes queued `setAppState()` calls (these override auth adapter state). For each: updates `stateData`, sets state on `StateMachine`, resolves path, calls `navigator.navigateAfterStateChange()`.
9. **Initial navigation**: reads current URL from `browser.getLocation()`, navigates with `replace: true`.
10. Sets `ready = true`.

### `navigate(path, options?)`

```ts
public async navigate(path: string, options?: NavigateOptions): Promise<NavigationResult>
```

1. Resolves relative paths against `page.pathname` using standard `URL` resolution.
2. Calls `tryExpandPath()` -- if the path doesn't match directly, attempts to prepend a param value from `stateData` (e.g., `/dashboard` becomes `/acme/dashboard` when `stateData.orgId === 'acme'` and route `/[orgId]/dashboard` exists).
3. Delegates to `navigator.navigate()`.

### `setAppState(state, dataOrPath?, options?)`

```ts
public async setAppState(
  state: TAppState,
  dataOrPath?: TStateData | string,
  options?: SetStateOptions
): Promise<NavigationResult>
```

- Second argument is polymorphic: `string` is treated as an explicit target path, anything else as `TStateData`.
- If called before `start()`, the request is queued in `preStartQueue` and processed during `start()`.
- After start: updates `stateData` (if provided), calls `stateMachine.setState()`, resolves path (explicit path > function/static default from cache), delegates to `navigator.navigateAfterStateChange()`.

### `updateSearch(params, options?)`

```ts
public updateSearch(
  params: Record<string, string | null>,
  options?: { replace?: boolean }
): void
```

Updates URL search params without triggering the full navigation pipeline. No hooks run, no `isNavigating` flag set. Intended for filters, tabs, pagination.

- Builds new `URLSearchParams` from current search + param changes (`null` deletes a key).
- Updates `PageState.search` and `PageState.path` reactively.
- Updates browser URL via `replace()` (default) or `push()`. Push entries use negative IDs (via `--searchUpdateCounter`) to avoid collision with Navigator's positive navigation IDs.
- Notifies `searchChangeListeners`.

### Default Path Caching

- **Static defaults** (string or null): pre-cached in constructor, never invalidated.
- **Function defaults** (`(data: TStateData) => string`): cached after first resolution. Cache key is the state name.
- **Invalidation**: when `updateStateData()` detects `stateData` changed by reference, all function default entries are cleared from the cache. Static entries are preserved.
- `getResolvedDefault(state)`: checks cache first, then resolves function defaults with current `stateData`. Returns `null` if `stateData` is undefined and the default is a function.

### Auth Integration

`handleAuthStateChange(result)`:
- Updates `stateData` if provided.
- If state differs from current: clears data cache (`dataConfig.client.clearCache()`), re-scopes cache via `dataConfig.scopeKey`, then calls `setAppState()`.

### Deep Links

- `getIntendedPath()` -- delegates to `storage.popIntendedPath()` (get-and-clear).
- `setIntendedPath(path)` -- delegates to `storage.saveIntendedPath()`.

### `destroy()`

Cleanup sequence:
1. Removes `window.__WARPKIT_INSTANCE__` (dev mode).
2. Removes popstate listener.
3. Removes beforeunload listener.
4. Removes global error handlers.
5. Unsubscribes from auth state changes.
6. Calls `destroy()` on all providers (try/catch per provider).
7. Clears `blockers`, `searchChangeListeners`, `navigationCompleteListeners`.

---

## 2. Navigator -- 9-Phase Navigation Pipeline

**File:** `src/core/Navigator.ts`

Executes all navigations: push, pop, and state-change. Internally stateful (tracks `navigationCounter`, `currentNavigationId`, `historyPosition`).

### Entry Points

| Method | `NavigationRequest.type` | Called by |
|---|---|---|
| `navigate(path, options)` | `'push'` | `WarpKit.navigate()`, `WarpKit.retry()`, `WarpKit.start()` |
| `navigateAfterStateChange(state, path, options)` | `'state-change'` | `WarpKit.setAppState()` |
| `handlePopState(state, direction, onBlocked)` | `'pop'` | `WarpKit.handlePopState()` |

All three delegate to `runPipeline(request)`.

### Cancellation

Every pipeline has dual cancellation detection, checked between phases:

```ts
const isCancelled = (): boolean =>
  navigationId !== this.currentNavigationId ||
  capturedStateId !== this.stateMachine.getStateId();
```

- `navigationId !== currentNavigationId` -- a newer `navigate()` call has started.
- `capturedStateId !== stateMachine.getStateId()` -- app state changed during this navigation (e.g., sign-out while loading a page).

When cancelled, `pageState.setNavigating(false)` is called and a `CANCELLED` result is returned. The cancelled navigation does not modify PageState, history, or loaded components.

### Phase 1: INITIATE

```
src/core/Navigator.ts:200-216
```

1. Increment `navigationCounter`, assign to `currentNavigationId`.
2. Capture `capturedStateId` from `stateMachine.getStateId()`.
3. Set `pageState.isNavigating = true`.
4. Snapshot current location as `fromLocation` (used in `NavigationContext.from`).

### Phase 2: MATCH ROUTE

```
src/core/Navigator.ts:222-265
```

Calls `matcher.match(pathname, currentState)`. The return type is a discriminated union with four possible outcomes:

| Outcome | Shape | Action |
|---|---|---|
| **Redirect** | `{ redirect: string }` | Increment redirect count, recurse into `runPipeline()` with new path. |
| **Route match** | `{ route, params, state }` | Proceed to Phase 3. |
| **State mismatch** | `{ stateMismatch: true, requestedState, availableInState }` | Resolve current state's default path via `getResolvedDefault()`. If found, redirect to it (with `replace: true`). If not, emit `STATE_MISMATCH` error. |
| **null** | `null` | Emit `NOT_FOUND` error. |

Redirect loop protection: `redirectCount` is tracked on `NavigationRequest` and checked against `MAX_REDIRECTS = 10`. Exceeding the limit produces a `TOO_MANY_REDIRECTS` error.

### Phase 3: CHECK BLOCKERS

```
src/core/Navigator.ts:296-305
```

1. Check `isCancelled()`.
2. Call `checkBlockers()` (delegated to WarpKit, which iterates the blocker Set).
3. If blocked:
   - Set `isNavigating = false`.
   - If this is a `pop` navigation, call `onBlocked()` to restore the browser URL (go forward/back to undo the popstate).
   - Return `BLOCKED` error.

### Phase 4: BEFORE NAVIGATE

```
src/core/Navigator.ts:310-327
```

1. Check `isCancelled()`.
2. Call `lifecycle.runBeforeNavigate(context)` -- runs all hooks in parallel.
3. Process result:
   - `{ proceed: false, redirect: undefined }` -- abort. Set `isNavigating = false`, return `ABORTED` error.
   - `{ proceed: false, redirect: string }` -- redirect. Increment redirect count, recurse into `runPipeline()`.
   - `{ proceed: true }` -- continue.

### Phase 5: DEACTIVATE CURRENT

```
src/core/Navigator.ts:332-343
```

1. Check `isCancelled()`.
2. If there is a current route (`context.from?.route`): read the current history state from the browser provider, save the current scroll position keyed by `historyState.id` via the storage provider.

### Phase 6: LOAD & ACTIVATE

```
src/core/Navigator.ts:348-368
```

1. Check `isCancelled()`.
2. **Load component**: call `route.component()` (lazy import). Extract `module.default` as the component. On import failure, wrap the error with route context via `enhanceLoadError()`.
3. Check `isCancelled()` again (import was async).
4. **Load layout**: call `layoutManager.resolveLayout(route, stateConfig)`.
5. Check `isCancelled()` again.
6. **Set loaded components**: call `setLoadedComponents(component, layout)` -- this updates WarpKit's `$state` fields.
7. Clear any previous error on PageState.
8. **Update PageState**: call `pageState.update(context.to)` -- atomically sets path, pathname, search, hash, params, route, appState, and clears error.

### Phase 7: ON NAVIGATE

```
src/core/Navigator.ts:372-374
```

1. Call `lifecycle.runOnNavigate(context)` -- runs hooks **sequentially** (awaited). This is the hook point for View Transitions API (`document.startViewTransition()`).
2. Check `isCancelled()`.

### Phase 8: COMMIT

```
src/core/Navigator.ts:379-392
```

1. Create `HistoryState` object: `{ __warpkit: true, id: navigationId, position: historyPosition, appState, data }`.
2. For non-pop navigations:
   - `replace: true` -- call `browser.replace(path, historyState)`.
   - `replace: false` -- call `browser.push(path, historyState)`, increment `historyPosition`.
3. Pop navigations skip history manipulation (the browser already updated the URL).
4. **Scroll handling** (priority order):
   - `scrollPosition === 'preserve'` -- do nothing.
   - `scrollPosition` is `{ x, y }` -- scroll to explicit coordinates.
   - Pop navigation with `restoredNavigationId` -- restore saved scroll position from storage provider.
   - `context.to.hash` is non-empty -- scroll to element by ID (`document.getElementById`).
   - Default -- `window.scrollTo(0, 0)`.

### Phase 9: AFTER NAVIGATE

```
src/core/Navigator.ts:396-402
```

1. Set `pageState.isNavigating = false`.
2. Call `lifecycle.runAfterNavigate(context)` -- fire-and-forget, NOT awaited.
3. Call `fireNavigationComplete(context)` -- notifies provider observers.
4. Return `{ success: true, location: context.to }`.

### Error Handling

The entire pipeline is wrapped in a try/catch. Uncaught errors (typically from component/layout loading in Phase 6) produce a `LOAD_FAILED` error:

```ts
const navError: NavigationError = {
  code: NavigationErrorCode.LOAD_FAILED,
  message: error instanceof Error ? error.message : 'Navigation failed',
  cause: error instanceof Error ? error : undefined,
  requestedPath: request.path
};
```

The error is set on `PageState` and the global `onError` handler is invoked.

### NavigationErrorCode Reference

| Code | Name | Visual | Source |
|---|---|---|---|
| 1 | `CANCELLED` | No | Any phase (isCancelled check) |
| 2 | `ABORTED` | Yes | Phase 4 (beforeNavigate hook returned false) |
| 3 | `BLOCKED` | No | Phase 3 (blocker/confirm dialog) |
| 4 | `NOT_FOUND` | Yes | Phase 2 (no route in any state) |
| 5 | `STATE_MISMATCH` | Yes | Phase 2 (route in wrong state) |
| 6 | `LOAD_FAILED` | Yes | Phase 6 (import failure) |
| 7 | `TOO_MANY_REDIRECTS` | Yes | Phase 2/4 (redirect count > 10) |
| 8 | `RENDER_ERROR` | Yes | Post-pipeline (svelte:boundary in RouterView) |

"Visual" errors are displayed by RouterView. "Non-visual" errors (`CANCELLED`, `BLOCKED`) are flow-control outcomes that don't warrant user-facing error UI.

---

## 3. StateMachine

**File:** `src/core/StateMachine.ts`

Simple finite state machine. Intentionally a plain TypeScript class (not `.svelte.ts`) for testability -- WarpKit mirrors state to `$state` fields separately.

### Generic

```ts
class StateMachine<TAppState extends string>
```

### State

| Field | Type | Description |
|---|---|---|
| `currentState` | `TAppState` | Current app state. |
| `stateId` | `number` | Monotonically increasing counter. Starts at 0, increments on every `setState()` call. |
| `listeners` | `Set<(transition) => void>` | Subscriber set. |

### `setState(newState)`

```ts
public setState(newState: TAppState): StateTransition<TAppState>
```

1. Capture `previous = currentState`.
2. Set `currentState = newState`.
3. Increment `stateId`.
4. Create `StateTransition` object: `{ previous, current, id: stateId, timestamp: Date.now() }`.
5. Notify all listeners (each wrapped in try/catch; errors reported via `reportError()` but don't block other listeners).
6. Return the transition object.

**Same-state transitions are allowed.** This is intentional: `stateId` still increments, causing Navigator's `isCancelled()` to detect the transition and cancel in-flight navigations. Consumers that want to short-circuit on same-state can check `previous === current` on the returned transition.

### `subscribe(listener)`

Returns an unsubscribe function (removes listener from Set).

---

## 4. RouteCompiler

**File:** `src/core/RouteCompiler.ts`

Stateless compiler. Converts path pattern strings into `CompiledRoute` objects containing a RegExp pattern, extracted param names, and a specificity score.

### `compile(route, state)`

```ts
public compile(route: Route, state: string): CompiledRoute
```

Delegates to `pathToRegex()` for the heavy lifting, then wraps the result with the route and state.

### `pathToRegex(path)` -- Segment Rules

The path is split by `/` and each segment is classified:

| Segment Type | Example | Score | RegExp Fragment | Notes |
|---|---|---|---|---|
| Static | `projects` | +100 | `/projects` | Escaped via `escapeRegex()`. |
| Required param | `[id]` | +10 | `/([^/]+)` | Captures exactly one non-empty segment. |
| Optional param | `[id?]` | +5 | `(?:/([^/]+))?` | Entire segment is optional. Unmatched = `undefined` in capture group. |
| Required catch-all | `[...rest]` | +2 | `/(.+)` | Matches one or more remaining segments. |
| Optional catch-all | `[...rest?]` | +1 | `(?:/(.*))?` | Matches zero or more remaining segments. Uses `(.*)` not `(.+)` because empty string is valid. |

### Final RegExp Construction

- Segments are joined without separators (each fragment already includes its leading `/`).
- Root path `/` produces empty `regexStr`, which becomes `^/$` (exact match).
- Non-root paths append `/?$` to allow an optional trailing slash.
- Example: `/projects/[id]/settings` produces `^/projects/([^/]+)/settings/?$` with score 210.

### Specificity Scoring Rationale

Higher score = more specific = matched first. The scoring gap between tiers (100 vs 10 vs 5 vs 2 vs 1) ensures that a route with more static segments always beats a route with more dynamic segments, regardless of count.

---

## 5. RouteMatcher

**File:** `src/core/RouteMatcher.ts`

Pre-compiles all routes at construction time. Maintains multiple lookup structures for fast matching.

### Data Structures (per state)

| Structure | Type | Purpose |
|---|---|---|
| `compiledRoutes` | `Map<state, CompiledRoute[]>` | All routes sorted by specificity (descending), then definition order (ascending) for tie-breaking. |
| `redirects` | `Map<state, Map<from, to>>` | Exact-match redirect lookup. O(1). |
| `staticPathLookup` | `Map<state, Map<path, CompiledRoute>>` | Non-param routes for O(1) matching. Includes both with and without trailing slash. |
| `expandableRoutes` | `Map<state, ExpandableRoute[]>` | Routes starting with `/[param]/...` for path expansion. |
| `expansionLookup` | `Map<state, Map<restOfRoute, ExpandableRoute>>` | Fast lookup for `tryExpandPath()`. |
| `stateConfigs` | `Map<state, StateConfig>` | Full state configs (for default paths, layouts). |

### Constructor

For each state in `StateRoutes`:

1. Store `StateConfig` in `stateConfigs`.
2. Compile all routes via `RouteCompiler`.
3. Sort compiled routes: `score DESC, definitionOrder ASC`.
4. Strip `definitionOrder` (transient sorting field).
5. Build `staticPathLookup`: routes with zero params get exact-path entries.
6. Build `expandableRoutes` and `expansionLookup`: routes matching `/\[([^\]]+)\](\/.*)?$/` are categorized by their leading param name and rest-of-route suffix.
7. Store redirects as a `Map<string, string>` from the config's `redirects` object.

### `match(pathname, state)` -- 5-Step Process

```ts
public match(pathname: string, state: string): RouteMatch | null
```

Returns a discriminated union (see `RouteMatch` type in `src/core/types.ts`):

**Step 1: Check redirects** -- O(1) lookup in `redirects.get(state)`. If found, return `{ redirect: target }`.

**Step 2: Static lookup** -- O(1) lookup in `staticPathLookup.get(state)`. If found, return `{ route, params: {}, state }`.

**Step 3: Param routes** -- Linear scan of `compiledRoutes.get(state)`, skipping static routes (already checked). For each: test `compiled.pattern.exec(pathname)`. On match: extract params from capture groups, `decodeURIComponent()` each value, unmatched optional params default to `''`. Return `{ route, params, state }`.

**Step 4: State mismatch** -- Iterate all OTHER states. For each: check static lookup, then param routes. If any match: return `{ stateMismatch: true, requestedState: state, availableInState: otherState, pathname }`.

**Step 5: Not found** -- Return `null`.

### `tryExpandPath(pathname, state, stateData)`

```ts
public tryExpandPath(
  pathname: string,
  state: string,
  stateData: Record<string, unknown> | undefined
): string | null
```

Used when a navigate call like `navigate('/dashboard')` doesn't match directly, but a route `/[orgId]/dashboard` exists.

1. Return `null` if no `stateData`.
2. Get `expandableRoutes` for the state.
3. For each expandable route: check if `stateData[paramName]` is a non-empty string. Build expanded path: `/${paramValue.toLowerCase()}${pathname === '/' ? '' : pathname}`. Test against the compiled pattern. Return first match, or `null`.

### `addRoutes(routes, state)`

Dynamic route addition. Compiles new routes, merges with existing, re-sorts, rebuilds all lookup structures for the state. **Must be called before `WarpKit.start()`** -- adding routes after start is not supported and may cause race conditions with in-progress navigations.

---

## 6. PageState

**File:** `src/core/PageState.svelte.ts`

Reactive state container. Every field is a Svelte 5 `$state` property, so components that read these fields automatically re-render on changes.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | `''` | Full path: pathname + search + hash. |
| `pathname` | `string` | `''` | Pathname without search or hash. |
| `search` | `SvelteURLSearchParams` | `new SvelteURLSearchParams()` | Reactive search params wrapper. |
| `hash` | `string` | `''` | URL fragment (e.g., `#section`). |
| `params` | `Record<string, string>` | `{}` | Route parameters extracted from path matching. |
| `route` | `Route \| null` | `null` | Currently matched route definition, or `null` before first navigation. |
| `appState` | `string` | `''` | Current app state name. |
| `isNavigating` | `boolean` | `false` | `true` while the navigation pipeline is running. |
| `error` | `NavigationError \| null` | `null` | Set on navigation errors (`NOT_FOUND`, `LOAD_FAILED`, etc.). |

### Methods

**`update(location: ResolvedLocation)`** -- Atomically updates all location fields from the resolved match. Clears `error` to `null`. Called by Navigator in Phase 6.

**`setNavigating(isNavigating: boolean)`** -- Sets the navigating flag. Called at Phase 1 start and Phase 9 end.

**`setError(error: NavigationError | null)`** -- Sets the error and forces `isNavigating = false`. Called by Navigator on pipeline failures.

**`clearError()`** -- Sets `error = null`. Called by Navigator in Phase 6 before updating location fields.

---

## 7. SvelteURLSearchParams

**File:** `src/core/SvelteURLSearchParams.svelte.ts`

A `URLSearchParams` wrapper that integrates with Svelte 5's reactivity system. The native `URLSearchParams` is not reactive -- mutations don't trigger Svelte re-renders.

### Reactivity Mechanism

Uses a version counter pattern:

```ts
#params: URLSearchParams;      // The actual data (not reactive)
#version = $state<number>(0);  // Reactive trigger
```

- **Reading methods** (`get`, `getAll`, `has`, `toString`, `entries`, `keys`, `values`, `forEach`, `size`, `[Symbol.iterator]`): access `this.#version` via `void this.#version` to establish a Svelte dependency.
- **Writing methods** (`set`, `append`, `delete`): mutate `#params` then increment `#version` to trigger reactive updates.

This avoids creating new `URLSearchParams` objects on every mutation.

### `replaceAll(init)`

```ts
replaceAll(init: URLSearchParams | string): void
```

Creates a new `URLSearchParams` instance and increments `#version`. Used for atomic updates during navigation (called from `PageState.update()`).

### Full API Surface

Implements: `get`, `getAll`, `has`, `set`, `append`, `delete`, `toString`, `entries`, `keys`, `values`, `forEach`, `size` (getter), `[Symbol.iterator]`, `replaceAll`.

---

## 8. LayoutManager

**File:** `src/core/LayoutManager.ts`

Resolves which layout component applies to a route and caches loaded layout modules.

### Layout Priority

```
route-level layout  >  state-level layout  >  no layout (null)
```

Route-level layout: `route.layout` (from `RouteConfig`).
State-level layout: `stateConfig.layout` (from `StateConfig`).

### Identity by String ID

Layout identity is determined by the `LayoutConfig.id` string, NOT by function reference. This is critical because lazy import functions (`() => import('./Layout.svelte')`) create new references on each access, so reference equality (`===`) would always be false. Explicit string IDs make cache hits reliable.

### Caching

Internal state:

| Field | Type | Purpose |
|---|---|---|
| `currentLayoutId` | `string \| null` | ID of the currently cached layout. |
| `currentLayout` | `Component \| null` | The cached layout component. |

### `resolveLayout(route, stateConfig?)`

```ts
public async resolveLayout(
  route: Route,
  stateConfig?: StateConfig
): Promise<Component | null>
```

1. Determine `layoutConfig` from `route.layout ?? stateConfig?.layout`.
2. If no layout config: clear cache, return `null`.
3. If `layoutConfig.id === currentLayoutId` and `currentLayout` is non-null: return cached component (no re-import, no remount).
4. Otherwise: call `layoutConfig.load()` (lazy import), extract `module.default`, cache the component and ID. On import failure, wrap error with layout context.

### `willLayoutChange(route, stateConfig?)`

```ts
public willLayoutChange(route: Route, stateConfig?: StateConfig): boolean
```

Check-only (no loading). Compares the resolved `layoutConfig.id` against `currentLayoutId`. Used by onNavigate hooks to decide whether to trigger a View Transition for layout changes.

### `clearCache()`

Resets `currentLayoutId` and `currentLayout` to `null`. Forces the next `resolveLayout()` to re-import even if the same ID is requested.

---

## 9. NavigationLifecycle

**File:** `src/core/NavigationLifecycle.ts`

Manages registration and execution of the three navigation hook types.

### Hook Types

| Hook | Registration | Execution | Signature | Phase |
|---|---|---|---|---|
| `beforeNavigate` | `registerBeforeNavigate(hook)` | `runBeforeNavigate(context)` | `(context) => boolean \| string \| void \| Promise<...>` | 4 |
| `onNavigate` | `registerOnNavigate(hook)` | `runOnNavigate(context)` | `(context) => void \| Promise<void>` | 7 |
| `afterNavigate` | `registerAfterNavigate(hook)` | `runAfterNavigate(context)` | `(context) => void` | 9 |

All registration methods return an unsubscribe function (removes the hook from the Set).

### `runBeforeNavigate(context)` -- Parallel with Conflict Resolution

```ts
public async runBeforeNavigate(context: NavigationContext): Promise<BeforeNavigateResult>
```

1. Short-circuit if no hooks registered (`{ proceed: true }`).
2. Run ALL hooks in parallel via `Promise.all()`.
3. Each hook is wrapped in try/catch. If a hook throws, it is treated as an abort (`false`). The error is reported via `reportError()` with `showUI: false`.
4. Process results with conflict resolution:
   - **Any hook returns `false`**: abort. `{ proceed: false }`. Abort wins over redirect -- even if another hook returned a redirect path, the abort takes precedence.
   - **Any hook returns `string`** (and no abort): redirect. `{ proceed: false, redirect: firstRedirectPath }`. Only the first redirect is used.
   - **All hooks return `void`/`true`**: proceed. `{ proceed: true }`.

### `runOnNavigate(context)` -- Sequential

```ts
public async runOnNavigate(context: NavigationContext): Promise<void>
```

Iterates hooks in Set insertion order. Each hook is `await`-ed before the next runs. Errors are caught per-hook, reported via `reportError()`, but do not prevent subsequent hooks from running.

This sequential execution is required for View Transitions: `document.startViewTransition()` must complete before the next hook runs.

### `runAfterNavigate(context)` -- Fire-and-Forget

```ts
public runAfterNavigate(context: NavigationContext): void
```

**Synchronous method** -- does NOT return a Promise, does NOT await hooks. Iterates hooks and calls each synchronously. Errors are caught per-hook and reported via `reportError()`.

Intended for analytics, logging, and cleanup tasks that should not delay the navigation completion signal.

### Error Isolation

All three execution methods wrap each individual hook invocation in its own try/catch. A failing hook never prevents other hooks from running, and never causes the navigation pipeline to fail. Errors are reported via `reportError('navigation-lifecycle', error, { showUI: false, context: { hook: hookName } })`.
