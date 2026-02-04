# Deferred Items

**For Review**: warpkit-query-phase3-2026-01-28

**CRITICAL**: If a reviewer finding matches an item below, mark it as:

- `DEFERRED` (for phase deferrals)
- `WON'T FIX (ADR)` (for ADR-protected patterns)

Do NOT mark as `OPEN`.

---

## Deferred to Later Phases

| Item                          | Current Phase | Deferred To     | Reason                              | Source          |
| ----------------------------- | ------------- | --------------- | ----------------------------------- | --------------- |
| useQuery hook implementation  | Phase 3       | Phase 4         | Svelte integration phase            | `phase4.md`     |
| README.md documentation       | Phase 3       | After Phase 5   | Per Phase 1 code review decision    | Phase 1 #8      |
| Package.json description      | Phase 3       | Before OSS      | Minimal package for internal use    | Phase 1 #10     |
| Package.json license          | Phase 3       | Before OSS      | Not needed until OSS extraction     | Phase 1 #11     |
| QueryError custom type        | Phase 3       | Future phase    | Consideration only, not planned     | Phase 1 #17     |
| createMockQueryClient helper  | Phase 3       | Phase 5         | Test infrastructure phase           | `plan.md`       |

### Detection Patterns

When to mark as DEFERRED:

- Issue mentions: "missing useQuery", "where is useQuery hook", "no hook implementation"
  - Status: `DEFERRED (Phase 4): useQuery hook is planned for Phase 4 per plan.md`

- Issue mentions: "missing README", "no documentation file", "package lacks README.md"
  - Status: `DEFERRED (After Phase 5): README deferred per Phase 1 code review #8`

- Issue mentions: "missing package.json description", "empty description field"
  - Status: `DEFERRED (Before OSS): Metadata deferred per Phase 1 code review #10`

- Issue mentions: "missing license", "no license field"
  - Status: `DEFERRED (Before OSS): License deferred per Phase 1 code review #11`

- Issue mentions: "custom error type", "QueryError type", "typed errors"
  - Status: `DEFERRED (Future): QueryError type was consideration only, not planned`

- Issue mentions: "mock QueryClient", "test helper for QueryClient", "createMockQueryClient"
  - Status: `DEFERRED (Phase 5): Test infrastructure planned for Phase 5`

---

## ADR-Protected (Won't Fix)

| Pattern                        | ADR Reference | Decision                              | Rationale                              |
| ------------------------------ | ------------- | ------------------------------------- | -------------------------------------- |
| Empty QueryKeyRegistry interface | Phase 1 #13  | Module augmentation requires empty base | Consumer extends via declaration merging |
| QueryKey = never type          | Phase 1 #13   | Expected before consumer augmentation | Union is empty until keys are registered |
| No maxAge/hard expiration      | Phase 1 #14   | E-Tag validation via HTTP 304         | Server controls freshness, not client  |
| Untyped invalidateOn strings   | Phase 1 #15   | Intentional decoupling                | Query package has no knowledge of WarpKit events |
| staleTime in two places        | Phase 1 #16   | Config default vs stored instance     | Config sets default, entry stores actual value |
| NoCacheProvider no-op methods  | phase3.md     | Default provider when caching disabled | Intentional null object pattern        |
| Single-letter generics         | ADR-006       | Standard TypeScript convention        | `<K>`, `<T>` are industry standard     |
| PascalCase file names          | Phase 2 #2    | WarpKit pattern for class files       | Classes use PascalCase, utilities use kebab-case |
| Storage utilities unused       | Phase 2 #3    | Exported for external consumers       | Not dead code, designed for OSS users  |

### Detection Patterns

When to mark as WON'T FIX (ADR):

- Issue type: "empty interface", "interface with no members"
  - Check: Is it `QueryKeyRegistry`?
  - Status: `WON'T FIX (Phase 1 #13): Module augmentation requires empty base interface`

- Issue type: "type is never", "union is never"
  - Check: Is it `QueryKey` type before consumer augmentation?
  - Status: `WON'T FIX (Phase 1 #13): QueryKey is never until consumer registers keys via augmentation`

- Issue type: "missing expiration", "no TTL", "no maxAge"
  - Check: Is it about CacheEntry lacking time-based expiration?
  - Status: `WON'T FIX (Phase 1 #14): E-Tag validation via HTTP 304, server controls freshness`

- Issue type: "untyped strings", "string literal union would be better"
  - Check: Is it about `invalidateOn?: string[]`?
  - Status: `WON'T FIX (Phase 1 #15): Intentional decoupling - query has no knowledge of event types`

- Issue type: "duplicate property", "staleTime defined twice"
  - Check: Is it about staleTime in QueryKeyConfig AND CacheEntry?
  - Status: `WON'T FIX (Phase 1 #16): Config sets default, entry stores actual computed value`

- Issue type: "method does nothing", "empty implementation", "no-op"
  - Check: Is it about NoCacheProvider methods?
  - Status: `WON'T FIX (phase3.md): NoCacheProvider is intentional null object pattern`

- Issue type: "single letter generic", "poor generic naming", "use descriptive name for K"
  - Check: Is it about `<K>`, `<T>`, `<V>` generics?
  - Status: `WON'T FIX (ADR-006): Single-letter generics are standard TypeScript convention`

- Issue type: "PascalCase file name", "should be kebab-case"
  - Check: Is the file a class definition (QueryClient.ts, NoCacheProvider.ts)?
  - Status: `WON'T FIX (Phase 2 #2): WarpKit uses PascalCase for class files`

- Issue type: "unused export", "dead code", "exported but not used"
  - Check: Is it about storage utilities in @warpkit/cache?
  - Status: `WON'T FIX (Phase 2 #3): Utilities are for external consumers post-OSS`

---

## Known Temporary States

| State                        | Reason                              | Resolution Timeline    | Source          |
| ---------------------------- | ----------------------------------- | ---------------------- | --------------- |
| No consumer app integration  | Phase 3 is package implementation   | Phase 4-5              | plan.md         |
| Limited test infrastructure  | createMockQueryClient planned       | Phase 5                | plan.md         |
| Types re-exported from cache | Dependency inversion in progress    | Stable after Phase 5   | architecture    |

---

## Technology-Handled (Don't Flag as Missing)

| What Reviewer Might Flag          | Why It's Wrong                          | Technology               | Reference           |
| --------------------------------- | --------------------------------------- | ------------------------ | ------------------- |
| "Missing retry logic"             | Retry is consumer responsibility        | Design decision          | `04-query-package.md` |
| "fetch without try/catch"         | fetch IS in try block                   | Code structure           | `QueryClient.ts:101-135` |
| "clearTimeout called twice"       | Defensive cleanup is correct            | concurrency.md pattern   | `QueryClient.ts:110,134` |
| "No global state"                 | Intentional - testability via DI        | Design principle         | `04-query-package.md` |
| "Events injected not from context" | Intentional - avoids implicit deps     | Design principle         | `04-query-package.md` |
| "Works without cache"             | This is the KEY design principle        | NoCacheProvider pattern  | `04-query-package.md` |

---

## Aggregator Instructions

When processing findings:

1. Check each issue against "Deferred to Later Phases" table
2. Check each issue against "ADR-Protected" table
3. Check each issue against "Known Temporary States" table
4. Check each issue against "Technology-Handled" table
5. If ANY match, use corresponding status instead of OPEN
6. Include source reference in status explanation

### Status Assignment Examples

**Example 1**: "QueryKeyRegistry is an empty interface with no members"

- Match: ADR-Protected table, "Empty QueryKeyRegistry interface"
- Status: `WON'T FIX (Phase 1 #13): Module augmentation requires empty base interface. Consumers extend via declaration merging.`

**Example 2**: "Missing README.md for the package"

- Match: Deferred table, "README.md documentation"
- Status: `DEFERRED (After Phase 5): README documentation deferred per Phase 1 code review #8`

**Example 3**: "The fetch method doesn't implement retry logic"

- Match: Technology-Handled table, "Missing retry logic"
- Status: `WON'T FIX (Design): Retry is consumer responsibility per 04-query-package.md design decision`

**Example 4**: "staleTime property is defined in both QueryKeyConfig and CacheEntry"

- Match: ADR-Protected table, "staleTime in two places"
- Status: `WON'T FIX (Phase 1 #16): Config sets default staleTime, CacheEntry stores the computed value for the specific entry`

**Example 5**: "NoCacheProvider.get() always returns undefined - this is a no-op"

- Match: ADR-Protected table, "NoCacheProvider no-op methods"
- Status: `WON'T FIX (phase3.md): NoCacheProvider is an intentional null object pattern for when caching is disabled`

**Example 6**: "Missing useQuery hook - how do components use this?"

- Match: Deferred table, "useQuery hook implementation"
- Status: `DEFERRED (Phase 4): useQuery hook is planned for Phase 4 Svelte integration per plan.md`

**Example 7**: "Generic parameter <K> should have a more descriptive name"

- Match: ADR-Protected table, "Single-letter generics"
- Status: `WON'T FIX (ADR-006): Single-letter generic parameters are standard TypeScript convention`
