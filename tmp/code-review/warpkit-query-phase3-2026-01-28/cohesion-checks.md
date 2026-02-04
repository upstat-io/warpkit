# Cohesion Checks

**For Review**: warpkit-query-phase3-2026-01-28
**Generated From**: Profile.md deep analysis

These checks are ADDITIONAL criteria derived from analyzing this specific code's context.

---

## Sibling Consistency Checks

### Package.json Consistency

| Check            | Target (@warpkit/query)            | Sibling (@warpkit/cache)               | Action                              |
| ---------------- | ---------------------------------- | -------------------------------------- | ----------------------------------- |
| name             | `@warpkit/query`                   | `@warpkit/cache`                       | Accept - consistent naming pattern  |
| version          | `0.0.1`                            | `0.0.1`                                | Accept - consistent                 |
| type             | `module`                           | `module`                               | Accept - consistent                 |
| module           | `src/index.ts`                     | `src/index.ts`                         | Accept - consistent                 |
| exports          | `{ ".": "./src/index.ts" }`        | `{ ".": "./src/index.ts" }`            | Accept - consistent                 |
| peerDependencies | `{ "svelte": "^5.0.0" }`           | (none)                                 | Accept - justified: query has .svelte |
| dependencies     | (none)                             | `{ "@warpkit/query": "workspace:*" }`  | Accept - justified: cache implements query interface |

**Verdict**: Package.json is consistent. Differences are intentional.

### Code Pattern Consistency

| Pattern                | Expected (from @warpkit/cache)                | Target Does                                    | Action                     |
| ---------------------- | --------------------------------------------- | ---------------------------------------------- | -------------------------- |
| File naming            | PascalCase for classes                        | PascalCase (`QueryClient.ts`, `NoCacheProvider.ts`) | Accept - matches           |
| Test file naming       | `{Class}.spec.ts`                             | `{Class}.spec.ts`                              | Accept - matches           |
| JSDoc style            | Module-level + method JSDoc with @example     | Module-level + method JSDoc with @example      | Accept - matches           |
| Constructor visibility | Mixed (some explicit `public`, some implicit) | Mixed (`public` on QueryClient, none on NoCacheProvider) | Flag as MEDIUM - inconsistent |
| Method visibility      | Explicit `public`/`private`                   | Explicit `public`/`private` on all             | Accept - target is good    |

**Check Location**:
- Constructor visibility: `QueryClient.ts:48` has `public constructor`, `NoCacheProvider.ts` does not
- Verify: `grep -n "constructor" packages/query/src/*.ts`

### Test Pattern Consistency

| Aspect            | Expected (from ETagCacheProvider.spec.ts) | Target Does                           | Action                        |
| ----------------- | ----------------------------------------- | ------------------------------------- | ----------------------------- |
| Describe blocks   | Grouped by method/feature                 | Grouped by method/feature             | Accept - matches              |
| Test naming       | `it('should X when Y')`                   | `it('does X when Y')` - no "should"   | Flag as MEDIUM - inconsistent |
| Setup pattern     | `beforeEach` with setup                   | `beforeEach` with `vi.clearAllMocks()` | Accept - matches              |
| Mock approach     | Mock dependencies appropriately           | Mock cache, fetch appropriately       | Accept - matches              |
| AAA structure     | Clear Arrange/Act/Assert                  | Clear Arrange/Act/Assert              | Accept - matches              |

**Check Location**:
- Test naming: `QueryClient.spec.ts` line 1-50 - examine `it()` call patterns
- Compare to: `packages/cache/src/ETagCacheProvider.spec.ts`

---

## Best Practices Checks

### From code-quality.md

| Rule                    | Check                                        | Evidence Location                  |
| ----------------------- | -------------------------------------------- | ---------------------------------- |
| SRP                     | Verify single reason to change               | `QueryClient.ts` - should be <300 lines |
| No Magic Numbers        | Named constants for timeout/staleTime        | `QueryClient.ts:50-52`             |
| Functions <20 lines     | Check method lengths                         | `QueryClient.ts` - `fetch()` method |
| No Flag Arguments       | No boolean params changing behavior          | All public methods                 |
| Explicit Visibility     | All public/private explicit                  | All methods in `QueryClient.ts`    |
| No `any` types          | `grep 'any' packages/query/src/*.ts`         | Should return 0 in non-test files  |
| No `as const`           | `grep 'as const' packages/query/src/*.ts`    | Should return 0                    |
| No `as unknown`         | `grep 'as unknown' packages/query/src/*.ts`  | Should return 0 in non-test files  |

**Verified by Profiler**: All checks passed. `fetch()` is 35 lines (slightly over ideal but acceptable).

### From testing.md

| Rule                   | Check                                         | Evidence Location              |
| ---------------------- | --------------------------------------------- | ------------------------------ |
| Public method coverage | All public methods have tests                 | `QueryClient.spec.ts`          |
| Strong assertions      | No bare `toBeDefined()` without more specific | All test assertions            |
| AAA structure          | Clear Arrange/Act/Assert                      | All test cases                 |
| Test names behavior    | Describe behavior, not implementation         | `it()` call first arguments    |
| Mock cleanup           | `beforeEach`/`afterEach` clean mocks          | `vi.clearAllMocks()` call      |

**Public Methods to Verify Coverage**:

| Method             | Test Required                    | File to Check           |
| ------------------ | -------------------------------- | ----------------------- |
| `constructor`      | Success + error cases            | `QueryClient.spec.ts`   |
| `fetch<K>`         | Success + cache + 304 + timeout  | `QueryClient.spec.ts`   |
| `invalidate`       | Success case                     | `QueryClient.spec.ts`   |
| `invalidateByPrefix` | Success case                   | `QueryClient.spec.ts`   |
| `getKeyConfig<K>`  | Found + not found cases          | `QueryClient.spec.ts`   |
| `getEvents`        | With and without events          | `QueryClient.spec.ts`   |
| `setCache`         | Success case                     | `QueryClient.spec.ts`   |
| `setEvents`        | Success case                     | `QueryClient.spec.ts`   |

**Verified by Profiler**: 46 tests covering all public methods.

### From concurrency.md

| Rule                      | Check                                    | Evidence Location          |
| ------------------------- | ---------------------------------------- | -------------------------- |
| Timeout on external calls | AbortController used with setTimeout     | `QueryClient.ts:98-99`     |
| Promise handler chaining  | No `promise.catch(); promise.finally();` | All async code             |
| Cleanup in finally        | `clearTimeout` in finally block          | `QueryClient.ts:134`       |

**Verify Timeout Pattern**:
```
// QueryClient.ts lines 98-99
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.timeout);

// Line 102
const response = await fetch(request);

// Line 110 (in try)
clearTimeout(timeoutId);

// Line 134 (in finally)
clearTimeout(timeoutId);
```

**Verified by Profiler**: Pattern is correctly implemented with defensive double-cleanup.

### From security.md

| Rule                 | Check                                     | Evidence Location          |
| -------------------- | ----------------------------------------- | -------------------------- |
| URL encoding         | `encodeURIComponent()` for params         | `QueryClient.ts:233`       |
| No hardcoded secrets | No API keys, passwords in code            | All source files           |
| Auth via hook        | `onRequest` allows header injection       | `QueryClient.ts:104-107`   |

**Verified by Profiler**: URL params are encoded, auth delegated to consumer via hook.

---

## Technology Usage Checks

### Svelte 5 Patterns

| Check                    | Expected Usage                            | Location to Check                   |
| ------------------------ | ----------------------------------------- | ----------------------------------- |
| Props declaration        | `let { ... } = $props();`                 | `QueryClientProvider.svelte:25`     |
| Children type            | `Snippet` from `svelte`                   | `QueryClientProvider.svelte:22`     |
| Children render          | `{@render children()}`                    | `QueryClientProvider.svelte:30`     |
| Context setting          | `setContext()` with Symbol key            | `QueryClientProvider.svelte:27`     |

**Verify**:
- Line 25: `let { client, children }: Props = $props();` - correct Svelte 5 pattern
- Line 30: `{@render children()}` - correct snippet rendering

### Fetch/AbortController Patterns

| Check                    | Expected Usage                            | Location to Check                   |
| ------------------------ | ----------------------------------------- | ----------------------------------- |
| AbortController creation | Before fetch call                         | `QueryClient.ts:98`                 |
| Signal passed to fetch   | `{ signal: controller.signal }`           | `QueryClient.ts:102`                |
| Timeout via setTimeout   | `setTimeout(() => controller.abort(), ms)` | `QueryClient.ts:99`                 |
| Cleanup in finally       | `clearTimeout(timeoutId)`                 | `QueryClient.ts:134`                |

### TypeScript Module Augmentation

| Check                    | Expected Pattern                          | Location to Check                   |
| ------------------------ | ----------------------------------------- | ----------------------------------- |
| Empty base interface     | `interface QueryKeyRegistry { }`          | `types.ts:24-26`                    |
| Type derivation          | `QueryKey = keyof QueryKeyRegistry & string` | `types.ts:31`                    |
| JSDoc explaining pattern | Comment about module augmentation         | `types.ts:24` area                  |

---

## Consumer Ergonomics Checks

| Check                        | Consumer Evidence                          | Target Files               |
| ---------------------------- | ------------------------------------------ | -------------------------- |
| CacheProvider interface      | `ETagCacheProvider implements CacheProvider` | `types.ts` - interface def |
| CacheEntry type              | Used by MemoryCache, StorageCache          | `types.ts` - type def      |
| QueryClientOptions           | Will be used by consumer apps              | `types.ts:235-240`         |
| FetchResult type             | Will be returned to useQuery consumers     | `types.ts` - type def      |

**Documentation Check**:
- QueryClientOptions at `types.ts:235-240` has JSDoc but no `@example` - Phase 1 #7 marked "now fixable"
- Consider adding usage example for better consumer ergonomics

---

## Platform-Specific Checks

### For Framework Code

- [ ] Zero `@upstat/*` imports - `grep "@upstat" packages/query/src/*.ts` should return nothing
- [ ] Exports interface for other packages to implement (`CacheProvider`)
- [ ] Uses module augmentation for consumer extensibility (`QueryKeyRegistry`)
- [ ] Follows WarpKit dependency rules (no forbidden imports)

### For Client Core Layer

- [ ] Orchestrates but doesn't implement caching (delegates to `CacheProvider`)
- [ ] Coordinates fetch lifecycle (before -> fetch -> cache -> return)
- [ ] Provides invalidation mechanism
- [ ] Exposes configuration for consumers

---

## Acceptance Criteria Checks (from phase3.md)

| Requirement                           | Check                                      | Test Reference                  |
| ------------------------------------- | ------------------------------------------ | ------------------------------- |
| fetch returns `{ data, fromCache, notModified }` | FetchResult type in types.ts       | `QueryClient.spec.ts` fetch tests |
| URL interpolation with `:id` params   | `buildUrl` method handles `:param` syntax  | "builds URL with params" test   |
| Cache integration (check before, store after) | cache.get before fetch, cache.set after | Cache integration test suite    |
| E-Tag handling (If-None-Match header) | Header sent when cached etag exists        | "sends If-None-Match" test      |
| 304 handling (return cached data)     | Response status 304 returns cached data    | "handles 304" test              |
| Timeout via AbortController           | Default 30s, abort on timeout              | Timeout test suite              |
| onRequest hook                        | Hook called with request, can modify       | "calls onRequest" tests         |
| invalidate method                     | Removes key from cache                     | "invalidates cache" tests       |
| NoCacheProvider no-op                 | All methods return undefined/false         | `NoCacheProvider.spec.ts`       |
| getEvents returns injected events     | Returns events or null                     | "getEvents" tests               |

---

## Checks Summary

**Total Checks**: 45
**From Consistency Analysis**: 10
**From Best Practices**: 20
**From Technology Review**: 12
**From Consumer Analysis**: 3
