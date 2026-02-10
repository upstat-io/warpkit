# WarpKit Technical Specification

> **Maintainer documentation for the WarpKit framework internals.**
> For user-facing documentation, see the [WarpKit Guide](../guide/README.md).

**Status**: Active
**Last Updated**: 2026-02-10
**Audience**: Framework contributors and maintainers

---

## Overview

WarpKit is a modular SPA framework for Svelte 5 built around **state-based routing** — routes are organized by application state (e.g., `authenticated`, `unauthenticated`) rather than flat URL patterns. The framework provides a 9-phase navigation pipeline, pluggable providers for browser APIs, config-driven data fetching, schema-driven forms, and a type-safe WebSocket client.

The codebase is split into a core package (`src/`) and independent sub-packages (`packages/`). Core handles routing, state management, events, errors, and Svelte components. Sub-packages handle data fetching, caching, forms, validation, WebSockets, auth adapters, and Vite tooling.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Consumer App                             │
├─────────────────────────────────────────────────────────────────┤
│  Components Layer                                               │
│  WarpKitProvider → RouterView → Link / NavLink                  │
│  useWarpKit() / usePage() / useEvent()                          │
├─────────────────────────────────────────────────────────────────┤
│  WarpKit Facade (orchestrator)                                  │
│  ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │Navigator │ │StateMachine│ │RouteMatcher  │ │LayoutManager │  │
│  │(9-phase  │ │(FSM)      │ │(compiler +   │ │(caching)     │  │
│  │pipeline) │ │           │ │scorer)       │ │              │  │
│  └──────────┘ └───────────┘ └──────────────┘ └──────────────┘  │
│  ┌──────────────────┐ ┌───────────────┐ ┌──────────────────┐   │
│  │NavigationLifecycle│ │PageState      │ │EventEmitter      │   │
│  │(hooks)           │ │($state)       │ │(pub/sub)         │   │
│  └──────────────────┘ └───────────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Provider Layer                                                 │
│  BrowserProvider │ ConfirmDialogProvider │ StorageProvider       │
│  (+ custom providers via open registry)                         │
├─────────────────────────────────────────────────────────────────┤
│  Independent Packages                                           │
│  @warpkit/data │ @warpkit/cache │ @warpkit/forms                │
│  @warpkit/validation │ @warpkit/websocket │ @warpkit/errors     │
│  @warpkit/auth-firebase │ @warpkit/vite-plugin │ @warpkit/types │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **State-based routing**: Routes are scoped to app states. A path like `/dashboard` only matches in the `authenticated` state. State mismatches redirect to the current state's default path.

2. **Provider abstraction**: All browser APIs (history, confirm dialogs, storage) are abstracted behind interfaces. This enables testing with in-memory providers and custom implementations (hash routing, custom modals, IndexedDB storage).

3. **Svelte 5 reactivity**: Core state (`PageState`, `loadedComponent`, `loadedLayout`, `ready`) uses `$state` runes. Components react automatically to navigation changes without stores or subscriptions.

4. **Dual cancellation**: The Navigator checks both `navigationId` and `stateId` at each async boundary. This catches both rapid navigations and state transitions during in-flight navigations.

5. **Error isolation**: Event handlers, lifecycle hooks, and providers all use try/catch isolation. One failing handler never breaks other handlers or the navigation pipeline.

6. **Zero-dependency error channel**: `@warpkit/errors` has no dependencies and can be imported from any package. Errors are buffered until core subscribes, then flushed.

## File Inventory

### Core (`src/`)

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports |
| `route.ts` | `createRoute()` and `createStateRoutes()` factories |
| `context.ts` | Svelte context key and WarpKitContext interface |
| `hooks.ts` | `useWarpKit()`, `usePage()`, `useWarpKitContext()` |
| `core/WarpKit.svelte.ts` | Main facade class orchestrating all components |
| `core/Navigator.ts` | 9-phase navigation pipeline |
| `core/StateMachine.ts` | Simple FSM for app state tracking |
| `core/RouteMatcher.ts` | Route matching with state filtering and path expansion |
| `core/RouteCompiler.ts` | Path pattern → RegExp with specificity scoring |
| `core/PageState.svelte.ts` | Reactive page state container ($state) |
| `core/SvelteURLSearchParams.svelte.ts` | Reactive URLSearchParams wrapper |
| `core/LayoutManager.ts` | Layout resolution and caching |
| `core/NavigationLifecycle.ts` | Hook registration and execution |
| `core/types.ts` | All core type definitions |
| `events/EventEmitter.ts` | Type-safe pub/sub with error isolation |
| `events/useEvent.svelte.ts` | Svelte 5 hook for event subscriptions |
| `events/types.ts` | Event registry and handler types |
| `providers/interfaces.ts` | Provider contracts (Browser, Confirm, Storage) |
| `providers/browser/BrowserProvider.ts` | Default browser history provider |
| `providers/browser/HashBrowserProvider.ts` | Hash-based routing provider |
| `providers/browser/MemoryBrowserProvider.ts` | In-memory provider for testing |
| `providers/browser/utils.ts` | Browser utilities |
| `providers/confirm/ConfirmDialogProvider.ts` | Default window.confirm provider |
| `providers/storage/StorageProvider.ts` | Default sessionStorage provider |
| `errors/error-store.svelte.ts` | Reactive error state ($state) |
| `errors/global-handlers.ts` | window.onerror, unhandledrejection, Vite HMR |
| `errors/ErrorOverlay.svelte` | Dev-mode error overlay component |
| `errors/types.ts` | Error types and severity |
| `auth/index.ts` | Auth adapter exports |
| `auth/types.ts` | AuthAdapter interface |
| `shared/shouldHandleClick.ts` | Link click handling utility |
| `components/WarpKitProvider.svelte` | Root context provider |
| `components/WarpKitAppBoundary.svelte` | Ready-state wrapper |
| `components/RouterView.svelte` | Route component renderer |
| `components/Link.svelte` | Declarative navigation |
| `components/NavLink.svelte` | Active-aware navigation link |
| `testing/createMockWarpKit.ts` | Mock WarpKit factory |
| `testing/MockConfirmProvider.ts` | Configurable confirm mock |
| `testing/NoOpStorageProvider.ts` | Silent storage mock |
| `testing/createMockEvents.ts` | Mock event emitter factory |
| `testing/createEventSpy.ts` | Event spy for assertions |
| `testing/expectations.ts` | Navigation assertion helpers |
| `testing/waitForNavigation.ts` | Async navigation utility |
| `testing/renderWithWarpKit.ts` | Test render helper |
| `testing/createMockDataClient.ts` | Mock DataClient factory |
| `testing/WarpKitTestWrapper.svelte` | Test wrapper component |

### Sub-Packages (`packages/`)

| Package | Purpose | Key Files |
|---------|---------|-----------|
| `@warpkit/data` | Data fetching, caching, mutations | `DataClient.ts`, `useData.svelte.ts`, `useMutation.svelte.ts` |
| `@warpkit/cache` | Cache implementations | `MemoryCache.ts`, `StorageCache.ts`, `ETagCacheProvider.ts` |
| `@warpkit/forms` | Schema-driven form state | `proxy.ts`, `form-logic.ts`, `hooks.svelte.ts`, `paths.ts` |
| `@warpkit/validation` | StandardSchema validation | `standard-schema.ts`, `validate.ts`, `validated-type.ts` |
| `@warpkit/websocket` | WebSocket client | `client.ts`, `control-messages.ts`, `json.ts` |
| `@warpkit/auth-firebase` | Firebase auth adapter | `adapter.ts`, `error-mapping.ts` |
| `@warpkit/errors` | Cross-package error channel | `channel.ts` |
| `@warpkit/vite-plugin` | Vite dev tooling + HMR | `index.ts` |
| `@warpkit/types` | Shared TypeScript types | `index.ts`, `auth.ts` |

## Section Index

| Section | Description | Key Files |
|---------|-------------|-----------|
| [Core Internals](./core-internals.md) | WarpKit facade, Navigator pipeline, StateMachine, routing engine, PageState, layouts | `core/*.ts` |
| [Provider System](./providers.md) | Provider interfaces, built-in implementations, lifecycle | `providers/**/*.ts` |
| [Events & Errors](./events-errors.md) | EventEmitter, error channel, error store, global handlers | `events/*.ts`, `errors/*.ts`, `packages/errors/` |
| [Components](./components.md) | Svelte components, context, hooks | `components/*.svelte`, `context.ts`, `hooks.ts` |
| [Sub-Packages](./packages.md) | Data, cache, forms, validation, WebSocket, auth, Vite plugin | `packages/*/` |
| [Testing](./testing.md) | Mock providers, test factories, assertion helpers | `testing/*.ts` |

## Development Setup

```bash
# Install dependencies
bun install

# Run all tests
bun run test:all

# Unit tests (Bun test runner)
bun run test

# Package tests (Vitest)
bun run test:packages

# Browser tests (Vitest + Playwright)
bun run test:browser

# Type checking
bun run typecheck

# Benchmarks
bun run src/core/__benchmarks__/router.bench.ts
```

## Dependency Graph

```
@warpkit/errors          (zero deps - any package can import)
    ↑
@warpkit/types           (zero deps)
    ↑
@warpkit/validation      (zero deps)
    ↑
@warpkit/data            (depends on: @warpkit/validation)
    ↑
@warpkit/cache           (depends on: @warpkit/data for CacheProvider type)
    ↑
@warpkit/core (src/)     (depends on: @warpkit/errors)
    ↑
@warpkit/forms           (depends on: @warpkit/validation)
@warpkit/websocket       (depends on: @warpkit/errors)
@warpkit/auth-firebase   (depends on: @warpkit/core for types)
@warpkit/vite-plugin     (standalone Vite plugin)
```
