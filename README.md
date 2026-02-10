# WarpKit

> **Alpha Software** — WarpKit is being built and used in production by [Upstat](https://upstat.io) to power their own application. While this real-world usage drives rapid improvements, the framework is still early stage. Use at your own risk. APIs and behaviors are subject to change.

A standalone Svelte 5 SPA framework providing state-based routing, data fetching, forms, and real-time capabilities.

## Features

- **State-Based Routing** - Routes organized by application state (unauthenticated, onboarding, authenticated)
- **Navigation Pipeline** - Every navigation flows through 10 predictable phases with guards and middleware
- **Auth-Provider Agnostic** - Bring your own auth adapter (Firebase, Auth0, custom)
- **Config-Driven Data Layer** - E-Tag caching, stale-while-revalidate, automatic refetching
- **Schema-Driven Forms** - Deep proxy binding with StandardSchema validation (TypeBox, Zod)
- **Real-Time WebSockets** - Type-safe messages, rooms, automatic reconnection
- **Pluggable Provider System** - Swap browser APIs for testing or custom implementations
- **Generic Type System** - Extend with your own user and data types

## Packages

| Package | Description |
| ------- | ----------- |
| `@warpkit/core` | Router, state machine, events, components |
| `@warpkit/data` | Data fetching, caching, mutations |
| `@warpkit/cache` | Cache implementations (Memory, Storage, E-Tag) |
| `@warpkit/forms` | Schema-driven form state management |
| `@warpkit/validation` | StandardSchema validation (Zod, TypeBox) |
| `@warpkit/websocket` | WebSocket client with reconnection |
| `@warpkit/auth-firebase` | Firebase authentication adapter |
| `@warpkit/types` | Shared TypeScript types |

## Installation

```bash
npm install @warpkit/core @warpkit/data @warpkit/cache
```

Optional packages:

```bash
npm install @warpkit/forms @warpkit/validation
npm install @warpkit/websocket
npm install @warpkit/auth-firebase firebase
```

## Quick Start

### 1. Define Routes

```typescript
import { createRoute, createStateRoutes } from '@warpkit/core';

type AppState = 'authenticated' | 'unauthenticated';

export const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [
      createRoute({
        path: '/login',
        component: () => import('./pages/Login.svelte'),
        meta: { title: 'Login' }
      })
    ],
    default: '/login'
  },
  authenticated: {
    routes: [
      createRoute({
        path: '/dashboard',
        component: () => import('./pages/Dashboard.svelte'),
        meta: { title: 'Dashboard' }
      }),
      createRoute({
        path: '/settings',
        component: () => import('./pages/Settings.svelte'),
        meta: { title: 'Settings' }
      })
    ],
    default: '/dashboard'
  }
});
```

### 2. Create WarpKit Instance

```typescript
import { createWarpKit } from '@warpkit/core';
import { routes } from './routes';

export const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated'
});
```

### 3. Set Up App Component

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { WarpKitProvider, RouterView } from '@warpkit/core';
  import { warpkit } from './warpkit';

  $effect(() => {
    warpkit.start();
    return () => warpkit.destroy();
  });
</script>

<WarpKitProvider {warpkit}>
  <RouterView />
</WarpKitProvider>
```

### 4. Navigate

```svelte
<script lang="ts">
  import { Link, useWarpKit } from '@warpkit/core';

  const warpkit = useWarpKit();

  function handleLogin() {
    warpkit.setState('authenticated');
  }
</script>

<Link href="/settings">Settings</Link>
<button onclick={handleLogin}>Login</button>
```

## What WarpKit Does NOT Provide

WarpKit is intentionally minimal. These concerns are left to consumers:

- **Title Management** - Update `document.title` yourself based on route meta
- **Focus Management** - Handle accessibility announcements yourself
- **Error Boundary UI** - Provide your own error handling UI

## Requirements

- Svelte 5.0.0+
- Node.js 18+

## Documentation

### Guide

The [WarpKit Guide](./guide/README.md) is a comprehensive walkthrough covering everything from first setup to advanced architecture:

1. [Introduction & Philosophy](./guide/01-introduction.md) — What WarpKit is, why it exists, and the design principles behind it
2. [Quick Start](./guide/02-quick-start.md) — Get a WarpKit app running in 5 minutes
3. [State-Based Routing](./guide/03-state-based-routing.md) — The core innovation: routes organized by application state
4. [The Navigation Pipeline](./guide/04-navigation-pipeline.md) — How every navigation flows through 10 predictable phases
5. [The Provider System](./guide/05-provider-system.md) — Pluggable abstractions for browser APIs
6. [Data Fetching & Caching](./guide/06-data-fetching.md) — Config-driven data layer with E-Tag caching
7. [Forms & Validation](./guide/07-forms.md) — Schema-driven forms with deep proxy binding
8. [WebSockets & Real-Time](./guide/08-websockets.md) — Type-safe real-time communication
9. [Authentication](./guide/09-authentication.md) — Pluggable auth adapter pattern
10. [Testing](./guide/10-testing.md) — Mock providers, assertion helpers, and testing strategies
11. [Architecture & Design Decisions](./guide/11-architecture.md) — Why WarpKit is built the way it is

### API Reference

The [API docs](./docs/_llms.md) cover package internals, components, providers, and testing utilities.

## License

[MIT](LICENSE)
