# Event System & Error System

Technical specification for WarpKit's two cross-cutting subsystems: the type-safe event emitter and the layered error pipeline. Both are foundational infrastructure that other packages depend on.

---

## Part 1: Event System

The event system provides type-safe pub/sub within a WarpKit application. It consists of three layers: the `EventEmitter` class, the type definitions that make it generic, and the `useEvent` Svelte 5 hook for component-scoped subscriptions.

### EventEmitter

**File:** `src/events/EventEmitter.ts`

Generic class parameterized over an `EventRegistry`. Stores handlers in a `Map<keyof R, Set<EventHandler<unknown>>>`.

#### API

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `on<K>(event: K, handler: EventHandler<R[K]>): () => void` | Subscribe. Returns unsubscribe function. |
| `once` | `once<K>(event: K, handler: EventHandler<R[K]>): () => void` | Subscribe for a single invocation. Wraps the handler; the wrapper calls `off` then delegates. Returns unsubscribe. |
| `off` | `off<K>(event: K, handler: EventHandler<R[K]>): void` | Remove a specific handler from an event. |
| `emit` | `emit<K>(event: K, ...args: R[K] extends void ? [] : [payload: R[K]]): void` | Emit an event. Void-typed events take no payload argument; data events require one. |
| `clear` | `clear(event: keyof R): void` | Remove all handlers for one event. |
| `clearAll` | `clearAll(): void` | Remove all handlers for all events. |
| `listenerCount` | `listenerCount(event: keyof R): number` | Count of registered handlers for an event. |
| `eventNames` | `eventNames(): Array<keyof R>` | All event names that currently have at least one handler. |

#### Conditional rest params on `emit`

The `emit` signature uses a conditional rest parameter:

```typescript
emit<K extends keyof R>(event: K, ...args: R[K] extends void ? [] : [payload: R[K]]): void
```

When `R[K]` is `void`, the rest spread resolves to `[]` (no arguments). When `R[K]` is a data type, it resolves to `[payload: R[K]]` (one required argument). This gives callers compile-time enforcement: `emit('auth:signed-out')` requires zero args, `emit('auth:signed-in', { userId })` requires the payload.

#### Error isolation

Every handler invocation is wrapped in try/catch. The emit loop copies the handler set before iterating (`[...set]`), so handlers that add or remove other handlers during emission do not affect the current loop.

- **Synchronous errors:** Caught immediately in the try/catch.
- **Async errors:** If a handler returns a `Promise`, the promise's `.catch()` is attached.
- **Reporting:** All caught errors are forwarded to `reportError('event-emitter', error, { showUI: false, context: { event } })` from `@warpkit/errors`. Errors never propagate to the caller of `emit`.

#### Mutation safety

Before iterating, handlers are spread into an array: `const handlers = [...set]`. This means:

- A handler that calls `off()` for itself or another handler does not cause skipped iterations.
- A handler that calls `on()` for the same event does not cause the new handler to fire during the current emit.
- A handler that calls `clear()` or `clearAll()` does not break the loop because `handlers` is a detached copy.

#### `once` implementation detail

`once` wraps the original handler in a closure that calls `off(event, wrapper)` before delegating. The wrapper is what gets stored in the `Set`. The unsubscribe function returned by `once` is the one returned by the inner `on(event, wrapper)` call, so calling it before the event fires correctly removes the wrapper.

### Event Types

**File:** `src/events/types.ts`

#### `EventRegistry`

Base interface with an index signature `[event: string]: unknown`. All custom registries extend this.

#### `WarpKitEventRegistry`

Built-in events emitted by WarpKit internals:

| Event | Payload | Emitted by |
|-------|---------|------------|
| `auth:signed-in` | `{ userId: string }` | Auth adapter integration |
| `auth:signed-out` | `void` | Auth adapter integration |
| `auth:token-refreshed` | `void` | Auth adapter integration |
| `app:state-changed` | `{ from: string; to: string }` | State machine transitions |
| `app:error` | `{ error: Error; context?: string }` | Error system |
| `query:invalidated` | `{ key: string; params?: Record<string, string> }` | `useQuery` internals |
| `query:fetched` | `{ key: string; fromCache: boolean }` | `useQuery` internals |

#### Consumer extension via module augmentation

Consumers add custom events by augmenting the `WarpKitEventRegistry` interface:

```typescript
declare module '@warpkit/core' {
  interface WarpKitEventRegistry {
    'monitor:created': { uuid: string };
    'monitor:updated': { uuid: string };
  }
}
```

These events then become available through the same `EventEmitter<WarpKitEventRegistry>` instance with full type safety.

#### Handler and utility types

| Type | Definition | Purpose |
|------|-----------|---------|
| `EventHandler<T>` | `(payload: T) => void \| Promise<void>` | Handler function. Supports sync and async. |
| `EventEmitterAPI<R>` | Interface | Public API surface of `EventEmitter`. Used for typing the emitter when exposed through DI or context. |
| `EventNames<R>` | `keyof R & string` | All event names as a string union. |
| `EventPayload<R, K>` | `R[K]` | Payload type for a specific event. |
| `EventsWithPayload<R>` | Mapped type | Union of event names that have a non-void payload. |
| `EventsWithoutPayload<R>` | Mapped type | Union of event names that have `void` payload. |
| `TypedEventHandler<R, K>` | `EventHandler<R[K]>` | Convenience alias binding handler to a specific registry event. |

### `useEvent` Hook

**File:** `src/events/useEvent.svelte.ts`

Svelte 5 hook for component-scoped event subscriptions. Must be called during component initialization (inside `<script>` setup).

#### Signature

```typescript
function useEvent<K extends keyof WarpKitEventRegistry>(
  event: K,
  handler: EventHandler<WarpKitEventRegistry[K]>,
  options?: UseEventOptions
): void
```

#### Lifecycle management

Internally uses `$effect()`:

1. Evaluates `options.enabled` inside the effect. If `enabled` is a function, it acts as a reactive getter -- the effect re-runs when the getter's dependencies change.
2. If disabled (`enabled` evaluates to `false`), returns early without subscribing.
3. If enabled, calls `warpkit.events.on(event, handler)` and returns the unsubscribe function as the effect cleanup.

This means:

- When the component is destroyed, Svelte's effect cleanup calls the unsubscribe.
- When `enabled` transitions from `true` to `false`, the previous subscription is cleaned up and no new one is created.
- When `enabled` transitions from `false` to `true`, a new subscription is created.

#### `UseEventOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean \| (() => boolean)` | `true` | Controls whether the subscription is active. Function form enables reactive control. |

---

## Part 2: Error System

The error system is a layered pipeline that captures errors from all WarpKit packages and surfaces them to the application. It has four layers, ordered from lowest-level to highest:

1. **Error Channel** (`@warpkit/errors`) -- zero-dependency pub/sub for cross-package error reporting
2. **Error Store** (`src/errors/error-store.svelte.ts`) -- reactive state for UI consumption
3. **Global Handlers** (`src/errors/global-handlers.ts`) -- window-level error capture and routing
4. **ErrorOverlay** (`src/errors/ErrorOverlay.svelte`) -- dev-mode error display component

Additionally, the navigation system defines its own `NavigationErrorCode` enum for route-specific failures.

### Error Channel

**File:** `packages/errors/src/channel.ts`
**Package:** `@warpkit/errors`

Singleton pub/sub that any WarpKit package can import without pulling in the core framework. Zero dependencies by design.

#### `reportError(source, error, options?)`

Entry point for all error reporting.

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `ErrorChannelSource` | Identifies the reporting package. |
| `error` | `unknown` | The error value. Coerced to `Error` via `toError()`. |
| `options` | `ErrorReportOptions` | Optional severity, showUI override, handledLocally flag, context. |

**Error coercion** (`toError`): `Error` instances pass through. Strings become `new Error(string)`. Everything else becomes `new Error(String(value))`.

**Delivery behavior:**

- If subscribers exist: the report is delivered to every handler immediately. Each handler call is wrapped in try/catch (error reporting never throws).
- If no subscribers: the report is buffered (up to `MAX_BUFFER_SIZE = 100`). In DEV mode (`import.meta.env?.DEV`), a `console.error` is also emitted.

**showUI default:** `error` and `fatal` severity default to `showUI: true`. `warning` and `info` default to `showUI: false`.

#### `onErrorReport(handler)`

Subscribe to error reports. Returns an unsubscribe function.

**Buffer flush:** When the first subscriber registers, all buffered reports are immediately flushed to that subscriber. The buffer is then cleared. This handles the startup timing gap where packages report errors before the core framework has initialized.

#### `ErrorChannelSource` values

The source type is a union literal:

```
'data:query' | 'data:mutation' | 'websocket' | 'websocket:message' |
'websocket:heartbeat' | 'forms:submit' | 'cache' | 'auth' |
'event-emitter' | 'state-machine' | 'navigation-lifecycle'
```

Convention: `package:subsystem` for packages with multiple error-producing subsystems.

#### `ErrorReport` structure

| Field | Type | Description |
|-------|------|-------------|
| `source` | `ErrorChannelSource` | Reporting package identifier. |
| `error` | `Error` | Coerced error object. |
| `severity` | `ErrorReportSeverity` | `'fatal' \| 'error' \| 'warning' \| 'info'` |
| `showUI` | `boolean` | Whether the error overlay should display. |
| `handledLocally` | `boolean` | Whether the package already shows this error in its own UI. |
| `context` | `Record<string, unknown>` | Optional debugging context. |
| `timestamp` | `number` | `Date.now()` at report time. |

#### `_resetChannel()`

Testing utility. Clears all handlers and the buffer. Exported but prefixed with underscore to signal internal use.

### Error Store

**File:** `src/errors/error-store.svelte.ts`

Singleton `ErrorStore` class that maintains reactive error state. Provides a subscription-based API for UI components.

#### State shape (`ErrorStoreState`)

| Field | Type | Description |
|-------|------|-------------|
| `currentError` | `NormalizedError \| null` | Most recent error. |
| `errorHistory` | `NormalizedError[]` | Newest-first array, capped at `maxHistorySize` (default 50). |
| `showErrorUI` | `boolean` | Whether the overlay should render. |
| `hasFatalError` | `boolean` | True when `currentError.severity === 'fatal'`. |

#### `NormalizedError` structure

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID: `err_{timestamp}_{random}`. |
| `message` | `string` | Error message string. |
| `originalError` | `Error \| undefined` | Original Error object if available. |
| `stack` | `string \| undefined` | Stack trace if available. |
| `source` | `ErrorSource` | Superset of `ErrorChannelSource` plus `'global' \| 'unhandled-rejection' \| 'router' \| 'component' \| 'manual'`. |
| `severity` | `ErrorSeverity` | `'fatal' \| 'error' \| 'warning' \| 'info'` |
| `timestamp` | `Date` | When the error was stored. |
| `context` | `Record<string, unknown>` | Optional context data. |
| `url` | `string \| undefined` | `window.location.href` at error time. |
| `reported` | `boolean` | Whether sent to external reporting service. |

#### Key methods

| Method | Description |
|--------|-------------|
| `setError(error, options?)` | Normalizes the error, prepends to history, sets as `currentError`, sets `showErrorUI`. Returns the `NormalizedError`. |
| `clearCurrentError()` | Sets `currentError` to null, `showErrorUI` to false. |
| `hideErrorUI()` | Sets `showErrorUI` to false without clearing the error from state. |
| `clearHistory()` | Resets all error state. |
| `markAsReported(errorId)` | Sets `reported: true` on the error in both `currentError` and `errorHistory`. |
| `getErrorById(errorId)` | Looks up an error in `errorHistory` by ID. |
| `subscribe(callback)` | Registers a subscriber that receives `ErrorStoreState` on every change. Immediately called with current state. Returns unsubscribe function. |

#### Caching

The store caches its `ErrorStoreState` object (`_cachedState`). It is invalidated (`_invalidateCache()`) before every state mutation. The `_getState()` method rebuilds the cache only when null. This avoids allocating new objects on every subscriber notification when nothing has changed.

#### Convenience getters

Exported module-level functions for backward compatibility:

- `getCurrentError()` -- delegates to `errorStore.currentError`
- `getShowErrorUI()` -- delegates to `errorStore.showErrorUI`
- `getErrorHistory()` -- delegates to `errorStore.errorHistory`
- `getHasFatalError()` -- delegates to `errorStore.hasFatalError`

### Global Handlers

**File:** `src/errors/global-handlers.ts`

Installs browser-level error handlers and wires the error channel into the error store. Called by `WarpKit.start()`.

#### `setupGlobalErrorHandlers(options?)`

Returns a cleanup function. Idempotent: calling multiple times only installs handlers once. Subsequent calls update the `ReportingProvider` if provided.

**SSR guard:** Returns a no-op cleanup if `typeof window === 'undefined'`.

**Installed handlers:**

1. **`window.onerror`** -- Catches synchronous errors and script errors. Normalizes to `NormalizedError` via `errorStore.setError()` with source `'global'`. Calls `reporter?.captureError()` if a reporting provider is configured. Chains to the original `window.onerror` if one existed.

2. **`window.onunhandledrejection`** -- Catches unhandled promise rejections. Normalizes the `event.reason` to an `Error`. Routes to `errorStore.setError()` with source `'unhandled-rejection'`. Chains to the original handler.

3. **Error channel subscription** -- Calls `onErrorReport()` from `@warpkit/errors`. Converts each `ErrorReport` into a `NormalizedError` via `errorStore.setError()`. Respects `handledLocally`: when true, `showUI` is forced false even if the report requested it.

4. **Vite HMR error handler** -- See next section.

All handler bodies are wrapped in try/catch. Error handlers never throw.

#### Vite error handling

`setupViteErrorHandlers()` is called internally by `setupGlobalErrorHandlers()`. It checks for `import.meta.hot` and, if available:

- Subscribes to `vite:error` events. Builds a rich error message that includes plugin name, file path, line/column, and code frame. Stores with context `{ viteError: true, plugin, file, line, column }`.
- Subscribes to `vite:beforeUpdate` events. When a successful HMR update arrives, checks if the current error has `context.viteError === true` and clears it. This auto-dismisses stale compile errors.

**Deduplication:** `hasActiveViteError()` returns true when the current error has `context.viteError === true`. Both `window.onerror` and `window.onunhandledrejection` check this before processing. When a Vite compile error is active, generic handlers skip their error to avoid overwriting the richer Vite error (which includes file, line, plugin context).

#### `removeGlobalErrorHandlers()`

Restores `window.onerror` and `window.onunhandledrejection` to null. Disposes the Vite HMR subscription and the error channel subscription. Resets the `installed` flag and clears the reporter.

#### `ReportingProvider` interface

Provider-agnostic interface for external error services (Sentry, LogRocket, etc.):

| Method | Required | Description |
|--------|----------|-------------|
| `captureError(error: NormalizedError)` | Yes | Report the error. Can return void or Promise. |
| `setUser(user)` | No | Set user context for error grouping. |
| `addBreadcrumb(message, data?)` | No | Add a debugging breadcrumb. |
| `setTags(tags)` | No | Set key-value tags on error reports. |

`setReportingProvider(provider)` can be called at any time to update or clear the provider.

### ErrorOverlay Component

**File:** `src/errors/ErrorOverlay.svelte`

Dev-mode overlay that renders when `showErrorUI` is true and `currentError` is non-null. Subscribes to `errorStore` via `$effect` + `errorStore.subscribe()`.

**UI features:**
- Full-screen backdrop with blur (`z-index: 9999`)
- Error message display with red styling
- Stack trace panel with copy-to-clipboard button
- Stack trace cleaning: strips Vite dev server URLs (`/@fs/...`), simplifies `node_modules/.pnpm/` paths, replaces `localhost:PORT/` with `./`
- Dismiss button (calls `errorStore.clearCurrentError()`)
- Reload button (calls `window.location.reload()`)
- Keyboard: Escape to dismiss, Tab/Shift+Tab focus trap
- WCAG: `role="alertdialog"`, `aria-modal="true"`, auto-focus on appear

**Style isolation:** Uses `all: initial` on the root element to prevent host application CSS from leaking in. All styles are component-scoped and explicitly set (font family, colors, sizes).

### Navigation Errors

**File:** `src/core/types.ts`

The `NavigationErrorCode` enum defines all possible navigation failure modes. Each navigation can fail with exactly one code (not bitflags).

#### Error codes

| Code | Value | Visual | Retryable | Source | Description |
|------|-------|--------|-----------|--------|-------------|
| `CANCELLED` | 1 | No | No | Any pipeline phase | Another navigation started before this one completed. Normal during rapid navigation. Checked via `isCancelled` at each phase. |
| `ABORTED` | 2 | Yes | No | Phase 4 (beforeNavigate hooks) | A `beforeNavigate` hook returned `false`. The hook author handles user feedback. |
| `BLOCKED` | 3 | No | No | Phase 3 (blocker check) | User cancelled via blocker/confirm dialog. For popstate navigations, the browser URL is restored. |
| `NOT_FOUND` | 4 | Yes | No | Phase 2 (route matching) | No route pattern matches the path in the current app state. True 404. |
| `STATE_MISMATCH` | 5 | Yes | No | Phase 2 (route matching + state check) | Route exists but in a different app state. Example: navigating to `/dashboard` while unauthenticated when that route only exists in the `authenticated` state. |
| `LOAD_FAILED` | 6 | Yes | Yes | Phase 6 (component/layout loading) | Lazy `import()` failed. Typically network error or missing chunk. Triggers global `onError`. |
| `TOO_MANY_REDIRECTS` | 7 | Yes | No | Phase 2/4 (redirect processing) | Exceeded 10 redirects. Indicates a redirect loop in config or hooks. Developer error. |
| `RENDER_ERROR` | 8 | Yes | Yes | Post-pipeline (svelte:boundary) | Component rendered but threw at runtime. Caught by `svelte:boundary` in `RouterView`. Does NOT set `PageState.error` -- lives within the boundary's `{#snippet failed}`. Converted to `NavigationError` format for uniform handling. |

#### Visual vs. non-visual

- **Visual errors** (ABORTED, NOT_FOUND, STATE_MISMATCH, LOAD_FAILED, TOO_MANY_REDIRECTS, RENDER_ERROR) are displayed by `RouterView` using the consumer's error snippet.
- **Non-visual errors** (CANCELLED, BLOCKED) are flow-control outcomes that do not warrant user-facing error UI.

#### `NavigationError` structure

| Field | Type | Description |
|-------|------|-------------|
| `code` | `NavigationErrorCode` | Which error occurred. |
| `message` | `string` | Human-readable description. |
| `cause` | `Error \| undefined` | Original error when wrapping a caught exception (e.g., import failure, component throw). |
| `requestedPath` | `string` | The path that was being navigated to. |

#### `NavigationErrorContext`

Passed to the global `onError` handler configured in `WarpKitConfig`:

| Field | Type | Description |
|-------|------|-------------|
| `from` | `ResolvedLocation \| null` | Where the user was navigating from. Null on initial navigation. |
| `to` | `ResolvedLocation \| null` | Where the user was navigating to. Null if matching failed before resolution. |
| `type` | `'push' \| 'pop' \| 'state-change'` | Navigation type. |

---

## How the Systems Connect

The event system and error system are intentionally decoupled but interact at specific points:

1. **EventEmitter reports to Error Channel:** When a handler throws during `emit()`, the `EventEmitter` calls `reportError('event-emitter', error)` from `@warpkit/errors`. This flows through the error channel into the error store.

2. **Error Channel is the bridge:** Sub-packages (`@warpkit/data`, `@warpkit/websocket`, `@warpkit/forms`) import only `@warpkit/errors` (zero deps). They call `reportError()`. The core framework subscribes via `onErrorReport()` in `setupGlobalErrorHandlers()` and routes reports into `errorStore`.

3. **Startup buffering:** If a sub-package reports an error before `WarpKit.start()` calls `setupGlobalErrorHandlers()`, the error channel buffers it. When global handlers install and call `onErrorReport()`, all buffered errors are flushed.

4. **Navigation errors are separate:** `NavigationError` is a domain-specific error type for the router. It does not flow through the error channel. It is surfaced via `PageState.error` (for visual errors) and the `onError` callback in `WarpKitConfig`. The global `onError` handler may choose to call `reportError()` or `errorStore.setError()` to bridge navigation errors into the general error system, but this is a consumer decision.
