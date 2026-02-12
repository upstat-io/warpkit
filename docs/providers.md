# Provider System

WarpKit's provider system is a pluggable abstraction layer over browser APIs (history, storage, confirmation dialogs). Providers enable testability without mocking globals and allow consumers to swap implementations (hash routing, custom modals, IndexedDB storage).

This document covers provider interfaces, built-in implementations, resolution, initialization, and extension points.

## Source Map

| File | Purpose |
|------|---------|
| `src/providers/interfaces.ts` | All provider interfaces, types, and the `ProviderRegistry`/`ResolvedProviders` contracts |
| `src/providers/browser/BrowserProvider.ts` | `DefaultBrowserProvider` -- HTML5 History API |
| `src/providers/browser/HashBrowserProvider.ts` | `HashBrowserProvider` -- hash-based routing |
| `src/providers/browser/MemoryBrowserProvider.ts` | `MemoryBrowserProvider` -- in-memory for tests |
| `src/providers/browser/utils.ts` | Shared helpers: `extractHistoryState()`, `notifyListeners()` |
| `src/providers/confirm/ConfirmDialogProvider.ts` | `DefaultConfirmDialogProvider` -- `window.confirm()` |
| `src/providers/storage/StorageProvider.ts` | `DefaultStorageProvider` -- `sessionStorage` with LRU |
| `src/core/resolveProviders.ts` | Standalone resolution with Kahn's topological sort, cycle detection, key validation |
| `src/core/WarpKit.svelte.ts` | Calls standalone `resolveProviders()` during `start()` for full resolution + initialization |

## Provider Interface (`src/providers/interfaces.ts`)

### Base Provider

```typescript
interface Provider {
  readonly id: string;
  readonly dependsOn?: string[];
  initialize?(warpkit: WarpKitCore): void | Promise<void>;
  destroy?(): void;
}
```

- `id` is the canonical key. It must match the key used in `ProviderRegistry` -- the resolution logic validates `key === provider.id` and throws `ProviderKeyMismatchError` if they differ (`src/core/resolveProviders.ts:70-74`).
- `dependsOn` lists provider IDs that must initialize before this one. If omitted, the provider has no ordering constraints and can initialize in parallel with others.
- `initialize()` is called once during `WarpKit.start()`. It receives a `WarpKitCore` reference (not the full `WarpKit` instance). Both sync and async returns are supported.
- `destroy()` is called during `WarpKit.destroy()`. Each provider's `destroy()` is wrapped in try/catch so a failure in one provider does not prevent cleanup of others (`WarpKit.svelte.ts:413-419`).

### WarpKitCore

```typescript
interface WarpKitCore {
  readonly page: PageState;
  getState(): string;
  getStateId(): number;
  onNavigationComplete(callback: (context: NavigationContext) => void): () => void;
}
```

This is the read-only subset of `WarpKit` that providers receive during initialization. The design is intentionally constrained:

- Providers can **observe** state (page, app state) and listen for navigation completions.
- Providers **cannot** navigate, set app state, or register lifecycle hooks. This one-way dependency prevents provider-to-WarpKit circular calls.
- `onNavigationComplete` fires after Phase 9 (afterNavigate) of the navigation pipeline. It is an observation hook, not the `onNavigate` pipeline hook (Phase 7). Providers cannot block or redirect from this callback.

`WarpKit` implements `WarpKitCore` directly (`class WarpKit<...> implements WarpKitCore`), so the `WarpKit` instance is passed as-is. TypeScript's structural typing ensures providers only see the `WarpKitCore` surface.

## BrowserProvider (`id: 'browser'`)

### Interface

```typescript
interface BrowserProvider extends Provider {
  readonly id: 'browser';
  getLocation(): BrowserLocation;
  buildUrl(path: string): string;
  parseUrl(url: string): string;
  push(path: string, state: HistoryState): void;
  replace(path: string, state: HistoryState): void;
  go(delta: number): void;
  getHistoryState(): HistoryState | null;
  onPopState(callback: PopStateCallback): () => void;
}
```

The `id` is a literal `'browser'` -- TypeScript enforces this at the type level, not just by convention.

### BrowserLocation

```typescript
interface BrowserLocation {
  pathname: string;
  search: string;
  hash: string;
}
```

Returned by `getLocation()`. For `DefaultBrowserProvider`, the `pathname` has the `basePath` stripped. For `HashBrowserProvider`, the pathname is extracted from the hash fragment.

### HistoryState

```typescript
interface HistoryState {
  __warpkit: true;   // Marker to identify WarpKit entries
  id: number;        // Unique navigation ID (positive from Navigator, negative from search updates)
  position: number;  // History stack position for back/forward direction detection
  appState: string;  // App state name when entry was created
  data?: Record<string, unknown>;  // Consumer-provided state data
}
```

Key design decisions:

- The `__warpkit: true` marker allows `extractHistoryState()` (`src/providers/browser/utils.ts:13-18`) to distinguish WarpKit entries from third-party history state. If the state does not have this marker, it returns `null`.
- `position` is a monotonically increasing counter maintained by each browser provider. Direction detection works by comparing the new position against the previous position -- lower means "back", higher means "forward" (all three providers use this pattern).
- `id` uses positive numbers for Navigator-generated navigations and negative numbers for search-only updates via `WarpKit.updateSearch()` (`WarpKit.svelte.ts:949-951`). This prevents ID collisions between the two systems.
- Scroll positions are **not** stored in `HistoryState`. They are stored separately via `StorageProvider`, keyed by navigation ID. The `PopStateCallback` type documents this explicitly in a JSDoc comment.

### PopStateCallback

```typescript
type PopStateCallback = (state: HistoryState | null, direction: 'back' | 'forward') => void;
```

The direction is computed by the browser provider, not by the caller. State is `null` when the history entry was not created by WarpKit.

## ConfirmDialogProvider (`id: 'confirmDialog'`)

### Interface

```typescript
interface ConfirmDialogProvider extends Provider {
  readonly id: 'confirmDialog';
  confirm(message: string): Promise<boolean>;
}
```

Used by WarpKit's blocker system. When a `NavigationBlocker` returns a string message, WarpKit calls `confirmDialog.confirm(message)` and blocks navigation if the user declines (`WarpKit.svelte.ts:881-897`).

The async return allows custom implementations to show modal dialogs that resolve on user interaction, not just the synchronous `window.confirm()`.

## StorageProvider (`id: 'storage'`)

### Interface

```typescript
interface StorageProvider extends Provider {
  readonly id: 'storage';
  saveScrollPosition(navigationId: number, position: ScrollPosition): void;
  getScrollPosition(navigationId: number): ScrollPosition | null;
  saveIntendedPath(path: string): void;
  popIntendedPath(): string | null;
}
```

Two responsibilities:

1. **Scroll position persistence**: Keyed by navigation ID. The Navigator saves scroll position before navigating and restores it after popstate navigation. LRU eviction bounds storage size.
2. **Intended path for deep links**: When an unauthenticated user hits a protected route, the app saves the path before redirecting to login. After authentication, `popIntendedPath()` retrieves and clears it (get-and-delete semantics).

### ScrollPosition

```typescript
interface ScrollPosition {
  x: number;
  y: number;
}
```

### Configuration

```typescript
interface StorageProviderConfig {
  maxScrollPositions?: number;  // Default: 50
}
```

## Built-in Implementations

### DefaultBrowserProvider (`src/providers/browser/BrowserProvider.ts`)

HTML5 History API implementation (`pushState`/`replaceState`).

**Constructor**: Accepts optional `BrowserProviderConfig` with `basePath`. The trailing slash is stripped during construction (line 31-33).

**Initialization** (`initialize()`):
- Sets `history.scrollRestoration = 'manual'` -- WarpKit manages scroll restoration via StorageProvider, not the browser default.
- Reads the current history state to seed `historyPosition` for direction detection.
- Registers a `popstate` event listener that computes direction from position delta and notifies all registered callbacks via `notifyListeners()`.

**URL handling**:
- `buildUrl(path)` prepends `basePath`.
- `getLocation()` reads from `window.location` and strips `basePath` from the pathname.
- `parseUrl(url)` strips `basePath` (same as `stripBasePath()`).

**History manipulation**:
- `push()` increments `historyPosition`, merges position into state, calls `history.pushState()`.
- `replace()` keeps current `historyPosition`, merges position into state, calls `history.replaceState()`.
- This means every `HistoryState` stored in the browser always has the correct `position` field regardless of what the caller passes.

**Cleanup** (`destroy()`): Removes the `popstate` listener and clears the listener set.

### HashBrowserProvider (`src/providers/browser/HashBrowserProvider.ts`)

Hash-based routing for environments without server-side URL rewriting (e.g., static file hosting, `file://` protocol).

URLs look like `example.com/#/dashboard` rather than `example.com/dashboard`.

**Initialization**: Same as `DefaultBrowserProvider` (manual scroll restoration, position seeding, popstate listener) plus a `hashchange` listener as a fallback. Some browsers fire `hashchange` instead of or in addition to `popstate`, so the provider uses a `popStateProcessing` flag with `queueMicrotask()` to prevent double-handling (lines 42-57, 61-65).

**URL handling**:
- `buildUrl(path)` returns `'#' + path`.
- `getLocation()` parses the hash portion of `window.location.hash` into pathname, search, and nested hash (for `#/page#section` fragment patterns).
- `parseUrl(url)` extracts pathname from hash URL.

**Private**: `parseHashPath()` handles edge cases: empty hash defaults to `/`, nested `#` within the hash fragment is treated as a page section anchor, and `?` within the hash is extracted as the search string.

### MemoryBrowserProvider (`src/providers/browser/MemoryBrowserProvider.ts`)

In-memory history stack with no browser API interaction. Primary use case is testing.

**Constructor**: Takes an optional `initialPath` (defaults to `'/'`). Creates a single-entry history stack.

**History stack**:
- `push()` truncates forward history (like a real browser), increments position, appends entry.
- `replace()` overwrites the current entry, preserves position.
- `go(delta)` does bounds checking and fires listeners synchronously (intentional -- matches test expectations, avoids async timing issues in unit tests).

**Test helpers** (public methods not on the interface):
- `getHistory()`: Returns a copy of the full history stack for assertions.
- `getCurrentIndex()`: Current position in the stack.
- `getHistoryPosition()`: The monotonic position counter (distinct from stack index).
- `simulatePopState(direction)`: Moves the history index in the given direction (if within bounds), then fires popstate listeners with the entry's state and direction. This matches real browser behavior where back/forward changes the URL before firing popstate.

**No `initialize()` or `destroy()`**: This provider has no browser globals to set up or tear down.

### DefaultConfirmDialogProvider (`src/providers/confirm/ConfirmDialogProvider.ts`)

Wraps `window.confirm()`.

Falls back to returning `true` (allow navigation) when `window` is undefined or `window.confirm` is not a function. This handles SSR and unusual test environments gracefully.

The `confirm()` method is `async` despite `window.confirm()` being synchronous. This matches the interface contract and avoids breaking if the implementation is ever swapped for something async.

### DefaultStorageProvider (`src/providers/storage/StorageProvider.ts`)

Uses `sessionStorage` with LRU eviction for scroll positions.

**Storage keys**:
- `__warpkit_scroll_positions__` -- JSON object mapping navigation ID to `{ position: ScrollPosition, timestamp: number }`.
- `__warpkit_intended_path__` -- string value for deep link support.

**LRU eviction** (`evictOldest()`, line 117-129): When the number of stored positions exceeds `maxPositions` (default 50), entries are sorted by timestamp ascending and the oldest are deleted until the count equals the limit.

**Error handling**: All public methods wrap their bodies in try/catch with empty catch blocks. This is intentional graceful degradation -- if `sessionStorage` is unavailable (private browsing, quota exceeded), scroll restoration and deep links silently degrade rather than throwing.

**SSR safety**: `getStorage()` checks for `window` and `sessionStorage` existence before returning.

## Shared Browser Utilities (`src/providers/browser/utils.ts`)

### `extractHistoryState(state: unknown): HistoryState | null`

Type-narrows raw `history.state` (which is `any`) into a `HistoryState` or `null`. Checks for `__warpkit` marker property. Used by both `DefaultBrowserProvider` and `HashBrowserProvider` to safely read popstate and current history state.

### `notifyListeners(listeners, state, direction): void`

Iterates a `Set<PopStateCallback>` and calls each listener. Individual listener errors are caught and logged via `console.error` to prevent one failing listener from blocking others. Used by all three browser provider implementations.

## Provider Resolution

### ProviderRegistry and ResolvedProviders

```typescript
interface ProviderRegistry {
  browser?: BrowserProvider;
  confirmDialog?: ConfirmDialogProvider;
  storage?: StorageProvider;
  [key: string]: Provider | undefined;  // Consumer extensions
}

interface ResolvedProviders {
  browser: BrowserProvider;
  confirmDialog: ConfirmDialogProvider;
  storage: StorageProvider;
  [key: string]: Provider;
}
```

The difference is optionality: `ProviderRegistry` accepts partial input, `ResolvedProviders` guarantees all three core providers exist. The index signature `[key: string]` allows consumer-defined providers (e.g., `analytics`, `auth`).

### Resolution Logic

`WarpKit.start()` calls the standalone `resolveProviders()` function from `src/core/resolveProviders.ts`. The provider registry from the config is stored in the constructor and resolved asynchronously during startup.

**`resolveProviders(registry, warpkit)` (`src/core/resolveProviders.ts`)**

Applies defaults, validates, and initializes in one pass:

1. **Apply defaults** with nullish coalescing:
   ```
   browser:       registry.browser       ?? new DefaultBrowserProvider()
   confirmDialog: registry.confirmDialog ?? new DefaultConfirmDialogProvider()
   storage:       registry.storage       ?? new DefaultStorageProvider()
   ```
   The spread `...registry` is applied after defaults, so consumer-provided core providers override defaults, and custom providers are included.

2. **Key-ID match validation**: Iterates all registry entries and throws `ProviderKeyMismatchError` if `key !== provider.id`.

3. **Dependency existence validation**: For each provider with `dependsOn`, verifies every dependency ID exists in the registry. Throws `MissingProviderError` if not.

4. **Topological sort**: Runs Kahn's algorithm on the dependency graph.

5. **Cycle detection**: If the sorted output is shorter than the provider list, a cycle exists. The `findCycle()` helper uses DFS to extract the cycle path for the error message. Throws `CircularDependencyError`.

6. **Sequential initialization**: Initializes providers in topological order, one at a time. Wraps initialize errors with provider ID context using `Error.cause`.

The `WarpKitCore` reference passed to each provider is `this` (the WarpKit instance itself), since WarpKit implements the `WarpKitCore` interface.

### Error Types (`src/core/resolveProviders.ts`)

| Error Class | Thrown When |
|-------------|------------|
| `CircularDependencyError` | Dependency graph has a cycle (e.g., A depends on B, B depends on A) |
| `MissingProviderError` | A `dependsOn` references a provider ID not in the registry |
| `ProviderKeyMismatchError` | Registry key does not match `provider.id` |

## Initialization Order Within `start()`

After provider resolution and initialization, `start()` continues with:
1. Create Navigator with resolved providers and all dependencies.
2. Register popstate listener on `providers.browser.onPopState()`.
3. Set up `beforeunload` handler for navigation blockers.
4. Initialize auth adapter (if configured).
5. Process pre-start state change queue.
6. Perform initial navigation from current URL.
7. Set `ready = true`.

## Provider Destruction (`WarpKit.destroy()`)

Cleanup order in `destroy()` (`WarpKit.svelte.ts:390-425`):

1. Remove popstate unsubscribe.
2. Remove `beforeunload` listener.
3. Remove global error handlers.
4. Unsubscribe from auth state changes.
5. Iterate all providers and call `destroy()` on each, wrapped in individual try/catch blocks.
6. Clear internal sets (blockers, search listeners, navigation complete listeners).

The per-provider try/catch ensures all providers get a cleanup attempt even if one throws.

## Writing a Custom Provider

Custom providers use the `[key: string]` extension point on `ProviderRegistry`.

### Minimal Example

A provider that only needs to observe navigation completions:

```typescript
const analyticsProvider: Provider = {
  id: 'analytics',
  initialize(warpkit: WarpKitCore) {
    warpkit.onNavigationComplete((context) => {
      trackPageView(context.to.path);
    });
  },
  destroy() {
    // Flush any pending analytics
  }
};

// Pass in config:
createWarpKit({
  providers: { analytics: analyticsProvider },
  // ...
});
```

### With Dependencies

A provider that depends on the browser provider being initialized first:

```typescript
const customProvider: Provider = {
  id: 'myProvider',
  dependsOn: ['browser'],
  initialize(warpkit) {
    // Browser provider is guaranteed initialized at this point
  }
};
```

### Replacing a Core Provider

Supply a custom implementation with the correct `id`:

```typescript
const customConfirm: ConfirmDialogProvider = {
  id: 'confirmDialog',
  async confirm(message) {
    return showCustomModal(message);  // Returns Promise<boolean>
  }
};

createWarpKit({
  providers: { confirmDialog: customConfirm },
  // ...
});
```

The `id` must be `'confirmDialog'` (literal type enforced by TypeScript). The key in the registry must also be `'confirmDialog'`. If they differ, `resolveProviders()` throws `ProviderKeyMismatchError`.

## Testing with Providers

### MemoryBrowserProvider for Unit Tests

```typescript
import { MemoryBrowserProvider } from 'warpkit/providers/browser/MemoryBrowserProvider';

const browser = new MemoryBrowserProvider('/initial-path');

// After navigations:
browser.getHistory();        // Full stack for assertions
browser.getCurrentIndex();   // Current position in stack
browser.simulatePopState('back');  // Fire listeners manually
```

### Mocking StorageProvider

For tests that need to control scroll position or intended path behavior, implement the `StorageProvider` interface with a `Map`:

```typescript
const mockStorage: StorageProvider = {
  id: 'storage',
  saveScrollPosition: (id, pos) => positions.set(id, pos),
  getScrollPosition: (id) => positions.get(id) ?? null,
  saveIntendedPath: (path) => { storedPath = path; },
  popIntendedPath: () => { const p = storedPath; storedPath = null; return p; }
};
```

## Architectural Notes

### Why Providers Instead of Direct API Calls

1. **Testability**: `MemoryBrowserProvider` replaces `window.history` in unit tests without JSDOM or global mocking.
2. **Flexibility**: `HashBrowserProvider` enables hash routing with zero changes to navigation logic.
3. **Decoupling**: WarpKit's core (Navigator, StateMachine, RouteMatcher) never touches `window` directly. All browser interaction flows through the provider abstraction.

### Why WarpKitCore is Restricted

Providers must not navigate or change app state. If they could, it would create circular dependency chains:

```
WarpKit.start() -> provider.initialize(warpkit) -> warpkit.navigate() -> provider.push() -> ...
```

By limiting providers to read-only observation plus `onNavigationComplete`, the dependency direction is always one-way: WarpKit calls providers, never the reverse (except for popstate callbacks, which are event-driven and safe).

### Two Resolution Paths

The standalone `resolveProviders()` in `src/core/resolveProviders.ts` was the original implementation with full validation (key-ID matching, missing deps, cycle detection). The runtime `WarpKit.resolveProviders()` is a simpler synchronous version that skips validation for performance. The standalone version remains used by tests and could be promoted to the runtime path if validation at startup is desired. The standalone version initializes providers sequentially in topological order; the runtime version uses parallel `Promise.all` with recursive DFS for dependency ordering.
