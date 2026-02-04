# Testing Rules

## Browser Tests Required for Components

jsdom doesn't work with Svelte 5's `mount()`. Use vitest-browser-svelte + Playwright.

### Setup

```typescript
// *.svelte.test.ts
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { flushSync } from 'svelte';
```

### Basic Component Test

```typescript
import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  test('renders with props', async () => {
    render(MyComponent, { props: { title: 'Hello' } });
    await expect.element(page.getByText('Hello')).toBeVisible();
  });
});
```

### Input Interactions

```typescript
test('handles input', async () => {
  render(FormComponent);

  const input = page.getByRole('textbox');
  await input.fill('test value');

  // Or for immediate reactive updates:
  const el = input.element() as HTMLInputElement;
  el.value = 'test value';
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  flushSync();

  await expect.element(page.getByText('test value')).toBeVisible();
});
```

### Form Submission

```typescript
test('submits form', async () => {
  render(FormComponent);

  const form = page.getByRole('form').element();
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
```

### Invisible Elements

For elements that aren't visible but need interaction:

```typescript
// Use dispatchEvent instead of locator.click()
const el = page.getByTestId('hidden-trigger').element();
el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
```

## Mocking

### Mock Stores with vi.hoisted

```typescript
const mockStore = vi.hoisted(() => ({
  subscribe: vi.fn((cb) => {
    cb({ value: 'test' });
    return () => {};
  }),
  set: vi.fn()
}));

vi.mock('./store', () => ({
  myStore: mockStore
}));
```

### Mock Svelte Components

Create stub files for complex component mocks:

```typescript
// __mocks__/ComplexComponent.svelte
<script>
  export let value;
</script>
<div data-testid="mock-complex">{value}</div>
```

## Effect Testing

Wrap tests with `$effect` in `$effect.root()`:

```typescript
test('effect runs', async () => {
  const cleanup = $effect.root(() => {
    // Test code using $effect
  });

  // Assertions

  cleanup(); // Always clean up
});
```

## Async Assertions

```typescript
// Use vi.waitFor for async state changes
await vi.waitFor(() => {
  expect(actor.getSnapshot().value).toBe('success');
});

// Or expect.element for DOM
await expect.element(page.getByText('loaded')).toBeVisible();
```
