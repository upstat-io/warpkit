# Testing Svelte Review Findings

**Reviewer**: testing-svelte
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Missing Browser Tests for QueryClientProvider.svelte

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClientProvider.svelte`
**Severity**: HIGH
**Rule**: svelte5-testing.md - "Browser Tests Required: MUST use vitest-browser-svelte + Playwright"
**Status**: OPEN

**Issue**:
The `QueryClientProvider.svelte` component is a Svelte 5 component using `$props()` runes but has no browser tests. Per svelte5-testing.md:

- "MUST use vitest-browser-svelte + Playwright"
- "jsdom doesn't work with Svelte 5's mount()"
- "Test files must include `.svelte` in name for runes"

The component uses Svelte 5 patterns:
```svelte
let { client, children }: Props = $props();
setContext(QUERY_CLIENT_CONTEXT, client);
{@render children()}
```

These require browser tests to verify:
1. Context is correctly provided to child components
2. Children are rendered correctly via Snippet pattern
3. The component mounts without errors

Existing browser tests in `frameworks/warpkit/__browser_tests__/` demonstrate the established pattern (e.g., `components.svelte.test.ts` tests WarpKitProvider which follows the same context provider pattern).

**Fix**:
Create a browser test file at `frameworks/warpkit/__browser_tests__/query/QueryClientProvider.svelte.test.ts` following the established pattern:

```typescript
import { expect, test, describe } from 'vitest';
import { render } from 'vitest-browser-svelte';
// Create a TestQueryClientProvider.svelte wrapper component
// Test that:
// 1. Component mounts successfully
// 2. QueryClient context is available to children via getQueryClient()
// 3. Children are rendered via Snippet pattern
```

---

### #2. Missing Browser Test for getQueryClient() Context Integration

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/context.ts:36-44`
**Severity**: MEDIUM
**Rule**: svelte5-testing.md - Context testing requires browser environment
**Status**: OPEN

**Issue**:
The `getQueryClient()` function retrieves QueryClient from Svelte context but has no functional test verifying the integration between `QueryClientProvider.svelte` (which calls `setContext`) and `getQueryClient()` (which calls `getContext`).

While the function has a clear error path:
```typescript
if (!client) {
  throw new Error(
    'QueryClient not found. Make sure to wrap your component tree with QueryClientProvider.'
  );
}
```

There is no test verifying:
1. The success path works (context is found when properly wrapped)
2. The error path works (proper error thrown when context missing)

This is a functional integration test that requires browser environment because it involves Svelte's context API.

**Fix**:
Add test cases to the QueryClientProvider browser tests:

```typescript
test('should provide QueryClient context to children', async () => {
  // Render a test component that calls getQueryClient()
  // Verify it receives the QueryClient instance
});

test('should throw error when QueryClient not found in context', async () => {
  // Render component calling getQueryClient() WITHOUT QueryClientProvider
  // Verify the specific error message is thrown
});
```

---

### #3. Test Naming Inconsistency: "does X" vs "should X"

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts`
**Severity**: MEDIUM
**Rule**: testing.md - Test names: `should [behavior] when [condition]`
**Status**: OPEN

**Issue**:
The `QueryClient.spec.ts` test file uses "does X" naming pattern instead of the project standard "should X when Y" pattern.

Examples from QueryClient.spec.ts:
- Line 79: `it('creates client with config', ...)` - should be "should create client with config"
- Line 123: `it('fetches data successfully', ...)` - should be "should fetch data successfully"
- Line 145: `it('interpolates URL parameters', ...)` - should be "should interpolate URL parameters"
- Line 160: `it('throws for missing URL parameters', ...)` - should be "should throw for missing URL parameters"

The sibling package `@warpkit/cache` (ETagCacheProvider.spec.ts) uses the "should X" pattern, creating inconsistency between packages.

The cohesion-checks.md explicitly identified this:
> "Test naming: `it('should X when Y')` - Target Does: `it('does X when Y')` - no 'should' - Flag as MEDIUM - inconsistent"

**Fix**:
Update test names to follow the "should [behavior] when [condition]" pattern for consistency with:
1. testing.md rule: "Test names: `should [behavior] when [condition]`"
2. Sibling package patterns (ETagCacheProvider.spec.ts)

---

## Good Practices

- **Test organization**: Tests are well-organized with describe blocks grouped by method/feature (e.g., `describe('constructor')`, `describe('fetch()')`, `describe('cache integration')`)
- **AAA structure**: All tests follow clear Arrange-Act-Assert structure
- **Mock cleanup**: Proper `vi.clearAllMocks()` in `beforeEach` and timer management with `vi.useFakeTimers()`/`vi.useRealTimers()`
- **Strong assertions**: Tests use specific assertions like `toEqual()` with exact values, not bare `toBeDefined()`
- **Edge case coverage**: QueryClient.spec.ts has 46 tests covering success paths, error paths, cache integration, 304 handling, timeout, and hooks
- **Type safety in tests**: Uses `@ts-expect-error` appropriately when testing runtime errors for unknown keys
- **Module augmentation for tests**: Properly augments `QueryKeyRegistry` with test keys to maintain type safety
