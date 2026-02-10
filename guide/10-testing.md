# Testing

WarpKit was designed with testing as a first-class concern. The provider system -- where every browser API is behind an interface -- exists primarily so that your tests never need to mock `window`, `localStorage`, or `history`. The entire navigation pipeline runs in memory, deterministically, with no browser required.

This chapter covers everything you need to test a WarpKit application: creating mock instances, asserting on navigation and state, testing components in the browser, and choosing the right testing strategy for each layer of your app.

## Testing Philosophy

Traditional SPA routers force you into an uncomfortable position when writing tests. You either mock global browser APIs (which is brittle and incomplete), render inside a real browser for every test (which is slow), or skip testing navigation altogether (which is dangerous).

WarpKit eliminates this trade-off. The three core providers -- `BrowserProvider`, `StorageProvider`, and `ConfirmDialogProvider` -- are interfaces. In production, these are backed by real browser APIs. In tests, they are backed by in-memory implementations that behave identically but run without a DOM.

This means you can test your entire navigation pipeline -- route matching, state transitions, blockers, hooks, scroll restoration -- in a plain unit test that runs in milliseconds.

For component rendering, Svelte 5 requires a real browser environment because the `mount()` function is not available in jsdom. WarpKit provides `renderWithWarpKit` for these browser tests, giving you full WarpKit context in a Playwright-powered browser test.

The result is a two-tier testing strategy:
1. **Unit tests** for navigation logic, state machines, forms, and data fetching -- fast, no browser needed.
2. **Browser tests** for component rendering and user interaction -- real DOM, real Svelte reactivity.

## createMockWarpKit

The foundation of all WarpKit testing is `createMockWarpKit`. It creates a fully functional WarpKit instance backed by three mock providers:

- **MemoryBrowserProvider** -- An in-memory history stack. Maintains push/replace/back/forward behavior without `window.history`.
- **MockConfirmProvider** -- A configurable confirmation mock. You control whether the "confirm" dialog returns true or false, and you can inspect which messages were shown.
- **NoOpStorageProvider** -- A silent no-op for scroll positions and intended paths. All writes are ignored, all reads return null.

Here is the basic usage:

```typescript
import { createMockWarpKit } from '@warpkit/core/testing';
import { createRoute, createStateRoutes } from '@warpkit/core';

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
      createRoute({ path: '/settings', component: () => import('./Settings.svelte') }),
      createRoute({ path: '/users/[id]', component: () => import('./UserDetail.svelte') })
    ],
    default: '/dashboard'
  }
});

const warpkit = await createMockWarpKit({
  routes,
  initialState: 'authenticated',
  initialPath: '/dashboard'
});

// warpkit is fully initialized and ready to test
expect(warpkit.page.pathname).toBe('/dashboard');
```

The returned `MockWarpKit` extends the normal `WarpKit` instance with additional test helpers. You get direct access to the mock providers and convenience methods for common test operations:

```typescript
// Direct provider access
warpkit.memoryBrowser;  // MemoryBrowserProvider
warpkit.mockConfirm;    // MockConfirmProvider
warpkit.noOpStorage;    // NoOpStorageProvider

// History inspection
warpkit.getHistory();       // Full history stack
warpkit.getCurrentIndex();  // Current position in stack

// Browser simulation
warpkit.simulatePopState('back');     // Simulate browser back button
warpkit.simulatePopState('forward');  // Simulate browser forward button

// Confirm dialog control
warpkit.setConfirmResult(false);  // Next confirm() returns false
warpkit.setConfirmResult(true);   // Next confirm() returns true
```

### Configuration Options

`createMockWarpKit` accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `routes` | `StateRoutes<TAppState>` | (required) | The route configuration |
| `initialState` | `TAppState` | (required) | Starting application state |
| `initialPath` | `string` | `'/'` | Initial URL path |
| `componentLoadDelay` | `number` | `0` | Artificial delay (ms) added to component loading |
| `onError` | `(error, context) => void` | `undefined` | Custom error handler |

## Testing Navigation

Navigation is the core of any router, and WarpKit makes it straightforward to test. The `navigate()` method returns a `NavigationResult` that tells you whether navigation succeeded:

```typescript
import { describe, it, expect } from 'vitest';
import { createMockWarpKit } from '@warpkit/core/testing';

describe('Navigation', () => {
  it('navigates to a new path', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    const result = await warpkit.navigate('/settings');

    expect(result.success).toBe(true);
    expect(warpkit.page.pathname).toBe('/settings');
  });

  it('extracts route parameters', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    await warpkit.navigate('/users/abc-123');

    expect(warpkit.page.pathname).toBe('/users/abc-123');
    expect(warpkit.page.params).toEqual({ id: 'abc-123' });
  });

  it('returns NOT_FOUND for unmatched paths', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    const result = await warpkit.navigate('/nonexistent');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('handles search params', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    await warpkit.navigate('/settings?tab=security&lang=en');

    expect(warpkit.page.pathname).toBe('/settings');
    expect(warpkit.getSearchParam('tab')).toBe('security');
    expect(warpkit.getSearchParam('lang')).toBe('en');
  });
});
```

### Testing Back and Forward Navigation

The `MemoryBrowserProvider` maintains a full history stack. You can navigate through it and assert on the results:

```typescript
describe('History navigation', () => {
  it('handles back and forward', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    await warpkit.navigate('/settings');
    await warpkit.navigate('/users/123');

    expect(warpkit.page.pathname).toBe('/users/123');

    // Simulate browser back button
    warpkit.simulatePopState('back');
    // Wait for the navigation pipeline to complete
    await new Promise((r) => setTimeout(r, 0));

    expect(warpkit.page.pathname).toBe('/settings');

    // Simulate browser forward button
    warpkit.simulatePopState('forward');
    await new Promise((r) => setTimeout(r, 0));

    expect(warpkit.page.pathname).toBe('/users/123');
  });

  it('tracks history length', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    // Initial navigation creates one history entry
    const initialLength = warpkit.getHistory().length;

    await warpkit.navigate('/settings');
    expect(warpkit.getHistory().length).toBe(initialLength + 1);

    await warpkit.navigate('/users/123');
    expect(warpkit.getHistory().length).toBe(initialLength + 2);
  });
});
```

### Testing Navigation Blockers

Blockers prevent navigation when there are unsaved changes. The `MockConfirmProvider` lets you control the user's response to the confirmation dialog:

```typescript
describe('Navigation blockers', () => {
  it('blocks navigation when user cancels', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/settings'
    });

    // Register a blocker (simulating unsaved form changes)
    const registration = warpkit.registerBlocker(() => 'You have unsaved changes');

    // User clicks "Cancel" on the confirm dialog
    warpkit.setConfirmResult(false);

    const result = await warpkit.navigate('/dashboard');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BLOCKED');
    expect(warpkit.page.pathname).toBe('/settings'); // Still on settings

    // Verify the confirm dialog was shown with the right message
    expect(warpkit.mockConfirm.confirmCalls).toContain('You have unsaved changes');

    // Clean up
    registration.unregister();
  });

  it('allows navigation when user confirms', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/settings'
    });

    warpkit.registerBlocker(() => 'You have unsaved changes');

    // User clicks "OK" on the confirm dialog
    warpkit.setConfirmResult(true);

    const result = await warpkit.navigate('/dashboard');

    expect(result.success).toBe(true);
    expect(warpkit.page.pathname).toBe('/dashboard');
  });

  it('supports silent blocking (no dialog)', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/settings'
    });

    // Return true to block silently (no confirm dialog shown)
    warpkit.registerBlocker(() => true);

    const result = await warpkit.navigate('/dashboard');

    expect(result.success).toBe(false);
    // No confirm calls because the blocker returned true (silent block)
    expect(warpkit.mockConfirm.confirmCalls).toHaveLength(0);
  });
});
```

## Assertion Helpers

WarpKit provides a set of expressive assertion helpers that produce better error messages than manual `expect()` calls. Instead of seeing "Expected true but received false", you get messages like "Expected path to be '/dashboard' but was '/settings'".

Import them from `@warpkit/core/testing`:

```typescript
import {
  expectNavigation,
  expectState,
  expectStateTransition,
  expectFullPath,
  expectParams,
  expectSearchParam,
  expectSearchParams,
  expectIsNavigating,
  expectHasError,
  expectNavigationBlocked,
  expectNavigationError,
  expectHistoryLength,
  expectHistoryIndex
} from '@warpkit/core/testing';
```

### Path and State Assertions

```typescript
// Assert the current path
expectNavigation(warpkit, '/dashboard');

// Assert the current application state
expectState(warpkit, 'authenticated');

// Assert a state transition occurred (checks both state and stateId)
const initialStateId = warpkit.getStateId();
await warpkit.setAppState('unauthenticated');
expectStateTransition(warpkit, 'unauthenticated', initialStateId + 1);

// Assert the full path including search params and hash
expectFullPath(warpkit, '/users?tab=settings#section');
```

### Parameter Assertions

```typescript
// Assert route params
await warpkit.navigate('/users/abc-123');
expectParams(warpkit, { id: 'abc-123' });

// Assert a single search param
expectSearchParam(warpkit, 'tab', 'settings');

// Assert a search param is absent
expectSearchParam(warpkit, 'removed', null);

// Assert all search params (fails if unexpected params exist)
expectSearchParams(warpkit, { tab: 'settings', sort: 'name' });
```

### Navigation Status Assertions

```typescript
// Assert that navigation is in progress (useful with componentLoadDelay)
expectIsNavigating(warpkit, true);

// Assert that an error occurred
expectHasError(warpkit, true);
```

### Navigation Outcome Assertions

These helpers combine navigation and assertion in a single call:

```typescript
// Navigate and assert it was blocked
warpkit.registerBlocker(() => 'Unsaved changes');
warpkit.setConfirmResult(false);
await expectNavigationBlocked(warpkit, '/leave');

// Navigate and assert a specific error occurred
await expectNavigationError(warpkit, '/nonexistent', NavigationErrorCode.NOT_FOUND);
```

### History Assertions

```typescript
// Assert history stack length
await warpkit.navigate('/a');
await warpkit.navigate('/b');
expectHistoryLength(warpkit, 3); // Initial + 2 navigations

// Assert current index in history stack
warpkit.simulatePopState('back');
expectHistoryIndex(warpkit, 1); // Back from index 2 to 1
```

## Event Spies

WarpKit's event system is a typed pub/sub bus used for cross-component communication and cache invalidation. The `createEventSpy` utility tracks emitted events for assertions:

```typescript
import { createMockEvents, createEventSpy } from '@warpkit/core/testing';

describe('Event handling', () => {
  it('tracks emitted events', () => {
    const events = createMockEvents();
    const spy = createEventSpy();

    // Register the spy for specific events
    events.on('auth:signed-in', spy.forEvent('auth:signed-in'));
    events.on('auth:signed-out', spy.forEvent('auth:signed-out'));

    // Trigger events
    events.emit('auth:signed-in', { userId: 'user-123' });

    // Assert on the spy
    expect(spy.calledWith('auth:signed-in')).toBe(true);
    expect(spy.calledWith('auth:signed-in', { userId: 'user-123' })).toBe(true);
    expect(spy.calledTimes('auth:signed-in')).toBe(1);
    expect(spy.calledTimes('auth:signed-out')).toBe(0);

    // Get all payloads for an event
    const payloads = spy.getCallsForEvent('auth:signed-in');
    expect(payloads[0]).toEqual({ userId: 'user-123' });
  });

  it('clears between tests', () => {
    const events = createMockEvents();
    const spy = createEventSpy();

    events.on('auth:signed-in', spy.forEvent('auth:signed-in'));

    events.emit('auth:signed-in', { userId: 'first' });
    events.emit('auth:signed-in', { userId: 'second' });

    expect(spy.calledTimes('auth:signed-in')).toBe(2);

    spy.clear();

    expect(spy.calledTimes('auth:signed-in')).toBe(0);
    expect(spy.calls).toHaveLength(0);
  });
});
```

The `createMockEvents` function returns a real `EventEmitter` instance -- it is "mock" only in the sense that it exists outside a WarpKit context. It has the same event emission, subscription, and error isolation behavior as the production event emitter.

## Waiting for Navigation

Some navigations happen asynchronously in response to user actions or external events. The `waitForNavigation` and `waitForNavigationWithTimeout` helpers let you wait for navigation completion:

```typescript
import { waitForNavigation, waitForNavigationWithTimeout } from '@warpkit/core/testing';

describe('Async navigation', () => {
  it('waits for navigation triggered by external action', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    // Set up the wait BEFORE triggering navigation
    const navigationPromise = waitForNavigation(warpkit);

    // Trigger navigation (imagine this is called by a button click handler)
    warpkit.navigate('/settings');

    // Wait for it to complete and inspect the context
    const context = await navigationPromise;
    expect(context.to.pathname).toBe('/settings');
  });

  it('times out if navigation does not complete', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    // This will reject after 100ms because no navigation occurs
    await expect(
      waitForNavigationWithTimeout(warpkit, 100)
    ).rejects.toThrow('Navigation did not complete within 100ms');
  });
});
```

## Testing State Transitions

One of WarpKit's core features is state-based routing. Testing state transitions verifies that your authentication flow, onboarding flow, and other state-dependent behavior works correctly:

```typescript
describe('State transitions', () => {
  it('transitions from unauthenticated to authenticated', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'unauthenticated',
      initialPath: '/login'
    });

    expectState(warpkit, 'unauthenticated');
    expectNavigation(warpkit, '/login');

    // Simulate successful login
    await warpkit.setAppState('authenticated');

    expectState(warpkit, 'authenticated');
    expectNavigation(warpkit, '/dashboard'); // Navigated to default path
  });

  it('transitions from authenticated to unauthenticated on logout', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/settings'
    });

    await warpkit.setAppState('unauthenticated');

    expectState(warpkit, 'unauthenticated');
    expectNavigation(warpkit, '/login');
  });

  it('redirects cross-state navigation to the default path', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'unauthenticated',
      initialPath: '/login'
    });

    // Try to navigate to an authenticated-only route
    const result = await warpkit.navigate('/dashboard');

    // Dashboard exists in 'authenticated' state but not 'unauthenticated'.
    // The router redirects to the current state's default path.
    expectNavigation(warpkit, '/login');
  });
});
```

## Mock DataClient

If your application uses `@warpkit/data` for data fetching, the `createMockDataClient` utility lets you control API responses in tests without making network requests:

```typescript
import { createMockDataClient } from '@warpkit/core/testing';

describe('Data-dependent component', () => {
  it('renders fetched data', async () => {
    const mockClient = createMockDataClient();

    // Configure what the client returns for specific data keys
    mockClient.setResponse('monitors', [
      { id: '1', name: 'API Health Check', status: 'up' },
      { id: '2', name: 'Database Ping', status: 'down' }
    ]);

    // Your component calls mockClient.fetch('monitors')
    const result = await mockClient.fetch('monitors');
    expect(result.data).toHaveLength(2);
    expect(result.fromCache).toBe(false);
  });

  it('simulates API errors', async () => {
    const mockClient = createMockDataClient();

    mockClient.setError('monitors', new Error('Network timeout'));

    await expect(mockClient.fetch('monitors')).rejects.toThrow('Network timeout');
  });

  it('tracks which data keys were fetched', async () => {
    const mockClient = createMockDataClient();
    mockClient.setResponse('monitors', []);
    mockClient.setResponse('incidents', []);

    await mockClient.fetch('monitors');
    await mockClient.fetch('incidents', { projectId: '123' });

    const calls = mockClient.getFetchCalls();
    expect(calls).toEqual([
      { key: 'monitors', params: undefined },
      { key: 'incidents', params: { projectId: '123' } }
    ]);
  });

  it('resets all state between tests', () => {
    const mockClient = createMockDataClient();
    mockClient.setResponse('monitors', []);

    mockClient.reset();

    // Responses, errors, and fetch call history are all cleared
    expect(mockClient.getFetchCalls()).toEqual([]);
  });
});
```

## Testing Loading States

The `componentLoadDelay` option on `createMockWarpKit` adds an artificial delay to component loading, letting you test loading indicators and skeleton screens:

```typescript
describe('Loading states', () => {
  it('shows loading during component load', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard',
      componentLoadDelay: 100 // 100ms delay on component imports
    });

    // Start navigation (don't await)
    const navigationPromise = warpkit.navigate('/settings');

    // During the delay, isNavigating should be true
    expect(warpkit.page.isNavigating).toBe(true);

    // Wait for navigation to complete
    await navigationPromise;

    expect(warpkit.page.isNavigating).toBe(false);
    expect(warpkit.page.pathname).toBe('/settings');
  });
});
```

This is particularly useful for browser tests where you want to verify that a loading skeleton appears before the real content loads.

## Component Testing with renderWithWarpKit

Svelte 5 components cannot be rendered in jsdom because the `mount()` function requires a real DOM. WarpKit provides `renderWithWarpKit` for browser-based component tests using `vitest-browser-svelte`:

```typescript
// Dashboard.browser.spec.ts
import { renderWithWarpKit } from '@warpkit/core/testing';
import Dashboard from './Dashboard.svelte';

describe('Dashboard component', () => {
  it('renders the dashboard', async () => {
    const { warpkit } = await renderWithWarpKit(Dashboard, {
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    await expect.element(page.getByText('Dashboard')).toBeVisible();
  });

  it('navigates when clicking a link', async () => {
    const { warpkit } = await renderWithWarpKit(Dashboard, {
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    // Click a link rendered by the Dashboard component
    await page.getByTestId('settings-link').click();

    // Verify WarpKit navigated
    expect(warpkit.page.pathname).toBe('/settings');
  });
});
```

### Svelte 5 Browser Test Configuration

Browser tests require specific Vitest configuration. In your `vite.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    // Critical: Svelte 5 in browser mode needs the 'browser' condition
    conditions: ['browser']
  },
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright'
    },
    // Browser test files use .browser.spec.ts suffix
    include: ['**/*.browser.spec.ts']
  }
});
```

Without `resolve.conditions: ['browser']`, Svelte resolves to `index-server.js` and `mount()` is unavailable. This is a common pitfall.

### Creating Test Routes Quickly

The `createTestRoutes` helper simplifies route creation for tests when you do not need the full `createStateRoutes` configuration:

```typescript
import { createTestRoutes } from '@warpkit/core/testing';

const routes = createTestRoutes({
  authenticated: [
    { path: '/dashboard', component: () => import('./Dashboard.svelte') },
    { path: '/settings', component: () => import('./Settings.svelte') }
  ],
  unauthenticated: [
    { path: '/login', component: () => import('./Login.svelte') }
  ]
}, { defaultState: 'authenticated' });
```

This is less verbose than `createStateRoutes` and sufficient for most test scenarios.

## Testing Lifecycle Hooks

WarpKit's lifecycle hooks -- `beforeNavigate`, `afterNavigate`, and `registerBlocker` -- can be tested directly on the mock instance:

```typescript
describe('Lifecycle hooks', () => {
  it('runs beforeNavigate hooks', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    const visited: string[] = [];
    warpkit.beforeNavigate((context) => {
      visited.push(context.to.pathname);
    });

    await warpkit.navigate('/settings');

    expect(visited).toEqual(['/settings']);
  });

  it('aborts navigation from beforeNavigate', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    // Return false to abort
    warpkit.beforeNavigate(() => false);

    const result = await warpkit.navigate('/settings');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ABORTED');
    expect(warpkit.page.pathname).toBe('/dashboard');
  });

  it('redirects from beforeNavigate', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    // Return a string to redirect
    warpkit.beforeNavigate((context) => {
      if (context.to.pathname === '/settings') {
        return '/dashboard'; // Redirect back to dashboard
      }
    });

    await warpkit.navigate('/settings');

    expect(warpkit.page.pathname).toBe('/dashboard');
  });

  it('runs afterNavigate hooks', async () => {
    const warpkit = await createMockWarpKit({
      routes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    const transitions: Array<{ from: string | null; to: string }> = [];
    warpkit.afterNavigate((context) => {
      transitions.push({
        from: context.from?.pathname ?? null,
        to: context.to.pathname
      });
    });

    await warpkit.navigate('/settings');
    await warpkit.navigate('/users/123');

    expect(transitions).toEqual([
      { from: '/dashboard', to: '/settings' },
      { from: '/settings', to: '/users/123' }
    ]);
  });
});
```

## Testing Strategies

Different parts of your application need different testing approaches. Here is a guide to choosing the right one:

### 1. Unit Test the Router

Test navigation, state transitions, guards, blockers, and hooks. These tests use `createMockWarpKit` and run without a browser. They are fast and deterministic.

**What to test:**
- Navigation to valid and invalid paths
- Route parameter extraction
- State transitions and default path resolution
- Navigation blockers (confirm and cancel)
- `beforeNavigate` and `afterNavigate` hooks
- Search param updates
- Error handling (NOT_FOUND, STATE_MISMATCH, LOAD_FAILED)

### 2. Unit Test Forms

If you use `@warpkit/forms`, test form validation, dirty tracking, array operations, and submit handling. These tests use `createMockForm` from `@warpkit/forms/testing` and run without a browser.

**What to test:**
- Validation rules fire on blur and submit
- Array field operations (push, remove, move)
- Dirty tracking and reset behavior
- Submit handler receives correct data

### 3. Browser Test Components

Test Svelte components that render UI and depend on WarpKit context. These tests use `renderWithWarpKit` and run in a real browser via Playwright.

**What to test:**
- Component renders correctly for a given route
- Click handlers trigger navigation
- Loading states appear during navigation
- Error states render error UI
- Form components show validation messages

### 4. Integration Test Full Flows

For critical user journeys, write end-to-end tests that exercise multiple components and services together.

**What to test:**
- Login flow: unauthenticated -> login form -> authenticated -> dashboard
- CRUD operations: list -> create form -> submit -> updated list
- Navigation guard: edit form with changes -> navigate away -> confirm dialog -> decision

## Comparison to Other Frameworks

### React Testing Library + React Router

React Router provides `MemoryRouter` for tests, which is conceptually similar to WarpKit's `MemoryBrowserProvider`. However, you still need to wrap components manually, and the router's internal state is not easily inspectable:

```tsx
// React Router: manual wrapper, limited inspection
render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  </MemoryRouter>
);
```

WarpKit's `createMockWarpKit` gives you a single object with full access to page state, history, navigation results, and provider internals. No wrapper components needed for unit tests.

### Vue Test Utils + Vue Router

Vue Router requires `createRouter` with `createMemoryHistory`, and you must wait for the router to be ready:

```typescript
// Vue Router: create router, wait for ready, then test
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/dashboard', component: Dashboard }]
});
router.push('/dashboard');
await router.isReady();
```

WarpKit's `createMockWarpKit` handles initialization internally. The returned instance is ready to use immediately after the `await`.

### The Key Difference

Other frameworks test routing as URL matching. WarpKit tests routing as state-based navigation. You can assert not just "what path are we on?" but also "what application state are we in?", "which routes are available?", and "what happened during the navigation pipeline?". The `NavigationResult` object tells you exactly why a navigation succeeded or failed, with typed error codes and context.

## Next Steps

- [Architecture & Design Decisions](./11-architecture.md) -- Understand the WHY behind the testing infrastructure
- [The Provider System](./05-provider-system.md) -- Deep dive into the providers that make testing possible
- [The Navigation Pipeline](./04-navigation-pipeline.md) -- Understand the 9 phases that your tests exercise
