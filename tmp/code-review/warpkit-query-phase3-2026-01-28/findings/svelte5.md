# Svelte 5 Review Findings

**Reviewer**: svelte5
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Test naming inconsistency: "does X" vs "should X"

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79`
**Severity**: MEDIUM
**Rule**: Sibling package consistency (testing.md pattern)
**Status**: OPEN

**Issue**:
The test naming pattern in `QueryClient.spec.ts` uses "does X" or imperative phrases (e.g., `it('creates client with config')`, `it('fetches data successfully')`, `it('throws for unknown query key')`), while the sibling package `@warpkit/cache` uses "should X" pattern (e.g., `it('should create with default options')`, `it('should return undefined for nonexistent key')`).

Examples from QueryClient.spec.ts:
- Line 79: `it('creates client with config', ...)`
- Line 86: `it('uses NoCacheProvider by default', ...)`
- Line 123: `it('fetches data successfully', ...)`

Examples from ETagCacheProvider.spec.ts (sibling):
- Line 25: `it('should create with default options', ...)`
- Line 43: `it('should return undefined for nonexistent key', ...)`
- Line 48: `it('should return entry from memory', ...)`

**Fix**:
Standardize test naming across packages. Choose one pattern (recommend "should X when Y" per testing.md) and apply consistently:
- `it('creates client with config')` -> `it('should create client with config')`
- `it('uses NoCacheProvider by default')` -> `it('should use NoCacheProvider by default')`

---

### #2. NoCacheProvider missing explicit constructor visibility

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:18`
**Severity**: LOW
**Rule**: Explicit visibility (code-quality.md), sibling consistency
**Status**: OPEN

**Issue**:
The `NoCacheProvider` class does not have an explicit constructor, which means it uses the implicit default constructor without visibility modifier. The sibling `QueryClient` class has an explicit `public constructor()` at line 48. For consistency, all classes should either have explicit constructors with visibility or follow a documented pattern for when implicit constructors are acceptable.

Code at NoCacheProvider.ts:18:
```typescript
export class NoCacheProvider implements CacheProvider {
    // No explicit constructor
```

Compared to QueryClient.ts:48:
```typescript
public constructor(config: QueryClientConfig, options?: QueryClientOptions) {
```

**Fix**:
Add an explicit empty public constructor for consistency:
```typescript
export class NoCacheProvider implements CacheProvider {
    public constructor() {
        // No initialization needed
    }
```

Or document that classes with no state initialization can omit constructors as a project convention.

---

### #3. NoCacheProvider.spec.ts test naming inconsistent with QueryClient.spec.ts

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.spec.ts:6`
**Severity**: LOW
**Rule**: Internal package consistency
**Status**: OPEN

**Issue**:
Within the same package (`@warpkit/query`), `NoCacheProvider.spec.ts` uses a different test naming style than `QueryClient.spec.ts`. NoCacheProvider uses imperative + parens style (e.g., `it('get() returns undefined for any key')`), while QueryClient uses plain descriptive (e.g., `it('returns config for existing key')`).

Examples from NoCacheProvider.spec.ts:
- Line 6: `it('get() returns undefined for any key', ...)`
- Line 14: `it('get() returns undefined even after set()', ...)`
- Line 27: `it('set() completes without error', ...)`

Examples from QueryClient.spec.ts:
- Line 494: `it('returns config for existing key', ...)`
- Line 515: `it('returns null when no events configured', ...)`

**Fix**:
Standardize within the package. Since QueryClient has more tests and is the primary class, either:
1. Update NoCacheProvider.spec.ts to match QueryClient style: `it('returns undefined for any key', ...)`
2. Or update both to follow "should X" pattern from sibling package

---

## Good Practices

- **Correct Svelte 5 $props() usage**: `QueryClientProvider.svelte` correctly uses `let { client, children }: Props = $props();` at line 25 - this is the proper Svelte 5 runes pattern.

- **Correct Snippet children pattern**: The component correctly types `children: Snippet` (line 22) and renders with `{@render children()}` (line 30) - proper Svelte 5 snippet composition.

- **Proper context API usage**: Uses `setContext(QUERY_CLIENT_CONTEXT, client)` with a Symbol key for type-safe context - correct pattern for Svelte context.

- **No unnecessary onDestroy**: The component only sets context and renders children - no cleanup needed since no subscriptions or timers are created.

- **AbortController timeout pattern**: `QueryClient.ts` correctly implements the timeout pattern with AbortController (lines 98-99), clearTimeout in try block (line 110) and finally block (line 134) for defensive cleanup per concurrency.md.

- **URL encoding**: Parameters are correctly encoded with `encodeURIComponent(value)` at line 233 of QueryClient.ts.

- **Module augmentation pattern**: `QueryKeyRegistry` empty interface (types.ts:24-26) is correctly structured for consumer extension via declaration merging.

- **JSDoc with examples**: All public methods have JSDoc documentation with `@example` blocks where helpful (e.g., QueryClient.ts lines 63-70, types.ts lines 56-68).

- **Explicit public/private visibility**: All class members in QueryClient have explicit visibility modifiers.

- **No forbidden patterns**: No `any` types, no `as const`, no `as unknown` type assertions found in source files.

- **Comprehensive test coverage**: 46 tests in QueryClient.spec.ts covering all public methods with success, error, and edge cases.
