# Documentation Review Findings

**Reviewer**: documentation
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. QueryClientOptions Missing @example Tag

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/types.ts:235-240`
**Severity**: MEDIUM
**Rule**: JSDoc for Public APIs - @example recommended for complex types
**Status**: OPEN

**Issue**:
The `QueryClientOptions` interface has a JSDoc description but lacks an `@example` tag. This is an important consumer-facing type that benefits from usage examples. The cohesion-checks.md file specifically notes this at Phase 1 #7 as "now fixable".

```typescript
/**
 * Options for QueryClient constructor.
 */
export interface QueryClientOptions {
	/** Cache provider for storing fetched data */
	cache?: CacheProvider;
	/** Event emitter for invalidation subscriptions */
	events?: QueryEventEmitter;
}
```

**Fix**:
Add an `@example` tag showing how to use QueryClientOptions:

```typescript
/**
 * Options for QueryClient constructor.
 *
 * @example
 * const options: QueryClientOptions = {
 *   cache: new ETagCacheProvider(),
 *   events: warpkit.events
 * };
 * const client = new QueryClient(config, options);
 */
export interface QueryClientOptions {
```

---

### #2. NoCacheProvider Constructor Missing Explicit `public` Modifier

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:18`
**Severity**: LOW
**Rule**: Explicit visibility - constructor visibility inconsistent with sibling classes
**Status**: OPEN

**Issue**:
The `NoCacheProvider` class does not have an explicit constructor, but `QueryClient` at line 48 has an explicit `public constructor`. For consistency across the codebase (as noted in cohesion-checks.md), either all classes should have explicit public constructors or none should. Since `QueryClient` uses explicit `public constructor`, `NoCacheProvider` should follow the same pattern.

Note: The class currently uses the implicit default constructor. Adding an explicit one ensures consistency.

**Fix**:
Add an explicit public constructor to NoCacheProvider:

```typescript
export class NoCacheProvider implements CacheProvider {
	public constructor() {
		// NoCacheProvider requires no initialization
	}
```

---

### #3. Private Method `isFresh` Missing JSDoc Description

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:203-211`
**Severity**: LOW
**Rule**: Self-documenting code - Complex logic should have explanatory comments
**Status**: OPEN

**Issue**:
The `isFresh` method has a single-line JSDoc comment but lacks explanation of the algorithm used. The method contains business logic that determines cache freshness - specifically that entries without `staleTime` are always considered stale. This nuance is worth documenting.

```typescript
/**
 * Check if a cache entry is still fresh (within staleTime).
 */
private isFresh(entry: CacheEntry<unknown>): boolean {
	if (!entry.staleTime) {
		return false; // No staleTime means always stale
	}
	const age = Date.now() - entry.timestamp;
	return age < entry.staleTime;
}
```

**Fix**:
Expand the JSDoc to explain the freshness logic:

```typescript
/**
 * Check if a cache entry is still fresh (within staleTime).
 *
 * An entry is considered fresh if:
 * 1. It has a staleTime value set, AND
 * 2. The time elapsed since caching is less than staleTime
 *
 * Entries without staleTime are always considered stale and will
 * trigger a network request (with If-None-Match for 304 support).
 *
 * @param entry - The cache entry to check
 * @returns true if the entry is fresh and can be used without revalidation
 */
```

---

### #4. Private Methods `resolveUrl` and `buildCacheKey` Missing @param/@returns

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:213-254`
**Severity**: LOW
**Rule**: JSDoc completeness - private methods with complex logic benefit from full documentation
**Status**: OPEN

**Issue**:
The private methods `resolveUrl` and `buildCacheKey` have brief one-line JSDoc comments but lack `@param` and `@returns` documentation. While these are private methods, they contain non-trivial logic (URL interpolation with regex, sorted parameter encoding) that would benefit from fuller documentation.

```typescript
/**
 * Resolve a URL template with parameters.
 */
private resolveUrl(...)

/**
 * Build a cache key from query key and params.
 */
private buildCacheKey(...)
```

**Fix**:
Add complete JSDoc with @param and @returns:

```typescript
/**
 * Resolve a URL template with parameters.
 *
 * Supports both string templates with `:param` syntax and function builders.
 * Parameter values are URL-encoded for safe inclusion in URLs.
 *
 * @param urlTemplate - URL string with :param placeholders or a function
 * @param params - Parameter values to substitute
 * @returns The resolved URL with baseUrl prepended
 * @throws Error if a required parameter is missing
 */
private resolveUrl(...)

/**
 * Build a cache key from query key and params.
 *
 * Params are sorted alphabetically to ensure consistent cache keys
 * regardless of the order parameters are provided.
 *
 * @param key - The query key
 * @param params - Optional URL parameters
 * @returns Cache key in format "key" or "key?a=1&b=2"
 */
private buildCacheKey(...)
```

---

## Good Practices

- **Excellent module-level documentation**: All source files (`types.ts`, `context.ts`, `QueryClient.ts`, `NoCacheProvider.ts`, `index.ts`) have clear module-level JSDoc comments explaining the file's purpose and its role in the package.

- **Comprehensive @example usage**: Major types and classes include practical `@example` tags showing real usage patterns (e.g., `QueryKeyRegistry` module augmentation example at types.ts:16-22, `QueryClient` constructor example at QueryClient.ts:24-34).

- **Section dividers for organization**: The types.ts file uses clear section dividers (`// ============`) to organize related types, making the file easy to navigate.

- **Inline comments explain "why"**: The code follows the "comment the why" principle - e.g., the `// No staleTime means always stale` comment at QueryClient.ts:207 explains the business logic, not what the code does.

- **CacheProvider interface has complete example**: The `CacheProvider` interface at types.ts:85-111 includes a full implementation example, which is excellent for consumers who need to implement custom cache providers.

- **Public methods have complete JSDoc**: All public methods in `QueryClient` and `NoCacheProvider` have JSDoc with `@param`, `@returns`, `@throws` (where applicable), and `@example` tags.

- **Props interface documented in Svelte component**: The `QueryClientProvider.svelte` component has JSDoc on the Props interface properties, which is good practice for component documentation.

- **Error messages are descriptive**: Error messages include context (e.g., `Unknown query key: ${key}`, `Missing param: ${paramName}`) that helps consumers debug issues.
