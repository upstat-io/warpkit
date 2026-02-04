# Testing

WarpKit provides comprehensive testing utilities for unit and integration tests.

## Mock WarpKit

Create a fully configured WarpKit instance with mock providers:

```typescript
import { createMockWarpKit } from '@warpkit/core/testing';

const warpkit = await createMockWarpKit({
  routes: {
    authenticated: {
      routes: [
        { path: '/dashboard', component: () => import('./Dashboard.svelte'), meta: {} }
      ],
      default: '/dashboard'
    }
  },
  initialState: 'authenticated',
  initialPath: '/dashboard'
});
```

### Mock Providers

`createMockWarpKit` uses:
- `MemoryBrowserProvider` - In-memory history
- `MockConfirmProvider` - Configurable confirmation dialogs
- `NoOpStorageProvider` - Silent storage (no-op)

### MockWarpKit API

```typescript
interface MockWarpKit extends WarpKit {
  // Provider access
  memoryBrowser: MemoryBrowserProvider;
  mockConfirm: MockConfirmProvider;
  noOpStorage: NoOpStorageProvider;

  // History helpers
  getHistory(): Array<{ path: string; state: unknown }>;
  getCurrentIndex(): number;

  // Simulation
  simulatePopState(direction: 'back' | 'forward'): void;
  setConfirmResult(result: boolean): void;
}
```

### Example Test

```typescript
import { createMockWarpKit } from '@warpkit/core/testing';
import { describe, it, expect } from 'vitest';

describe('Navigation', () => {
  it('navigates to settings', async () => {
    const warpkit = await createMockWarpKit({
      routes: myRoutes,
      initialState: 'authenticated',
      initialPath: '/dashboard'
    });

    await warpkit.navigate('/settings');

    expect(warpkit.page.pathname).toBe('/settings');
  });

  it('blocks navigation with unsaved changes', async () => {
    const warpkit = await createMockWarpKit({
      routes: myRoutes,
      initialState: 'authenticated'
    });

    // Set up blocker
    warpkit.block({ message: 'Unsaved changes', when: () => true });

    // User declines confirmation
    warpkit.setConfirmResult(false);

    await warpkit.navigate('/other');

    // Navigation was blocked
    expect(warpkit.page.pathname).not.toBe('/other');
  });

  it('handles back/forward', async () => {
    const warpkit = await createMockWarpKit({
      routes: myRoutes,
      initialState: 'authenticated'
    });

    await warpkit.navigate('/page1');
    await warpkit.navigate('/page2');

    warpkit.simulatePopState('back');

    expect(warpkit.page.pathname).toBe('/page1');
  });
});
```

## Assertion Helpers

WarpKit provides assertion helpers for common checks:

```typescript
import {
  expectNavigation,
  expectState,
  expectStateTransition,
  expectFullPath,
  expectSearchParam,
  expectSearchParams,
  expectParams,
  expectIsNavigating,
  expectHasError,
  expectNavigationBlocked,
  expectNavigationError,
  expectHistoryLength,
  expectHistoryIndex
} from '@warpkit/core/testing';
```

### Usage

```typescript
// Path assertions
expectNavigation(warpkit, '/dashboard');
expectFullPath(warpkit, '/dashboard?tab=settings');

// State assertions
expectState(warpkit, 'authenticated');
await expectStateTransition(warpkit, 'authenticated', 'unauthenticated');

// Parameter assertions
expectParams(warpkit, { id: '123' });
expectSearchParam(warpkit, 'tab', 'settings');
expectSearchParams(warpkit, { tab: 'settings', view: 'grid' });

// Status assertions
expectIsNavigating(warpkit, false);
expectHasError(warpkit, false);

// MockWarpKit history assertions
expectHistoryLength(warpkit, 3);
expectHistoryIndex(warpkit, 1);
```

## Render Helpers

### renderWithWarpKit

Render a component with WarpKit context:

```typescript
import { renderWithWarpKit } from '@warpkit/core/testing';
import { render, screen } from '@testing-library/svelte';

const { warpkit, container } = await renderWithWarpKit(MyComponent, {
  routes: myRoutes,
  initialState: 'authenticated',
  initialPath: '/dashboard'
});

expect(screen.getByText('Dashboard')).toBeInTheDocument();
```

### WarpKitTestWrapper

For more control, use the wrapper component:

```svelte
<!-- In test -->
<script>
  import { WarpKitTestWrapper } from '@warpkit/core/testing';
  import MyComponent from './MyComponent.svelte';
</script>

<WarpKitTestWrapper
  routes={myRoutes}
  initialState="authenticated"
  initialPath="/dashboard"
>
  <MyComponent />
</WarpKitTestWrapper>
```

## Event Spies

Track emitted events:

```typescript
import { createEventSpy } from '@warpkit/core/testing';

const spy = createEventSpy(warpkit.events);

// Perform actions...
await warpkit.navigate('/settings');

// Check events
expect(spy.getCalls('navigation:started')).toHaveLength(1);
expect(spy.getCalls('navigation:completed')[0].data).toMatchObject({
  path: '/settings'
});

// Clear for next test
spy.clear();
```

### EventSpy API

```typescript
interface EventSpy {
  getCalls<K>(event: K): EventCall<K>[];
  getLastCall<K>(event: K): EventCall<K> | undefined;
  hasEvent(event: string): boolean;
  clear(): void;
  clearEvent(event: string): void;
}

interface EventCall<T> {
  event: string;
  data: T;
  timestamp: number;
}
```

## Mock DataClient

Test components with mocked data:

```typescript
import { createMockDataClient } from '@warpkit/core/testing';

const client = createMockDataClient({
  mockData: {
    'monitors': [{ id: '1', name: 'Test Monitor' }],
    'monitors/:id': { id: '1', name: 'Test Monitor' }
  }
});

// Use in test
const monitors = await client.fetch('monitors');
expect(monitors.data).toHaveLength(1);
```

### Mock Responses

```typescript
const client = createMockDataClient({
  mockData: {
    'monitors': async () => {
      // Simulate delay
      await new Promise(r => setTimeout(r, 100));
      return [{ id: '1', name: 'Test' }];
    }
  }
});
```

### Mock Errors

```typescript
const client = createMockDataClient({
  mockData: {
    'monitors': () => {
      throw new Error('Network error');
    }
  }
});
```

## Navigation Waiting

Wait for navigation to complete:

```typescript
import { waitForNavigation, waitForNavigationWithTimeout } from '@warpkit/core/testing';

// Basic wait
await warpkit.navigate('/settings');
await waitForNavigation(warpkit);
expect(warpkit.page.pathname).toBe('/settings');

// With timeout
await waitForNavigationWithTimeout(warpkit, 5000);
```

## Component Testing

### Svelte 5 Browser Tests

For Svelte 5 components, use browser tests:

```typescript
// MyComponent.browser.spec.ts
import { render } from 'vitest-browser-svelte';
import { renderWithWarpKit } from '@warpkit/core/testing';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  it('renders correctly', async () => {
    const { warpkit } = await renderWithWarpKit(MyComponent, {
      routes: myRoutes,
      initialState: 'authenticated'
    });

    // Use Playwright locators
    await expect.element(page.getByText('Dashboard')).toBeVisible();
  });
});
```

### With Component Load Delay

Test loading states:

```typescript
const warpkit = await createMockWarpKit({
  routes: myRoutes,
  initialState: 'authenticated',
  componentLoadDelay: 100  // Add 100ms delay to component loading
});

await warpkit.navigate('/settings');

// Component is loading
expect(warpkit.page.isLoading).toBe(true);

// Wait for load
await new Promise(r => setTimeout(r, 150));
expect(warpkit.page.isLoading).toBe(false);
```

## Form Testing

```svelte
<script>
  import { useForm } from '@warpkit/forms';

  const form = useForm({
    initialValues: { email: '' },
    onSubmit: async (values) => { /* ... */ }
  });
</script>

<input data-testid="email" bind:value={form.data.email} />
```

```typescript
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';

it('updates form value', async () => {
  render(MyForm);

  const input = page.getByTestId('email');
  await input.fill('test@example.com');

  // Flush Svelte updates
  flushSync();

  // Check form state
  expect(form.data.email).toBe('test@example.com');
});
```

## Best Practices

1. **Use createMockWarpKit** - Avoid real browser APIs in tests
2. **Use assertion helpers** - More readable than manual expects
3. **Use event spies** - Verify events without side effects
4. **Test navigation flows** - Not just individual routes
5. **Test error states** - Use mock errors
6. **Use browser tests for Svelte 5** - jsdom doesn't support `mount()`
7. **Add load delays** - Test loading states with `componentLoadDelay`
