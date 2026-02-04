# Framework Patterns Review Findings

**Reviewer**: framework-patterns
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Issues Found

### #1. Constructor Visibility Inconsistent Between Classes

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/NoCacheProvider.ts:18`
**Severity**: MEDIUM
**Rule**: Code Pattern Consistency (cohesion-checks.md)
**Status**: OPEN

**Issue**:
`QueryClient.ts:48` has explicit `public constructor`, but `NoCacheProvider.ts:18` does not have explicit visibility modifier on its constructor. This inconsistency reduces code predictability within the package.

```typescript
// QueryClient.ts:48 - Has explicit visibility
public constructor(config: QueryClientConfig, options?: QueryClientOptions) {

// NoCacheProvider.ts:18 - Missing explicit visibility
export class NoCacheProvider implements CacheProvider {
  // (implicit constructor - no explicit constructor defined)
```

**Fix**:
No explicit constructor needed since NoCacheProvider has no constructor logic. This is consistent - when a class has no constructor, omitting it is acceptable. Mark as acceptable deviation.

**Status Update**: FALSE POSITIVE - NoCacheProvider has no constructor at all (relies on implicit default constructor), which is appropriate for a stateless class. QueryClient has an explicit constructor because it requires parameters. These are different situations, not an inconsistency.

---

### #2. Test Naming Convention Mismatch with Sibling Package

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:79`
**Severity**: MEDIUM
**Rule**: Test Pattern Consistency (framework-patterns.md - Test File Naming)
**Status**: OPEN

**Issue**:
`QueryClient.spec.ts` uses `it('creates client with config')` (present tense "creates/does") pattern, while `@warpkit/cache` tests use `it('should X when Y')` pattern. Examples:

```typescript
// QueryClient.spec.ts - present tense pattern
it('creates client with config', () => {
it('uses NoCacheProvider by default', async () => {
it('fetches data successfully', async () => {

// ETagCacheProvider.spec.ts - "should" pattern
it('should create with default options', () => {
it('should return undefined for nonexistent key', async () => {
it('should return entry from memory', async () => {
```

The testing.md rule specifies: `Test names: should [behavior] when [condition]`

**Fix**:
Update test names in `QueryClient.spec.ts` and `NoCacheProvider.spec.ts` to use the `should X when Y` pattern for consistency:
- `'creates client with config'` -> `'should create client with config'`
- `'uses NoCacheProvider by default'` -> `'should use NoCacheProvider by default'`
- `'fetches data successfully'` -> `'should fetch data successfully'`

---

### #3. Type Assertion in Test File for Private Member Access

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.spec.ts:447`
**Severity**: LOW
**Rule**: Code Quality - No Type Assertions (code-quality.md)
**Status**: OPEN

**Issue**:
Tests use `as unknown as` double cast to access private `timeout` property:

```typescript
// Line 447
expect((client as unknown as { timeout: number }).timeout).toBe(30000);

// Line 454
expect((client as unknown as { timeout: number }).timeout).toBe(5000);
```

While this is in a test file (not production code), it indicates a potential design issue - if timeout verification is needed for tests, consider exposing it via a getter method.

**Fix**:
Two options:
1. **Recommended**: Add a `getTimeout()` public method to QueryClient if timeout introspection is a valid use case
2. **Alternative**: Accept double-cast in tests as necessary evil for testing private state (mark as acceptable test pattern)

Given that these tests verify the default timeout behavior which is important for consumers, option 1 is preferred. However, if the team decides timeout is purely internal implementation detail, option 2 is acceptable.

---

### #4. Provider Subdirectory Pattern Deviation

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/provider/`
**Severity**: LOW
**Rule**: Repository Structure (framework-patterns.md)
**Status**: OPEN

**Issue**:
`NoCacheProvider.ts` is in a `provider/` subdirectory, but `QueryClient.ts` is in the root `src/` directory. The sibling `@warpkit/cache` package has all its classes (`ETagCacheProvider.ts`, `MemoryCache.ts`, `StorageCache.ts`) directly in `src/`. This creates inconsistent organization patterns between sibling packages.

Current structure:
```
packages/query/src/
  QueryClient.ts         # Root level
  provider/
    NoCacheProvider.ts   # In subdirectory
```

Sibling package structure:
```
packages/cache/src/
  ETagCacheProvider.ts   # Root level
  MemoryCache.ts         # Root level
  StorageCache.ts        # Root level
```

**Fix**:
Move `NoCacheProvider.ts` and `NoCacheProvider.spec.ts` to `src/` directory to match sibling package organization:
```
packages/query/src/
  QueryClient.ts
  NoCacheProvider.ts     # Moved to root
  NoCacheProvider.spec.ts
```

Update import in `QueryClient.ts`:
```typescript
// From:
import { NoCacheProvider } from './provider/NoCacheProvider';
// To:
import { NoCacheProvider } from './NoCacheProvider';
```

Update export in `index.ts`:
```typescript
// From:
export { NoCacheProvider } from './provider/NoCacheProvider.js';
// To:
export { NoCacheProvider } from './NoCacheProvider.js';
```

---

## Good Practices

- **No Barrel File Re-exports**: The `index.ts` uses explicit named exports rather than `export * from` pattern, avoiding circular dependency issues
- **No I-Prefix on Interfaces**: All interfaces (`CacheProvider`, `QueryKeyRegistry`, `CacheEntry`, etc.) follow TypeScript naming conventions without `I` prefix
- **Zero @upstat/* Dependencies**: Framework code correctly has no dependencies on application-specific packages, maintaining OSS readiness
- **Scoped Package Name**: Package uses `@warpkit/` prefix following monorepo conventions
- **PascalCase for Class Files**: `QueryClient.ts`, `NoCacheProvider.ts` follow WarpKit's established pattern (consistent with `ETagCacheProvider.ts`, `MemoryCache.ts` in sibling package)
- **kebab-case for Utility Files**: `context.ts`, `types.ts`, `index.ts` use kebab-case appropriately
- **Test File Suffix**: All test files use `.spec.ts` suffix consistently
- **JSDoc Documentation**: All public APIs have JSDoc with `@param`, `@returns`, and `@example` where appropriate
- **Explicit Method Visibility**: All class methods have explicit `public` or `private` visibility modifiers
- **No Deep Inheritance**: Classes use composition (NoCacheProvider implements CacheProvider) rather than inheritance hierarchies
- **Type Exports in index.ts**: All public types are properly exported from the package entry point
