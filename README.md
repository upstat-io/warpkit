# WarpKit

A standalone Svelte 5 SPA framework providing state-based routing, data fetching, forms, and real-time capabilities.

## Features

- **Auth-Provider Agnostic** - Bring your own auth adapter (Firebase, Auth0, custom)
- **Generic Type System** - Extend with your own user and data types
- **Modular Packages** - Use only what you need
- **Built-in State Machine** - Simple FSM for app state management
- **State-Based Routing** - Routes organized by application state

## Packages

| Package | Description |
| ------- | ----------- |
| `@warpkit/core` | Router, state machine, events, components |
| `@warpkit/data` | Data fetching, caching, E-Tag support |
| `@warpkit/cache` | Cache implementations (Memory, Storage, E-Tag) |
| `@warpkit/forms` | Form state, validation, array operations |
| `@warpkit/validation` | StandardSchema validation (Zod, TypeBox) |
| `@warpkit/websocket` | WebSocket client with reconnection |
| `@warpkit/auth-firebase` | Firebase authentication adapter |
| `@warpkit/types` | Shared TypeScript types |

## What WarpKit Provides

- **Router** - Path matching, navigation, guards, layouts
- **State Machine** - Simple FSM for app state transitions
- **Data Layer** - E-Tag caching, stale-while-revalidate
- **Forms** - Schema-driven form state with deep proxy binding
- **Events** - Type-safe pub/sub event emitter
- **WebSocket** - Reconnection, rooms, type-safe messages
- **Auth Adapter** - Generic auth provider interface

## What WarpKit Does NOT Provide

WarpKit is intentionally minimal. These concerns are left to consumers:

- **Title Management** - Update `document.title` yourself based on route meta
- **Focus Management** - Handle accessibility announcements yourself
- **Error Boundary UI** - Provide your own error handling UI

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
// routes.ts
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
// warpkit.ts
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
    // Transition to authenticated state
    warpkit.setState('authenticated');
  }
</script>

<Link href="/settings">Settings</Link>
<button onclick={handleLogin}>Login</button>
```

## Data Fetching

```typescript
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

const client = new DataClient({
  baseUrl: '/api',
  keys: {
    'users': { key: 'users', url: '/users' },
    'users/:id': { key: 'users/:id', url: '/users/:id' }
  }
}, {
  cache: new ETagCacheProvider()
});
```

```svelte
<script lang="ts">
  import { useData } from '@warpkit/data';

  const users = useData('users', { url: '/users' });
</script>

{#if users.isLoading}
  <p>Loading...</p>
{:else}
  {#each users.data ?? [] as user}
    <div>{user.name}</div>
  {/each}
{/if}
```

## Forms

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const schema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 })
  });

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema,
    onSubmit: async (values) => {
      await login(values);
    }
  });
</script>

<form onsubmit={form.submit}>
  <input bind:value={form.data.email} />
  {#if form.errors.email}<span>{form.errors.email}</span>{/if}

  <input type="password" bind:value={form.data.password} />
  {#if form.errors.password}<span>{form.errors.password}</span>{/if}

  <button type="submit" disabled={form.isSubmitting}>Submit</button>
</form>
```

## WebSocket

```typescript
import { SocketClient, Connected, ClientMessage } from '@warpkit/websocket';

const client = new SocketClient('wss://api.example.com/ws');

const IncidentCreated = ClientMessage.define<{ id: string; title: string }>('incident.created');

client.on(Connected, () => {
  client.joinRoom(`account:${accountId}`);
});

client.on(IncidentCreated, (data) => {
  console.log('Incident:', data.id, data.title);
});

client.connect();
```

## Firebase Auth

```typescript
import { initializeApp } from 'firebase/app';
import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';

const firebaseApp = initializeApp({ /* config */ });

const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
  getInitialState: async (user) => {
    if (!user) return { state: 'unauthenticated' };
    return { state: 'authenticated' };
  }
});

await warpkit.start({ authAdapter });
```

## Requirements

- Svelte 5.0.0+
- Node.js 18+

## Documentation

See the [docs](./docs/) folder for complete documentation:

- [Getting Started](./docs/getting-started.md)
- [Core Concepts](./docs/core-concepts.md)
- [Routing](./docs/routing.md)
- [Data Fetching](./docs/data-fetching.md)
- [Forms](./docs/forms.md)
- [WebSockets](./docs/websockets.md)
- [Authentication](./docs/authentication.md)
- [Testing](./docs/testing.md)
- [API Reference](./docs/api-reference.md)

## License

[MIT](LICENSE)
