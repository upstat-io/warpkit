# Core Concepts

WarpKit is built around several key concepts that work together to provide a robust SPA framework.

## State Machine

WarpKit uses a state machine to manage application states. Unlike traditional routers that only care about URLs, WarpKit's router is **state-aware**.

### Application States

Your app defines discrete states (e.g., `authenticated`, `unauthenticated`, `onboarding`). Routes are organized by state:

```typescript
type AppState = 'authenticated' | 'unauthenticated' | 'onboarding';

const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [...],
    default: '/login'
  },
  authenticated: {
    routes: [...],
    default: '/dashboard'
  },
  onboarding: {
    routes: [...],
    default: '/onboarding/welcome'
  }
});
```

### State Transitions

State changes trigger navigation to the new state's default route:

```typescript
// Transition from any state to authenticated
warpkit.setState('authenticated');
// Navigates to '/dashboard' (authenticated default)

// Transition with state data (for dynamic defaults)
warpkit.setState('authenticated', { projectAlias: 'my-project' });
```

### Why State-Based Routing?

1. **Security** - Authenticated routes are only accessible in authenticated state
2. **UX** - Automatic redirects on login/logout
3. **Type Safety** - TypeScript knows which routes exist in each state
4. **Clarity** - Route organization matches mental model

## Navigation Pipeline

WarpKit's navigation follows a 10-phase pipeline:

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Expand Path | Resolve relative paths, apply base path |
| 2 | Version Check | Check for app version updates |
| 3 | Save Scroll | Store current scroll position |
| 4 | Route Match | Find matching route in current state |
| 5 | Blockers | Check navigation blockers (unsaved changes) |
| 6 | Guards | Run route guards (auth checks) |
| 7 | Load | Load component and layout |
| 8 | Commit | Update URL and page state |
| 9 | After Navigate | Run post-navigation hooks |
| 10 | Restore Scroll | Restore scroll position (back/forward) |

### Navigation Cancellation

Any phase can cancel navigation:
- **Blockers** - User declines "unsaved changes" dialog
- **Guards** - Redirect to login if unauthenticated
- **Errors** - Component fails to load

### Concurrent Navigation

If a new navigation starts during an existing one, the previous navigation is cancelled:

```typescript
// These fire rapidly - only the last one completes
warpkit.navigate('/page-1');
warpkit.navigate('/page-2');
warpkit.navigate('/page-3'); // This one wins
```

## Provider System

WarpKit uses providers to abstract browser APIs. This enables:
- **Testing** - Replace real browser with in-memory implementation
- **Customization** - Use custom history handling, storage, or confirmation dialogs

### Core Providers

| Provider | Interface | Default | Purpose |
|----------|-----------|---------|---------|
| Browser | `BrowserProvider` | `DefaultBrowserProvider` | History, URL manipulation |
| Storage | `StorageProvider` | `DefaultStorageProvider` | Scroll positions, intended path |
| ConfirmDialog | `ConfirmDialogProvider` | `DefaultConfirmDialogProvider` | Navigation blocking dialogs |

### Custom Providers

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  providers: {
    browser: new CustomBrowserProvider(),
    storage: new CustomStorageProvider(),
    confirmDialog: new CustomConfirmProvider()
  }
});
```

### Testing with Mock Providers

```typescript
import { createMockWarpKit } from '@warpkit/core/testing';

const warpkit = await createMockWarpKit({
  routes,
  initialState: 'authenticated',
  initialPath: '/dashboard'
});

// Uses MemoryBrowserProvider, MockConfirmProvider, NoOpStorageProvider
```

## Event System

WarpKit includes a type-safe event emitter for decoupled communication.

### Built-in Events

| Event | Payload | When |
|-------|---------|------|
| `auth:signed-in` | `{ userId: string }` | User signs in |
| `auth:signed-out` | `void` | User signs out |
| `query:invalidated` | `{ key: string }` | Cache invalidated |
| `navigation:started` | `{ path: string }` | Navigation begins |
| `navigation:completed` | `{ path: string }` | Navigation ends |

### Subscribing to Events

```typescript
// In component (auto-cleanup)
import { useEvent } from '@warpkit/core';

useEvent('auth:signed-out', () => {
  // Handle sign out
});

// Conditional subscription
useEvent('query:invalidated', handleInvalidation, {
  enabled: () => isActive
});
```

### Emitting Events

```typescript
const warpkit = useWarpKit();

warpkit.events.emit('auth:signed-in', { userId: '123' });
```

### Custom Events

Define your own event registry:

```typescript
declare module '@warpkit/core' {
  interface WarpKitEventRegistry {
    'user:profile-updated': { userId: string };
    'notification:received': { id: string; message: string };
  }
}
```

## WarpKit Context

WarpKit uses Svelte context to provide access to the router throughout your app.

### WarpKitProvider

Wrap your app with `WarpKitProvider`:

```svelte
<WarpKitProvider {warpkit}>
  <RouterView />
</WarpKitProvider>
```

### Hooks

Access WarpKit in any component:

```typescript
// Full WarpKit instance
const warpkit = useWarpKit();

// Just page state (reactive)
const page = usePage();
console.log(page.pathname, page.params, page.search);
```

### Page State

The `page` object contains current navigation state:

```typescript
interface PageState {
  pathname: string;           // Current path
  params: Record<string, string>;  // Route parameters
  search: URLSearchParams;    // Query string
  hash: string;               // URL hash
  meta: RouteMeta;            // Route metadata
  state: string;              // Current app state
}
```

## Lifecycle

### Initialization

```typescript
// 1. Create WarpKit
const warpkit = createWarpKit({ routes, initialState });

// 2. Start (initializes providers, performs initial navigation)
await warpkit.start();

// 3. Optional: Wait for auth adapter
await warpkit.start({
  authAdapter: myAuthAdapter
});
```

### Cleanup

```typescript
// Destroy on unmount
onDestroy(() => {
  warpkit.destroy();
});

// Or in $effect
$effect(() => {
  warpkit.start();
  return () => warpkit.destroy();
});
```

## Key Principles

1. **State First** - Application state determines available routes
2. **Type Safety** - Full TypeScript support throughout
3. **Testability** - Mock providers for unit testing
4. **Svelte 5** - Built for runes, not stores
5. **Generic** - No hardcoded types, you provide your own
