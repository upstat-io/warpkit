# Technical Debt Review Findings

**Reviewer**: technical-debt
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Test naming convention inconsistent with sibling package

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79`
**Severity**: MEDIUM
**Rule**: Testing - consistent test naming convention
**Status**: OPEN

**Issue**:
QueryClient.spec.ts uses test names without "should" prefix (e.g., `it('creates client with config')`, `it('fetches data successfully')`) while the sibling @warpkit/cache package uses "should X when Y" pattern (e.g., `it('should create with default options')`, `it('should return undefined for nonexistent key')`).

From testing.md: "Test names: `should [behavior] when [condition]`"

Evidence:
- QueryClient.spec.ts line 79: `it('creates client with config', ...)`
- QueryClient.spec.ts line 123: `it('fetches data successfully', ...)`
- ETagCacheProvider.spec.ts line 25: `it('should create with default options', ...)`
- ETagCacheProvider.spec.ts line 43: `it('should return undefined for nonexistent key', ...)`

**Fix**:
Update test names in QueryClient.spec.ts and NoCacheProvider.spec.ts to use "should X when Y" pattern for consistency:
- `it('creates client with config')` -> `it('should create client with config')`
- `it('fetches data successfully')` -> `it('should fetch data successfully')`
- Continue for all 46 tests

---

### #2. Constructor visibility inconsistent with sibling package

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:18`
**Severity**: MEDIUM
**Rule**: Code Quality - explicit visibility on all members
**Status**: OPEN

**Issue**:
NoCacheProvider class does not have explicit `public` visibility on its constructor, while QueryClient does have `public constructor`. This is inconsistent within the same package. ETagCacheProvider in @warpkit/cache also lacks explicit constructor visibility.

Evidence:
- QueryClient.ts line 48: `public constructor(config: QueryClientConfig, options?: QueryClientOptions)`
- NoCacheProvider.ts line 18: class has no explicit constructor (uses implicit default)
- ETagCacheProvider.ts line 30: `constructor(options?: ETagCacheProviderOptions)` - no `public`

From code-quality.md: "Explicit Visibility: All public/private explicit"

**Fix**:
The NoCacheProvider uses an implicit default constructor (no constructor defined). If one were needed, it should use `public constructor`. However, since no constructor is defined and the class needs no initialization, this is acceptable. The cohesion-checks.md already flagged this as "MEDIUM - inconsistent" to document but not block. The real fix should be applied to ETagCacheProvider.ts in @warpkit/cache which has a defined constructor without `public`.

---

### #3. Type assertion in test file to access private member

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:447`
**Severity**: LOW
**Rule**: Code Quality - avoid type assertions
**Status**: OPEN

**Issue**:
Test file uses `as unknown as { timeout: number }` to access private `timeout` property for verification. While this is in test code (not production), it creates fragile tests that depend on internal implementation details.

Evidence:
```typescript
// Line 447
expect((client as unknown as { timeout: number }).timeout).toBe(30000);
// Line 454
expect((client as unknown as { timeout: number }).timeout).toBe(5000);
```

**Fix**:
Consider one of these approaches:
1. Add a `getTimeout()` public method if timeout is part of the public API contract
2. Test timeout behavior indirectly through observable behavior (the existing timeout test at line 408 already does this correctly)
3. If these tests are redundant with the behavioral test, remove them

The behavioral test at line 408-426 already validates timeout functionality correctly by testing the actual behavior (fetch is aborted). The direct property access tests (lines 442-455) are redundant and fragile.

---

### #4. Missing JSDoc @example on QueryClientOptions type

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/types.ts:235`
**Severity**: LOW
**Rule**: Documentation - JSDoc with examples for public API
**Status**: OPEN

**Issue**:
QueryClientOptions interface has JSDoc description but lacks an `@example` block, while other similar interfaces in the same file (QueryKeyConfig, QueryClientConfig, CacheProvider, QueryState, UseQueryOptions) all have `@example` blocks.

Evidence:
- QueryClientConfig (line 56-69): Has `@example` block
- CacheProvider (line 85-111): Has `@example` block
- QueryState (line 159-175): Has `@example` block
- UseQueryOptions (line 195-209): Has `@example` block
- QueryClientOptions (line 232-240): Only has description, no `@example`

From cohesion-checks.md: "QueryClientOptions at `types.ts:235-240` has JSDoc but no `@example` - Phase 1 #7 marked 'now fixable'"

**Fix**:
Add `@example` block to QueryClientOptions:
```typescript
/**
 * Options for QueryClient constructor.
 *
 * @example
 * const client = new QueryClient(config, {
 *   cache: new ETagCacheProvider(),
 *   events: warpkitEvents
 * });
 */
export interface QueryClientOptions {
```

---

## Good Practices

- **SRP Compliance**: QueryClient is 256 lines with 4 private fields and 8 public methods - well within acceptable bounds for a single-purpose class
- **No TODO/FIXME/HACK comments**: No technical debt markers found in source code
- **No `any` types**: Only found in test file comments/descriptions, not in actual type definitions
- **No `@upstat/*` dependencies**: Framework correctly maintains zero Upstat dependencies for OSS readiness
- **Proper timeout handling**: AbortController pattern with defensive double-cleanup in try and finally blocks follows concurrency.md best practices
- **URL encoding**: `encodeURIComponent()` correctly used for URL parameter values (line 233)
- **Explicit method visibility**: All public and private methods have explicit visibility modifiers
- **Comprehensive test coverage**: 46 tests covering all public methods with success, error, and edge cases
- **Well-documented public API**: JSDoc with `@param`, `@returns`, `@throws`, and `@example` on all public methods
- **No magic numbers**: Timeout defaults are clearly documented in JSDoc and easily configurable
