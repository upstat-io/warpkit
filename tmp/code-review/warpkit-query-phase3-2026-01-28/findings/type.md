# Type Review Findings

**Reviewer**: type
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Type assertion in test file for accessing private property

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:447`
**Severity**: LOW
**Rule**: No `as unknown as X` type assertions
**Status**: WON'T FIX (Test Pattern)

**Issue**:
The test file uses `as unknown as { timeout: number }` to access the private `timeout` property of `QueryClient`:

```typescript
expect((client as unknown as { timeout: number }).timeout).toBe(30000);
```

This pattern is repeated at line 454.

**Fix**:
This is a legitimate test pattern for verifying internal state. The alternative would be adding a public getter method just for testing, which violates the principle of not modifying production code for tests. Marking as WON'T FIX since accessing private members via type assertion in tests is an accepted pattern when the alternative is worse.

---

### #2. Type assertion for generic narrowing

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:172`
**Severity**: LOW
**Rule**: Minimize type assertions
**Status**: WON'T FIX (ADR)

**Issue**:
The `getKeyConfig` method uses a type assertion:

```typescript
public getKeyConfig<K extends QueryKey>(key: K): QueryKeyConfig<K> | undefined {
    return this.config.keys[key] as QueryKeyConfig<K> | undefined;
}
```

**Fix**:
This is a justified generic type narrowing. The `config.keys` is typed as `Record<QueryKey, QueryKeyConfig<QueryKey>>`, and TypeScript cannot infer that accessing with a specific `K` returns `QueryKeyConfig<K>`. This is a fundamental limitation of TypeScript's type system with generic indexing. The assertion is safe because the key and config are guaranteed to match by construction.

---

## Good Practices

- **Explicit generics on interface methods**: `CacheProvider.get<T>()` and `CacheProvider.set<T>()` use explicit generic parameters, allowing consumers to specify the cached data type
- **Proper use of readonly**: `FetchResult<T>` uses `readonly` for its properties where mutation is not expected
- **QueryState uses readonly pattern**: All `QueryState<T>` properties are marked `readonly` which is correct for reactive state that should not be mutated directly
- **No banned type patterns**: No usage of `any`, `as const`, or `as any` in production code
- **Proper generic constraints**: `K extends QueryKey` properly constrains generics to valid query keys
- **Module augmentation pattern**: `QueryKeyRegistry` is correctly set up as an empty interface for consumers to extend via declaration merging
- **No interface inheritance for composition**: All types use explicit property definitions or `type` aliases, not `interface extends` for composition
- **Consistent type organization**: Types are logically grouped with section separators and comprehensive JSDoc documentation
- **No entity utility types on domain objects**: The code does not use `Partial`, `Omit`, `Pick`, or `Required` on domain types in inappropriate locations
- **Proper use of `undefined` vs `null`**: Consistent use of `undefined` for optional values and `null` for explicit absence (e.g., `events: QueryEventEmitter | null`)
