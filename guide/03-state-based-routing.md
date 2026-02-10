# State-Based Routing

Every web application has states. A user is logged in or logged out. An account is onboarding or fully set up. An admin has elevated privileges or they don't. These states fundamentally change what the user can see and do, yet traditional routers pretend they don't exist.

WarpKit's state-based routing is the core idea that makes everything else work. Instead of defining a flat list of routes and scattering auth checks across your codebase, you organize routes into **states** --- groups that represent meaningful phases of your application. The router enforces these states at the matching level, not as an afterthought bolted on with middleware.

This chapter explains the problem, the solution, and every detail of how to define and work with state-based routes.

---

## The Problem with Traditional Routing

Consider a typical React Router setup:

```tsx
// React Router - routes are flat, state-unaware
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/settings" element={<Settings />} />
  <Route path="/admin/users" element={<AdminUsers />} />
</Routes>
```

This configuration has no concept of application state. The router will happily match `/dashboard` whether the user is logged in or not. To fix that, you add guards:

```tsx
// The "wrapper component" pattern
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return children;
}

// Now you wrap every protected route
<Route path="/dashboard" element={
  <ProtectedRoute><Dashboard /></ProtectedRoute>
} />
```

This works, but it has real problems:

**Guards are scattered and repetitive.** Every protected route needs wrapping. Forget one, and you have a security hole. Add a new route? Remember to add the guard. Every developer on the team needs to know the convention.

**The router doesn't understand intent.** When a logged-out user navigates to `/dashboard`, the router matches the route, loads the component, and *then* the guard kicks in. The route matched successfully --- it's the guard that rejected it. This makes error handling confusing: is it a 404 (route not found) or an auth failure (route found but not allowed)?

**Redirects are ad-hoc.** When a logged-in user hits `/login`, what should happen? You need another check, another redirect, another place to get wrong. And what's the "default" page for a logged-in user? That's scattered across redirect logic, not centralized.

**Testing is harder.** You can't test routing in isolation because route behavior depends on auth state, which depends on context providers, which depend on... everything else.

Vue Router improves on this with navigation guards, but the fundamental issue remains: routes exist in a single flat namespace, and state enforcement is layered on top rather than built in.

```js
// Vue Router - guards are better, but routes are still flat
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return '/login';
  }
});
```

SvelteKit takes a different approach with `+page.server.ts` load functions and hooks, but it's designed for server-rendered multi-page apps. For SPAs, you're back to client-side guard patterns.

---

## How WarpKit Solves This

WarpKit makes application state a **first-class concept in the router**. Routes are organized into states, and the router only considers routes that belong to the current state.

```typescript
import { createWarpKit, createRoute, createStateRoutes } from '@warpkit/core';

type AppState = 'unauthenticated' | 'authenticated' | 'onboarding';

const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [
      createRoute({ path: '/login', component: () => import('./pages/Login.svelte') }),
      createRoute({ path: '/register', component: () => import('./pages/Register.svelte') }),
      createRoute({ path: '/forgot-password', component: () => import('./pages/ForgotPassword.svelte') }),
    ],
    default: '/login',
  },

  onboarding: {
    routes: [
      createRoute({ path: '/welcome', component: () => import('./pages/Welcome.svelte') }),
      createRoute({ path: '/setup-org', component: () => import('./pages/SetupOrg.svelte') }),
      createRoute({ path: '/invite-team', component: () => import('./pages/InviteTeam.svelte') }),
    ],
    default: '/welcome',
  },

  authenticated: {
    routes: [
      createRoute({ path: '/dashboard', component: () => import('./pages/Dashboard.svelte') }),
      createRoute({ path: '/projects', component: () => import('./pages/Projects.svelte') }),
      createRoute({ path: '/projects/[id]', component: () => import('./pages/Project.svelte') }),
      createRoute({ path: '/settings', component: () => import('./pages/Settings.svelte') }),
    ],
    default: '/dashboard',
    layout: {
      id: 'app-layout',
      load: () => import('./layouts/AppLayout.svelte'),
    },
  },
});

const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
});
```

This is different from traditional routing in several important ways:

**Routes belong to states.** `/dashboard` only exists when the app is in the `authenticated` state. It is not merely "protected" --- it is *absent* from the router's route table until the state changes.

**Each state has a default path.** When you transition to `authenticated`, the router knows to navigate to `/dashboard` automatically. No scattered redirect logic.

**State-level layouts apply automatically.** Every route in `authenticated` gets the `app-layout` without wrapping each route individually.

**State mismatches produce specific errors.** If a user somehow navigates to `/dashboard` while in the `unauthenticated` state, the router produces a `STATE_MISMATCH` error, not a generic 404. The error says: "this route exists in the `authenticated` state, but you're in `unauthenticated`." This distinction matters for debugging and for deep link handling.

---

## Defining Routes with createRoute()

The `createRoute()` function creates a typed route definition. It validates the path pattern at construction time, extracts parameter names for TypeScript inference, and provides a `buildPath()` helper for type-safe URL construction.

```typescript
const projectRoute = createRoute({
  path: '/projects/[id]',
  component: () => import('./pages/Project.svelte'),
  meta: { title: 'Project Details' },
});
```

The route object returned has several useful properties:

```typescript
// Type-safe param extraction from a generic params object
const params = projectRoute.getParams({ id: '123', other: 'ignored' });
// params: { id: string } -- TypeScript knows the shape

// Type-safe path construction
const path = projectRoute.buildPath({ id: '123' });
// path: '/projects/123'

// Attempting to build without required params is a compile error:
// projectRoute.buildPath({});
// Error: Property 'id' is missing
```

### Route Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `path` | `string` | Yes | URL pattern with parameter placeholders |
| `component` | `() => Promise<{ default: Component }>` | Yes | Lazy import for the page component |
| `layout` | `LayoutConfig` | No | Route-level layout override (see [Layouts](#layouts)) |
| `meta` | `RouteMeta` | No | Arbitrary metadata (title, permissions, etc.) |

The `component` must be a function that returns a dynamic import. This ensures code splitting --- the component is only loaded when the route is navigated to.

```typescript
// Correct: lazy import (creates a separate chunk)
component: () => import('./pages/Dashboard.svelte')

// Wrong: eager import (bundles everything together)
import Dashboard from './pages/Dashboard.svelte';
component: () => Promise.resolve({ default: Dashboard })
```

### Path Patterns

WarpKit supports several path pattern types. Each pattern type has a specificity score that determines matching priority when multiple routes could match the same URL.

| Pattern | Syntax | Example Path | Matches | Score |
|---------|--------|-------------|---------|-------|
| Static segment | `/about` | `/about` | Exactly `/about` | 100 per segment |
| Required param | `/users/[id]` | `/users/123` | `/users/` + any single segment | 10 per param |
| Optional param | `/users/[id?]` | `/users` or `/users/123` | `/users` with or without a segment | 5 per param |
| Required catch-all | `/docs/[...path]` | `/docs/api/v2/users` | `/docs/` + one or more segments | 2 |
| Optional catch-all | `/docs/[...path?]` | `/docs` or `/docs/api/v2` | `/docs` with or without trailing segments | 1 |

**Static segments are the most specific.** A route like `/users/settings` (score: 200) will always match before `/users/[id]` (score: 110) for the path `/users/settings`. This means you can safely define both without worrying about order:

```typescript
// These can be defined in any order -- specificity scoring handles it
createRoute({ path: '/users/settings', component: () => import('./UserSettings.svelte') }),
createRoute({ path: '/users/[id]', component: () => import('./UserProfile.svelte') }),
```

When two routes have the same specificity score, definition order breaks the tie --- the route defined first wins.

**Optional parameters** make a segment non-required:

```typescript
// Matches both /users and /users/123
createRoute({ path: '/users/[id?]', component: () => import('./Users.svelte') });
```

When the optional segment is absent, the param value is an empty string `''`, not `undefined`. This simplifies component code since you never need null checks on params.

**Catch-all parameters** match multiple path segments:

```typescript
// Matches /docs, /docs/api, /docs/api/v2/users, etc.
createRoute({ path: '/docs/[...slug?]', component: () => import('./Docs.svelte') });
```

The catch-all value includes the slashes: for `/docs/api/v2/users`, the `slug` param is `'api/v2/users'`. Catch-all parameters must be the last segment in the path --- you cannot add segments after them.

### Path Validation

`createRoute()` validates path patterns at construction time. Invalid patterns throw descriptive errors immediately, so you catch configuration mistakes during development, not at runtime:

```typescript
// Throws: "Route path 'dashboard' must start with '/'"
createRoute({ path: 'dashboard', ... });

// Throws: "catch-all parameter [...] must be the last segment"
createRoute({ path: '/docs/[...slug]/page', ... });

// Throws: "invalid parameter syntax '[id!]'"
createRoute({ path: '/users/[id!]', ... });
```

---

## Organizing Routes with createStateRoutes()

The `createStateRoutes<AppState>()` function takes your state-organized route configuration and validates it at startup. The generic parameter `AppState` is a string union that TypeScript uses to ensure every state is defined.

```typescript
type AppState = 'unauthenticated' | 'authenticated';

const routes = createStateRoutes<AppState>({
  unauthenticated: { /* ... */ },
  authenticated: { /* ... */ },
  // TypeScript error if you omit either state
});
```

### State Configuration

Each state has these options:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `routes` | `Route[]` | Yes | Routes available in this state |
| `default` | `string \| ((data) => string) \| null` | Yes | Where to navigate when entering this state |
| `layout` | `LayoutConfig` | No | Layout applied to all routes in this state |
| `redirects` | `Record<string, string>` | No | Path-level redirects within this state |

### Default Paths

The `default` property determines where the user goes when the app transitions to this state.

**Static defaults** are the most common:

```typescript
unauthenticated: {
  routes: [/* ... */],
  default: '/login',
}
```

**Function defaults** use state data to compute the path dynamically. This is essential for multi-tenant apps where the URL includes an org identifier:

```typescript
type StateData = { orgAlias: string };

authenticated: {
  routes: [
    createRoute({ path: '/[orgAlias]/dashboard', component: () => import('./Dashboard.svelte') }),
    createRoute({ path: '/[orgAlias]/projects', component: () => import('./Projects.svelte') }),
  ],
  default: (data: StateData) => `/${data.orgAlias}/dashboard`,
}
```

When the user logs in and state data includes `{ orgAlias: 'acme' }`, the default resolves to `/acme/dashboard`. WarpKit caches resolved function defaults and invalidates the cache when state data changes.

**Null defaults** mean "don't navigate." This is useful for transient states like `initializing` where you don't want any route to render:

```typescript
initializing: {
  routes: [],
  default: null,
}
```

### Redirects

State-level redirects map one path to another within the same state. They are checked before route matching and follow the redirect chain automatically:

```typescript
authenticated: {
  routes: [/* ... */],
  default: '/dashboard',
  redirects: {
    '/': '/dashboard',
    '/home': '/dashboard',
    '/old-settings': '/settings',
  },
}
```

Redirects are validated at startup. Self-referencing redirects throw immediately:

```typescript
// Throws: "Self-referencing redirect '/a' -> '/a' in state 'authenticated'"
redirects: { '/a': '/a' }
```

WarpKit also enforces a maximum redirect depth of 10 to prevent loops that span multiple redirects.

### Startup Validation

`createStateRoutes()` runs several validations when your app starts:

1. **No duplicate paths** within a state --- each path pattern must be unique
2. **Valid path syntax** --- catches typos in bracket notation
3. **Default path warnings** --- warns (in dev mode) if the default path doesn't match any route in the state
4. **No self-referencing redirects** --- prevents obvious infinite loops

These validations catch configuration errors at startup rather than at navigation time, when they'd be harder to debug.

---

## State Transitions

Changing the application state is how you move between phases of your app. Call `setAppState()` with the new state name and optional state data:

```typescript
// Simple state change
await warpkit.setAppState('authenticated');
// Navigates to '/dashboard' (the default for authenticated)

// With state data (for dynamic defaults)
await warpkit.setAppState('authenticated', { orgAlias: 'acme' });
// Navigates to '/acme/dashboard'

// With an explicit path (overrides the default)
await warpkit.setAppState('authenticated', '/settings');
// Navigates to '/settings' instead of the default
```

### What Happens During a State Transition

When you call `setAppState('authenticated')`, WarpKit does the following:

1. **Updates the state machine.** The internal state changes to `'authenticated'`. This increments the state ID, which is used by the navigation pipeline to detect stale navigations.

2. **Resolves the default path.** For string defaults, this is immediate. For function defaults, the function is called with the current state data. The result is cached.

3. **Runs the navigation pipeline.** The resolved path (or the explicit path you provided) goes through the full 9-phase navigation pipeline as a `state-change` navigation type. This means blockers, guards, and hooks all run normally.

4. **Updates the URL and renders.** The matched route's component is loaded, the URL is updated, and the `RouterView` renders the new page.

### Pre-Start Queuing

You can call `setAppState()` before `start()`. This is common when you need to set the initial state based on async initialization (like an auth check):

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
});

// This is queued, not executed immediately
warpkit.setAppState('authenticated', { orgAlias: 'acme' });

// The queued state change runs during start()
await warpkit.start();
```

Queued state changes run in order after providers initialize but before the initial navigation. If an auth adapter is configured, its result is applied first, then queued changes override it.

### The Auth Adapter Pattern

For most apps, state transitions are driven by authentication. Instead of manually calling `setAppState()`, you can provide an auth adapter that handles this automatically:

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  authAdapter: {
    async initialize(context) {
      const session = localStorage.getItem('session');
      if (!session) return { state: 'unauthenticated' };

      const user = await fetchUser(session);
      return {
        state: user.isOnboarded ? 'authenticated' : 'onboarding',
        stateData: { orgAlias: user.defaultOrg },
      };
    },
    onAuthStateChanged(callback) {
      // Subscribe to auth changes (Firebase, Auth0, etc.)
      return onAuthChange((user) => {
        if (user) {
          callback({ state: 'authenticated', stateData: { orgAlias: user.org } });
        } else {
          callback({ state: 'unauthenticated' });
        }
      });
    },
  },
});
```

When an auth adapter is provided, `warpkit.ready` is `false` until initialization completes. This prevents the app from rendering before auth state is known.

---

## Navigation

WarpKit provides several ways to navigate between pages within the current state.

### Programmatic Navigation

```typescript
const warpkit = useWarpKit();

// Basic navigation (push)
await warpkit.navigate('/projects');

// Replace current history entry (no back button)
await warpkit.navigate('/projects', { replace: true });

// Relative navigation
await warpkit.navigate('../settings'); // resolves relative to current path

// History navigation
warpkit.back();     // go back one entry
warpkit.forward();  // go forward one entry
warpkit.go(-2);     // go back two entries
```

### The Link Component

For declarative navigation in templates:

```svelte
<script>
  import { Link } from '@warpkit/core';
</script>

<Link href="/projects">Projects</Link>
<Link href="/settings" replace>Settings</Link>
<Link href="/help" disabled={!isReady}>Help</Link>
```

`Link` renders a standard `<a>` tag with the correct `href`, so it works with right-click "Open in new tab," accessibility tools, and search engines. For internal navigations (left-click without modifier keys), it intercepts the click and uses `warpkit.navigate()` instead of a full page load.

### The NavLink Component

`NavLink` extends `Link` with active state awareness:

```svelte
<script>
  import { NavLink } from '@warpkit/core';
</script>

<nav>
  <NavLink href="/dashboard" activeClass="text-blue-600" exactActiveClass="font-bold">
    Dashboard
  </NavLink>
  <NavLink href="/projects" activeClass="text-blue-600">
    Projects
  </NavLink>
</nav>
```

- `activeClass` is applied when the current path **starts with** the href (partial match)
- `exactActiveClass` is applied when the current path **exactly equals** the href

For example, when the current path is `/projects/123`:
- `NavLink href="/projects"` gets `activeClass` (partial match)
- `NavLink href="/projects/123"` gets both `activeClass` and `exactActiveClass`
- `NavLink href="/dashboard"` gets neither

NavLink also sets `aria-current="page"` on exact matches for accessibility.

### Automatic Path Expansion

When your routes include a leading parameter like `/[orgAlias]/dashboard`, WarpKit can automatically expand short paths using state data:

```typescript
// If authenticated state has route /[orgAlias]/dashboard
// and stateData is { orgAlias: 'acme' }

warpkit.navigate('/dashboard');
// Automatically expands to '/acme/dashboard'
```

This works because the router checks whether the path matches any route directly. If it doesn't, it looks for expandable routes (routes starting with `/[param]/...`) and tries prepending the param value from state data. The expansion is transparent --- components, hooks, and the URL all see the fully expanded path.

### Navigation Results

`navigate()` and `setAppState()` return a `NavigationResult`:

```typescript
const result = await warpkit.navigate('/projects');

if (result.success) {
  console.log('Navigated to:', result.location?.pathname);
} else {
  console.log('Navigation failed:', result.error?.code, result.error?.message);
}
```

---

## Layouts

Layouts wrap route components with shared UI (navigation bars, sidebars, footers). WarpKit supports layouts at two levels.

### State-Level Layouts

A state-level layout applies to every route in that state:

```typescript
authenticated: {
  routes: [/* ... */],
  default: '/dashboard',
  layout: {
    id: 'app-layout',
    load: () => import('./layouts/AppLayout.svelte'),
  },
}
```

The layout component receives `children` as a Svelte 5 snippet:

```svelte
<!-- AppLayout.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="app-layout">
  <nav><!-- sidebar --></nav>
  <main>
    {@render children()}
  </main>
</div>
```

### Route-Level Layouts

Individual routes can override the state-level layout:

```typescript
createRoute({
  path: '/settings',
  component: () => import('./pages/Settings.svelte'),
  layout: {
    id: 'settings-layout',
    load: () => import('./layouts/SettingsLayout.svelte'),
  },
})
```

Route-level layouts take priority over state-level layouts. If a route specifies no layout and the state has one, the state layout is used. If neither specifies a layout, the route renders without any wrapper.

### Layout Identity and Caching

Layouts use an explicit `id` string for identity. When navigating between routes that share the same layout ID, WarpKit **does not remount the layout component**. It reuses the existing instance, which means:

- Layout state (open sidebars, scroll positions within the layout) is preserved
- Animations don't flicker between pages
- Expensive layout components aren't re-created on every navigation

The layout is only unmounted and remounted when transitioning to a route with a *different* layout ID (or no layout at all).

```typescript
// These two routes share the same layout instance
createRoute({ path: '/projects', layout: { id: 'app', load: ... } }),
createRoute({ path: '/settings', layout: { id: 'app', load: ... } }),

// This route has a different layout (app layout unmounts, admin layout mounts)
createRoute({ path: '/admin', layout: { id: 'admin', load: ... } }),
```

---

## Guards

State-based routing eliminates most guard use cases. If `/dashboard` only exists in `authenticated` state, you don't need a guard to check if the user is logged in --- the router handles it. But guards are still useful for fine-grained access control *within* a state.

WarpKit implements guards through `beforeNavigate` hooks:

```typescript
// Admin page guard
const unsubscribe = warpkit.beforeNavigate((context) => {
  if (context.to.pathname.startsWith('/admin') && !currentUser.isAdmin) {
    return '/unauthorized'; // redirect
  }
  // return void to allow, false to abort
});
```

### Why Both States AND Guards?

This is defense in depth:

- **States** handle the broad strokes: logged in vs. logged out, onboarding vs. active. They're structural --- they change which routes exist in the route table.
- **Guards** handle fine-grained checks: admin access, feature flags, subscription tiers. They're behavioral --- they run logic before allowing a matched route to load.

Think of states as walls and guards as doors. The walls define the rooms of your application. The doors add conditional access within those rooms.

### Guard Return Values

A `beforeNavigate` hook can return three things:

| Return | Effect |
|--------|--------|
| `void` or `true` | Allow navigation to continue |
| `false` | Abort navigation (produces ABORTED error) |
| `string` | Redirect to that path |

Multiple hooks run in **parallel**. If any hook returns `false`, navigation aborts regardless of what other hooks return. If no hook aborts but one returns a redirect, the redirect is followed. This "abort wins" rule ensures security checks can't be overridden by other hooks.

---

## Navigation Blockers

Blockers prevent navigation when the user has unsaved changes. Unlike guards (which check permissions), blockers check component state.

```typescript
const { unregister } = warpkit.registerBlocker(() => {
  if (hasUnsavedChanges) {
    return 'You have unsaved changes. Leave anyway?';
  }
  // Return void/false to allow navigation
});

// Clean up when the component is destroyed
onDestroy(() => unregister());
```

When a blocker returns a string, WarpKit shows a confirmation dialog using the confirm dialog provider (which defaults to `window.confirm()` but can be replaced with a custom modal).

### Browser Tab Close

Blockers also integrate with the browser's `beforeunload` event. If any blocker returns a truthy value, the browser shows its built-in "Leave site?" dialog when the user tries to close the tab or navigate away from the app entirely:

```typescript
// This single registration handles both:
// 1. In-app navigation blocking (shows your confirm dialog)
// 2. Tab close blocking (shows browser's built-in dialog)
warpkit.registerBlocker(() => {
  if (form.isDirty) return 'Unsaved changes will be lost.';
});
```

### Blocker Return Values

| Return | Effect |
|--------|--------|
| `void`, `false`, `undefined` | Allow navigation |
| `true` | Block silently (no dialog) |
| `string` | Show confirmation dialog with this message |

---

## Scroll Restoration

WarpKit automatically manages scroll positions. When you navigate forward, the page scrolls to the top. When you navigate back, the page restores to where you were.

This is handled by the storage provider, which saves scroll positions keyed by navigation ID. An LRU (least recently used) cache evicts old positions when the limit is reached (default: 50 entries).

You can control scroll behavior per-navigation:

```typescript
// Preserve current scroll (useful for tab changes)
warpkit.navigate('/page?tab=settings', { scrollPosition: 'preserve' });

// Scroll to specific position
warpkit.navigate('/page', { scrollPosition: { x: 0, y: 500 } });

// Default: scroll to top (forward) or restore (back)
warpkit.navigate('/page');
```

Hash navigation scrolls to the element with the matching ID:

```typescript
warpkit.navigate('/docs#installation');
// Scrolls to <h2 id="installation">
```

---

## Error Handling

Navigation can fail in several ways. WarpKit uses specific error codes so you can handle each case appropriately.

| Error Code | When It Happens | Visual? |
|------------|----------------|---------|
| `NOT_FOUND` | Path doesn't match any route in any state | Yes |
| `STATE_MISMATCH` | Path matches a route in a different state | Yes |
| `LOAD_FAILED` | Component or layout import failed (network error) | Yes |
| `TOO_MANY_REDIRECTS` | More than 10 redirects in a chain | Yes |
| `CANCELLED` | A newer navigation superseded this one | No |
| `BLOCKED` | User declined the navigation blocker dialog | No |
| `ABORTED` | A `beforeNavigate` hook returned `false` | Yes |
| `RENDER_ERROR` | Component loaded but threw during render | Yes |

"Visual" errors are displayed by `RouterView`. "Non-visual" errors are flow control outcomes that don't need user-facing UI.

### Handling Errors in RouterView

```svelte
<RouterView>
  {#snippet loading()}
    <LoadingSpinner />
  {/snippet}

  {#snippet error({ error, retry })}
    {#if error?.code === 6}
      <!-- LOAD_FAILED: network issue, offer retry -->
      <div>
        <p>Failed to load page. Check your connection.</p>
        <button onclick={retry}>Try Again</button>
      </div>
    {:else if error?.code === 4}
      <!-- NOT_FOUND -->
      <NotFoundPage />
    {:else}
      <p>Something went wrong: {error?.message}</p>
    {/if}
  {/snippet}
</RouterView>
```

### Global Error Handler

For error reporting (Sentry, LogRocket, etc.), use the `onError` config:

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  onError(error, context) {
    // Only report unexpected errors, not normal flow control
    if (error.code !== NavigationErrorCode.CANCELLED
      && error.code !== NavigationErrorCode.BLOCKED) {
      Sentry.captureException(error.cause ?? new Error(error.message), {
        extra: { from: context.from?.path, to: error.requestedPath },
      });
    }
  },
});
```

### Retry After Load Failure

When a component fails to load (network error, chunk missing after deploy), the user can retry:

```typescript
// Programmatic retry
await warpkit.retry();
// Re-runs navigation to the current path with replace semantics
```

Or through the `RouterView` error snippet, which receives a `retry` function.

---

## Reactive Page State

The `page` object provides reactive access to the current navigation state. In Svelte 5, these are `$state` fields that trigger re-renders automatically:

```svelte
<script>
  import { usePage } from '@warpkit/core';
  const page = usePage();
</script>

<p>Path: {page.pathname}</p>
<p>Params: {JSON.stringify(page.params)}</p>
<p>Loading: {page.isNavigating}</p>
<p>Error: {page.error?.message ?? 'none'}</p>
<p>State: {page.appState}</p>
```

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Full path including search and hash |
| `pathname` | `string` | Path without search or hash |
| `search` | `SvelteURLSearchParams` | Reactive search params |
| `hash` | `string` | URL hash fragment |
| `params` | `Record<string, string>` | Route parameters |
| `route` | `Route \| null` | Currently matched route |
| `appState` | `string` | Current app state name |
| `isNavigating` | `boolean` | True during navigation |
| `error` | `NavigationError \| null` | Current navigation error |

---

## Search Params

For lightweight URL updates (filters, tabs, pagination) that don't need a full navigation, use `updateSearch()`:

```typescript
const warpkit = useWarpKit();

// Add/update a search param (replaces history by default)
warpkit.updateSearch({ tab: 'settings' });
// URL: /page?tab=settings

// Remove a param by passing null
warpkit.updateSearch({ tab: null });

// Push new history entry instead of replacing
warpkit.updateSearch({ page: '2' }, { replace: false });
```

`updateSearch()` does not run the navigation pipeline. It updates the URL and `PageState.search` reactively, but does not trigger hooks, blockers, or component loading. Use `navigate()` for actual page changes.

---

## Compared to Other Frameworks

### React Router

React Router v6 uses flat routes with wrapper components for protection. There is no concept of application state at the router level. Auth checks are scattered across `<ProtectedRoute>` wrappers or `loader` functions. The router matches routes eagerly and relies on component-level logic to redirect.

WarpKit's approach means the router never matches a route that shouldn't exist in the current state. There are no wrappers, no loaders checking auth, no possibility of forgetting a guard.

### Vue Router

Vue Router has global and per-route navigation guards, which is a significant improvement over React Router. However, routes still exist in a single flat namespace. Guards run after matching, meaning the router finds the route and then decides whether to allow it. This works, but the error model is less precise --- a guard rejection and a genuine 404 look similar.

WarpKit's state mismatch error explicitly tells you "this route exists but not in your current state," which is actionable information that a generic 404 is not.

### TanStack Router

TanStack Router adds type-safe routes and search params, which WarpKit also provides. But like React Router, it organizes routes by URL hierarchy rather than application state. Auth is handled through `beforeLoad` functions on route definitions, which is cleaner than wrapper components but still per-route.

### SvelteKit

SvelteKit is designed for server-rendered multi-page applications. Its routing model is file-system based, and auth checks happen in `+page.server.ts` load functions or `hooks.server.ts`. For SPAs, SvelteKit's routing model doesn't apply cleanly --- there's no server to run load functions, and the file-system convention doesn't map to state-based organization.

WarpKit is purpose-built for client-side SPAs where the routing model needs to understand application state natively.

---

## Next Steps

Now that you understand how routes are organized by state, the next chapter explains what happens when a navigation is triggered: [The Navigation Pipeline](./04-navigation-pipeline.md) details the 9 phases that every navigation passes through, from path resolution to scroll restoration.
