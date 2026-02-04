# Svelte Review Findings

**Reviewer**: svelte
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Missing Test Coverage for getQueryClient Context Function

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/context.ts:36`
**Severity**: MEDIUM
**Rule**: testing.md - "Every public method has tests"
**Status**: OPEN

**Issue**:
The `getQueryClient()` function is a public export with error-throwing behavior (lines 38-42) but has no test coverage. This function:
1. Retrieves context via `getContext()`
2. Throws a descriptive error if context is not found

While the error message is well-crafted, the error path is not verified by tests.

**Fix**:
Add a test file `context.spec.ts` or add context tests to an existing test file. Since testing Svelte context requires browser tests (per svelte5-testing.md), this could be deferred to Phase 4 when `useQuery` hook integration tests will naturally exercise this code path.

**Alternative**: Mark as DEFERRED if testing is planned for Phase 4 integration.

---

### #2. Inconsistent Test Naming Convention

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts`
**Severity**: MEDIUM
**Rule**: testing.md - Test names: `should [behavior] when [condition]`
**Status**: OPEN

**Issue**:
The test file uses `it('does X when Y')` format (lines 79, 86, 102, etc.) instead of the recommended `it('should X when Y')` format documented in testing.md. Examples:

- Line 79: `it('creates client with config')`
- Line 86: `it('uses NoCacheProvider by default')`
- Line 123: `it('fetches data successfully')`

The sibling package `@warpkit/cache` uses `it('should X')` format in `ETagCacheProvider.spec.ts`.

**Fix**:
Update test names to use `should` prefix for consistency:
- `'creates client with config'` -> `'should create client with config'`
- `'uses NoCacheProvider by default'` -> `'should use NoCacheProvider by default'`

---

## Good Practices

- **Svelte 5 Patterns**: `QueryClientProvider.svelte` correctly uses `$props()` for prop declaration (line 25), `Snippet` type for children (line 22), and `{@render children()}` for rendering (line 30)
- **Context Pattern Consistency**: The component follows the exact same pattern as `WarpKitProvider.svelte` in the parent framework, ensuring architectural consistency
- **Symbol-Based Context Key**: Uses `Symbol('warpkit:query-client')` for context key (context.ts:19), preventing accidental key collisions
- **Descriptive Error Message**: `getQueryClient()` throws a helpful error message that guides developers to the solution (wrap with `QueryClientProvider`)
- **JSDoc Documentation**: Both the component (lines 2-12) and context module (lines 1-6, 25-35) have comprehensive JSDoc comments with examples
- **Clean Separation**: Context logic is cleanly separated from the component into `context.ts`, following single-responsibility principle
- **Type Safety**: Props interface is properly typed with `QueryClient` and `Snippet` types
