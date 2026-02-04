# Routing

WarpKit provides a powerful routing system with state-based organization, type-safe parameters, and flexible navigation options.

## Route Definition

### createRoute()

Create individual routes with type inference:

```typescript
import { createRoute } from '@warpkit/core';

// Basic route
const dashboardRoute = createRoute({
  path: '/dashboard',
  component: () => import('./Dashboard.svelte'),
  meta: { title: 'Dashboard' }
});

// Route with parameters
const projectRoute = createRoute({
  path: '/projects/[id]',
  component: () => import('./Project.svelte'),
  meta: { title: 'Project' }
});

// Type-safe parameter access
const params = projectRoute.getParams({ id: '123', other: 'ignored' });
// params.id: string

// Type-safe path building
const path = projectRoute.buildPath({ id: '123' });
// '/projects/123'
```

### Path Patterns

| Pattern | Example | Matches |
|---------|---------|---------|
| Static | `/about` | `/about` |
| Required param | `/users/[id]` | `/users/123` |
| Optional param | `/users/[id?]` | `/users` or `/users/123` |
| Catch-all | `/docs/[...path]` | `/docs/a/b/c` |
| Optional catch-all | `/docs/[...path?]` | `/docs` or `/docs/a/b/c` |

```typescript
// Optional parameter
createRoute({ path: '/users/[id?]', ... });

// Catch-all (required)
createRoute({ path: '/docs/[...slug]', ... });

// Catch-all (optional)
createRoute({ path: '/files/[...path?]', ... });
```

### createStateRoutes()

Organize routes by application state:

```typescript
import { createStateRoutes } from '@warpkit/core';

type AppState = 'authenticated' | 'unauthenticated';

const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [
      createRoute({ path: '/login', component: () => import('./Login.svelte'), meta: {} }),
      createRoute({ path: '/signup', component: () => import('./Signup.svelte'), meta: {} })
    ],
    default: '/login'
  },
  authenticated: {
    routes: [
      createRoute({ path: '/dashboard', component: () => import('./Dashboard.svelte'), meta: {} }),
      createRoute({ path: '/settings', component: () => import('./Settings.svelte'), meta: {} })
    ],
    default: '/dashboard',
    layout: {
      id: 'app-layout',
      load: () => import('./AppLayout.svelte')
    }
  }
});
```

### State Configuration

| Property | Type | Description |
|----------|------|-------------|
| `routes` | `Route[]` | Routes for this state |
| `default` | `string \| ((data) => string) \| null` | Default path when entering state |
| `layout` | `{ id, load }` | State-level layout component |
| `redirects` | `Record<string, string>` | Path redirects within state |

### Dynamic Defaults

Use a function for dynamic default paths:

```typescript
authenticated: {
  routes: [...],
  default: (stateData) => `/projects/${stateData.projectAlias}/dashboard`
}

// When transitioning:
warpkit.setState('authenticated', { projectAlias: 'my-project' });
// Navigates to: /projects/my-project/dashboard
```

## Navigation

### Methods

```typescript
const warpkit = useWarpKit();

// Push (add to history)
warpkit.navigate('/dashboard');

// Replace (no history entry)
warpkit.navigate('/dashboard', { replace: true });

// With state data
warpkit.navigate('/project', { state: { returnTo: '/dashboard' } });

// Go back/forward
warpkit.back();
warpkit.forward();
warpkit.go(-2); // Go back 2 entries
```

### Navigation Options

```typescript
interface NavigateOptions {
  replace?: boolean;      // Replace instead of push
  state?: unknown;        // History state data
  skipBlockers?: boolean; // Skip navigation blockers
}
```

### Link Component

Declarative navigation:

```svelte
<script>
  import { Link } from '@warpkit/core';
</script>

<!-- Basic link -->
<Link href="/dashboard">Dashboard</Link>

<!-- Replace history -->
<Link href="/settings" replace>Settings</Link>

<!-- Disabled state -->
<Link href="/admin" disabled={!isAdmin}>Admin</Link>

<!-- With class -->
<Link href="/profile" class="nav-link">Profile</Link>
```

## Route Parameters

### Accessing Parameters

```svelte
<script lang="ts">
  import { usePage } from '@warpkit/core';

  const page = usePage();
  // page.params.id - route parameter
  // page.search.get('tab') - query parameter
</script>

<h1>Project: {page.params.id}</h1>
```

### Typed Parameters

TypeScript infers parameter types from path:

```typescript
const route = createRoute({
  path: '/projects/[projectId]/tasks/[taskId]',
  component: () => import('./Task.svelte'),
  meta: {}
});

// getParams returns { projectId: string, taskId: string }
route.getParams({ projectId: '1', taskId: '2' });

// buildPath requires { projectId: string, taskId: string }
route.buildPath({ projectId: '1', taskId: '2' });
```

## Layouts

### State-Level Layouts

Apply a layout to all routes in a state:

```typescript
authenticated: {
  routes: [...],
  layout: {
    id: 'app-layout',
    load: () => import('./AppLayout.svelte')
  }
}
```

### Route-Level Layouts

Override for specific routes:

```typescript
createRoute({
  path: '/fullscreen',
  component: () => import('./Fullscreen.svelte'),
  layout: {
    id: 'minimal-layout',
    load: () => import('./MinimalLayout.svelte')
  }
});
```

### Layout Component

```svelte
<!-- AppLayout.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="app-layout">
  <header>...</header>
  <main>
    {@render children()}
  </main>
  <footer>...</footer>
</div>
```

## Guards

Route guards protect routes based on conditions.

### Guard Definition

```typescript
const adminGuard = {
  name: 'admin',
  check: async (context) => {
    if (!currentUser.isAdmin) {
      return { redirect: '/unauthorized' };
    }
    return { allow: true };
  }
};
```

### Applying Guards

```typescript
createRoute({
  path: '/admin',
  component: () => import('./Admin.svelte'),
  meta: {
    guards: [adminGuard]
  }
});
```

### Guard Context

```typescript
interface GuardContext {
  from: PageState;      // Previous page
  to: PageState;        // Target page
  params: Record<string, string>;
}
```

## Redirects

### State-Level Redirects

```typescript
authenticated: {
  routes: [...],
  redirects: {
    '/': '/dashboard',           // Redirect root to dashboard
    '/home': '/dashboard',       // Redirect old path
    '/legacy/*': '/new/*'        // Pattern redirect (if supported)
  }
}
```

### Programmatic Redirects

```typescript
// In guard
return { redirect: '/login' };

// In component
warpkit.navigate('/new-path', { replace: true });
```

## Navigation Blockers

Prevent navigation when there are unsaved changes:

```typescript
// Register blocker
const unblock = warpkit.block({
  message: 'You have unsaved changes. Are you sure you want to leave?',
  when: () => hasUnsavedChanges
});

// Unregister when done
unblock();
```

### With Forms

```svelte
<script>
  import { useWarpKit } from '@warpkit/core';
  import { useForm } from '@warpkit/forms';

  const warpkit = useWarpKit();
  const form = useForm({ ... });

  // Block navigation when form is dirty
  $effect(() => {
    if (!form.isDirty) return;

    const unblock = warpkit.block({
      message: 'You have unsaved changes.',
      when: () => form.isDirty
    });

    return unblock;
  });
</script>
```

## Scroll Restoration

WarpKit automatically restores scroll positions for back/forward navigation.

### How It Works

1. Before navigation, current scroll position is saved
2. Position is stored in `StorageProvider` (keyed by navigation ID)
3. On back/forward, position is restored after content loads

### Configuration

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    storage: new DefaultStorageProvider({
      maxScrollPositions: 100 // LRU eviction
    })
  }
});
```

### Disabling for a Route

```typescript
createRoute({
  path: '/modal',
  component: () => import('./Modal.svelte'),
  meta: {
    scrollRestore: false
  }
});
```

## Error Handling

### Not Found

When no route matches:

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  onError: (error, context) => {
    if (error.type === 'NOT_FOUND') {
      // Handle 404
    }
  }
});
```

### Component Load Errors

```typescript
onError: (error, context) => {
  if (error.type === 'LOAD_ERROR') {
    console.error('Failed to load:', error.cause);
  }
}
```

## Best Practices

1. **Organize by state** - Group routes by application state
2. **Use layouts** - Share UI across related routes
3. **Type your routes** - Use TypeScript for parameter inference
4. **Guard protected routes** - Don't rely only on state
5. **Handle errors** - Provide meaningful error pages
6. **Use replace for redirects** - Don't pollute history
