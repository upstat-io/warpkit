# WarpKit — Development Rules

## Project Overview

- **Package**: `@warpkit/core` — Svelte 5 SPA framework (state-driven routing, navigation lifecycle, provider architecture)
- **Repo**: https://github.com/upstat-io/warpkit
- **Runtime**: Bun (never Node/npm for running — `bun test`, `bun run`, `bun add`)
- **Language**: TypeScript strict, Svelte 5 runes
- **Monorepo**: `packages/*` workspace packages under `@warpkit/*` scope

## Critical Rules

- **Ship compiled JS** — every package MUST have a build step; consumers never compile our source
- **Framework-agnostic** — no consumer-specific code, concepts, or coupling
- **No relative paths in docs/configs** — always use package names
- **No hardcoded versions in templates** — scaffolding tools must resolve versions dynamically
- **Fix ALL errors immediately** — no "pre-existing" or "unrelated" errors; stop and fix now
- **Test from consumer perspective** — if `bun add @warpkit/core` + `bun dev` doesn't work, it's broken

## Package Architecture

| Package | Description | Has Svelte files |
|---------|-------------|-----------------|
| `@warpkit/core` | Router, state machine, navigation, events, components | Yes (.svelte, .svelte.ts) |
| `@warpkit/data` | DataClient, useQuery, useMutation, cache invalidation | Yes (.svelte.ts) |
| `@warpkit/forms` | useForm, deep proxy binding, StandardSchema validation | Yes (.svelte.ts) |
| `@warpkit/cache` | MemoryCache, StorageCache, ETagCacheProvider | No |
| `@warpkit/errors` | Error reporting channel and utilities | No |
| `@warpkit/types` | Shared TypeScript type definitions | No |
| `@warpkit/validation` | StandardSchema wrapper (TypeBox, Zod, Valibot) | No |
| `@warpkit/websocket` | SocketClient, rooms, auto-reconnection | No |
| `@warpkit/auth-firebase` | Firebase auth adapter | No |
| `@warpkit/vite-plugin` | Vite plugin (HMR, warmup, error overlay) | No |
| `create-warpkit` | Project scaffolding CLI (unscoped) | No |

## Svelte 5 Runes

- `$state<T>(initial)` — reactive state
- `$derived(expr)` / `$derived.by(() => { ... })` — computed values
- `$effect(() => { ... return cleanup })` — side effects
- `$props()` with `interface Props` — component props
- `$state` in `.svelte.ts` files — module-level reactive state
- NEVER destructure reactive objects (breaks reactivity)
- Use Snippet API, not slots: `children: Snippet`, `{@render children()}`

## Component Patterns

- **Pages**: manage data (useQuery, useMutation), pass to feature components
- **Feature components**: presentational, receive props, derive display state
- **UI components**: reusable, `$props()` with `interface Props`
- **Layouts**: `children: Snippet`, `{@render children()}`
- `data-testid` on all interactive elements
- Callbacks not boolean flags: `onclick`, `onSuccess`, `onError`

## File Naming

- `.svelte` — Svelte components (PascalCase)
- `.svelte.ts` — files using runes (stores, hooks, reactive state)
- `.ts` — pure TypeScript (no runes)
- `.spec.ts` — unit tests (bun test)
- `.browser.spec.ts` — browser component tests (vitest-browser-svelte)

## Testing

- **Unit tests**: `bun test src` — pure logic, classes, utilities
- **Package tests**: `bun run test:packages` — vitest for workspace packages
- **Browser tests**: `bun run test:browser` — vitest-browser-svelte + Playwright
- `createMockWarpKit()` with MemoryBrowserProvider for isolated testing
- `renderWithWarpKit()` renders component within WarpKitProvider context
- NO timer-based tests — use deterministic approaches (manual flush, callbacks)
- NO jsdom — Svelte 5's mount() requires real browser (Playwright)

## Build & Publish

- **CI**: GitHub Actions — typecheck → unit tests → package tests
- **Publish**: Tag-triggered (`v*`) via OIDC trusted publishing (no npm tokens)
- **Versions**: Set from git tag; `workspace:*` deps resolved to version at publish time
- Packages publish in dependency order (types/errors first, core last)
- All packages must build to `dist/` before publish

## Quality Gates

- `bun run typecheck` — zero errors (warnings OK in test files)
- `bun run test` — all pass
- `bun run test:packages` — all pass
- PR required for main (CI must pass, 1 approval)

## Navigation Pipeline (9 phases)

1. INITIATE — generate navigationId, capture stateId
2. MATCH ROUTE — find matching route, handle redirects
3. CHECK BLOCKERS — run navigation blockers (unsaved changes)
4. BEFORE NAVIGATE — run beforeNavigate hooks (parallel, can abort/redirect)
5. DEACTIVATE CURRENT — save scroll position
6. LOAD & ACTIVATE — load component/layout async (dynamic import)
7. ON NAVIGATE — run onNavigate hooks (sequential, View Transitions API)
8. COMMIT — update browser history
9. AFTER NAVIGATE — set isNavigating=false, fire afterNavigate hooks

## State Machine

- Simple custom FSM (not XState)
- Tracks current state + stateId (increments on transition)
- `createStateRoutes<AppState>()` groups routes by state
- `warpkit.setAppState(state, stateData)` to transition
- State determines which routes are accessible

## Route Definitions

- `createRoute({ path, component, layout?, meta? })`
- Param syntax: `[id]` required, `[id?]` optional, `[...rest]` catch-all
- Dynamic defaults: `default: (data) => '/${data.slug}/'`
- Layouts lazy-loaded: `load: () => import('./AppLayout.svelte')`

## Provider Abstraction

- `BrowserProvider` — abstracts window/history/location (testable)
- `StorageProvider` — abstracts localStorage
- `ConfirmDialogProvider` — abstracts window.confirm
- Use `MemoryBrowserProvider` in tests
