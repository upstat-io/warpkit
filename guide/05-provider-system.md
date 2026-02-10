# The Provider System

Every SPA framework needs to interact with browser APIs. The browser's History API for navigation, `localStorage` or `sessionStorage` for persisting data across page loads, `window.confirm()` for blocking dialogs. These are the fundamental building blocks of client-side routing.

Most frameworks call these APIs directly. React Router calls `window.history.pushState()` in its source code. Vue Router wraps some of it but does not expose a pluggable interface. The result is that testing, customization, and portability all suffer.

WarpKit takes a different approach. Every browser API that WarpKit touches is abstracted behind a **provider interface**. The router never calls `window.history.pushState()` directly. It calls `browserProvider.push()`. This single architectural decision unlocks testability, customization, and platform portability -- all without any compromise in production behavior.

## The Three Core Providers

WarpKit ships with three core providers, each abstracting a specific browser capability:

| Provider | Interface | Default Implementation | Purpose |
|----------|-----------|------------------------|---------|
| Browser | `BrowserProvider` | `DefaultBrowserProvider` | History API, URL manipulation, popstate events |
| Storage | `StorageProvider` | `DefaultStorageProvider` | Scroll position persistence, intended path for deep links |
| ConfirmDialog | `ConfirmDialogProvider` | `DefaultConfirmDialogProvider` | Navigation blocking confirmation dialogs |

When you call `createWarpKit()` without specifying providers, the defaults are applied automatically:

```typescript
import { createWarpKit } from '@warpkit/core';

// All three default providers are created internally
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated'
});
```

You only need to think about providers when you want to change the default behavior -- for testing, for hash-based routing, for custom confirmation modals, or for any other reason.

## Why Providers Matter

### 1. Testability

This is the primary reason providers exist. Without them, testing a router means mocking `window.history`, `window.location`, `sessionStorage`, and `window.confirm()`. These mocks are brittle at best and impossible at worst. Different test runners handle `window` differently. Mock implementations are always incomplete. Test isolation is a constant struggle.

With providers, testing is trivial:

```typescript
import { createMockWarpKit } from '@warpkit/core/testing';

const warpkit = await createMockWarpKit({
  routes,
  initialState: 'authenticated',
  initialPath: '/dashboard'
});

// Navigate and assert -- no browser, no mocks, no hacks
await warpkit.navigate('/settings');
expect(warpkit.page.pathname).toBe('/settings');

// Test browser back button
warpkit.memoryBrowser.go(-1);
expect(warpkit.page.pathname).toBe('/dashboard');
```

`createMockWarpKit` automatically uses `MemoryBrowserProvider` (in-memory history stack), `MockConfirmProvider` (configurable confirmation results), and `NoOpStorageProvider` (silent no-op). No `window` mocking needed. No browser APIs touched. Tests run in any JavaScript runtime, not just a browser.

### 2. Custom Behavior

Providers are not just for testing. They enable genuine customization of how WarpKit interacts with the platform:

- **Hash-based routing** -- Deploy to static file hosts (GitHub Pages, S3) where server-side URL rewriting is not available. The `HashBrowserProvider` uses `/#/dashboard` style URLs instead of `/dashboard`.
- **Custom confirmation dialogs** -- Replace the ugly `window.confirm()` with a styled modal dialog that matches your application's design system.
- **Alternative storage backends** -- Use IndexedDB instead of sessionStorage, encrypt sensitive data before storing, or implement a custom eviction strategy.

### 3. Platform Portability

Providers enable WarpKit to run outside traditional browsers. Electron apps, Capacitor mobile apps, server-side testing environments, and web workers -- any context where `window.history` might not exist or might behave differently can provide its own browser provider. The router does not care about the implementation; it only talks to the interface.

## Browser Provider Deep Dive

The `BrowserProvider` interface is the most important provider. It abstracts everything related to navigation history and URL handling:

```typescript
interface BrowserProvider extends Provider {
  readonly id: 'browser';

  /** Get the current URL location */
  getLocation(): BrowserLocation;

  /** Build a full URL from an internal path */
  buildUrl(path: string): string;

  /** Parse a full URL back to an internal path */
  parseUrl(url: string): string;

  /** Push a new entry onto the history stack */
  push(path: string, state: HistoryState): void;

  /** Replace the current history entry */
  replace(path: string, state: HistoryState): void;

  /** Navigate forward or backward in history */
  go(delta: number): void;

  /** Get the current history state object */
  getHistoryState(): HistoryState | null;

  /** Listen for popstate (browser back/forward) events */
  onPopState(callback: PopStateCallback): () => void;
}
```

Where `BrowserLocation` is:

```typescript
interface BrowserLocation {
  pathname: string;
  search: string;
  hash: string;
}
```

And `HistoryState` is the state object stored in each history entry:

```typescript
interface HistoryState {
  __warpkit: true;       // Marker to identify WarpKit history entries
  id: number;            // Unique navigation ID
  position: number;      // Position in history stack (for back/forward detection)
  appState: string;      // App state when this entry was created
  data?: Record<string, unknown>;  // Consumer-provided state data
}
```

### DefaultBrowserProvider

The default implementation wraps the HTML5 History API (`pushState`, `replaceState`, `popstate`). It handles:

- **Base path support** -- If your app is deployed at `/app/`, the `basePath` option strips and prepends that prefix automatically.
- **Manual scroll restoration** -- Sets `history.scrollRestoration = 'manual'` on initialization so WarpKit can manage scroll positions through the StorageProvider.
- **Direction detection** -- Tracks the current position in the history stack to determine whether a popstate event is a back or forward navigation.

```typescript
import { DefaultBrowserProvider } from '@warpkit/core';

// For an app deployed at /app/
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    browser: new DefaultBrowserProvider({ basePath: '/app' })
  }
});
```

With `basePath: '/app'`, an internal path of `/dashboard` becomes `/app/dashboard` in the browser URL bar, and `/app/dashboard` in the URL bar is parsed back to `/dashboard` internally.

### HashBrowserProvider

For deployment to static file hosts where you cannot configure server-side URL rewrites, the `HashBrowserProvider` uses the URL hash fragment for routing:

```typescript
import { HashBrowserProvider } from '@warpkit/core';

const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    browser: new HashBrowserProvider()
  }
});
```

Internal path `/dashboard` becomes `example.com/#/dashboard` in the browser. The provider handles both `popstate` and `hashchange` events, with deduplication to prevent double handling.

### MemoryBrowserProvider

The in-memory implementation maintains a history stack as a plain array. It never touches `window` or any browser API. This is what `createMockWarpKit` uses for testing:

```typescript
import { MemoryBrowserProvider } from '@warpkit/core';

const browser = new MemoryBrowserProvider('/dashboard');

browser.push('/settings', {
  __warpkit: true,
  id: 1,
  position: 1,
  appState: 'authenticated'
});

browser.getLocation(); // { pathname: '/settings', search: '', hash: '' }
browser.getHistory();  // Array of all history entries
```

The `MemoryBrowserProvider` also exposes test helper methods:

- `getHistory()` -- Returns the full history stack for assertions.
- `getCurrentIndex()` -- Returns the current position in the stack.
- `getHistoryPosition()` -- Returns the position counter used for direction detection.
- `simulatePopState(direction)` -- Fires popstate listeners as if the user pressed back or forward.

## Storage Provider Deep Dive

The `StorageProvider` handles two responsibilities: scroll position persistence and intended path storage for deep links.

```typescript
interface StorageProvider extends Provider {
  readonly id: 'storage';

  saveScrollPosition(navigationId: number, position: ScrollPosition): void;
  getScrollPosition(navigationId: number): ScrollPosition | null;

  saveIntendedPath(path: string): void;
  popIntendedPath(): string | null;
}
```

### What Gets Stored

**Scroll positions** are keyed by navigation ID (a unique number assigned to each history entry). When you navigate away from a page, WarpKit saves the current scroll position. When you navigate back, it restores the scroll position for that history entry. This is what makes the browser back button restore your scroll position correctly in a SPA.

**Intended path** is used for deep link support. When an unauthenticated user tries to access `/settings`, WarpKit saves `/settings` as the intended path, redirects them to login, and then after successful authentication, navigates them to `/settings` instead of the default authenticated route.

### LRU Eviction

The `DefaultStorageProvider` uses `sessionStorage` with LRU (Least Recently Used) eviction to prevent unbounded storage growth. The default limit is 50 scroll positions. When the limit is reached, the oldest entries are evicted first.

```typescript
import { DefaultStorageProvider } from '@warpkit/core';

const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    storage: new DefaultStorageProvider({ maxScrollPositions: 100 })
  }
});
```

The `NoOpStorageProvider` (used in tests) silently ignores all writes and returns `null` for all reads. This means tests do not need to worry about scroll position side effects.

## ConfirmDialog Provider Deep Dive

The `ConfirmDialogProvider` abstracts the confirmation dialog shown when navigation is blocked (for example, when a form has unsaved changes).

```typescript
interface ConfirmDialogProvider extends Provider {
  readonly id: 'confirmDialog';

  confirm(message: string): Promise<boolean>;
}
```

The default implementation calls `window.confirm()`, which shows the browser's native modal dialog. This works but is ugly, non-customizable, and synchronous in appearance (though the provider interface is async to support custom implementations).

### Custom Confirmation Modal

To replace the browser's native confirm dialog with a styled modal:

```typescript
class ModalConfirmProvider implements ConfirmDialogProvider {
  readonly id = 'confirmDialog' as const;

  async confirm(message: string): Promise<boolean> {
    // Your custom modal implementation
    // Returns a promise that resolves to true (confirm) or false (cancel)
    return showConfirmModal(message);
  }
}

const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    confirmDialog: new ModalConfirmProvider()
  }
});
```

The `MockConfirmProvider` (used in tests) tracks all confirmation calls and lets you control the result:

```typescript
const warpkit = await createMockWarpKit({
  routes,
  initialState: 'authenticated',
  initialPath: '/editor'
});

// Block the next confirmation
warpkit.setConfirmResult(false);

// This navigation will be blocked because the confirm returned false
await warpkit.navigate('/dashboard');
expect(warpkit.page.pathname).toBe('/editor'); // Still on editor

// Allow the next confirmation
warpkit.setConfirmResult(true);
await warpkit.navigate('/dashboard');
expect(warpkit.page.pathname).toBe('/dashboard'); // Navigation succeeded
```

## Provider Configuration

All three providers can be passed together when creating a WarpKit instance:

```typescript
import { createWarpKit } from '@warpkit/core';
import { HashBrowserProvider } from '@warpkit/core';

const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    browser: new HashBrowserProvider(),
    storage: new DefaultStorageProvider({ maxScrollPositions: 100 }),
    confirmDialog: new ModalConfirmProvider()
  }
});
```

Any provider you do not specify gets its default implementation. You can override one without touching the others.

## Provider Lifecycle

Providers have a well-defined lifecycle managed by WarpKit:

### Initialization

When you call `warpkit.start()`, all providers are initialized via their `initialize(warpkitCore)` method. The `WarpKitCore` object passed to `initialize` is intentionally limited -- providers can observe state and subscribe to navigation events, but they cannot navigate or change state. This prevents circular dependencies between providers and the router.

```typescript
interface WarpKitCore {
  readonly page: PageState;
  getState(): string;
  getStateId(): number;
  onNavigationComplete(callback: (context: NavigationContext) => void): () => void;
}
```

### Dependency Ordering

Providers can declare dependencies on other providers via the `dependsOn` property. WarpKit uses topological sorting (Kahn's algorithm) to initialize providers in the correct order. Circular dependencies are detected and throw a `CircularDependencyError`.

```typescript
class AnalyticsProvider implements Provider {
  readonly id = 'analytics';
  readonly dependsOn = ['browser']; // Initialize after browser provider

  initialize(warpkit: WarpKitCore): void {
    // Browser provider is guaranteed to be initialized already
    warpkit.onNavigationComplete((context) => {
      trackPageView(context.to.pathname);
    });
  }
}
```

Providers without dependencies initialize in parallel. Providers with dependencies initialize after all their dependencies are ready.

### Cleanup

When `warpkit.destroy()` is called, each provider's `destroy()` method is invoked. This is where providers remove event listeners, clear intervals, and release resources. The `DefaultBrowserProvider`, for example, removes its `popstate` event listener during cleanup.

## Custom Providers

You can register custom providers beyond the three core ones. Any object implementing the `Provider` interface can be added to the registry:

```typescript
interface Provider {
  readonly id: string;
  readonly dependsOn?: string[];
  initialize?(warpkit: WarpKitCore): void | Promise<void>;
  destroy?(): void;
}
```

Register custom providers using any string key that matches the provider's `id`:

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    analytics: new AnalyticsProvider(),
    // Core providers still get defaults if not specified
  }
});
```

The key in the registry must match the `id` property on the provider. WarpKit validates this at initialization time and throws a `ProviderKeyMismatchError` if they do not match.

## Compared to Other Frameworks

### React Router

React Router calls `window.history.pushState()` and `window.history.replaceState()` directly in its source code. Testing requires mocking the global `window.history` object, which is fragile and varies between test environments (jsdom, happy-dom, real browser). There is no way to swap in a memory-based history for testing without using the separate `createMemoryRouter` factory, which creates a different router type entirely rather than swapping a provider.

### Vue Router

Vue Router has a history abstraction (`createWebHistory`, `createWebHashHistory`, `createMemoryHistory`) that is conceptually similar to WarpKit's browser provider. However, it does not extend this pattern to other browser APIs. There is no storage abstraction and no confirm dialog abstraction. Testing still requires mocking `window.confirm()` for navigation guards.

### WarpKit

WarpKit abstracts all three browser API surfaces behind pluggable providers. Testing uses the same `createWarpKit` function with different providers -- not a different router type or a different API. The provider system extends to custom providers, enabling analytics, logging, or platform-specific integrations without modifying core code.

## Next Steps

- [Data Fetching & Caching](./06-data-fetching.md) -- Learn how WarpKit's config-driven data layer works
- [Testing](./10-testing.md) -- Deep dive into testing with mock providers
