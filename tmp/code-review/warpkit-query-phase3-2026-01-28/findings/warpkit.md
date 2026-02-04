# WarpKit Review Findings

**Reviewer**: warpkit
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Test naming inconsistency with sibling package

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79`
**Severity**: MEDIUM
**Rule**: Consistency with sibling package patterns
**Status**: OPEN

**Issue**:
Test naming style differs from the sibling `@warpkit/cache` package. QueryClient.spec.ts uses `it('creates client with config', ...)` pattern (declarative without "should"), while ETagCacheProvider.spec.ts uses `it('should create with default options', ...)` pattern. This inconsistency across WarpKit packages makes the codebase harder to maintain.

Examples from QueryClient.spec.ts:
- Line 79: `it('creates client with config', ...)`
- Line 86: `it('uses NoCacheProvider by default', ...)`
- Line 123: `it('fetches data successfully', ...)`

Examples from ETagCacheProvider.spec.ts:
- Line 25: `it('should create with default options', ...)`
- Line 43: `it('should return undefined for nonexistent key', ...)`

**Fix**:
Standardize test naming across all WarpKit packages. The recommended pattern per testing.md is `should [behavior] when [condition]`. Update QueryClient.spec.ts and NoCacheProvider.spec.ts to match the sibling package pattern.

---

### #2. NoCacheProvider missing explicit `public constructor`

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:18`
**Severity**: LOW
**Rule**: code-quality.md - Explicit visibility for all members
**Status**: OPEN

**Issue**:
`NoCacheProvider` class does not have an explicit constructor, while `QueryClient` (line 48) has `public constructor(...)`. For consistency with code-quality rules requiring explicit visibility and alignment with QueryClient in the same package, NoCacheProvider should have an explicit public constructor (even if empty/default).

**Fix**:
Add explicit constructor to NoCacheProvider:
```typescript
export class NoCacheProvider implements CacheProvider {
	public constructor() {
		// No-op - default constructor
	}
	// ... rest of class
}
```

---

### #3. Missing tests for `getQueryClient()` context getter

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/context.ts:36-44`
**Severity**: MEDIUM
**Rule**: testing.md - Every public method needs tests
**Status**: OPEN

**Issue**:
The `getQueryClient()` function exported from `context.ts` is a public API but has no tests. This function throws an error when QueryClient is not found in context, which is important behavior to verify. The function is exported from index.ts (line 23), confirming it's part of the public API.

Public methods that should be tested:
1. Returns QueryClient when context exists
2. Throws meaningful error when context does not exist

**Fix**:
Create a test file `context.spec.ts` or add tests to QueryClient.spec.ts that verify:
```typescript
describe('getQueryClient()', () => {
	it('should throw when QueryClient not in context', () => {
		// Need to mock getContext to return undefined
		expect(() => getQueryClient()).toThrow(
			'QueryClient not found. Make sure to wrap your component tree with QueryClientProvider.'
		);
	});
});
```

Note: Testing the success path requires Svelte component testing infrastructure, which may be deferred to Phase 4 with useQuery hook integration tests.

---

### #4. Missing tests for QueryClientProvider.svelte component

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClientProvider.svelte`
**Severity**: MEDIUM
**Rule**: testing.md - Every public method needs tests
**Status**: OPEN

**Issue**:
The `QueryClientProvider.svelte` component is exported from index.ts (line 30) but has no test file. This is a public API component that:
1. Sets QueryClient in Svelte context
2. Renders children via Snippet pattern

While this is a simple component, testing that it correctly provides context to children is important for consumer confidence.

**Fix**:
Create `QueryClientProvider.browser.spec.ts` (browser test per svelte5-testing.md) that verifies:
1. Component renders children
2. Child components can access QueryClient via getQueryClient()
3. Correct QueryClient instance is provided

Note: This requires browser test infrastructure (vitest-browser-svelte + Playwright) per Svelte 5 testing rules.

---

### #5. Cache key params not URL-encoded in `buildCacheKey`

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:250-251`
**Severity**: LOW
**Rule**: security.md - URL encoding for user input
**Status**: OPEN

**Issue**:
In `buildCacheKey()`, parameter values are included directly without URL encoding:
```typescript
const sortedParams = Object.keys(params)
	.sort()
	.map((k) => `${k}=${params[k]}`)  // params[k] not encoded
	.join('&');
```

While `resolveUrl()` (line 233) correctly uses `encodeURIComponent()` for URL building, the cache key builder does not. This could cause cache key collisions if param values contain `&` or `=` characters.

Example: `{ a: "x=y", b: "1" }` would produce cache key `?a=x=y&b=1` which is ambiguous.

**Fix**:
Encode parameter values in cache keys:
```typescript
const sortedParams = Object.keys(params)
	.sort()
	.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
	.join('&');
```

---

### #6. Test uses `as unknown as` type assertion to access private member

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:447`
**Severity**: LOW
**Rule**: code-quality.md - No type assertions (as unknown)
**Status**: OPEN

**Issue**:
Tests at lines 447 and 454 use `as unknown as { timeout: number }` to access the private `timeout` property:
```typescript
expect((client as unknown as { timeout: number }).timeout).toBe(30000);
```

This pattern violates the code-quality.md rule against `as unknown` assertions. It's also fragile - if the private field is renamed or removed, these tests break at runtime rather than compile time.

**Fix**:
Instead of accessing private members, test the observable behavior. The timeout can be verified via its effect on fetch behavior (which is already tested at line 408-426). Remove lines 442-455 as they duplicate tested behavior.

Alternatively, if verifying the default value is important, expose a `getTimeout()` public method or include timeout in options returned by a config getter.

---

## Good Practices

- **Excellent JSDoc documentation**: All public methods have clear JSDoc with @param, @returns, and @example where appropriate (QueryClient.ts, types.ts, context.ts)
- **Proper AbortController timeout pattern**: Implements the recommended timeout pattern with defensive double-cleanup in try/finally (QueryClient.ts:98-135)
- **Type-safe module augmentation**: QueryKeyRegistry pattern enables consumer type safety without hardcoding keys
- **Clean separation of concerns**: NoCacheProvider follows null object pattern correctly, keeping cache logic out of QueryClient
- **URL encoding in resolveUrl**: Properly encodes parameter values using encodeURIComponent (line 233)
- **Comprehensive fetch tests**: 46 tests covering success, error, cache integration, timeout, URL interpolation, and hooks
- **No @upstat/* dependencies**: Package is correctly OSS-ready with zero Upstat dependencies
- **Consistent file naming**: PascalCase for class files matches WarpKit pattern
- **Explicit method visibility**: All public/private methods have explicit visibility modifiers
- **Proper error messages**: Error messages include helpful context (e.g., "Unknown query key: {key}", "Missing param: {param}")
