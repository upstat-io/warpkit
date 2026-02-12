# WarpKit Technical Specification -- AI Navigation Index

> **Start here** when you need to understand WarpKit's internals. This index maps common questions to the right document and section.

## Document Map

| Document | Scope | When to Read |
|----------|-------|-------------|
| [Overview & Architecture](./_index.md) | High-level architecture, file inventory, dependency graph, dev setup | First read, orientation, finding files |
| [Core Internals](./core-internals.md) | WarpKit facade, Navigator (9-phase pipeline), StateMachine, RouteCompiler, RouteMatcher, PageState, SvelteURLSearchParams, LayoutManager, NavigationLifecycle | Navigation behavior, routing, state machine, reactive state, layout resolution |
| [Provider System](./providers.md) | Provider interfaces, BrowserProvider, ConfirmDialogProvider, StorageProvider, built-in implementations, resolution, initialization, custom providers | Browser API abstraction, history management, hash routing, testing with MemoryBrowserProvider |
| [Events & Errors](./events-errors.md) | EventEmitter, event types, useEvent hook, error channel, error store, global handlers, ErrorOverlay, NavigationErrorCode | Event pub/sub, error handling pipeline, error codes, error UI |
| [Components & Hooks](./components.md) | WarpKitProvider, WarpKitAppBoundary, RouterView, Link, NavLink, context system, useWarpKit, usePage, useEvent, shouldHandleClick | Svelte component layer, context bridge, hooks API, link handling |
| [Sub-Packages](./packages.md) | @warpkit/data, @warpkit/cache, @warpkit/forms, @warpkit/validation, @warpkit/websocket, @warpkit/errors, @warpkit/auth-firebase, @warpkit/vite-plugin, @warpkit/types | Data fetching, caching, forms, validation, WebSocket, auth, Vite tooling |
| [Testing](./testing.md) | createMockWarpKit, mock providers, event spies, navigation assertions, renderWithWarpKit, createMockDataClient | Writing tests, mock setup, assertion helpers |

## Quick Lookup

### "How does navigation work?"
Start with [Core Internals > Navigator](./core-internals.md#2-navigator----9-phase-navigation-pipeline). The 9 phases are: INITIATE, MATCH ROUTE, CHECK BLOCKERS, BEFORE NAVIGATE, DEACTIVATE CURRENT, LOAD & ACTIVATE, ON NAVIGATE, COMMIT, AFTER NAVIGATE.

### "How does route matching work?"
[Core Internals > RouteMatcher](./core-internals.md#5-routematcher) for the 5-step matching algorithm. [Core Internals > RouteCompiler](./core-internals.md#4-routecompiler) for path-to-regex compilation and specificity scoring.

### "How does state-based routing work?"
[Core Internals > StateMachine](./core-internals.md#3-statemachine) for the FSM. Routes are scoped to app states -- a path only matches if it exists in the current state's route table. State mismatches redirect to the current state's default path.

### "How do providers work?"
[Provider System](./providers.md) covers all three provider interfaces (Browser, ConfirmDialog, Storage), their built-in implementations, and the resolution/initialization lifecycle.

### "How do I write a custom provider?"
[Provider System > Writing a Custom Provider](./providers.md#writing-a-custom-provider) has examples for minimal providers, providers with dependencies, and replacing core providers.

### "How does the event system work?"
[Events & Errors > Part 1: Event System](./events-errors.md#part-1-event-system). Covers EventEmitter API, conditional rest params on emit, error isolation, mutation-safe iteration, and the useEvent Svelte hook.

### "How does error handling work?"
[Events & Errors > Part 2: Error System](./events-errors.md#part-2-error-system). Four layers: error channel (zero-dep pub/sub), error store (reactive state), global handlers (window.onerror etc.), ErrorOverlay (dev UI). Navigation errors are separate -- see [NavigationErrorCode reference](./events-errors.md#navigation-errors).

### "How does data fetching work?"
[Sub-Packages > @warpkit/data](./packages.md#warpkitdata). DataClient handles config-driven queries with URL interpolation, E-Tag caching, and event-driven invalidation. useQuery and useData are the Svelte hooks.

### "How does caching work?"
[Sub-Packages > @warpkit/cache](./packages.md#warpkitcache). Two-tier caching: MemoryCache (L1) + StorageCache (L2) via ETagCacheProvider. Supports scoped caches for multi-tenant apps.

### "How do forms work?"
[Sub-Packages > @warpkit/forms](./packages.md#warpkitforms). Schema-driven forms with deep proxy binding, 4 validation modes, array operations with error reindexing, and TypeBox default extraction.

### "How does validation work?"
[Sub-Packages > @warpkit/validation](./packages.md#warpkitvalidation). Library-agnostic StandardSchema interface. Works with Zod, TypeBox, Valibot, ArkType.

### "How does the WebSocket client work?"
[Sub-Packages > @warpkit/websocket](./packages.md#warpkitwebsocket). Full-jitter backoff reconnection, heartbeat ping/pong, room management, browser offline/visibility detection, prototype-pollution-safe JSON parsing.

### "How does auth work?"
[Sub-Packages > @warpkit/auth-firebase](./packages.md#warpkitauth-firebase) for Firebase adapter. [Sub-Packages > @warpkit/types](./packages.md#warpkittypes) for the AuthAdapter interface contract.

### "How do I write tests?"
[Testing](./testing.md). Start with `createMockWarpKit` for navigation tests. Use `expectations.ts` for assertion helpers. Use `createMockDataClient` for data layer tests.

### "How do the Svelte components work?"
[Components & Hooks](./components.md). WarpKitProvider sets context, RouterView renders matched routes, Link/NavLink handle click interception, hooks (useWarpKit, usePage, useEvent) provide reactive access.

### "What does the Vite plugin do?"
[Sub-Packages > @warpkit/vite-plugin](./packages.md#warpkitvite-plugin). Disables Vite's overlay (WarpKit has its own), injects `__warpkitHmrId` for debugging, pre-warms route components.

## Related Documentation

- **User Guide**: `../guide/README.md` -- comprehensive guide for WarpKit consumers (11 chapters)
- **Source Code**: `../src/` (core), `../packages/` (sub-packages)
