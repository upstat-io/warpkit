# Introduction & Philosophy

Every few years, the frontend ecosystem goes through a routing renaissance. File-based routing. Nested layouts. Server-side rendering. Each wave optimizes for a particular class of application. But there is a large and underserved class of application that keeps getting treated as an afterthought: the pure single-page application.

Dashboards. Admin panels. Internal tools. Monitoring consoles. CRMs. Project management apps. These applications share a common trait -- they live entirely behind authentication, they never need SEO, and their routing requirements are fundamentally different from a blog or a marketing site.

WarpKit is a modular Svelte 5 framework built specifically for these applications.

## What Is WarpKit?

WarpKit provides the infrastructure layer that every non-trivial SPA eventually needs to build from scratch:

- **State-based routing** -- Routes are organized by application state (authenticated, unauthenticated, onboarding), not just URL patterns. The router knows which routes are valid at any given moment and automatically handles transitions between states.

- **Type-safe data fetching** -- A config-driven data layer with E-Tag caching, stale-while-revalidate, and event-based cache invalidation. Define your data keys once, get type inference everywhere.

- **Schema-driven forms** -- Form state management with a deep proxy system that enables Svelte 5's `bind:value` to work directly on nested objects. Validation via StandardSchema means you can use TypeBox, Zod, Valibot, or any compliant library.

- **Real-time WebSocket support** -- A WebSocket client with automatic reconnection, full-jitter exponential backoff, type-safe message definitions, room subscriptions, and browser-aware connection management (pause when tab is hidden, reconnect when online).

- **Pluggable auth adapter pattern** -- WarpKit does not ship with a specific auth provider hardcoded in. You provide an adapter that tells WarpKit how to check for existing sessions, listen for auth changes, and sign out. A Firebase adapter is available as a separate package.

Here is what the key imports look like:

```typescript
// Core routing and components
import { createWarpKit, createRoute, createStateRoutes } from '@warpkit/core';
import { useWarpKit, usePage } from '@warpkit/core';
import { Link, RouterView, WarpKitProvider } from '@warpkit/core';

// Data fetching
import { DataClient, useData, useMutation } from '@warpkit/data';

// Forms
import { useForm } from '@warpkit/forms';

// WebSocket
import { SocketClient } from '@warpkit/websocket';
```

If you have used React Router, TanStack Router, or SvelteKit's routing, you will find WarpKit familiar in many ways -- but fundamentally different in one: the router is aware of your application's state, not just its URLs.

## Why WarpKit Exists

The Svelte ecosystem has an excellent meta-framework in SvelteKit. If you are building a public-facing website that needs server-side rendering, SEO optimization, and file-based routing, SvelteKit is the right choice. Full stop.

But SvelteKit is designed around a server-centric model. Every route can have a `load` function that runs on the server. Pages are pre-rendered or server-rendered. The routing is file-based, mapping filesystem paths to URL paths. This architecture is powerful for content-driven websites, but it creates friction for applications that are purely client-side:

- **You do not need SSR** for a dashboard that requires login. There is no SEO benefit. There is no first-paint improvement for a page that shows a loading spinner until the user's data arrives anyway.

- **You do not need file-based routing** when your route structure is determined by application state. In a typical SPA, the routes available to an unauthenticated user are completely different from those available to an authenticated user. File-based routing does not express this distinction.

- **You need client-side state awareness.** When a user logs in, you want the router to automatically navigate to their dashboard. When they log out, you want it to redirect to the login page. When they are mid-onboarding, you want to restrict them to onboarding routes. This is not URL routing -- it is state-based routing.

- **You need a real data layer.** SPAs make dozens of API calls per page. You need caching, E-Tag support, stale-while-revalidate, and event-driven invalidation. SvelteKit's `load` functions solve this on the server side, but a pure SPA needs these capabilities on the client.

- **You need form management at scale.** A monitoring dashboard might have forms for creating monitors, configuring alerts, setting up escalation policies, and editing status pages. Each form needs validation, dirty tracking, array field operations, and submit handling. This is a framework concern, not something each page should reinvent.

Other SPA-oriented frameworks in the broader ecosystem -- React Router, TanStack Router, Vue Router -- solve routing well but treat it as a URL-matching problem. They do not have a concept of application state determining which routes are valid. You end up writing ad-hoc auth checks in every route, or wrapping groups of routes in auth guard components, or building a custom state machine on top of the router. WarpKit makes this the primary abstraction.

## Design Principles

WarpKit is built on six principles that inform every API decision:

### 1. State First

Application state determines available routes, not just URLs. This is the core insight that separates WarpKit from other routing solutions.

In a traditional router, you define routes as URL patterns and then bolt on auth checks:

```typescript
// Traditional approach: routes are just URLs, auth is an afterthought
const routes = [
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard, beforeEnter: requireAuth },
  { path: '/settings', component: Settings, beforeEnter: requireAuth },
];
```

In WarpKit, routes are organized by application state:

```typescript
// WarpKit: routes belong to states
const routes = createStateRoutes<'authenticated' | 'unauthenticated'>({
  unauthenticated: {
    routes: [
      createRoute({ path: '/login', component: () => import('./Login.svelte') })
    ],
    default: '/login'
  },
  authenticated: {
    routes: [
      createRoute({ path: '/dashboard', component: () => import('./Dashboard.svelte') }),
      createRoute({ path: '/settings', component: () => import('./Settings.svelte') })
    ],
    default: '/dashboard'
  }
});
```

When the application is in the `unauthenticated` state, `/dashboard` simply does not exist. There is no guard to bypass, no race condition to exploit, no forgotten `beforeEnter` on a new route. The router will not match it. If a user tries to navigate there, they get the default path for their current state.

When you call `warpkit.setState('authenticated')`, the router transitions to the authenticated state and navigates to its default path. When you call `warpkit.setState('unauthenticated')`, it transitions back and navigates to the login page. The state machine handles the plumbing.

### 2. Type Safety

WarpKit provides full TypeScript inference throughout. Route parameters are inferred from path patterns. Data fetching keys are type-checked against a registry. Form values are typed against their schema. Event payloads are type-safe.

```typescript
// Route params inferred from path
const route = createRoute({
  path: '/projects/[projectId]/tasks/[taskId]',
  component: () => import('./Task.svelte'),
  meta: { title: 'Task' }
});

// TypeScript knows this needs { projectId: string, taskId: string }
route.buildPath({ projectId: '1', taskId: '2' });
```

### 3. Testability

Every browser API that WarpKit touches is behind a provider interface. The router does not call `window.history.pushState` directly. It calls `browserProvider.pushState()`. This means you can swap in a `MemoryBrowserProvider` during tests and run your entire navigation pipeline without a browser.

```typescript
// In production: uses real browser history
const warpkit = createWarpKit({ routes, initialState: 'unauthenticated' });

// In tests: uses in-memory history
const warpkit = await createMockWarpKit({
  routes,
  initialState: 'authenticated',
  initialPath: '/dashboard'
});
```

The confirm dialog, storage, and browser history are all pluggable. This is not just for testing -- it also enables hash-based routing, custom storage backends, and alternative confirmation UIs.

### 4. Svelte 5 Native

WarpKit is built from the ground up for Svelte 5 runes. It uses `$state` for reactive page state, `$derived` for computed values, and `$effect` for lifecycle management. There are no Svelte 4 stores anywhere in the codebase.

This means WarpKit's reactivity follows Svelte 5 conventions. Page state is a reactive object. Form data is a reactive proxy. Data fetching states are reactive properties. Everything works with Svelte 5's fine-grained reactivity system.

### 5. Generic

WarpKit has zero opinions about your User type, your API shape, your auth provider, or your backend. The core framework uses generics throughout:

```typescript
// You provide your state type
type AppState = 'authenticated' | 'unauthenticated' | 'onboarding';

// You provide your state data type
interface AppStateData {
  projectAlias: string;
  cacheScope: string;
}

// WarpKit infers from your types
const warpkit = new WarpKit<AppState, AppStateData>({ ... });
```

The auth adapter is an interface you implement. The data registry is a module augmentation you define. WarpKit provides the infrastructure; you provide the domain types.

### 6. Modular

WarpKit is split into focused packages. `@warpkit/core` provides routing, state management, events, and components. `@warpkit/data` provides the data layer. `@warpkit/forms` provides form management. `@warpkit/websocket` provides WebSocket support.

Only `@warpkit/core` is required. Everything else is opt-in. If your app does not need WebSocket support, do not install `@warpkit/websocket`. If you manage forms with a different library, skip `@warpkit/forms`.

| Package | Purpose | Required |
|---------|---------|----------|
| `@warpkit/core` | Router, state machine, events, components | Yes |
| `@warpkit/data` | Data fetching, caching, mutations | No |
| `@warpkit/cache` | MemoryCache, StorageCache, ETagCacheProvider | No (used by @warpkit/data) |
| `@warpkit/forms` | Schema-driven form state management | No |
| `@warpkit/validation` | StandardSchema validation utilities | No (used by @warpkit/forms) |
| `@warpkit/websocket` | WebSocket client with reconnection | No |
| `@warpkit/auth-firebase` | Firebase authentication adapter | No |
| `@warpkit/types` | Shared TypeScript types | No |

## Comparison to Alternatives

### WarpKit vs. SvelteKit

SvelteKit is a full-stack meta-framework. It handles server-side rendering, static site generation, API routes, form actions, and file-based routing. It is the default choice for Svelte applications and the right tool for most websites.

WarpKit is a client-only SPA framework. It handles client-side routing, data fetching, forms, and real-time updates. It runs entirely in the browser.

| Concern | SvelteKit | WarpKit |
|---------|-----------|---------|
| Rendering | SSR, SSG, ISR | Client-only (SPA) |
| Routing | File-based, URL patterns | Code-defined, state-based |
| Data loading | Server `load` functions | Client-side with caching |
| Auth | Manual guards per route | State-based (routes per state) |
| Forms | Form actions (server) | Client-side with StandardSchema |
| Real-time | Build your own | Built-in WebSocket client |
| SEO | Built-in | Not applicable |

**Use SvelteKit** if your app needs SEO, server rendering, or public-facing pages.
**Use WarpKit** if your app is a pure SPA behind authentication.

### WarpKit vs. React Router / TanStack Router

React Router and TanStack Router are excellent URL-based routers with support for nested layouts, loaders, and actions. They share WarpKit's SPA-first approach but differ in a fundamental way: they treat routing as a URL-matching problem.

In React Router, auth protection is typically done with wrapper components:

```tsx
// React Router: auth is a wrapper, not a routing concept
<Route path="/dashboard" element={
  <RequireAuth>
    <Dashboard />
  </RequireAuth>
} />
```

In WarpKit, auth protection is structural. The dashboard route only exists when the app is in the authenticated state. There is no wrapper to forget, no guard to bypass.

TanStack Router adds type-safe route parameters and search params, which WarpKit also provides. But neither React Router nor TanStack Router has a concept of application states that determine which routes are available.

### WarpKit vs. Next.js / Nuxt

Next.js and Nuxt are full-stack frameworks for React and Vue respectively. They are comparable to SvelteKit, not to WarpKit. If you are considering Next.js or Nuxt, the comparison is really about whether you want SSR (use those frameworks) or a pure SPA (consider WarpKit, if you are using Svelte 5).

## When to Use WarpKit

WarpKit is designed for applications that share these characteristics:

- **Behind authentication.** The user logs in before seeing any content. There is no public-facing page that needs SEO.
- **State-driven routing.** Different users in different states (logged in, onboarding, admin) see different sets of routes.
- **Rich data requirements.** Multiple API calls per page, caching needed, real-time updates desired.
- **Complex forms.** Multi-step forms, dynamic array fields, cross-field validation, forms on many pages.

Concrete examples:
- Monitoring dashboards (Datadog, Grafana)
- Project management tools (Linear, Jira)
- Admin panels and back-office tools
- CRM applications
- Internal developer tools
- Real-time collaborative applications

## When NOT to Use WarpKit

WarpKit is the wrong choice for:

- **SEO-critical public websites.** Use SvelteKit. WarpKit renders everything on the client; search engines may not index your content properly.
- **Static blogs or documentation sites.** Use SvelteKit, Astro, or a static site generator. WarpKit is overkill for content that does not change based on user state.
- **Marketing pages.** Use SvelteKit with SSR. Marketing pages need fast initial paint and SEO.
- **Hybrid apps that need both SSR and SPA sections.** Use SvelteKit for the whole thing, or SvelteKit for public pages with a WarpKit-powered SPA for the authenticated section.

## What WarpKit Does NOT Provide

WarpKit is intentionally focused. These concerns are left to you:

- **Title management** -- Update `document.title` based on route meta yourself.
- **Focus management** -- Handle accessibility announcements for route changes.
- **Error boundary UI** -- Provide your own error handling components.
- **CSS framework** -- WarpKit has no opinions about styling.
- **Build tooling** -- Use Vite (recommended), or any bundler that supports Svelte 5.

## Requirements

- Svelte 5.0.0 or later
- TypeScript (strongly recommended; WarpKit is designed for TypeScript)
- A bundler that supports dynamic imports (Vite recommended)

## Next Steps

Ready to build something? Head to [Quick Start](./02-quick-start.md) to get a WarpKit application running in five minutes.
