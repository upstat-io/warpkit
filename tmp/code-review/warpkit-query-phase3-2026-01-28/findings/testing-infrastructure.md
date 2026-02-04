# Testing Infrastructure Review Findings

**Reviewer**: testing-infrastructure
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## No Relevant Files

Target does not contain files in my review domain. No issues to report.

### Analysis

The `@warpkit/query` package is a **frontend framework package** for client-side data fetching. Its test files use pure unit testing patterns:

**Test Files Reviewed:**
- `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts` (46 tests)
- `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.spec.ts` (7 tests)

**Testing Approach:**
- Global fetch mock via `vi.stubGlobal('fetch', mockFetch)`
- In-memory mock cache provider using `Map<string, CacheEntry<unknown>>`
- Vitest with fake timers for timeout testing
- No database connections, containers, or backend fixtures

**Why No Test Infrastructure:**
This package tests browser/client-side code that:
1. Makes HTTP fetch requests (mocked)
2. Interacts with a cache provider interface (mocked)
3. Manages request timeouts via AbortController

None of these require:
- PostgreSQL containers (Testcontainers)
- Redis containers
- Database fixtures (`@upstat/test-infrastructure`)
- `PostgresTestInspector` or similar helpers

The testing approach is **appropriate** for this type of code - pure unit tests with mocked external boundaries.

---

## Good Practices Observed

- **Mock at the boundary**: Tests mock `fetch` globally rather than internal implementation details
- **In-memory test doubles**: `createMockCache()` provides a fully functional in-memory cache with a backing `Map`, enabling realistic cache behavior tests
- **Proper mock typing**: Mock functions use explicit type annotations (`vi.fn().mockImplementation(async (key: string) => ...)`)
- **Test isolation**: `vi.clearAllMocks()` in `beforeEach` ensures clean state
- **Timer management**: `vi.useFakeTimers()` / `vi.useRealTimers()` properly managed for timeout tests
- **AbortController testing**: Tests verify timeout behavior by implementing signal-aware mock fetch
