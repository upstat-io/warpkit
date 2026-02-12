# Quick Start

This chapter walks you through building a complete WarpKit application from scratch. By the end, you will have a working SPA with authentication states, page navigation, data fetching, and a form -- enough to understand how all the pieces fit together.

## Installation

WarpKit is distributed as a set of npm packages. Install the core package and the ones you need:

```bash
# Required
npm install @upstat/warpkit

# Recommended: data fetching and caching
npm install @warpkit/data @warpkit/cache

# Recommended: forms and validation
npm install @warpkit/forms @warpkit/validation

# Optional: real-time WebSocket support
npm install @warpkit/websocket

# Optional: Firebase authentication adapter
npm install @warpkit/auth-firebase firebase
```

You will also need a Svelte 5 project with a bundler. The easiest way to get one is with Vite:

```bash
npm create vite@latest my-app -- --template svelte-ts
cd my-app
npm install @upstat/warpkit @warpkit/data @warpkit/cache @warpkit/forms @warpkit/validation
```

WarpKit has a peer dependency on Svelte 5. If your project uses an older version of Svelte, you will need to upgrade first.

## Project Structure

Before writing code, here is the project structure we will build toward. You do not need to create all of these files right now -- we will build them one at a time.

```
src/
  lib/
    routes.ts              # Route definitions organized by state
    warpkit.ts             # WarpKit instance creation
    data/
      client.ts            # DataClient configuration
  routes/
    authenticated/
      Dashboard.svelte     # Dashboard page
      Settings.svelte      # Settings page
    unauthenticated/
      Login.svelte         # Login page
  layouts/
    AppLayout.svelte       # Layout for authenticated pages
  App.svelte               # Root component
  main.ts                  # Vite entry point
```

This structure separates concerns clearly: route definitions live in `lib/`, page components live in `routes/` organized by state, and layouts live in `layouts/`. You are free to organize your project differently, but this pattern scales well.

## Step 1: Define Routes

Routes are the backbone of a WarpKit application. Unlike traditional routers where you define a flat list of URL patterns, WarpKit organizes routes by application state.

Create `src/lib/routes.ts`:

```typescript
// src/lib/routes.ts
import { createRoute, createStateRoutes } from '@upstat/warpkit';

// Step 1: Define your application states as a union type.
// These represent the discrete modes your app can be in.
type AppState = 'authenticated' | 'unauthenticated';

// Step 2: Create routes organized by state.
// Each state has its own set of routes and a default path.
export const routes = createStateRoutes<AppState>({

  // Routes available when the user is NOT logged in
  unauthenticated: {
    routes: [
      createRoute({
        path: '/login',
        component: () => import('../routes/unauthenticated/Login.svelte'),
        meta: { title: 'Sign In' }
      })
    ],
    // When entering this state, navigate here by default
    default: '/login'
  },

  // Routes available when the user IS logged in
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
    // When entering this state, navigate here by default
    default: '/dashboard',
    // All authenticated routes share this layout
    layout: {
      id: 'app-layout',
      load: () => import('../layouts/AppLayout.svelte')
    }
  }
});

export type { AppState };
```

Let's unpack what is happening here:

**Why `createStateRoutes` instead of a flat route array?** Because the router needs to know which routes belong to which state. When the app is in the `unauthenticated` state, the router only matches against the routes in the `unauthenticated` group. The `/dashboard` route literally does not exist yet. This is not a guard that can be bypassed -- the route is not registered.

**Why are components lazy-loaded with `() => import(...)`?** This enables code splitting. The browser only downloads the code for a page when the user navigates to it. For a large application with dozens of pages, this dramatically reduces the initial bundle size.

**What is `default`?** When a state transition occurs (for example, the user logs in and the app switches from `unauthenticated` to `authenticated`), WarpKit navigates to the default path for the new state. Without a default, the router would not know where to go after a state change.

**What is the `layout`?** A layout wraps all routes in a state. Authenticated routes typically share a sidebar, navigation bar, and footer. The layout is also lazy-loaded -- it is fetched once and cached for the duration of the state.

**Compared to other frameworks:** In React Router, you would define all routes in a flat tree and wrap protected routes in an `<AuthRequired>` component. In SvelteKit, you would use directory-based grouping with `+layout.server.ts` guards. WarpKit makes the state boundary explicit at the route definition level.

## Step 2: Create the WarpKit Instance

Create `src/lib/warpkit.ts`:

```typescript
// src/lib/warpkit.ts
import { createWarpKit } from '@upstat/warpkit';
import { routes, type AppState } from './routes';

export function initWarpKit() {
  return createWarpKit<AppState>({
    routes,
    initialState: 'unauthenticated',
    onError: (error, context) => {
      console.error('[WarpKit] Navigation error:', error, context);
    }
  });
}
```

`createWarpKit` is a factory function that creates a new router instance. It takes three things:

- **`routes`** -- The state routes you defined in step 1.
- **`initialState`** -- The state the app starts in before auth is determined. For most apps, this is `'unauthenticated'`.
- **`onError`** -- A global error handler for navigation failures (route not found, component failed to load, etc.).

The instance is not started yet. Starting is a separate step that happens when the root component mounts. This separation matters because starting involves side effects (listening for browser history events, performing the initial navigation), and you want those to happen during the component lifecycle, not during module initialization.

## Step 3: Set Up the Root Component

Replace your `src/App.svelte` with:

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import { WarpKitProvider, RouterView } from '@upstat/warpkit';
  import { initWarpKit } from './lib/warpkit';

  // Create the WarpKit instance
  const warpkit = initWarpKit();

  // Start when the component mounts, clean up when it unmounts.
  // $effect runs after mount and returns a cleanup function.
  $effect(() => {
    warpkit.start();
    return () => warpkit.destroy();
  });
</script>

<!-- WarpKitProvider makes the instance available to all child components -->
<WarpKitProvider {warpkit}>
  <!-- RouterView renders the currently matched route component -->
  <RouterView />
</WarpKitProvider>
```

Three things are happening here:

1. **`WarpKitProvider`** sets up a Svelte context containing the WarpKit instance. Any child component can call `useWarpKit()` or `usePage()` to access the router.

2. **`RouterView`** reads the currently matched route from context and renders its component. When the user navigates, `RouterView` swaps in the new component. If the route has a layout, `RouterView` renders the layout wrapping the page component.

3. **The `$effect` pattern** handles the lifecycle. `warpkit.start()` initializes the browser history listener and performs the initial navigation (matching the current URL to a route). `warpkit.destroy()` cleans up event listeners when the component unmounts. This is the Svelte 5 equivalent of `onMount`/`onDestroy` combined.

**Why not start in `onMount`?** You can -- and for compatibility, that works fine. The `$effect` pattern is idiomatic Svelte 5 and pairs the start/destroy as a single cleanup concern. Either approach works.

## Step 4: Create Page Components

Now let's create the actual pages.

### Login Page

Create `src/routes/unauthenticated/Login.svelte`:

```svelte
<!-- src/routes/unauthenticated/Login.svelte -->
<script lang="ts">
  import { useWarpKit } from '@upstat/warpkit';

  const warpkit = useWarpKit();

  // For this quick start, we simulate login by switching state.
  // In a real app, this would call your auth adapter.
  function handleLogin() {
    warpkit.setState('authenticated');
  }
</script>

<div class="login-page">
  <h1>Welcome Back</h1>
  <p>Sign in to access your dashboard.</p>

  <button onclick={handleLogin}>
    Sign In (Demo)
  </button>
</div>
```

Notice `useWarpKit()` -- this hook retrieves the WarpKit instance from context. It must be called at the top level of your component's `<script>` block, not inside a function or conditional. This is a Svelte context rule, not a WarpKit limitation.

When the user clicks "Sign In," we call `warpkit.setState('authenticated')`. This triggers a state transition: the router switches to the `authenticated` state's routes and navigates to its default path (`/dashboard`). The URL changes, the dashboard component loads, and the login page unmounts.

### Dashboard Page

Create `src/routes/authenticated/Dashboard.svelte`:

```svelte
<!-- src/routes/authenticated/Dashboard.svelte -->
<script lang="ts">
  import { useWarpKit, usePage } from '@upstat/warpkit';
  import { Link } from '@upstat/warpkit';

  const warpkit = useWarpKit();
  const page = usePage();

  function handleLogout() {
    warpkit.setState('unauthenticated');
  }
</script>

<h1>Dashboard</h1>
<p>Current path: {page.pathname}</p>

<nav>
  <!-- Link component handles click interception and navigation -->
  <Link href="/settings">Go to Settings</Link>
  <button onclick={handleLogout}>Sign Out</button>
</nav>

<div class="dashboard-content">
  <p>Welcome to your dashboard. This page is only accessible when authenticated.</p>
</div>
```

Two new APIs here:

- **`usePage()`** returns the reactive page state. It includes the current `pathname`, route `params`, `search` (query string), and `meta` (the metadata you defined on the route). It updates automatically on every navigation.

- **`Link`** is WarpKit's navigation component. It renders an `<a>` tag but intercepts clicks to perform client-side navigation instead of a full page reload. It is aware of the current route and can apply active styles.

### Settings Page

Create `src/routes/authenticated/Settings.svelte`:

```svelte
<!-- src/routes/authenticated/Settings.svelte -->
<script lang="ts">
  import { Link } from '@upstat/warpkit';
  import { useWarpKit } from '@upstat/warpkit';

  const warpkit = useWarpKit();

  function handleSave() {
    // In a real app, save settings via a mutation
    alert('Settings saved!');
  }
</script>

<h1>Settings</h1>

<div class="settings-content">
  <p>Configure your preferences here.</p>
  <button onclick={handleSave}>Save Changes</button>
</div>

<nav>
  <Link href="/dashboard">Back to Dashboard</Link>
</nav>
```

You can also navigate programmatically instead of using `Link`:

```typescript
// Programmatic navigation
warpkit.navigate('/dashboard');

// Replace current history entry (no back button)
warpkit.navigate('/dashboard', { replace: true });
```

## Step 5: Create a Layout

Layouts wrap page components with shared UI like navigation bars, sidebars, and footers. We defined a layout for the `authenticated` state in step 1 -- now let's create it.

Create `src/layouts/AppLayout.svelte`:

```svelte
<!-- src/layouts/AppLayout.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Link, usePage } from '@upstat/warpkit';

  // Layouts receive their page content as a Snippet (Svelte 5 pattern)
  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const page = usePage();
</script>

<div class="app-layout">
  <header>
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/settings">Settings</Link>
    </nav>
    <span class="current-page">{page.meta.title}</span>
  </header>

  <main>
    <!-- Render the page component here -->
    {@render children()}
  </main>

  <footer>
    <p>My App &copy; 2025</p>
  </footer>
</div>
```

Layouts in WarpKit use Svelte 5's Snippet API. The layout receives a `children` snippet that contains the page component, and renders it with `{@render children()}`. This is different from Svelte 4's slot-based approach.

**State-level vs. route-level layouts:** The layout we defined is state-level -- it applies to all routes in the `authenticated` state. You can also define layouts on individual routes to override the state layout:

```typescript
createRoute({
  path: '/fullscreen-editor',
  component: () => import('./Editor.svelte'),
  meta: { title: 'Editor' },
  // This route gets a different layout
  layout: {
    id: 'minimal',
    load: () => import('../layouts/MinimalLayout.svelte')
  }
})
```

## Step 6: Add Data Fetching

Let's add real data to the dashboard. First, configure a DataClient.

Create `src/lib/data/client.ts`:

```typescript
// src/lib/data/client.ts
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

// Module augmentation: tell TypeScript what data each key returns.
// This gives you full type inference when using useData().
declare module '@warpkit/data' {
  interface DataRegistry {
    'projects': { data: Project[] };
  }
}

// Your data types
interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
}

// Create the DataClient with caching and key configuration
export const dataClient = new DataClient(
  {
    baseUrl: '/api',   // All URLs are relative to this
    timeout: 30000,    // 30 second timeout
    keys: {
      'projects': {
        key: 'projects',
        url: '/projects',
        staleTime: 60000    // Consider data fresh for 1 minute
      }
    },
    // Add auth headers to every request
    onRequest: async (request) => {
      const token = getAuthToken(); // Your auth token retrieval
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    }
  },
  {
    // Two-tier cache: fast memory + persistent localStorage with E-Tag support
    cache: new ETagCacheProvider()
  }
);
```

Now use it in the dashboard. Update `src/routes/authenticated/Dashboard.svelte`:

```svelte
<!-- src/routes/authenticated/Dashboard.svelte -->
<script lang="ts">
  import { useWarpKit, usePage, Link } from '@upstat/warpkit';
  import { useData } from '@warpkit/data';

  const warpkit = useWarpKit();

  // Fetch projects -- this hooks into the DataClient's caching layer.
  // The data will be cached and reused until staleTime expires.
  const projects = useData('projects', {
    url: '/projects'
  });

  function handleLogout() {
    warpkit.setState('unauthenticated');
  }
</script>

<h1>Dashboard</h1>

<!-- Handle the three states: loading, error, success -->
{#if projects.isLoading}
  <p>Loading projects...</p>
{:else if projects.isError}
  <div class="error">
    <p>Failed to load projects: {projects.error?.message}</p>
    <button onclick={projects.refetch}>Retry</button>
  </div>
{:else}
  <ul>
    {#each projects.data ?? [] as project}
      <li>
        <strong>{project.name}</strong>
        <span class="status">{project.status}</span>
      </li>
    {/each}
  </ul>
{/if}

<nav>
  <Link href="/settings">Settings</Link>
  <button onclick={handleLogout}>Sign Out</button>
</nav>
```

`useData` returns a reactive object with `data`, `error`, `isLoading`, `isError`, `isSuccess`, and a `refetch` function. You should not destructure this object -- access properties through the reference to maintain Svelte 5 reactivity.

**Compared to other frameworks:** If you have used TanStack Query (React Query), the API will feel familiar. The key difference is that WarpKit's data layer is config-driven: you define keys, URLs, and cache settings upfront in the DataClient, and the hooks reference those keys. This centralization makes it easy to see all your data dependencies in one place.

## Step 7: Add a Form

Let's add a login form with validation to the login page.

Update `src/routes/unauthenticated/Login.svelte`:

```svelte
<!-- src/routes/unauthenticated/Login.svelte -->
<script lang="ts">
  import { useWarpKit } from '@upstat/warpkit';
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const warpkit = useWarpKit();

  // Define the validation schema using TypeBox.
  // You can also use Zod, Valibot, or any StandardSchema-compliant library.
  const schema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 })
  });

  // Create the form. useForm returns a reactive object with data, errors,
  // validation state, and submit handling.
  const form = useForm({
    initialValues: {
      email: '',
      password: ''
    },
    schema,
    onSubmit: async (values) => {
      // In a real app, call your auth API here
      console.log('Logging in with:', values.email);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Transition to authenticated state
      warpkit.setState('authenticated');
    }
  });
</script>

<div class="login-page">
  <h1>Welcome Back</h1>

  <form onsubmit={form.submit}>
    <div class="field">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={form.data.email}
        onblur={() => form.touch('email')}
      />
      {#if form.errors.email}
        <span class="error">{form.errors.email}</span>
      {/if}
    </div>

    <div class="field">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        bind:value={form.data.password}
        onblur={() => form.touch('password')}
      />
      {#if form.errors.password}
        <span class="error">{form.errors.password}</span>
      {/if}
    </div>

    <button type="submit" disabled={form.isSubmitting || !form.isValid}>
      {form.isSubmitting ? 'Signing in...' : 'Sign In'}
    </button>

    {#if form.submitError}
      <div class="submit-error">{form.submitError.message}</div>
    {/if}
  </form>
</div>
```

The key thing to notice is `bind:value={form.data.email}`. WarpKit's form data is a deep proxy -- you can bind directly to any property, including nested objects and array elements, and it just works. This is what makes WarpKit forms feel native to Svelte 5.

The `form.touch('email')` call on blur triggers validation for that field. By default, WarpKit validates on blur (not on every keystroke), which provides a better user experience. After a field has an error, it revalidates on change so the error disappears as soon as the input is corrected.

**Compared to other form libraries:** If you have used React Hook Form, the mental model is similar: register fields, validate on blur/submit, display errors. The difference is that WarpKit uses Svelte 5's `bind:value` through a proxy instead of requiring explicit registration. If you have used Formik or react-final-form, the API will feel familiar but more concise.

## Wiring It All Together

If you set up your Vite project with the standard Svelte template, your `src/main.ts` mounts `App.svelte`:

```typescript
// src/main.ts
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
```

For the `DataClientProvider`, update your `App.svelte` to include it:

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import { WarpKitProvider, RouterView } from '@upstat/warpkit';
  import { DataClientProvider } from '@warpkit/data';
  import { initWarpKit } from './lib/warpkit';
  import { dataClient } from './lib/data/client';

  const warpkit = initWarpKit();

  $effect(() => {
    warpkit.start();
    return () => warpkit.destroy();
  });
</script>

<WarpKitProvider {warpkit}>
  <DataClientProvider client={dataClient}>
    <RouterView />
  </DataClientProvider>
</WarpKitProvider>
```

## Verification

Start your development server:

```bash
npm run dev
```

You should see:

1. The browser navigates to `/login` (the default for the `unauthenticated` state).
2. The Login page renders with the email and password form.
3. Try navigating to `/dashboard` directly in the URL bar -- you should be redirected back to `/login` because `/dashboard` does not exist in the `unauthenticated` state.
4. Fill in the form and submit. After the simulated delay, the app transitions to the `authenticated` state and navigates to `/dashboard`.
5. The dashboard renders inside the `AppLayout` with the shared navigation.
6. Click "Settings" to navigate to `/settings` -- the layout persists, only the page content changes.
7. Click "Sign Out" to transition back to `unauthenticated` and return to `/login`.

If any of these steps do not work, check the browser console for errors. The most common issues are:

- **Missing `WarpKitProvider`**: `useWarpKit()` throws if called outside the provider.
- **Hook called inside a function**: `useWarpKit()` and `usePage()` must be called at the top level of the `<script>` block.
- **Destructuring reactive objects**: Do not destructure `useData()` or `usePage()` results. Access properties through the object reference.

## Route Parameters

Before moving on, let's look at one more common pattern: route parameters. Add a project detail route to your authenticated state:

```typescript
// In routes.ts, add to the authenticated routes array:
createRoute({
  path: '/projects/[id]',
  component: () => import('../routes/authenticated/ProjectDetail.svelte'),
  meta: { title: 'Project Detail' }
})
```

Then create the page:

```svelte
<!-- src/routes/authenticated/ProjectDetail.svelte -->
<script lang="ts">
  import { usePage, Link } from '@upstat/warpkit';

  const page = usePage();

  // page.params.id contains the value from the URL
  // For /projects/abc123, page.params.id === 'abc123'
</script>

<h1>Project: {page.params.id}</h1>

<Link href="/dashboard">Back to Dashboard</Link>
```

Navigate to `/projects/abc123` and you will see the parameter extracted. WarpKit supports several parameter patterns:

| Pattern | Example URL | Params |
|---------|------------|--------|
| `/users/[id]` | `/users/123` | `{ id: '123' }` |
| `/users/[id?]` | `/users` or `/users/123` | `{}` or `{ id: '123' }` |
| `/docs/[...path]` | `/docs/a/b/c` | `{ path: 'a/b/c' }` |
| `/docs/[...path?]` | `/docs` or `/docs/a/b/c` | `{}` or `{ path: 'a/b/c' }` |

## Dynamic Default Paths

For applications where the default route depends on user data (like a project alias in the URL), you can use a function as the default:

```typescript
interface AppStateData {
  projectAlias: string;
}

const routes = createStateRoutes<AppState, AppStateData>({
  authenticated: {
    routes: [...],
    // The default path is computed from state data
    default: (data) => `/${data.projectAlias}/dashboard`
  }
});

// When transitioning, pass the state data:
warpkit.setAppState('authenticated', { projectAlias: 'my-project' });
// Navigates to: /my-project/dashboard
```

This is how real-world applications handle multi-tenant URLs where the project or workspace slug is part of the path.

## What's Next

You now have a working WarpKit application with:
- State-based routing between authenticated and unauthenticated states
- Page components with navigation via `Link` and programmatic `navigate()`
- A shared layout for authenticated pages
- Data fetching with `useData`
- A form with schema validation using `useForm`

The following chapters dive deeper into each area:

- [**State-Based Routing**](./03-state-based-routing.md) -- Route parameters, guards, redirects, navigation blockers, scroll restoration
- [**The Navigation Pipeline**](./04-navigation-pipeline.md) -- Understanding the 10 phases every navigation goes through
- [**The Provider System**](./05-provider-system.md) -- Custom browser providers, hash routing, testing with memory providers
- [**Data Fetching & Caching**](./06-data-fetching.md) -- The full DataClient API, E-Tag caching, cache invalidation, optimistic updates
- [**Forms & Validation**](./07-forms.md) -- Deep proxy binding, array fields, custom validators, validation modes
- [**WebSockets & Real-Time**](./08-websockets.md) -- SocketClient, type-safe messages, rooms, reconnection
- [**Authentication**](./09-authentication.md) -- Building an auth adapter, Firebase integration, token management
- [**Testing**](./10-testing.md) -- Mock WarpKit, assertion helpers, component testing strategies
