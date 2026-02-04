# Architecture Review Findings

**Reviewer**: architecture
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Constructor Visibility Inconsistency

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:18`
**Severity**: MEDIUM
**Rule**: Explicit visibility (code-quality.md)
**Status**: OPEN

**Issue**:
`NoCacheProvider` constructor has implicit public visibility, while `QueryClient` at line 48 has explicit `public constructor`. This is inconsistent within the same package and with sibling package `@warpkit/cache` where `ETagCacheProvider` also lacks explicit constructor visibility.

```typescript
// NoCacheProvider.ts - implicit
export class NoCacheProvider implements CacheProvider {
  // No explicit constructor

// QueryClient.ts:48 - explicit
public constructor(config: QueryClientConfig, options?: QueryClientOptions) {
```

**Fix**:
Either add explicit `public constructor()` to `NoCacheProvider` or remove `public` from `QueryClient.constructor`. Given that QueryClient has the correct explicit pattern, add to NoCacheProvider:

```typescript
export class NoCacheProvider implements CacheProvider {
  public constructor() {
    // NoCacheProvider requires no initialization
  }
```

---

### #2. Test Naming Convention Inconsistency

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79`
**Severity**: MEDIUM
**Rule**: Test naming convention (testing.md)
**Status**: OPEN

**Issue**:
`QueryClient.spec.ts` uses `it('creates client with config')` and `it('fetches data successfully')` naming pattern, while sibling package tests in `@warpkit/cache` (e.g., `ETagCacheProvider.spec.ts`) use `it('should X when Y')` pattern. This inconsistency makes the test suite feel less cohesive.

Examples from QueryClient.spec.ts:
- Line 79: `it('creates client with config')`
- Line 123: `it('fetches data successfully')`
- Line 137: `it('throws for unknown query key')`

The testing.md best practice recommends: `should [behavior] when [condition]`

**Fix**:
Update test names to follow the `should X when Y` pattern consistently:
- `it('creates client with config')` -> `it('should create client when provided valid config')`
- `it('fetches data successfully')` -> `it('should return data when fetch succeeds')`
- `it('throws for unknown query key')` -> `it('should throw when query key is not configured')`

---

### #3. Type Assertion in Tests for Private Field Access

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:447`
**Severity**: LOW
**Rule**: No type assertions (code-quality.md)
**Status**: OPEN

**Issue**:
Tests use `as unknown as { timeout: number }` double cast to access private `timeout` field for verification. While this is in test code (not production), it violates the type system and creates brittle tests that depend on implementation details.

```typescript
// Line 447
expect((client as unknown as { timeout: number }).timeout).toBe(30000);

// Line 454
expect((client as unknown as { timeout: number }).timeout).toBe(5000);
```

**Fix**:
Instead of accessing private fields, test the observable behavior. The timeout behavior is already tested via the abort test at line 408-426. Remove these tests or verify timeout behavior through fetch timeout assertions:

```typescript
// Instead of:
expect((client as unknown as { timeout: number }).timeout).toBe(30000);

// Test observable behavior already covered by:
it('aborts fetch when timeout is reached', async () => { ... });
```

Alternatively, if explicit timeout verification is needed, expose a `getTimeout()` public getter on QueryClient.

---

### #4. Missing Functional Test for getQueryClient Context Error

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/context.ts:36-43`
**Severity**: MEDIUM
**Rule**: Functional tests required (CLAUDE.md section 5)
**Status**: OPEN

**Issue**:
`getQueryClient()` function has error handling for missing context (throws if QueryClient is not found), but there is no test file for `context.ts`. The function interacts with Svelte's `getContext` and has error behavior that should be functionally tested.

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
Create a functional test for `context.ts` that verifies:
1. `getQueryClient()` throws when called outside provider context
2. `getQueryClient()` returns client when inside provider context
3. `QUERY_CLIENT_CONTEXT` is a unique symbol

Note: This requires a Svelte 5 browser test due to the context API dependency. The test would need to use the `*.svelte.test.ts` pattern per svelte5-testing.md rules.

---

### #5. Missing Test for QueryClientProvider Component

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClientProvider.svelte`
**Severity**: MEDIUM
**Rule**: Functional tests required (CLAUDE.md section 5)
**Status**: OPEN

**Issue**:
`QueryClientProvider.svelte` is a Svelte 5 component that sets context and renders children, but there is no corresponding test file. The component has behavior (calling `setContext`) that should be verified through functional testing.

```svelte
<script lang="ts">
import { setContext, type Snippet } from 'svelte';
import { QUERY_CLIENT_CONTEXT } from './context';
import type { QueryClient } from './QueryClient';

interface Props {
  client: QueryClient;
  children: Snippet;
}

let { client, children }: Props = $props();

setContext(QUERY_CLIENT_CONTEXT, client);
</script>

{@render children()}
```

**Fix**:
Create a Svelte 5 browser test file `QueryClientProvider.svelte.test.ts` that verifies:
1. Component renders children correctly
2. Component sets the QueryClient in context
3. Child components can access the client via `getQueryClient()`

Per svelte5-testing.md, this must use vitest-browser-svelte with Playwright.

---

### #6. Potential Issue: URL Function Does Not Encode Parameters

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:220-222`
**Severity**: MEDIUM
**Rule**: URL encoding for security (security.md)
**Status**: OPEN

**Issue**:
When `url` is a function (line 220-222), the parameters passed to it are not URL-encoded by QueryClient. The consumer-provided function receives raw params, and if the consumer forgets to encode, this could lead to URL injection issues.

```typescript
private resolveUrl(
  urlTemplate: string | ((params: Record<string, string>) => string),
  params?: Record<string, string>
): string {
  if (typeof urlTemplate === 'function') {
    return (this.config.baseUrl ?? '') + urlTemplate(params ?? {});
    // params are passed raw - consumer must remember to encode
  }

  // ... string template path properly uses encodeURIComponent at line 233
  url = url.replace(match, encodeURIComponent(value));
```

The string template path at line 233 correctly uses `encodeURIComponent()`, but the function path does not provide the same protection.

**Fix**:
Document this clearly in the JSDoc for `QueryKeyConfig.url` and/or provide a helper:

```typescript
/** URL or function that builds URL from params.
 * Note: When using a function, you must URL-encode parameter values yourself.
 * Use encodeURIComponent() for path segments.
 * @example
 * url: (params) => `/monitors/${encodeURIComponent(params.id)}`
 */
url: string | ((params: Record<string, string>) => string);
```

Alternatively, pre-encode the params before passing to the function:

```typescript
if (typeof urlTemplate === 'function') {
  const encodedParams = Object.fromEntries(
    Object.entries(params ?? {}).map(([k, v]) => [k, encodeURIComponent(v)])
  );
  return (this.config.baseUrl ?? '') + urlTemplate(encodedParams);
}
```

---

## Good Practices

- **Clean Architecture Compliance**: Dependencies point inward correctly. QueryClient depends on CacheProvider interface, not concrete implementation. NoCacheProvider is a concrete implementation that can be swapped.

- **Dependency Inversion**: `@warpkit/query` exports `CacheProvider` interface that `@warpkit/cache` implements, creating correct dependency direction (cache depends on query, not vice versa).

- **Single Responsibility Principle**: QueryClient has focused responsibility (fetch orchestration), NoCacheProvider has focused responsibility (null object pattern), and types.ts contains only type definitions.

- **Testability via DI**: Events and cache are injected at construction, not accessed via global state or implicit context. This makes the package fully unit-testable as stated in the design intent.

- **Null Object Pattern**: `NoCacheProvider` correctly implements the null object pattern, allowing QueryClient to work without any cache (key design principle from plan).

- **Module Augmentation Pattern**: `QueryKeyRegistry` uses TypeScript module augmentation correctly, enabling type-safe query keys without coupling to consumer code.

- **Timeout Handling**: AbortController pattern with defensive double-cleanup in try and finally blocks follows concurrency.md best practices.

- **URL Encoding**: String template URL parameters use `encodeURIComponent()` at line 233, following security.md requirements for the primary use case.

- **Comprehensive Test Coverage**: QueryClient.spec.ts has 46 tests covering all public methods with success, error, and edge cases.

- **JSDoc Documentation**: All public types and methods have JSDoc with `@param`, `@returns`, and `@example` annotations where appropriate.

- **Framework Independence**: Zero `@upstat/*` dependencies, making the package suitable for OSS extraction per WarpKit rules.
