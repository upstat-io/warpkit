---
paths:
  - "src/**"
  - "packages/**"
---

# Implementation Hygiene Rules

**Implementation hygiene is NOT architecture** (design decisions are made) **and NOT code hygiene** (surface style). It's about whether the implementation faithfully and cleanly realizes the architecture — tight joints, correct flow, no leaks.

## Package Boundary Discipline

- **Core (`src/`) vs Packages (`packages/`)**: Core handles routing, navigation, state machine, providers, events, error overlay. Packages are independent modules with their own build output.
- **Packages never import from core**: A package under `packages/` must never import from `src/`. The only bridge is `@warpkit/errors` (zero-dep leaf) which any package can import.
- **No cross-package imports** (except shared leaves): Packages may import `@warpkit/errors` and `@warpkit/types`. No other cross-package dependencies unless explicitly declared in `package.json`.
- **Dependency direction**: Consumer → Core → Packages → Shared leaves. Never upward.
- **Each package owns its domain**: `@warpkit/data` owns data fetching, `@warpkit/forms` owns form state, `@warpkit/websocket` owns socket connections. No domain overlap.

## Error Flow Discipline

- **Errors are never silent**: Every `catch` block must either rethrow, call `reportError()`, or log to console. No empty `catch {}` blocks.
- **`reportError()` is the bridge**: Sub-packages report via `reportError(source, error, options)`. Core subscribes via `onErrorReport()` and routes to `errorStore` + ErrorOverlay.
- **`showUI` defaults are severity-based**: `true` for `error`/`fatal`, `false` for `warning`/`info`. Callsites that override to `showUI: false` for `error` severity must justify it — the component must have visible error UI.
- **`handledLocally: true` means visible error UI**: Only use when the calling component actually renders the error to the user (e.g., `submitError` in forms, `error` state in useQuery). If there's no visible UI, don't set `handledLocally: true`.
- **Console always fires**: Even when `handledLocally: true` or `showUI: false`, errors must appear in `console.error` / `console.warn`.
- **`void` on async calls requires `.catch()`**: Every `void asyncFn()` fire-and-forget must have a `.catch()` handler that reports or logs the error. Unhandled rejections are bugs.
- **Error source must match package**: `reportError('data:query', ...)` from `@warpkit/data`, `reportError('websocket', ...)` from `@warpkit/websocket`. Don't use mismatched sources.

## Provider Abstraction

- **Browser APIs through providers**: All `window`, `history`, `location`, `localStorage`, `confirm` access goes through provider interfaces (`BrowserProvider`, `StorageProvider`, `ConfirmDialogProvider`).
- **No direct browser API calls in core logic**: Core classes and functions use injected providers. Direct `window.*` calls are only acceptable in provider implementations.
- **Providers enable testing**: `MemoryBrowserProvider` for unit tests. If code can't be tested with a memory provider, the abstraction is leaking.

## Svelte 5 Reactivity Discipline

- **Never destructure reactive objects**: Destructuring `$state` or `$derived` objects breaks reactivity. Always access properties on the original object.
- **`.svelte.ts` for reactive modules**: Files using `$state`, `$derived`, or `$effect` must use the `.svelte.ts` extension. Pure TypeScript logic uses `.ts`.
- **`$effect` cleanup**: Every `$effect` that creates subscriptions, listeners, or timers must return a cleanup function.
- **No `$state` in `.ts` files**: Runes only work in `.svelte` and `.svelte.ts` files. Using them in `.ts` files is a silent failure.
- **Snippet API, not slots**: Components use `children: Snippet` and `{@render children()}`, not `<slot>`.

## Data Flow

- **Error channel is the cross-package bridge**: Packages don't know about ErrorOverlay or errorStore. They only know `reportError()`.
- **Event emitter for invalidation**: DataClient uses events for cache invalidation. Event handlers must be wrapped in try/catch — a failing handler must never break other handlers.
- **State machine drives routing**: State transitions determine which routes are accessible. Route definitions are grouped by state via `createStateRoutes()`.
- **Props flow down, callbacks flow up**: Components receive data via `$props()` and notify parents via callback props (`onSuccess`, `onError`), not boolean flags.
- **Types at boundaries**: Exported package APIs must have explicit TypeScript types. No `any` at public interfaces.

## Build & Ship Discipline

- **Ship compiled JS**: Every package MUST have a build step producing `dist/`. Consumers never compile WarpKit source.
- **No relative paths in configs**: Always use package names (`@warpkit/errors`), not relative paths (`../../packages/errors`).
- **`workspace:*` resolved at publish**: Internal deps use `workspace:*` during development. The publish pipeline resolves them to actual versions.
- **Type declarations ship**: Every package includes `.d.ts` files in `dist/`. Missing type declarations break consumer TypeScript.
- **No hardcoded versions in templates**: Scaffolding tools (`create-warpkit`) must resolve versions dynamically.

## Navigation Pipeline Discipline

- **9-phase pipeline is sequential**: INITIATE → MATCH → BLOCKERS → BEFORE → DEACTIVATE → LOAD → ON → COMMIT → AFTER. No phase skipping.
- **Hooks can abort**: `beforeNavigate` hooks return `false` to abort. A throwing hook is treated as an abort.
- **Hook errors don't cascade**: Each hook is wrapped in its own try/catch. A failing hook must not prevent other hooks from running (except `onNavigate` where state is indeterminate after a throw).
- **Navigation lifecycle errors surface**: All hook errors must call `reportError()` with `showUI: true`. Navigation errors that result in blank screens are critical bugs.

## Route Config Validation

- **Fail fast on bad config**: Invalid route definitions must throw at definition time (`createRoute()` / `createStateRoutes()`), not at navigation time.
- **Component must be lazy import**: `component: () => import('./Page.svelte')`, never `component: Page`.
- **Layout must be `{ id, load }`**: Layout config validated at definition time for correct shape.
- **Default path must match a route**: Default paths in `createStateRoutes()` that don't match any route in that state must throw.

## Gap Detection

- **Cross-layer capability mismatch**: When one layer supports a feature but another blocks it, that's a **GAP** finding. Example: a route is defined but the component's lazy import is broken, or a package exports an error source that core doesn't handle.
- **Never silently work around a gap**: If a feature doesn't work end-to-end, don't inline logic at the wrong layer to compensate. Flag it immediately.
- **Audit across layers**: When adding a new capability, verify the full path: route definition → navigation → component load → data fetch → render. A feature that works in isolation but fails end-to-end is a gap.
- **Track with specificity**: A gap finding must name: (1) which layer blocks, (2) which layers already support, (3) what the user-visible symptom is.

## Testing Discipline

- **Test from consumer perspective**: If `bun add @warpkit/core` + `bun dev` doesn't work, it's broken.
- **`createMockWarpKit()` for isolation**: Tests use `MemoryBrowserProvider`, not real browser APIs.
- **No timer-based tests**: Use deterministic approaches (manual flush, callbacks). No `setTimeout` waits.
- **No jsdom**: Svelte 5's `mount()` requires a real browser. Use Playwright via vitest-browser-svelte for component tests.
- **Unit tests for logic, browser tests for components**: Pure functions and classes use `bun test`. Components that need DOM use vitest-browser-svelte.
