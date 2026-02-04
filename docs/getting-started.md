# Getting Started

This guide walks you through setting up a new WarpKit application.

## Installation

Install WarpKit packages:

```bash
npm install @warpkit/core @warpkit/data @warpkit/cache @warpkit/forms @warpkit/validation
```

Optional packages:

```bash
# WebSocket support
npm install @warpkit/websocket

# Firebase authentication
npm install @warpkit/auth-firebase firebase
```

## Project Structure

A typical WarpKit project structure:

```
src/
├── lib/
│   ├── routes.ts           # Route definitions
│   ├── warpkit.ts          # WarpKit instance creation
│   └── data/
│       └── client.ts       # DataClient configuration
├── routes/
│   ├── authenticated/
│   │   ├── Dashboard.svelte
│   │   └── Settings.svelte
│   └── unauthenticated/
│       └── Login.svelte
├── layouts/
│   └── AppLayout.svelte
└── App.svelte              # Root component
```

## Basic Setup

### 1. Define Routes

```typescript
// src/lib/routes.ts
import { createRoute, createStateRoutes } from '@warpkit/core';

// Define app states
type AppState = 'authenticated' | 'unauthenticated';

// Create routes for each state
export const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [
      createRoute({
        path: '/login',
        component: () => import('../routes/unauthenticated/Login.svelte'),
        meta: { title: 'Login' }
      })
    ],
    default: '/login'
  },
  authenticated: {
    routes: [
      createRoute({
        path: '/dashboard',
        component: () => import('../routes/authenticated/Dashboard.svelte'),
        meta: { title: 'Dashboard' }
      }),
      createRoute({
        path: '/settings',
        component: () => import('../routes/authenticated/Settings.svelte'),
        meta: { title: 'Settings' }
      })
    ],
    default: '/dashboard',
    layout: {
      id: 'app-layout',
      load: () => import('../layouts/AppLayout.svelte')
    }
  }
});
```

### 2. Create WarpKit Instance

```typescript
// src/lib/warpkit.ts
import { createWarpKit } from '@warpkit/core';
import { routes } from './routes';

export function initWarpKit() {
  return createWarpKit({
    routes,
    initialState: 'unauthenticated',
    onError: (error, context) => {
      console.error('Navigation error:', error, context);
    }
  });
}
```

### 3. Set Up Root Component

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import { WarpKitProvider, RouterView } from '@warpkit/core';
  import { initWarpKit } from './lib/warpkit';

  const warpkit = initWarpKit();

  // Start WarpKit when component mounts
  $effect(() => {
    warpkit.start();
    return () => warpkit.destroy();
  });
</script>

<WarpKitProvider {warpkit}>
  <RouterView />
</WarpKitProvider>
```

### 4. Create a Page Component

```svelte
<!-- src/routes/authenticated/Dashboard.svelte -->
<script lang="ts">
  import { useWarpKit } from '@warpkit/core';
  import { Link } from '@warpkit/core';

  const warpkit = useWarpKit();

  function handleLogout() {
    // Transition to unauthenticated state
    warpkit.setState('unauthenticated');
  }
</script>

<h1>Dashboard</h1>
<p>Welcome to your dashboard!</p>

<nav>
  <Link href="/settings">Settings</Link>
  <button onclick={handleLogout}>Logout</button>
</nav>
```

### 5. Create a Layout Component

```svelte
<!-- src/layouts/AppLayout.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Link } from '@warpkit/core';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="app-layout">
  <header>
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/settings">Settings</Link>
    </nav>
  </header>

  <main>
    {@render children()}
  </main>
</div>
```

## Adding Data Fetching

### 1. Configure DataClient

```typescript
// src/lib/data/client.ts
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

// Define your data registry
declare module '@warpkit/data' {
  interface DataRegistry {
    'users': { data: User[] };
    'users/:id': { data: User };
    'projects': { data: Project[] };
  }
}

export const dataClient = new DataClient(
  {
    baseUrl: '/api',
    keys: {
      'users': { key: 'users', url: '/users' },
      'users/:id': { key: 'users/:id', url: '/users/:id' },
      'projects': { key: 'projects', url: '/projects', staleTime: 60000 }
    }
  },
  {
    cache: new ETagCacheProvider()
  }
);
```

### 2. Use in Components

```svelte
<!-- src/routes/authenticated/Users.svelte -->
<script lang="ts">
  import { useData } from '@warpkit/data';

  const users = useData('users', {
    url: '/users'
  });
</script>

{#if users.isLoading}
  <p>Loading...</p>
{:else if users.isError}
  <p>Error: {users.error?.message}</p>
{:else}
  <ul>
    {#each users.data ?? [] as user}
      <li>{user.name}</li>
    {/each}
  </ul>
{/if}
```

## Adding Forms

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
  <input
    type="email"
    bind:value={form.data.email}
    onblur={() => form.touch('email')}
  />
  {#if form.errors.email}
    <span class="error">{form.errors.email}</span>
  {/if}

  <input
    type="password"
    bind:value={form.data.password}
    onblur={() => form.touch('password')}
  />
  {#if form.errors.password}
    <span class="error">{form.errors.password}</span>
  {/if}

  <button type="submit" disabled={form.isSubmitting}>
    {form.isSubmitting ? 'Signing in...' : 'Sign In'}
  </button>
</form>
```

## Verification

To verify your setup:

1. Run your development server
2. Navigate to the login page - you should see the Login component
3. The URL should be `/login` (the default for unauthenticated state)
4. Any navigation to authenticated routes should redirect to `/login`

## Next Steps

- [Core Concepts](./core-concepts.md) - Understand the state machine and navigation pipeline
- [Routing](./routing.md) - Learn about route parameters, guards, and layouts
- [Data Fetching](./data-fetching.md) - Set up data fetching with caching
- [Forms](./forms.md) - Build forms with validation
