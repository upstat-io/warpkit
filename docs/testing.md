# Testing Infrastructure

Technical specification for WarpKit's testing utilities. This document covers every test helper, mock provider, assertion function, and rendering utility available in `src/testing/`.

Source files covered:
- `src/testing/createMockWarpKit.ts`
- `src/testing/MockConfirmProvider.ts`
- `src/testing/NoOpStorageProvider.ts`
- `src/testing/createMockEvents.ts`
- `src/testing/createEventSpy.ts`
- `src/testing/expectations.ts`
- `src/testing/waitForNavigation.ts`
- `src/testing/renderWithWarpKit.ts`
- `src/testing/createMockDataClient.ts`
- `src/testing/WarpKitTestWrapper.svelte`

Test framework: Vitest (with `vitest-browser-svelte` for component rendering).

---

## Architecture Overview

WarpKit's testing infrastructure follows a provider-replacement strategy. The core `WarpKit` class accepts a `ProviderRegistry` in its config, which maps provider IDs to implementations. In production, these are real browser APIs (`BrowserBrowserProvider`, `BrowserConfirmProvider`, `SessionStorageProvider`). In tests, they are replaced with in-memory implementations:

```
Production:                          Testing:
BrowserBrowserProvider      -->      MemoryBrowserProvider
BrowserConfirmProvider      -->      MockConfirmProvider
SessionStorageProvider      -->      NoOpStorageProvider
```

The core navigation engine (`Navigator`, `RouteMatcher`, `PageState`, lifecycle hooks) runs unmodified in tests. Only the browser-facing providers are swapped. This means tests exercise the real navigation pipeline, not a mocked version of it.

---

## createMockWarpKit

**Source:** `src/testing/createMockWarpKit.ts`

Factory function that creates a fully configured, started WarpKit instance for testing. This is the primary entry point for unit/integration tests that need a working WarpKit instance.

### Function Signature

```typescript
async function createMockWarpKit<TAppState extends string>(
  options: MockWarpKitOptions<TAppState>
): Promise<MockWarpKit<TAppState>>
```

### MockWarpKitOptions

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `routes` | `StateRoutes<TAppState>` | Yes | -- | Route configuration (same format as production). |
| `initialState` | `TAppState` | Yes | -- | Starting application state. |
| `initialPath` | `string` | No | `'/'` | Initial URL path. The `MemoryBrowserProvider` starts at this path. |
| `componentLoadDelay` | `number` | No | `0` | Milliseconds to delay component loading. Used to test loading states and navigation races. |
| `onError` | `(error, context) => void` | No | -- | Custom error handler, same as `WarpKitConfig.onError`. |

### MockWarpKit Interface

`MockWarpKit<TAppState>` extends `WarpKit<TAppState>` with test-specific helpers:

| Member | Type | Description |
|--------|------|-------------|
| `memoryBrowser` | `readonly MemoryBrowserProvider` | Direct access to the in-memory browser provider. |
| `mockConfirm` | `readonly MockConfirmProvider` | Direct access to the confirm dialog mock. |
| `noOpStorage` | `readonly NoOpStorageProvider` | Direct access to the storage no-op. |
| `componentLoadDelay` | `readonly number` | The configured delay value. |
| `getHistory()` | `Array<{ path: string; state: unknown }>` | Returns the full history stack from `MemoryBrowserProvider`. |
| `getCurrentIndex()` | `number` | Returns the current position in the history stack. |
| `simulatePopState(direction)` | `void` | Triggers a popstate event on the memory browser (simulates back/forward button). |
| `setConfirmResult(result)` | `void` | Sets what the next `confirm()` call returns (delegates to `MockConfirmProvider.setNextResult()`). |

### Implementation Details

**Provider setup:**

```typescript
const memoryBrowser = new MemoryBrowserProvider(initialPath);
const mockConfirm = new MockConfirmProvider({ alwaysConfirm: true });
const noOpStorage = new NoOpStorageProvider();
```

The `MockConfirmProvider` defaults to `alwaysConfirm: true`, meaning navigation blockers will not block by default. Call `setConfirmResult(false)` to simulate a user denying a confirmation dialog.

**Auto-start:**

`createMockWarpKit` calls `await warpkit.start()` before returning. This means the returned instance has already performed its initial navigation and is in a ready state. The consumer does not need to call `start()` again.

**Object.create pattern:**

The mock wrapper uses `Object.create(warpkit)` to preserve the WarpKit prototype chain. This means `instanceof WarpKit` checks still pass, and any methods not overridden on the mock fall through to the real instance.

**$state field forwarding:**

Svelte 5 compiles `$state` fields to private class members (using `#private` syntax internally). When `Object.create()` creates a new object with `warpkit` as its prototype, reading `mock.loadedComponent` would skip the private field and return `undefined`. To fix this, `createMockWarpKit` defines explicit property descriptors with getters and setters that delegate to the real instance:

```typescript
Object.defineProperty(mock, 'loadedComponent', {
  get: () => warpkit.loadedComponent,
  set: (v) => { warpkit.loadedComponent = v; },
  enumerable: true
});
```

This is done for `loadedComponent` and `loadedLayout` -- the two `$state` fields that consumers might read on the mock.

**Component load delay wrapping:**

When `componentLoadDelay > 0`, all route component loaders and layout loaders are wrapped with `wrapLoaderWithDelay()`:

```typescript
async () => {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return loader();
};
```

The wrapping is applied recursively through `wrapRoutesWithDelay()` -> `wrapRouteWithDelay()` -> `wrapLoaderWithDelay()`. The original routes object is not mutated; a deep clone of the route structure is created.

---

## Mock Providers

### MockConfirmProvider

**Source:** `src/testing/MockConfirmProvider.ts`

Implements `ConfirmDialogProvider` with configurable behavior and call tracking.

**Constructor options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `alwaysConfirm` | `boolean` | `true` | Default return value for `confirm()`. |

**Public API:**

| Member | Type | Description |
|--------|------|-------------|
| `id` | `'confirmDialog'` | Provider identifier (matches production provider). |
| `confirmCalls` | `readonly string[]` | Array of all messages passed to `confirm()`, in call order. Use for assertions. |
| `confirm(message)` | `Promise<boolean>` | Records the message, returns the configured result. |
| `setNextResult(result)` | `void` | Override what the next single `confirm()` call returns. The override is consumed after one call, then reverts to the default. |
| `setDefaultResult(result)` | `void` | Change the default result for all future `confirm()` calls. |
| `clearHistory()` | `void` | Empties the `confirmCalls` array. |

**Override mechanics:**

`setNextResult()` sets a one-shot override via `hasOverride` and `overrideResult` flags. When `confirm()` is called and `hasOverride` is true, it returns `overrideResult` and resets `hasOverride` to false. Subsequent calls fall back to `nextResult` (the default).

### NoOpStorageProvider

**Source:** `src/testing/NoOpStorageProvider.ts`

Implements `StorageProvider` as a complete no-op. All writes are silently ignored, all reads return `null`.

| Method | Behavior |
|--------|----------|
| `saveScrollPosition(navigationId, position)` | No-op. |
| `getScrollPosition(navigationId)` | Returns `null`. |
| `saveIntendedPath(path)` | No-op. |
| `popIntendedPath()` | Returns `null`. |

Use this when tests do not need to verify scroll restoration or intended path persistence. If a test does need to verify storage behavior, create a custom `StorageProvider` implementation instead of extending `NoOpStorageProvider`.

### MemoryBrowserProvider (from `src/providers/browser/`)

Not in `src/testing/` but critical to the testing story. Implements `BrowserProvider` with an in-memory history stack.

**Constructor:** `new MemoryBrowserProvider(initialPath = '/')`

**BrowserProvider implementation:**

| Method | Behavior |
|--------|----------|
| `getLocation()` | Parses the current history entry's path into `{ pathname, search, hash }`. |
| `getHistoryState()` | Returns the state object from the current history entry. |
| `buildUrl(path)` | Returns `path` unchanged (no hash/base prefix). |
| `parseUrl(url)` | Returns `url` unchanged. |
| `push(path, state)` | Truncates forward history, appends a new entry, increments `historyPosition`. |
| `replace(path, state)` | Replaces the current entry in-place, preserving `historyPosition`. |
| `go(delta)` | Moves `currentIndex` by `delta`, fires popstate listeners synchronously. No-op if out of bounds. |
| `onPopState(callback)` | Registers a listener, returns an unsubscribe function. |

**Test helpers:**

| Method | Description |
|--------|-------------|
| `getHistory()` | Returns a shallow copy of the full history stack. |
| `getCurrentIndex()` | Returns `currentIndex`. |
| `getHistoryPosition()` | Returns `historyPosition` (for direction detection assertions). |
| `simulatePopState(direction)` | Fires all popstate listeners with the current entry's state and the specified direction, without changing the index. |

**History position tracking:**

Each `push()` increments a `historyPosition` counter. The position is embedded in the `HistoryState` as `state.position`. When `go()` moves through history, it compares the previous and new positions to determine direction (`'back'` or `'forward'`). This mirrors how the production `BrowserBrowserProvider` determines navigation direction from `history.state`.

---

## Event Testing

### createMockEvents

**Source:** `src/testing/createMockEvents.ts`

Creates a real `EventEmitter` instance (not a mock). The name "mock" refers to its testing context, not its implementation. The returned emitter is fully functional -- events are emitted synchronously, handlers are invoked in registration order.

```typescript
function createMockEvents<R extends EventRegistry = WarpKitEventRegistry>(): EventEmitter<R>
```

Use when testing components that emit or subscribe to events without needing the full WarpKit context.

### createEventSpy

**Source:** `src/testing/createEventSpy.ts`

Creates an event spy that records all events routed through its handlers. Unlike `vi.fn()`, the spy is specifically designed for the WarpKit event system and provides typed, event-name-scoped assertion helpers.

```typescript
function createEventSpy<R extends EventRegistry = WarpKitEventRegistry>(): EventSpy<R>
```

**EventSpy interface:**

| Member | Type | Description |
|--------|------|-------------|
| `calls` | `readonly Array<EventCall<R>>` | All recorded events. Each entry has `event` (name) and `payload`. |
| `forEvent(event)` | `EventHandler<R[K]>` | Creates a handler for a specific event. Register with `events.on()`. |
| `calledWith(event, payload?)` | `boolean` | Checks if event was emitted. If `payload` is provided, uses deep equality via `JSON.stringify`. |
| `calledTimes(event)` | `number` | Count of times the event was emitted. |
| `getCallsForEvent(event)` | `Array<R[K]>` | All payloads for a specific event. |
| `clear()` | `void` | Resets all recorded calls. |

**Usage pattern:**

```typescript
const events = createMockEvents();
const spy = createEventSpy();

events.on('auth:signed-in', spy.forEvent('auth:signed-in'));
events.emit('auth:signed-in', { userId: 'test-123' });

expect(spy.calledWith('auth:signed-in', { userId: 'test-123' })).toBe(true);
expect(spy.calledTimes('auth:signed-in')).toBe(1);
```

**Payload comparison:** `calledWith()` uses `JSON.stringify` for deep equality when a payload is provided. This works for plain objects but will not correctly compare objects with circular references, `Date` instances, `Map`/`Set`, or objects with non-enumerable properties.

---

## Navigation Assertions

### expectations.ts

**Source:** `src/testing/expectations.ts`

A collection of assertion functions that provide clear, descriptive failure messages for WarpKit-specific assertions. All functions use Vitest's `expect` internally with custom failure messages.

### Path and State Assertions

**`expectNavigation(warpkit, expectedPath)`**

Asserts that `warpkit.page.pathname` equals `expectedPath`.

**`expectState(warpkit, expectedState)`**

Asserts that `warpkit.getState()` equals `expectedState`.

**`expectStateTransition(warpkit, expectedState, expectedMinStateId)`**

Asserts both the state name and that `stateId` is at least `expectedMinStateId`. Use after calling `setState`/`setAppState` to verify the transition occurred.

### Search Parameter Assertions

**`expectSearchParam(warpkit, key, expectedValue)`**

Asserts a single search parameter. Pass `null` as `expectedValue` to assert the parameter is absent. Calls `warpkit.getSearchParam(key)`.

**`expectSearchParams(warpkit, expected)`**

Asserts that **all and only** the expected search parameters are present. Fails if unexpected parameters exist. Accepts a `Record<string, string>`.

### Full Path Assertions

**`expectFullPath(warpkit, expectedPath)`**

Asserts `warpkit.page.path` (which includes pathname + search + hash) equals `expectedPath`.

### Route Parameter Assertions

**`expectParams(warpkit, expected)`**

Asserts that `warpkit.page.params` contains all expected key-value pairs. Does not fail on extra params (partial match).

### Navigation Status Assertions

**`expectIsNavigating(warpkit, expected)`**

Asserts the `page.isNavigating` boolean.

**`expectHasError(warpkit, expected)`**

Asserts whether `page.error` is non-null.

### Navigation Outcome Assertions

**`expectNavigationBlocked(warpkit, targetPath)`** (async, MockWarpKit only)

Navigates to `targetPath` and asserts:
1. `result.success` is `false`.
2. `warpkit.page.pathname` has not changed from before navigation.

Requires a blocker to be registered and `setConfirmResult(false)` to have been called beforehand.

**`expectNavigationError(warpkit, targetPath, expectedCode)`** (async)

Navigates to `targetPath` and asserts:
1. `result.success` is `false`.
2. `result.error.code` matches `expectedCode`.

### History Assertions (MockWarpKit only)

**`expectHistoryLength(warpkit, expectedLength)`**

Asserts the length of the memory browser's history stack.

**`expectHistoryIndex(warpkit, expectedIndex)`**

Asserts the current index in the history stack.

---

## Async Navigation Helpers

### waitForNavigation

**Source:** `src/testing/waitForNavigation.ts`

**`waitForNavigation(warpkit)`**

Returns a `Promise<NavigationContext>` that resolves after the next `afterNavigate` hook fires. Uses `warpkit.afterNavigate()` internally and auto-unsubscribes after the first call.

Use this when navigation is triggered indirectly (e.g., by a button click) and you need to wait for it to complete:

```typescript
const promise = waitForNavigation(warpkit);
button.click(); // triggers navigation internally
const context = await promise;
expect(context.to.pathname).toBe('/dashboard');
```

**Important:** Call `waitForNavigation()` **before** triggering navigation. If you call it after, the `afterNavigate` hook may have already fired and the promise will never resolve.

**`waitForNavigationWithTimeout(warpkit, timeout)`**

Same as `waitForNavigation` but rejects with an error if navigation does not complete within `timeout` milliseconds. Uses a `setTimeout` guard.

Race condition handling: Both the timeout and the afterNavigate callback check a `resolved` flag to prevent double-resolution. The timeout clears the listener and the listener clears the timeout.

---

## Component Rendering

### renderWithWarpKit

**Source:** `src/testing/renderWithWarpKit.ts`

High-level helper that creates a mock WarpKit instance and renders a component wrapped in WarpKit context. Returns both the Vitest render result and the WarpKit instance for programmatic navigation.

```typescript
async function renderWithWarpKit<TAppState extends string>(
  component: Component<any>,
  options: RenderWithWarpKitOptions<TAppState>
): Promise<RenderWithWarpKitResult<TAppState>>
```

**RenderWithWarpKitOptions:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `routes` | `StateRoutes<TAppState>` | Yes | -- | Route configuration. |
| `initialState` | `TAppState` | Yes | -- | Starting app state. |
| `initialPath` | `string` | No | `'/'` | Initial URL. |
| `componentLoadDelay` | `number` | No | `0` | Component load delay in ms. |
| `onError` | `(error, context) => void` | No | -- | Error handler. |
| `props` | `Record<string, unknown>` | No | `{}` | Props to pass to the component. |

**RenderWithWarpKitResult:**

Extends Vitest's `RenderResult` with:

| Member | Type | Description |
|--------|------|-------------|
| `warpkit` | `MockWarpKit<TAppState>` | The mock WarpKit instance (with all test helpers). |

**Known limitation:** The `createTestHarness` function currently returns `WarpKitTestWrapper` without incorporating the target component or props. This is because Svelte components are compile-time constructs that cannot be dynamically composed at runtime. For full control, use `WarpKitTestWrapper` directly in test files.

### createTestRoutes

**Source:** `src/testing/renderWithWarpKit.ts`

Convenience function to build `StateRoutes` from a simplified format:

```typescript
function createTestRoutes<TAppState extends string>(
  stateRoutes: Record<TAppState, TestRouteConfig[]>,
  options: { defaultState: TAppState }
): StateRoutes<TAppState>
```

Each `TestRouteConfig` has `path`, `component` (lazy loader), and optional `meta`. The first route in each state's array becomes that state's default path.

### WarpKitTestWrapper

**Source:** `src/testing/WarpKitTestWrapper.svelte`

A stripped-down version of `WarpKitProvider` for test rendering. Identical behavior (creates `WarpKitContext`, calls `setContext`), but **does not** include `ErrorOverlay`. Tests should handle errors explicitly through assertions rather than relying on the overlay UI.

**Props:** Same as `WarpKitProvider` (`warpkit: WarpKit`, `children: Snippet`).

---

## Data Layer Testing

### createMockDataClient

**Source:** `src/testing/createMockDataClient.ts`

Factory for mock `DataClient` instances (from the `@warpkit/data` package). Use when testing components that fetch data.

```typescript
function createMockDataClient(options?: MockDataClientOptions): MockDataClient
```

**MockDataClientOptions:**

| Option | Type | Description |
|--------|------|-------------|
| `keyConfigs` | `Map<DataKey, DataKeyConfig>` | Pre-configured key configs for `getKeyConfig()` calls. |
| `events` | `DataEventEmitter` | Event emitter for invalidation subscription tests. |

**MockDataClient interface:**

All standard `DataClient` methods are implemented as `vi.fn()` mocks:

| Mock Method | Default Behavior |
|-------------|-----------------|
| `fetch(key, params?)` | Returns configured response or throws configured error. Records the call. |
| `invalidate(key, params?)` | No-op. |
| `invalidateByPrefix(prefix)` | No-op. |
| `getKeyConfig(key)` | Returns from `keyConfigs` map if provided. |
| `getEvents()` | Returns `events` option or `null`. |
| `getBaseUrl()` | Returns `''`. |
| `setCache(...)` | No-op. |
| `setEvents(...)` | No-op. |
| `mutate(url, options)` | Returns `{}`. |

**Test control methods:**

| Method | Description |
|--------|-------------|
| `setResponse(key, data)` | Configure response data for a key. Clears any error for that key. |
| `setError(key, error)` | Configure an error for a key. Clears any response for that key. |
| `clearResponse(key)` | Remove both response and error for a key. |
| `getFetchCalls()` | Returns a copy of all recorded `{ key, params }` fetch calls. |
| `clearFetchCalls()` | Empties the fetch call history. |
| `reset()` | Clears all responses, errors, fetch calls, and resets all `vi.fn()` mocks. |

**Response/error exclusivity:** `setResponse` and `setError` are mutually exclusive per key. Setting a response clears any error for that key, and vice versa. This prevents ambiguous states where both a response and an error are configured.

**Backwards compatibility:** The file exports deprecated aliases `createMockQueryClient`, `MockQueryClient`, and `MockQueryClientOptions` for the pre-rename API.

---

## Recommended Test Patterns

### Basic navigation test

```typescript
import { createMockWarpKit, expectNavigation, expectState } from '@warpkit/core/testing';

const warpkit = await createMockWarpKit({
  routes: {
    authenticated: {
      routes: [
        { path: '/dashboard', component: () => import('./Dashboard.svelte'), meta: {} },
        { path: '/settings', component: () => import('./Settings.svelte'), meta: {} }
      ],
      default: '/dashboard'
    }
  },
  initialState: 'authenticated',
  initialPath: '/dashboard'
});

// Navigate
await warpkit.navigate('/settings');
expectNavigation(warpkit, '/settings');
expectState(warpkit, 'authenticated');
```

### Testing navigation blockers

```typescript
const warpkit = await createMockWarpKit({ /* ... */ });

// Register a blocker
const { unregister } = warpkit.registerBlocker(() => 'Unsaved changes');

// Block navigation
warpkit.setConfirmResult(false);
await expectNavigationBlocked(warpkit, '/other-page');

// Verify confirm was called
expect(warpkit.mockConfirm.confirmCalls).toContain('Unsaved changes');

// Allow navigation
warpkit.setConfirmResult(true);
await warpkit.navigate('/other-page');
expectNavigation(warpkit, '/other-page');

// Cleanup
unregister();
```

### Testing events

```typescript
import { createMockEvents, createEventSpy } from '@warpkit/core/testing';

const events = createMockEvents();
const spy = createEventSpy();

events.on('auth:signed-out', spy.forEvent('auth:signed-out'));

events.emit('auth:signed-out', undefined);

expect(spy.calledWith('auth:signed-out')).toBe(true);
expect(spy.calledTimes('auth:signed-out')).toBe(1);
```

### Testing async navigation (indirect trigger)

```typescript
import { createMockWarpKit, waitForNavigationWithTimeout } from '@warpkit/core/testing';

const warpkit = await createMockWarpKit({ /* ... */ });

// Set up wait BEFORE triggering
const navPromise = waitForNavigationWithTimeout(warpkit, 5000);

// Trigger navigation indirectly
someComponent.triggerAction();

// Wait for completion
const ctx = await navPromise;
expect(ctx.to.pathname).toBe('/expected-path');
```

### Testing with component load delay

```typescript
const warpkit = await createMockWarpKit({
  routes: { /* ... */ },
  initialState: 'authenticated',
  componentLoadDelay: 100
});

// Start navigation (don't await)
const navPromise = warpkit.navigate('/slow-page');

// During the delay, isNavigating should be true
expect(warpkit.page.isNavigating).toBe(true);

// After navigation completes
await navPromise;
expect(warpkit.page.isNavigating).toBe(false);
```
