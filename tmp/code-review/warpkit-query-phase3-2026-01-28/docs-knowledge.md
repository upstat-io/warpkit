# Documentation Knowledge

**Generated**: 2026-01-28
**Review**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Technology Context

### Svelte 5

**Used in target**: `import { getContext } from 'svelte';` in context.ts, `QueryClientProvider.svelte` uses `$props()` and `setContext`

**What it provides** (from .claude/rules/svelte5-testing.md and .claude/rules/warpkit.md):
- Runes for reactivity (`$state`, `$derived`, `$effect`, `$props`)
- Context API via `getContext`/`setContext`
- Snippet children pattern for component composition

**What reviewers should NOT flag**:
- Using `$props()` without destructuring - this is the Svelte 5 pattern
- `let { client, children }: Props = $props();` is correct Svelte 5 syntax
- `{@render children()}` is correct Svelte 5 snippet rendering

### Fetch API / AbortController

**Used in target**: `AbortController` with `setTimeout` for timeout handling in QueryClient.ts

**What it provides** (from docs/dev/best-practices/concurrency.md):
- "AbortController for fetch cancellation with timeouts"
- "Use AbortController with setTimeout"
- "Clean up timeout in finally block"

**What reviewers should NOT flag**:
- The timeout pattern using `AbortController` + `setTimeout` in fetch method - this is the recommended pattern
- Double `clearTimeout` in finally block - defensive cleanup is acceptable
- Quote: "Missing timeout (CRITICAL): External call without timeout (`fetch(url)` without AbortController)"

### TypeScript Module Augmentation

**Used in target**: `QueryKeyRegistry` interface for type-safe query keys

**What it provides**:
- Consumers extend the interface to define their query keys
- `QueryKey = keyof QueryKeyRegistry & string` becomes a union of registered keys

**What reviewers should NOT flag**:
- Empty `QueryKeyRegistry` interface - this is intentional for module augmentation
- `QueryKey = never` before augmentation - documented expected behavior (Phase 1 review #13)

---

## Best Practices Applicable

### From code-quality.md

| Rule | Applies Because | Check |
| ---- | --------------- | ----- |
| SRP | QueryClient is a class | Verify single reason to change |
| No Magic Numbers | Timeout/staleTime defaults | Should be named constants or documented |
| Functions <20 lines | All methods | Review method lengths |
| No Flag Arguments | Method parameters | No boolean flags that change behavior |
| Explicit Visibility | Class members | All public/private explicit |

**Specific Checks**:
- [ ] Constructor does not have 6+ dependencies (SRP)
- [ ] No "And"/"Manager"/"Handler" in class names
- [ ] Public methods have JSDoc
- [ ] No `any` types
- [ ] No `as const`
- [ ] No type assertions (`as unknown`, `as any`)

### From testing.md

| Rule | Applies Because | Check |
| ---- | --------------- | ----- |
| Unit tests for public methods | QueryClient class | All public methods tested |
| Strong assertions | QueryClient.spec.ts | Exact values, not just toBeDefined |
| AAA structure | All tests | Arrange-Act-Assert |
| Test names | spec files | `should [behavior] when [condition]` |

**Specific Checks**:
- [ ] Every public method has tests (success + error + edge case)
- [ ] No `toBeDefined()` without more specific assertion
- [ ] No `test('test1')` style names
- [ ] Mocks properly cleaned up in beforeEach/afterEach

### From concurrency.md

| Rule | Applies Because | Check |
| ---- | --------------- | ----- |
| Timeout on external calls (CRITICAL) | fetch() calls | AbortController used |
| Promise handler chaining | Any promise chains | No parallel handlers |
| Cleanup in finally | Timers/controllers | Cleanup always runs |

**Specific Checks**:
- [ ] All fetch calls have timeout via AbortController
- [ ] No `promise.catch(); promise.finally();` pattern (CRITICAL)
- [ ] `clearTimeout` in finally block

### From security.md

| Rule | Applies Because | Check |
| ---- | --------------- | ----- |
| Input Validation | URL parameters | Params validated |
| No hardcoded secrets | Config options | No API keys in code |

**Specific Checks**:
- [ ] URL parameters are URL-encoded before use
- [ ] No hardcoded API keys, passwords, or tokens
- [ ] `onRequest` hook allows auth header injection (not hardcoded)

### From frontend-patterns.md

| Rule | Applies Because | Check |
| ---- | --------------- | ----- |
| Svelte 5 runes pattern | useQuery will use runes | Getters for reactivity |
| Server State | Data fetching | QueryClient pattern |

**Specific Checks**:
- [ ] QueryState returns object with getters (Phase 4, not this phase)
- [ ] No destructuring of `$state` values (Phase 4)

---

## ADR Summary

### ADR Files Discovered

| ADR File | Title | Applies to Target? |
| -------- | ----- | ------------------ |
| frameworks/orijs/docs/decisions/ADR-007-bullmq-provider-facade.md | BullMQWorkflowProvider Facade Pattern | No - different package, but establishes facade exemption principle |
| frameworks/orijs/docs/decisions/ADR-005-application-class-srp.md | Application Class SRP | No - establishes SRP exemption for facade classes |
| frameworks/orijs/docs/decisions/ADR-006-type-system-patterns.md | Type System Patterns | Yes - single-letter generics are standard |

### Decisions Affecting This Review

| ADR | Decision | Impact on Review |
| --- | -------- | ---------------- |
| Phase 1 Code Review #13 | QueryKey = never before augmentation | Do NOT flag empty QueryKeyRegistry as bug |
| Phase 1 Code Review #14 | E-Tag uses server validation, not TTL | Do NOT flag missing maxAge/hard expiration |
| Phase 1 Code Review #15 | String-based invalidateOn | Do NOT flag untyped event names - intentional decoupling |
| Phase 1 Code Review #16 | staleTime in both config and entry | Intentional - config default vs stored value |
| Phase 2 Code Review #3 | Storage utilities for external consumers | Do NOT flag unused utilities as dead code |
| Phase 2 Code Review #6 | MemoryCache/StorageCache sync, not CacheProvider | Do NOT flag missing async - intentional design |
| Phase 2 Code Review #26 | deleteByPrefix iterates all keys | Do NOT flag - inherent localStorage limitation |
| ADR-006 Part 2 | Single-letter generic params | Do NOT flag `<K>`, `<T>` as poor naming |
| ADR-007 | Facade classes exempt from line limits | If QueryClient grows large, verify it serves single actor |

### Won't Fix Patterns (MASTER LIST)

**CRITICAL: Issues matching these should be marked WON'T FIX (ADR)**

| Pattern | Detection | Rationale | ADR Source |
| ------- | --------- | --------- | ---------- |
| Empty QueryKeyRegistry interface | `interface QueryKeyRegistry { }` with no members | Module augmentation requires empty base | Phase 1 #13 |
| QueryKey = never type | Before consumer augmentation | Expected when no keys registered | Phase 1 #13 |
| No maxAge/hard expiration on cache | CacheEntry without expiration field | E-Tag validation via HTTP 304 | Phase 1 #14 |
| Untyped invalidateOn strings | `invalidateOn?: string[]` | Intentional decoupling from WarpKit events | Phase 1 #15 |
| staleTime in two places | QueryKeyConfig.staleTime AND CacheEntry.staleTime | Config default vs stored instance | Phase 1 #16 |
| NoCacheProvider no-op methods | Methods that do nothing | Default provider when caching disabled | phase3.md |
| Single-letter generics | `<K>`, `<T>` in type definitions | Standard TypeScript convention | ADR-006 |
| PascalCase file names | `QueryClient.ts`, `NoCacheProvider.ts` | WarpKit pattern for class files | Phase 2 #2 |

---

## Plan Context

### Active Plan Context

**Plan**: warpkit-v2-query-cache
**Phase**: 3 of 5 (Query Client)
**Design Intent**: "Implement QueryClient class that coordinates fetching, caching, and invalidation. QueryClientProvider for Svelte context. NoCacheProvider as default no-op cache."

From plan.md:
> "Implement two decoupled packages for WarpKit's data fetching architecture: `@warpkit/query` provides config-driven data fetching with a pluggable cache interface, and `@warpkit/cache` implements E-Tag conditional requests with two-tier caching (memory + localStorage)."

**Key Decisions from Design Plan** (04-query-package.md):
- "Key principle: Works without any cache. If no CacheProvider is supplied, every fetch hits the network."
- "Events are injected at construction (not implicitly via `getWarpKit()`), making the package fully testable."
- "No global state. Create QueryClient directly and pass to provider."

### Deferred to Later Phases (Do NOT flag as missing)

| Item | Deferred To | Reason |
| ---- | ----------- | ------ |
| useQuery hook implementation | Phase 4 | Svelte integration |
| README.md documentation | After Phase 5 | Per Phase 1 review |
| Package.json metadata (description, license) | Before OSS extraction | Phase 1 review #10-11 |
| QueryError custom type | Phase 3+ consideration | Phase 1 review #17 |
| Tenant-scoped cache keys | Implementations handle | Phase 1 review #12 |

### Acceptance Criteria from Phase 3

From phase3.md REQUIREMENTS:
1. QueryClient fetch: `fetch("monitors")` returns `{ data, fromCache, notModified }`
2. URL interpolation: `fetch("monitors/:id", { id: "123" })` fetches `/monitors/123`
3. Cache integration: Check cache before fetch, store after
4. E-Tag handling: Send If-None-Match header with cached E-Tag
5. 304 handling: Return cached data on 304 response
6. Timeout: Abort fetch after timeout (default 30s)
7. onRequest hook: Allow request modification
8. Invalidate: Remove key from cache
9. NoCacheProvider: No-op implementation
10. getEvents: Return injected events or null

---

## Reviewer Guidance Summary

### DO NOT Flag (Technology Handles It)

| What Reviewer Might Flag | Why It's Wrong | Technology | Reference |
| ------------------------ | -------------- | ---------- | --------- |
| "Missing retry logic" | Retry is consumer responsibility; caching provides stale-while-revalidate | Design decision | 04-query-package.md |
| "fetch without try/catch" | fetch is in try block with proper error handling | AbortController pattern | QueryClient.ts:101-135 |
| "clearTimeout called twice" | Defensive cleanup in try and finally is correct | concurrency.md | QueryClient.ts:110, 134 |

### DO NOT Flag (ADR Exemption)

| What Reviewer Might Flag | ADR Decision | Reference |
| ------------------------ | ------------ | --------- |
| "Empty interface QueryKeyRegistry" | Module augmentation pattern | Phase 1 #13 |
| "QueryKey is never" | Expected before augmentation | Phase 1 #13 |
| "invalidateOn uses raw strings" | Intentional decoupling | Phase 1 #15 |
| "Single letter generic <K>" | Standard convention | ADR-006 |
| "PascalCase filename" | WarpKit class file pattern | Phase 2 #2 |
| "NoCacheProvider does nothing" | Default no-op provider | phase3.md |
| "staleTime appears twice" | Config vs instance value | Phase 1 #16 |

### DO NOT Flag (Deferred by Plan)

| What Reviewer Might Flag | Deferred To | Plan Reference |
| ------------------------ | ----------- | -------------- |
| "Missing README.md" | After Phase 5 | Phase 1 #8 |
| "Missing package.json description" | Before OSS | Phase 1 #10 |
| "Missing useQuery tests" | Phase 4 | plan.md |
| "QueryClientOptions missing example" | Phase 3 complete | Phase 1 #7 - now fixable |

### SHOULD Flag (Valid Issues)

| What to Look For | Rule | Severity |
| ---------------- | ---- | -------- |
| `promise.catch(); promise.finally();` parallel handlers | concurrency.md | CRITICAL |
| Missing AbortController timeout | concurrency.md | CRITICAL |
| `as any`, `as unknown as X` type assertions | code-quality.md | HIGH |
| Public methods without tests | testing.md | HIGH |
| `any` type usage | code-quality.md | HIGH |
| Missing JSDoc on public methods | documentation.md | MEDIUM |
| Magic numbers without constants | code-quality.md | MEDIUM |
| Test names without behavior description | testing.md | MEDIUM |

---

## Search Summary

- Technologies identified: 3 (Svelte 5, Fetch/AbortController, TypeScript Module Augmentation)
- Reference docs read: 0 (technology-specific _llms.md not found for these)
- Best practices docs read: 5 (code-quality, testing, concurrency, security, frontend-patterns)
- ADR files found: 3 OriJS ADRs (for pattern reference)
- ADR decisions extracted: 10+ from Phase 1/2 code reviews
- Won't Fix patterns: 8
- Plans analyzed: 1 (warpkit-v2-query-cache with 8 design docs)
- Deferred items: 5
