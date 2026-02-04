# Testing Review Findings

**Reviewer**: testing
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Inconsistent Test Naming Convention with Sibling Package

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79-613`
**Severity**: MEDIUM
**Rule**: Test naming should use consistent pattern (`should X when Y`)
**Status**: OPEN

**Issue**:
The QueryClient.spec.ts uses "does X" naming pattern (e.g., `it('fetches data successfully')`, `it('throws for unknown query key')`), while the sibling @warpkit/cache package (ETagCacheProvider.spec.ts) uses "should X" pattern (e.g., `it('should return undefined for nonexistent key')`, `it('should create with default options')`).

Examples in QueryClient.spec.ts:
- Line 79: `it('creates client with config')`
- Line 123: `it('fetches data successfully')`
- Line 137: `it('throws for unknown query key')`
- Line 251: `it('stores response in cache with etag')`

Examples in ETagCacheProvider.spec.ts (sibling):
- Line 25: `it('should create with default options')`
- Line 43: `it('should return undefined for nonexistent key')`
- Line 55: `it('should preserve entry metadata')`

**Fix**:
Standardize on one naming pattern across all WarpKit packages. The "should X when Y" pattern is more explicit about expected behavior. Update QueryClient.spec.ts test names to follow the same pattern used in @warpkit/cache.

---

### #2. Missing Tests for context.ts (getQueryClient and QUERY_CLIENT_CONTEXT)

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/context.ts`
**Severity**: HIGH
**Rule**: Every public method has tests (testing.md)
**Status**: OPEN

**Issue**:
The `context.ts` file exports two public members:
1. `QUERY_CLIENT_CONTEXT` symbol (line 19)
2. `getQueryClient()` function (line 36)

These are exported in `index.ts` and thus part of the public API, but there are no tests for either:
- No test verifies that `getQueryClient()` throws the correct error message when called outside a provider
- No test verifies that `getQueryClient()` returns the correct client when inside a provider
- No test verifies the QUERY_CLIENT_CONTEXT symbol is the correct type

The `getQueryClient()` function has specific error-throwing behavior (lines 38-42) that should be tested:
```typescript
if (!client) {
  throw new Error(
    'QueryClient not found. Make sure to wrap your component tree with QueryClientProvider.'
  );
}
```

**Fix**:
Create `context.spec.ts` with tests for:
1. `getQueryClient()` throws Error with correct message when QueryClient not in context
2. `getQueryClient()` returns the client when QueryClient is in context

Note: Testing Svelte context requires browser tests per svelte5-testing.md rules. This may need to be a `.browser.spec.ts` file.

---

### #3. Missing Tests for QueryClientProvider.svelte Component

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClientProvider.svelte`
**Severity**: HIGH
**Rule**: Every public method has tests (testing.md), Svelte 5 components must use browser tests (svelte5-testing.md)
**Status**: OPEN

**Issue**:
The `QueryClientProvider.svelte` component is exported from the package (`index.ts` line 30) but has no test coverage. This component:
1. Sets context with the provided QueryClient (line 27)
2. Renders children using the Snippet pattern (line 30)

While the component is simple, it is framework infrastructure code that other components will depend on. Testing should verify:
- Context is set correctly with the provided client
- Children are rendered properly
- Integration with `getQueryClient()` works

**Fix**:
Create `QueryClientProvider.browser.spec.ts` (browser test required for Svelte 5 components) that tests:
1. QueryClientProvider sets context so children can access via getQueryClient()
2. Children are rendered correctly
3. The correct QueryClient instance is provided (identity check)

---

### #4. Type Assertions Used to Access Private Members in Timeout Tests

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:447,454`
**Severity**: MEDIUM
**Rule**: No `as unknown as X` type assertions (code-quality.md), Testing implementation not behavior (testing.md)
**Status**: OPEN

**Issue**:
Tests for timeout validation use `as unknown as { timeout: number }` to access the private `timeout` member:

Line 447:
```typescript
expect((client as unknown as { timeout: number }).timeout).toBe(30000);
```

Line 454:
```typescript
expect((client as unknown as { timeout: number }).timeout).toBe(5000);
```

This pattern:
1. Uses banned `as unknown as X` type assertion
2. Tests implementation details (private member) instead of observable behavior
3. Creates brittle tests that break if internal structure changes

**Fix**:
Test the timeout behavior through observable outcomes rather than internal state. Options:
1. Test that a fetch aborts after the configured timeout (behavioral test)
2. Remove these specific assertions since timeout behavior is already tested in the `'aborts fetch when timeout is reached'` test (line 408)
3. If the default timeout value must be verified, expose it via a public getter method

The existing test at line 408-425 already correctly tests timeout behavior through observable outcomes by using a mock that respects AbortSignal.

---

### #5. Weak Assertion in clearTimeout Test

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:428-439`
**Severity**: MEDIUM
**Rule**: Strong assertions only - exact values, not just toBeDefined (testing.md)
**Status**: OPEN

**Issue**:
The test `'clears timeout on successful fetch'` (lines 428-439) has a comment-based assertion:

```typescript
it('clears timeout on successful fetch', async () => {
  const config = createTestConfig();
  const client = new QueryClient(config);

  mockFetch.mockResolvedValueOnce(createMockResponse({}));

  await client.fetch('monitors');

  // If timeout wasn't cleared, this would cause issues
  vi.advanceTimersByTime(60000);

  // Test passes if no error is thrown
});
```

The assertion is implicit (no error thrown). This is a weak test that:
1. Has no explicit `expect()` call
2. Relies on side effects that may or may not manifest
3. Doesn't clearly document what behavior is being verified

**Fix**:
Add explicit assertions. Options:
1. Spy on `clearTimeout` and verify it was called:
```typescript
const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
await client.fetch('monitors');
expect(clearTimeoutSpy).toHaveBeenCalled();
```

2. Or verify that the AbortController's abort was NOT called after successful fetch:
```typescript
const abortSpy = vi.fn();
// ... setup mock that checks abort wasn't called
expect(abortSpy).not.toHaveBeenCalled();
```

---

### #6. NoCacheProvider Tests Missing Constructor Visibility Check

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.spec.ts`
**Severity**: LOW
**Rule**: Explicit visibility on all class members (code-quality.md), Constructor visibility inconsistent (cohesion-checks.md)
**Status**: OPEN

**Issue**:
The cohesion-checks.md document notes: "Constructor visibility: `QueryClient.ts:48` has `public constructor`, `NoCacheProvider.ts` does not".

Looking at NoCacheProvider.ts, the class doesn't have an explicit constructor at all (uses default), while QueryClient.ts has `public constructor(config: QueryClientConfig, options?: QueryClientOptions)`.

This is a minor inconsistency between sibling classes in the same package. While TypeScript allows implicit constructors, explicit visibility is the project standard per code-quality.md.

**Fix**:
Add explicit public constructor to NoCacheProvider.ts for consistency:
```typescript
export class NoCacheProvider implements CacheProvider {
  public constructor() {
    // No initialization needed for no-op provider
  }
  // ... rest of class
}
```

---

## Good Practices

- **Comprehensive QueryClient test coverage**: 46 tests covering all public methods including constructor, fetch(), invalidate(), invalidateByPrefix(), getKeyConfig(), getEvents(), setCache(), setEvents()
- **Cache integration tests**: Thorough testing of cache check/store/invalidation flow with mock CacheProvider
- **E-Tag handling tests**: Good coverage of If-None-Match header and 304 Not Modified handling
- **URL interpolation tests**: Tests for single param, multiple params, URL encoding, and missing param error
- **onRequest hook tests**: Both sync and async hook tests
- **Timeout behavior test**: Uses real AbortController signal handling to verify timeout abort behavior
- **AAA structure**: Tests follow clear Arrange-Act-Assert pattern
- **Mock cleanup**: Uses `beforeEach` with `vi.clearAllMocks()` for proper test isolation
- **Type-safe test setup**: Uses `declare module` to augment QueryKeyRegistry for test query keys
- **NoCacheProvider tests**: Complete coverage of the null object pattern, verifying all methods complete without error
- **Strong assertions in most tests**: Tests use exact value comparisons (e.g., `toEqual(responseData)`, `toBe('Bearer token')`) rather than weak `toBeDefined()` checks
