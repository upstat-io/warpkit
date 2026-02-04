# Testing Naming Review Findings

**Reviewer**: testing-naming
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Inconsistent Test Naming Convention Between Sibling Packages

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79-612`
**Severity**: MEDIUM
**Rule**: Test names should use consistent "should X when Y" pattern (testing.md)
**Status**: OPEN

**Issue**:
QueryClient.spec.ts uses present tense without "should" (e.g., `it('creates client with config')`, `it('fetches data successfully')`), while the sibling package @warpkit/cache uses the "should X when Y" convention (e.g., `it('should create with default options')`, `it('should return undefined for nonexistent key')`).

Evidence from QueryClient.spec.ts:
- Line 79: `it('creates client with config', () => {`
- Line 86: `it('uses NoCacheProvider by default', async () => {`
- Line 102: `it('accepts custom cache provider', async () => {`
- Line 123: `it('fetches data successfully', async () => {`
- Line 137: `it('throws for unknown query key', async () => {`
- Line 145: `it('interpolates URL parameters', async () => {`

Evidence from ETagCacheProvider.spec.ts (sibling):
- Line 25: `it('should create with default options', () => {`
- Line 31: `it('should accept custom memory and storage options', async () => {`
- Line 43: `it('should return undefined for nonexistent key', async () => {`
- Line 48: `it('should return entry from memory', async () => {`

The briefing.md noted this as a MEDIUM deviation: "Test naming: 'should X' vs 'does X'".

**Fix**:
Update test names in QueryClient.spec.ts to use the "should" prefix for consistency:
- `'creates client with config'` -> `'should create client with config'`
- `'uses NoCacheProvider by default'` -> `'should use NoCacheProvider by default'`
- `'fetches data successfully'` -> `'should fetch data successfully'`
- etc.

---

### #2. NoCacheProvider.spec.ts Uses Mixed Naming Convention

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.spec.ts:6-69`
**Severity**: MEDIUM
**Rule**: Test names should use consistent "should X when Y" pattern (testing.md)
**Status**: OPEN

**Issue**:
NoCacheProvider.spec.ts uses a hybrid naming pattern mixing method names with descriptions, which differs from both QueryClient.spec.ts and the sibling package. Some tests describe behavior well, but the convention is inconsistent with the sibling package.

Evidence:
- Line 6: `it('get() returns undefined for any key', async () => {`
- Line 14: `it('get() returns undefined even after set()', async () => {`
- Line 27: `it('set() completes without error', async () => {`
- Line 39: `it('delete() completes without error', async () => {`
- Line 53: `it('clear() completes without error', async () => {`

These names include the method name (`get()`, `set()`, etc.) which is acceptable, but they lack the "should" prefix used in the sibling package.

**Fix**:
Update test names to use the "should" prefix for consistency with @warpkit/cache:
- `'get() returns undefined for any key'` -> `'should return undefined from get() for any key'`
- `'set() completes without error'` -> `'should complete set() without error'`

Or alternatively, since these tests are already grouped in the top-level describe block, use the simpler format matching the sibling:
- `'get() returns undefined for any key'` -> `'should return undefined for any key'` (since context is clear from describe)

---

## Good Practices

- Both test files use clear describe blocks organized by feature/method (`constructor`, `fetch()`, `cache integration`, `timeout`, etc.)
- Test files follow AAA (Arrange-Act-Assert) structure with clear separation
- Mock setup is centralized and uses `beforeEach` with `vi.clearAllMocks()` for proper cleanup
- Test helper functions (`createTestConfig`, `createMockCache`, `createMockResponse`) are well-named and reusable
- Strong assertions are used throughout (e.g., `expect(result.data).toEqual(responseData)` rather than just `toBeDefined()`)
- Edge cases are tested (unknown keys, missing parameters, stale cache, 304 responses, timeout)
- Tests follow the pattern of testing behavior, not implementation details
- NoCacheProvider.spec.ts correctly tests the null object pattern behavior (verifying methods complete without error)
- Both files import and use vitest consistently
