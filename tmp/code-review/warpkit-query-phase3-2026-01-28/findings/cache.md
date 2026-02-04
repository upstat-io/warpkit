# Cache Review Findings

**Reviewer**: cache
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Summary

The `@warpkit/query` package defines the `CacheProvider` interface and core cache key management patterns. The target package is reviewed for caching patterns including invalidation, keys, TTL, and tenant scoping.

**Files Reviewed**:
- `/home/eric/upstat/frameworks/warpkit/packages/query/src/types.ts` - CacheProvider interface, CacheEntry type
- `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts` - No-op cache implementation
- `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts` - Cache key building, invalidation logic

**Related Files (for context)**:
- `/home/eric/upstat/frameworks/warpkit/packages/cache/src/ETagCacheProvider.ts` - Two-tier cache implementation
- `/home/eric/upstat/frameworks/warpkit/packages/cache/src/MemoryCache.ts` - LRU cache implementation
- `/home/eric/upstat/frameworks/warpkit/packages/cache/src/StorageCache.ts` - localStorage cache implementation

---

## Issues Found

No blocking issues found in caching patterns.

---

## Deferred Items (Not Flagged)

### D1. No TTL/maxAge Expiration

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/types.ts:128-137`
**Status**: WON'T FIX (Phase 1 #14)

The `CacheEntry` type has no hard expiration/TTL field. This is an intentional design decision - the system uses E-Tag validation via HTTP 304 responses. The server controls freshness, not the client.

### D2. Untyped invalidateOn Strings

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/types.ts:48`
**Status**: WON'T FIX (Phase 1 #15)

The `invalidateOn?: string[]` field uses raw strings rather than typed event names. This is intentional decoupling - the `@warpkit/query` package has no knowledge of WarpKit event types, maintaining package independence.

### D3. staleTime Defined in Two Places

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/types.ts:50,136`
**Status**: WON'T FIX (Phase 1 #16)

`staleTime` appears in both `QueryKeyConfig` and `CacheEntry`. This is intentional: config provides the default, and the value is copied to the entry when cached (line 129 of QueryClient.ts).

### D4. NoCacheProvider No-Op Methods

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:22-52`
**Status**: WON'T FIX (phase3.md)

All methods in `NoCacheProvider` are no-ops returning undefined or void. This is the intentional null object pattern - when caching is disabled, the system works without cache.

---

## Good Practices

- **Consistent cache key building**: `buildCacheKey()` in QueryClient.ts (line 242-253) sorts params alphabetically for deterministic keys. This prevents cache misses due to param ordering differences (e.g., `?a=1&b=2` vs `?b=2&a=1`).

- **URL encoding in cache keys**: Parameters are URL-encoded via `encodeURIComponent()` (line 233) before URL interpolation, but raw values are used in cache keys. This is correct - cache keys should match the logical query, not the encoded URL.

- **Async CacheProvider interface**: The `CacheProvider` interface (line 112-123) uses async methods. This allows implementations to be sync (like MemoryCache) or async (like IndexedDB in future).

- **Two-tier cache invalidation**: The `invalidateByPrefix()` method on CacheProvider (line 119) enables invalidating all related entries (e.g., all monitor queries when any monitor changes). The sibling `@warpkit/cache` package implements this correctly across both memory and storage tiers.

- **E-Tag conditional request pattern**: QueryClient.ts (line 92-95) sends `If-None-Match` header when cached entry has an E-Tag. Combined with 304 handling (line 112-115), this implements efficient cache revalidation.

- **Fresh check before network**: The `isFresh()` check (line 87) returns cached data immediately for fresh entries, avoiding unnecessary network requests. This is the stale-while-revalidate pattern.

- **Cache stampede prevention via staleTime**: By using `staleTime` rather than hard TTL, the design supports serving stale data while revalidating in background (to be implemented in useQuery hook, Phase 4).

---

## Tenant Scoping Analysis

**Finding**: No explicit tenant (account/project) scoping in cache keys.

**Analysis**: The `buildCacheKey()` method (QueryClient.ts:242-253) builds keys from the query key and params. Tenant scoping (if needed) would come from the params:

```typescript
// Example usage
client.fetch('monitors', { accountUuid: 'acc-123', projectUuid: 'proj-456' })
// Results in cache key: monitors?accountUuid=acc-123&projectUuid=proj-456
```

This is the correct approach for a framework package - tenant scoping is the consumer's responsibility. The `@warpkit/query` package is framework code that doesn't know about Upstat's multi-tenant architecture.

**Status**: Correct - tenant scoping delegated to consumer configuration.

---

## Cache Invalidation Analysis

**Pattern**: Event-driven invalidation via `invalidateOn` config.

**Implementation** (QueryClient.ts lines 147-163):
- `invalidate(key, params)` - invalidates specific cache entry
- `invalidateByPrefix(prefix)` - invalidates all entries matching prefix

**Test Coverage** (QueryClient.spec.ts lines 458-490):
- `invalidate()` builds cache key with params and calls `cache.delete()`
- `invalidateByPrefix()` delegates to `cache.deleteByPrefix()`

**Status**: Correct - invalidation patterns are well-designed and tested.

---

## No Issues to Flag

The caching implementation in `@warpkit/query` is well-designed:

1. **Interface is flexible**: `CacheProvider` supports sync or async implementations
2. **Keys are deterministic**: Sorted params prevent ordering issues
3. **Invalidation is granular**: Both specific key and prefix-based invalidation
4. **E-Tag pattern is correct**: Conditional requests with 304 handling
5. **No tenant leakage**: Cache keys include all params, tenant isolation is consumer's responsibility
6. **No cache stampede risk**: staleTime design supports stale-while-revalidate (Phase 4 will implement)

All potential issues are either deferred by design decision or correctly implemented.
