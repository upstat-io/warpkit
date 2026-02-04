# Frontend Review Findings

**Reviewer**: frontend
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Test Naming Inconsistency

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts`
**Severity**: MEDIUM
**Rule**: testing.md - Test names should use "should [behavior] when [condition]" pattern
**Status**: OPEN

**Issue**:
The test file uses inconsistent naming conventions. Tests use patterns like `it('creates client with config')` and `it('fetches data successfully')` instead of the established convention `it('should X when Y')`. The sibling package `@warpkit/cache` uses the `should` pattern consistently (e.g., `it('should create with default options')`).

Evidence from QueryClient.spec.ts:
- Line 79: `it('creates client with config')`
- Line 123: `it('fetches data successfully')`
- Line 137: `it('throws for unknown query key')`
- Line 251: `it('stores response in cache with etag')`

Evidence from ETagCacheProvider.spec.ts (sibling pattern):
- Line 25: `it('should create with default options')`
- Line 43: `it('should return undefined for nonexistent key')`

**Fix**:
Rename test cases to use the `should X when Y` pattern for consistency with the sibling package. Examples:
- `it('creates client with config')` -> `it('should create client with provided config')`
- `it('fetches data successfully')` -> `it('should fetch data successfully when URL is valid')`

---

### #2. Constructor Visibility Inconsistency

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts`
**Severity**: LOW
**Rule**: code-quality.md - Explicit visibility on all class members
**Status**: OPEN

**Issue**:
`NoCacheProvider` class has no explicit constructor definition, while `QueryClient` has `public constructor`. For explicit visibility consistency across the codebase, all classes should have constructors with explicit visibility, or all should omit them consistently.

Evidence:
- `QueryClient.ts:48`: `public constructor(config: QueryClientConfig, options?: QueryClientOptions)`
- `NoCacheProvider.ts`: No constructor (uses implicit default)

**Fix**:
Add explicit constructor to `NoCacheProvider` for consistency:
```typescript
public constructor() {
  // No-op - no initialization needed
}
```

Alternatively, document this as an acceptable pattern difference (classes with initialization logic get explicit constructors, no-op classes can omit them).

---

### #3. Missing QueryClientProvider.svelte Component Test

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClientProvider.svelte`
**Severity**: MEDIUM
**Rule**: testing.md - Public components need tests; coverage-gate.md - 80% coverage required
**Status**: OPEN

**Issue**:
The `QueryClientProvider.svelte` component has no dedicated test file. While it is a simple wrapper component, it is a public export and per testing.md, all public APIs need test coverage. The Svelte 5 context pattern and children rendering should be verified.

The inventory shows no `QueryClientProvider.spec.ts` or `QueryClientProvider.svelte.spec.ts` file.

**Fix**:
Create a browser test file `QueryClientProvider.svelte.spec.ts` (or `.browser.spec.ts` per Svelte 5 testing rules) that verifies:
1. Context is set correctly for child components
2. Children are rendered
3. Error is thrown when getQueryClient() is called outside the provider

Example test structure:
```typescript
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueryClientProvider from './QueryClientProvider.svelte';
// ... test implementation
```

---

### #4. getQueryClient Missing Test Coverage

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/context.ts`
**Severity**: MEDIUM
**Rule**: testing.md - All public methods need tests
**Status**: OPEN

**Issue**:
The `getQueryClient()` function in `context.ts` is a public export but has no dedicated tests. The function throws an error when QueryClient is not found in context (lines 38-42), and this error path should be tested. The `QUERY_CLIENT_CONTEXT` symbol is also exported but not verified in tests.

Evidence from context.ts:
```typescript
export function getQueryClient(): QueryClient {
  const client = getContext<QueryClient | undefined>(QUERY_CLIENT_CONTEXT);
  if (!client) {
    throw new Error(
      'QueryClient not found. Make sure to wrap your component tree with QueryClientProvider.'
    );
  }
  return client;
}
```

**Fix**:
Add tests in a new `context.spec.ts` or include in `QueryClientProvider.svelte.spec.ts`:
1. Test that `getQueryClient()` returns the client when inside provider
2. Test that `getQueryClient()` throws descriptive error when outside provider
3. Verify error message is helpful for debugging

---

### #5. NoCacheProvider Missing Constructor Visibility vs Explicit Methods

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts`
**Severity**: LOW
**Rule**: code-quality.md - Explicit visibility
**Status**: OPEN

**Issue**:
All methods on `NoCacheProvider` have explicit `public async` visibility (good), but there is no explicit constructor. While not strictly required for an empty constructor, this creates inconsistency with `QueryClient` which has `public constructor`.

This is a duplicate observation to Issue #2 but from the visibility angle.

**Fix**:
See Issue #2 fix. This is the same issue from a different rule perspective.

---

## Deferred Items (Not Flagged as OPEN)

The following items were identified but match deferral criteria:

1. **Missing README.md** - `DEFERRED (After Phase 5)`: README documentation deferred per Phase 1 code review #8
2. **Missing useQuery hook** - `DEFERRED (Phase 4)`: useQuery hook is planned for Phase 4 per plan.md
3. **QueryClientOptions missing @example** - Noted in cohesion-checks.md as "now fixable" but not flagged as critical

---

## ADR-Protected Patterns (Not Flagged)

The following patterns were reviewed and confirmed as intentional design decisions:

1. **Empty QueryKeyRegistry interface** - `WON'T FIX (Phase 1 #13)`: Module augmentation requires empty base interface
2. **QueryKey = never type** - `WON'T FIX (Phase 1 #13)`: Expected before consumer augmentation
3. **NoCacheProvider no-op methods** - `WON'T FIX (phase3.md)`: Intentional null object pattern
4. **PascalCase file names** - `WON'T FIX (Phase 2 #2)`: WarpKit pattern for class files
5. **Single-letter generics <K>, <T>** - `WON'T FIX (ADR-006)`: Standard TypeScript convention

---

## Good Practices

- **Svelte 5 Runes Usage**: `QueryClientProvider.svelte` correctly uses `$props()` destructuring pattern (line 25) and `{@render children()}` for snippet rendering (line 30)
- **Type Safety**: Module augmentation pattern in `types.ts` provides compile-time type safety for query keys
- **JSDoc Documentation**: All public APIs have comprehensive JSDoc with `@param`, `@returns`, and `@example` annotations
- **Timeout Pattern**: `QueryClient.ts` correctly implements AbortController with setTimeout and defensive cleanup in both try block (line 110) and finally block (line 134)
- **URL Encoding**: `encodeURIComponent()` properly used for URL parameter interpolation (line 233)
- **Error Messages**: Descriptive error messages that help developers debug issues (e.g., "QueryClient not found. Make sure to wrap your component tree with QueryClientProvider.")
- **Composition**: NoCacheProvider implements CacheProvider interface - composition over inheritance
- **Context Symbol**: Using `Symbol('warpkit:query-client')` for context key prevents key collisions
- **Test Coverage for QueryClient**: 46 tests covering all public methods with good variety of scenarios
- **Mock Cleanup**: Tests properly use `vi.clearAllMocks()` in beforeEach and timer management with afterEach
