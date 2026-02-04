# Review Briefing

**Target**: frameworks/warpkit/packages/query/src/
**Type**: Framework - Svelte 5/WarpKit - Client Core (data fetching)
**Review ID**: warpkit-query-phase3-2026-01-28

---

## What You're Reviewing

**What it is**: The `@warpkit/query` package - the core data fetching infrastructure for WarpKit applications. It provides `QueryClient` (config-driven fetching with caching and invalidation), `NoCacheProvider` (default no-op cache), and `QueryClientProvider.svelte` (Svelte context provider). This is the "Q" in a TanStack Query-like pattern, but designed for WarpKit's E-Tag-based caching strategy.

**Why it exists**: WarpKit applications need a standardized way to fetch, cache, and invalidate server data. Rather than each component managing its own fetch logic, `QueryClient` centralizes data fetching with config-driven query definitions. The key design principle is "works without any cache" - if no `CacheProvider` is supplied, every fetch hits the network. This makes the system testable and progressive (add caching for performance, not correctness).

**How it fits**: This package sits at the core of WarpKit's data layer. The sibling package `@warpkit/cache` implements the `CacheProvider` interface defined here. Phase 4 will add `useQuery` hook that wraps `QueryClient` for Svelte components. All data-fetching components in WarpKit apps will ultimately depend on this package.

**What to expect**: Framework-quality code with explicit TypeScript types, JSDoc documentation on all public APIs, and comprehensive test coverage. The module augmentation pattern for `QueryKeyRegistry` enables type-safe query keys. The code uses Svelte 5 runes in the provider component.

---

## Architectural Context

### Classification

| Attribute    | Value                          | What This Means                                                              |
| ------------ | ------------------------------ | ---------------------------------------------------------------------------- |
| Type         | Framework                      | Stricter patterns required. API stability matters. Zero `@upstat/*` deps.    |
| Platform     | Svelte 5 / WarpKit             | Uses `$props()` runes, `Snippet` children, context API. Expect Svelte 5 patterns. |
| Layer        | Client Core (data fetching)    | Orchestrates fetch, cache, invalidation. Not UI, not a utility.              |
| Blast Radius | Medium-High                    | `@warpkit/cache` depends on this (5 imports). All future `useQuery` consumers will depend on this. |

### Classification Reasoning

This code is a **framework-level package** that provides the core data fetching infrastructure for WarpKit applications. It is NOT an application-specific implementation - it's designed to be consumed by any WarpKit consumer application (currently `warpkit-frontend-app`, potentially external consumers post-OSS). The classification as "Framework" rather than "Shared Library" is evidenced by: (1) Location in `frameworks/warpkit/packages/` - the designated framework location, (2) Exports an interface (`CacheProvider`) that other packages implement, (3) Zero `@upstat/*` dependencies (WarpKit is OSS-ready), (4) Type-safe module augmentation pattern for consumer extensibility.

---

## Plan Context

### Active Plan

**Plan**: warpkit-v2-query-cache
**Phase**: 3 of 5 (Query Client)

**Design Intent**:

> "Implement two decoupled packages for WarpKit's data fetching architecture: `@warpkit/query` provides config-driven data fetching with a pluggable cache interface, and `@warpkit/cache` implements E-Tag conditional requests with two-tier caching (memory + localStorage)."

> "Key principle: Works without any cache. If no CacheProvider is supplied, every fetch hits the network. Events are injected at construction (not implicitly via `getWarpKit()`), making the package fully testable."

**What This Means for Review**:
The design explicitly prioritizes testability through DI (events and cache are injected, not accessed globally), working without cache (NoCacheProvider is intentional, not a missing feature), and decoupling (@warpkit/query has no dependencies on @warpkit/cache - the relationship is inverted). Reviewers should evaluate whether the implementation achieves these goals, not whether different goals would be better.

**Deferred Features** (see deferrals.md for full list):

- `useQuery` hook implementation (Phase 4)
- README.md documentation (after Phase 5)
- Package.json metadata like description/license (before OSS extraction)
- QueryError custom type (future consideration)
- Test infrastructure helpers like `createMockQueryClient` (Phase 5)

---

## Focus Areas (from User)

1. TESTABILITY - Can every class/method be tested in isolation?
2. COMPOSITION OVER INHERITANCE - Flag inheritance hierarchies
3. THREE-LAYER TESTING - Unit, Functional, E2E coverage
4. CONSISTENCY - Does this match sibling packages/components?
5. TECHNOLOGY USAGE - Is technology used correctly per reference docs?
6. BEST PRACTICES - Does code follow documented best practices?

**Review Instruction**: Prioritize these areas, but still apply all standard criteria.

---

## What Reviewers Should Know

### Technology Context

**Svelte 5 Runes** (in QueryClientProvider.svelte):

- This code uses `$props()` for component props (line 25)
- Svelte 5 provides the Snippet pattern for children composition
- Do NOT flag: `let { client, children }: Props = $props();` - this IS correct Svelte 5 syntax
- Do NOT flag: `{@render children()}` - this IS correct Svelte 5 snippet rendering
- Do NOT flag: Missing `onDestroy` - component only sets context, no resources to clean up

**Fetch API / AbortController** (in QueryClient.ts):

- This code uses AbortController with setTimeout for fetch timeout (lines 98-135)
- Best practices require timeout on ALL external calls
- Do NOT flag: "fetch without try/catch" - fetch IS in a try block
- Do NOT flag: "clearTimeout called twice" - defensive cleanup in both try and finally is CORRECT per concurrency.md

**TypeScript Module Augmentation** (in types.ts):

- `QueryKeyRegistry` is an empty interface for module augmentation
- Consumers extend it to define their query keys with type safety
- Do NOT flag: "Empty interface" - this is the required pattern
- Do NOT flag: "QueryKey = never" - expected before consumer augmentation

### Pattern References

When checking for consistency, use these as gold standards:

| Pattern               | Reference                                    | Why This Reference                           |
| --------------------- | -------------------------------------------- | -------------------------------------------- |
| WarpKit package structure | `@warpkit/cache` package                 | Sibling package, same patterns expected      |
| Class file naming     | `QueryClient.ts`, `ETagCacheProvider.ts`     | PascalCase for class files is WarpKit pattern |
| Test structure        | `QueryClient.spec.ts`                        | 46 tests with describe blocks by feature     |
| JSDoc style           | `QueryClient.ts` method docs                 | `@param`, `@returns`, `@example` when useful |

---

## Critical Consistency Findings

### Issues to Flag

No critical consistency issues identified. The implementation follows all documented patterns.

### Intentional Deviations (Don't Flag)

| Deviation                           | Reason                                              | Source               |
| ----------------------------------- | --------------------------------------------------- | -------------------- |
| @warpkit/query has `peerDependencies.svelte`, @warpkit/cache doesn't | Query has Svelte components, cache doesn't | Justified difference |
| QueryClient throws errors, cache fails silently | Different domains - fetch errors are critical, cache misses aren't | Design decision |
| CacheProvider is async, internal caches can be sync | Interface is async for flexibility, implementations can be sync | Architecture decision |

### Minor Deviations (Document, Not Blocking)

| Deviation                     | Evidence                                    | Severity |
| ----------------------------- | ------------------------------------------- | -------- |
| Test naming: "should X" vs "does X" | QueryClient.spec uses "does X", cache uses "should X" | MEDIUM |
| Constructor visibility inconsistent | Some classes have `public constructor`, some don't | MEDIUM |

---

## ADR-Protected Patterns

These patterns are intentional design decisions. Do NOT flag:

| Pattern                      | Decision                                    | ADR Source    |
| ---------------------------- | ------------------------------------------- | ------------- |
| Empty `QueryKeyRegistry` interface | Module augmentation requires empty base | Phase 1 #13   |
| `QueryKey = never` type      | Expected before consumer augmentation       | Phase 1 #13   |
| No maxAge/hard expiration    | E-Tag validation via HTTP 304               | Phase 1 #14   |
| Untyped `invalidateOn` strings | Intentional decoupling from WarpKit events | Phase 1 #15   |
| `staleTime` in two places    | Config default vs stored instance           | Phase 1 #16   |
| NoCacheProvider no-op methods | Default provider when caching disabled     | phase3.md     |
| Single-letter generics `<K>`, `<T>` | Standard TypeScript convention         | ADR-006       |
| PascalCase file names        | WarpKit pattern for class files             | Phase 2 #2    |

---

## Best Practices Status

### Violations Found (Flag These)

None. The implementation is fully compliant with documented best practices.

### Verified Compliant

- **SRP**: QueryClient has single purpose (256 lines, 4 deps)
- **No Magic Numbers**: Timeout assigned to named variable
- **Explicit Visibility**: All public/private explicitly marked
- **No `any` types**: Confirmed via grep
- **No `as const`**: Confirmed via grep
- **Timeout on fetch**: AbortController pattern with proper cleanup
- **Test coverage**: 46 tests covering all public methods
- **URL encoding**: `encodeURIComponent()` used for params

---

## Consumer Awareness

**Consumers**: 5 direct imports (all in @warpkit/cache)
**API Surface Risk**: Medium-High - CacheProvider and CacheEntry types are used by all cache implementations

**API Surface Used**:
- `CacheProvider` interface - ETagCacheProvider implements it
- `CacheEntry<T>` type - all cache implementations use it

**Future Consumers** (Phase 4+):
- `useQuery` hook will consume `QueryClient`
- All data-fetching components will depend on this

---

## Review This Code As

"Framework code on Svelte 5/WarpKit implementing client core data fetching functionality. Phase 3 of 5 is complete. Focus on verifying acceptance criteria from phase3.md are met and test coverage is comprehensive. See deferrals.md for 5 items not to flag."
