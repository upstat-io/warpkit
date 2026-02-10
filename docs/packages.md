# WarpKit Packages Technical Specification

Maintainer reference for all sub-packages in the `packages/` directory. Each package is independently publishable and can be used standalone. The dependency graph is intentionally shallow: `@warpkit/errors` is the only leaf dependency shared across packages, and `@warpkit/validation` is the shared validation abstraction layer.

**Dependency graph (top-down):**

```
@warpkit/auth-firebase  -->  @warpkit/types, @warpkit/errors
@warpkit/data           -->  @warpkit/validation, @warpkit/errors
@warpkit/cache          -->  @warpkit/data (types only), @warpkit/errors
@warpkit/forms          -->  @warpkit/validation, @warpkit/errors
@warpkit/websocket      -->  @warpkit/validation, @warpkit/errors
@warpkit/vite-plugin    -->  (none)
@warpkit/validation     -->  (none)
@warpkit/errors         -->  (none)
@warpkit/types          -->  (none)
```

---

## @warpkit/data

**Path:** `packages/data/`

Config-driven data fetching and mutation system for Svelte 5. Provides type-safe queries via module augmentation, pluggable caching, E-Tag support, event-driven invalidation, and reactive hooks built on Svelte 5 runes.

### DataClient (`src/DataClient.ts`)

Core coordinator for fetching, caching, mutations, and invalidation. Framework-agnostic -- no Svelte dependency.

**Constructor:**

```typescript
new DataClient(config: DataClientConfig, options?: DataClientOptions)
```

- `DataClientConfig` fields:
  - `keys: Record<DataKey, DataKeyConfig<DataKey>>` -- map of data key definitions
  - `baseUrl?: string` -- prepended to all URLs
  - `timeout?: number` -- fetch timeout in ms (default: 30000)
  - `onRequest?: (request: Request) => Request | Promise<Request>` -- request interceptor for auth headers, etc.
- `DataClientOptions` fields:
  - `cache?: CacheProvider` -- pluggable cache (default: `NoCacheProvider`)
  - `events?: DataEventEmitter` -- event emitter for invalidation subscriptions

**Construction side effect:** On construction, iterates all configured keys and subscribes to their `invalidateOn` events. Builds an internal `Map<event, DataKey[]>` and calls `invalidateByPrefix()` for affected keys when events fire. This ensures cache is cleared even when no component is mounted. Unsubscribe handles are stored in `eventUnsubscribes`.

**Public methods:**

| Method | Signature | Behavior |
|--------|-----------|----------|
| `fetch` | `fetch<K>(key, params?) => Promise<FetchResult<unknown>>` | Resolves URL from config, checks cache freshness via `isFresh()` (compares `Date.now() - timestamp < staleTime`). If fresh, returns immediately. If stale with E-Tag, sends `If-None-Match` header. Handles 304 Not Modified by returning cached data. Stores response with E-Tag and `staleTime` from config. Uses `AbortController` with timeout. Applies `onRequest` interceptor. |
| `mutate` | `mutate<T>(url, options: MutateOptions) => Promise<T>` | Sends POST/PUT/PATCH/DELETE with JSON body. Prepends `baseUrl`. Applies `onRequest` interceptor. Handles 204 No Content (returns `undefined`). Uses `AbortController` with timeout. |
| `getQueryData` | `getQueryData<K>(key, params?) => Promise<DataType<K> \| undefined>` | Direct cache read for optimistic updates. |
| `setQueryData` | `setQueryData<K>(key, data, params?) => Promise<void>` | Direct cache write for optimistic updates. Sets `timestamp: Date.now()` and copies `staleTime` from key config. |
| `invalidate` | `invalidate(key, params?) => Promise<void>` | Deletes specific cache entry by exact key. |
| `invalidateByPrefix` | `invalidateByPrefix(prefix) => Promise<void>` | Deletes all cache entries matching prefix. Used by event-driven invalidation to clear all parameterized variants (e.g., `monitor-detail?uuid=abc`). |
| `clearCache` | `clearCache() => Promise<void>` | Clears entire cache. |
| `scopeCache` | `scopeCache(scope: string) => void` | Calls `cache.createScoped(scope)` if supported. Replaces internal cache reference. Used for per-user cache scoping. |
| `setCache` | `setCache(cache: CacheProvider) => void` | Late injection of cache provider. |
| `setEvents` | `setEvents(events: DataEventEmitter) => void` | Late injection of event emitter. |
| `resolveUrl` | `resolveUrl(urlTemplate, params?) => string` | Supports string templates with `:param` placeholders (auto-encodes values via `encodeURIComponent`) and function URLs `(params) => string` (consumer handles encoding). Prepends `baseUrl`. Throws if required param is missing. |
| `getKeyConfig` | `getKeyConfig<K>(key) => DataKeyConfig<K> \| undefined` | Returns config for hooks to inspect. |
| `getEvents` | `getEvents() => DataEventEmitter \| null` | Returns event emitter for hooks. |
| `getBaseUrl` | `getBaseUrl() => string` | Returns base URL. |

**Cache key format:** `key?encodedKey=encodedValue&...` with params sorted alphabetically. Both keys and values are URL-encoded. Bare key (no params) is just the key string.

**Freshness check (`isFresh`):** Returns `false` if no `staleTime` on entry (always stale). Otherwise `Date.now() - entry.timestamp < entry.staleTime`.

### Type System (`src/types.ts`)

**Module augmentation pattern:**

```typescript
// Consumer declares their keys:
declare module '@warpkit/data' {
  interface DataRegistry {
    monitors: {
      data: Monitor[];
      mutations: {
        create: { input: CreateMonitorInput; output: Monitor };
      };
    };
  }
}
```

**Core types:**

| Type | Definition | Purpose |
|------|-----------|---------|
| `DataRegistry` | Empty interface for augmentation | Type-safe key registry |
| `DataKey` | `keyof DataRegistry & string` | Union of all registered keys |
| `DataType<K>` | Extracts `data` field from registry entry, or entry itself | Query return type |
| `MutationsConfig<K>` | Extracts `mutations` field, or `never` | Mutation type map |
| `DataKeyConfig<K>` | `{ key, url, invalidateOn?, staleTime?, cache?, responseSchema? }` | Per-key configuration |
| `DataClientConfig` | `{ keys, baseUrl?, timeout?, onRequest? }` | Client-level configuration |
| `CacheProvider` | `{ get, set, delete, deleteByPrefix, clear, createScoped? }` | Pluggable cache interface (async) |
| `CacheEntry<T>` | `{ data: T, etag?, timestamp: number, staleTime? }` | Cached data envelope |
| `FetchResult<T>` | `{ data: T, fromCache: boolean, notModified: boolean }` | Fetch response metadata |
| `QueryState<T>` | `{ data, error, isLoading, isError, isSuccess, refetch }` | Reactive query state |
| `UseDataConfig<K>` | `{ url, staleTime?, invalidateOn?, mutations?, enabled? }` | useData hook config |
| `DataState<K>` | `QueryState` intersected with mutation handles | Combined query+mutation state |
| `MutationHandle<TInput, TOutput>` | Callable `(input) => Promise<output>` with `isPending`, `error`, `data`, `reset` | Mutation callable with attached state |
| `MutationDef<TInput, TOutput>` | `{ input: TInput; output: TOutput }` | Mutation type definition for registry |
| `MutationConfig` | `{ method, url? }` | Runtime mutation endpoint config |
| `UseQueryOptions<K>` | `{ key, params?, enabled?, refetchInterval?, delay? }` | useQuery hook options |
| `UseMutationOptions<TData, TError, TVariables>` | `{ mutationFn, onSuccess?, onError?, onSettled? }` | Standalone mutation options |
| `MutationState<TData, TError, TVariables>` | `{ mutate, mutateAsync, isPending, isSuccess, isError, isIdle, error, data, reset }` | Standalone mutation state |
| `DataEventEmitter` | `{ on(event, handler): () => void }` | Minimal event interface, decoupled from WarpKit core events |

**Deprecated aliases:** `QueryClient`, `QueryKeyRegistry`, `QueryKey`, `QueryKeyConfig`, `QueryClientConfig`, `QueryClientOptions`, `QueryEventEmitter`, `QUERY_CLIENT_CONTEXT`, `getQueryClient`, `QueryClientProvider`. All map to their `Data*` equivalents.

### useQuery Hook (`src/hooks.svelte.ts`)

Svelte 5 reactive data fetching hook.

```typescript
function useQuery<K extends DataKey>(options: UseQueryOptions<K>): QueryState<DataType<K>>
```

**Reactivity model:**
- Internal state uses `$state` runes: `data`, `error`, `isLoading`
- Derived state uses `$derived`: `isError = error !== null`, `isSuccess = data !== undefined && !isError`
- Returns object with getters (not raw `$state`) to maintain reactivity through destructuring

**Effects:**

1. **Initial fetch effect** (`$effect`): Resolves `enabled` (supports getter functions for reactive behavior) and `params` synchronously inside the effect body for Svelte 5 dependency tracking. Calls `doFetch(resolvedParams)`. Cleanup aborts in-flight request.

2. **Event subscription effect** (`$effect`): Subscribes to `invalidateOn` events from key config. When events fire, calls `doFetch(resolveParams())`. Cache is already cleared by DataClient's global subscription, so fetch will hit network. Cleanup unsubscribes all.

3. **Polling effect** (`$effect`): If `refetchInterval` is set and enabled, runs `setInterval` calling `doFetch` with `{ silent: true, invalidate: true }`. Silent mode skips setting `isLoading` (avoids UI flash). Invalidate mode clears cache before fetch. Cleanup clears interval.

**Race condition handling:** Incrementing `fetchId` counter. Each `doFetch` captures `currentFetchId = ++fetchId`. State updates only if `currentFetchId === fetchId` when async operations complete.

**Delay support:** `options.delay` adds a pre-fetch delay (useful for testing loading states). Delay is abortable via the `AbortController`.

**Error reporting:** Errors are reported via `reportError('data:query', error, { handledLocally: true, showUI: false })`.

### useData Hook (`src/useData.svelte.ts`)

Combined query and mutations hook. Same fetch/effect pattern as `useQuery` but simplified (no params support, no refetchInterval). Mutations are currently defined as empty (placeholder for future implementation). Returns `DataState<K>` with mutation handles attached via `Object.defineProperty` with getters.

```typescript
function useData<K extends DataKey>(key: K, config: UseDataConfig<K>): DataState<K>
```

### useMutation Hook (`src/useMutation.svelte.ts`)

Standalone mutation hook for operations outside data keys (auth, form submissions).

```typescript
function useMutation<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>
): MutationState<TData, TError, TVariables>
```

**State machine:** `status` tracks `'idle' | 'pending' | 'success' | 'error'`. Derived booleans: `isSuccess`, `isError`, `isIdle`. `isPending` is a separate `$state` (set independently in `finally` block).

**Callback order:** `mutationFn` -> `onSuccess`/`onError` -> `onSettled`. All callbacks are awaited. Errors from `mutationFn` are re-thrown after callbacks.

**Error reporting:** Reports via `reportError('data:mutation', ...)` with `handledLocally: true`.

### Context (`src/context.ts`)

- `DATA_CLIENT_CONTEXT`: `unique symbol` used as Svelte context key
- `getDataClient()`: Retrieves `DataClient` from Svelte context, throws descriptive error if not found

### DataClientProvider (`src/DataClientProvider.svelte`)

Svelte 5 component using `$props()` and `Snippet`. Calls `setContext(DATA_CLIENT_CONTEXT, client)`. Renders children via `{@render children()}`.

### NoCacheProvider (`src/NoCacheProvider.ts`)

Default no-op `CacheProvider` implementation. All methods are async no-ops. `get()` always returns `undefined`. Used when no cache is configured.

### Exports (`src/index.ts`)

Primary exports: all types, `DATA_CLIENT_CONTEXT`, `getDataClient`, `DataClient`, `NoCacheProvider`, `DataClientProvider`, `useData`, `useMutation`, `useQuery`.

Deprecated re-exports: `QueryClient`, `QueryClientProvider`, all `Query*` type aliases.

---

## @warpkit/cache

**Path:** `packages/cache/`

Cache implementations for `@warpkit/data`. Provides in-memory LRU cache, localStorage-backed persistent cache, and a two-tier E-Tag-aware composite. All implementations are synchronous internally but `ETagCacheProvider` wraps operations in async to satisfy the `CacheProvider` interface.

### MemoryCache (`src/MemoryCache.ts`)

In-memory LRU cache using `Map` insertion order for eviction.

**Constructor:** `new MemoryCache(options?: MemoryCacheOptions)` where `MemoryCacheOptions = { maxEntries?: number }` (default: 100).

**LRU mechanics:**
- `get(key)`: If found, deletes and re-inserts entry (moves to end = most recently used). Returns `CacheEntry<T> | undefined`.
- `set(key, entry)`: Deletes existing key first (update position). If at capacity, evicts oldest entry (`Map.keys().next().value` = first/oldest). `maxEntries = 0` disables cache entirely (sets are no-ops).
- `delete(key)`: Direct `Map.delete`.
- `deleteByPrefix(prefix)`: Iterates all keys, deletes those matching `key.startsWith(prefix)`.
- `clear()`: `Map.clear()`.
- `size()`: Returns `Map.size`.

**Note:** All operations are synchronous (not async). `ETagCacheProvider` wraps them in async.

### StorageCache (`src/StorageCache.ts`)

localStorage-backed persistent cache with graceful error handling.

**Constructor:** `new StorageCache(options?: StorageCacheOptions)` where `StorageCacheOptions = { prefix?: string, storage?: StorageAdapter }`. Default prefix: `'warpkit:'`. Default storage: `window.localStorage` (auto-detected via `getDefaultStorage()`). If no storage is available (SSR), all operations are no-ops.

**Storage key format:** `prefix + cacheKey` (e.g., `warpkit:monitors?uuid=abc`).

**Error handling:**
- `get()`: On JSON parse failure, reports warning via `reportError('cache', ...)`, deletes corrupted entry, returns `undefined`.
- `set()`: On quota exceeded or other errors, reports warning via `reportError('cache', ...)`, fails silently.
- `deleteByPrefix()`: Uses `isIterableStorage()` type guard to check if storage supports `length`/`key()` iteration (full `Storage` interface vs minimal `StorageAdapter`). Collects keys first, then deletes (avoids modifying during iteration).
- `clear()`: Delegates to `deleteByPrefix('')`.

**StorageAdapter interface** (from `src/types.ts`):

```typescript
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

Minimal subset of `Storage`. Allows custom implementations for SSR or testing.

### ETagCacheProvider (`src/ETagCacheProvider.ts`)

Two-tier E-Tag-aware cache implementing `CacheProvider` from `@warpkit/data`.

**Constructor:** `new ETagCacheProvider(options?: ETagCacheProviderOptions)` where `ETagCacheProviderOptions = { memory?: MemoryCacheOptions, storage?: StorageCacheOptions }`.

**Lookup strategy:** Memory (L1, fast) -> Storage (L2, persistent) -> `undefined`.

**Promotion:** Storage hits are promoted to memory via `memory.set()`.

**Write strategy:** Write-through to both tiers (`memory.set()` + `storage.set()`).

**Delete/clear:** Applied to both tiers.

**`createScoped(scope)`:** Creates a new `ETagCacheProvider` with scoped storage prefix: `basePrefix + scope + ':'`. Memory cache starts empty but shares the same `maxEntries` option. Implements `CacheProvider.createScoped` interface.

### Storage Utilities (`src/utils/storage-adapter.ts`)

Safe wrappers for browser storage operations:

- `isStorageAvailable(storage)`: Tests write/read/delete cycle with `__warpkit_storage_test__` key.
- `safeGetItem(storage, key)`: Returns `null` on any error.
- `safeSetItem(storage, key, value)`: Returns `false` on error (e.g., quota exceeded).
- `safeRemoveItem(storage, key)`: Returns `false` on error.
- `getLocalStorage()`: Returns `localStorage` if available and functional, otherwise `undefined`.
- `getSessionStorage()`: Returns `sessionStorage` if available and functional, otherwise `undefined`.

---

## @warpkit/forms

**Path:** `packages/forms/`

Schema-driven form state management for Svelte 5. Deep proxy for transparent `bind:value`, StandardSchema validation integration, array field operations with error reindexing, and field-centric access.

### useForm Hook (`src/hooks.svelte.ts`)

Main entry point. Creates reactive form state with deep proxy binding.

```typescript
function useForm<T extends object>(options: FormOptions<T>): FormState<T>
```

**FormOptions<T>:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `initialValues` | `T` | (required) | Initial form values |
| `schema` | `StandardSchema<T>` | `undefined` | Validation schema |
| `mode` | `ValidationMode` | `'blur'` | When to start validating |
| `revalidateMode` | `RevalidateMode` | `'change'` | When to revalidate after first error |
| `delayError` | `number` | `0` | Debounce delay for error display (ms) |
| `validators` | `Partial<Record<keyof T, FieldValidator<T>>>` | `{}` | Per-field custom validators (run after schema) |
| `warners` | `Partial<Record<keyof T, FieldValidator<T>>>` | `{}` | Per-field warning validators (non-blocking) |
| `onSubmit` | `(values: T) => void \| Promise<void>` | (required) | Submit callback |

**Initialization flow:**
1. Extract defaults from TypeBox schema via `extractDefaults()` (TypeBox only)
2. Deep merge schema defaults with `initialValues` via `mergeInitialValues()` (JSON clone to handle Svelte 5 proxies)
3. Clone merged values for internal `$state`
4. Create deep proxy around values with `onSet` callback

**Core state (all `$state`):** `values`, `errors`, `warnings`, `touched`, `isSubmitting`, `isValidating`, `isSubmitted`, `submitError`, `submitCount`.

**Derived state:** `dirty` (computed via `calculateDirtyState` with cached paths for performance), `isDirty` (any dirty field), `isValid` (no errors).

**Path caching optimization:** `getCachedPaths()` computes a structural signature of the values object (keys, array lengths -- not values). If signature matches cached version, reuses cached `getAllPaths()` result. Avoids O(n) traversal on every value change.

**Deep proxy (`createDeepProxy`):**
- `onSet(path, value)`: Marks field as touched (if `mode === 'touched'`), triggers field validation (via `shouldValidateField`), always runs field warners.
- Creates nested proxies on property access for objects (lazy proxying).
- Symbols pass through without callbacks.

**Validation timing (`shouldValidateField`):**
- If field already has error: use `revalidateMode` (always revalidate on `'change'`, only on matching event for `'blur'`)
- If form has been submitted: always validate
- Mode-based: `'submit'` -> never, `'blur'` -> on blur only, `'change'` -> always, `'touched'` -> on change if touched

**Submit flow:**
1. Set `isSubmitted = true`, increment `submitCount`, clear `submitError`
2. Run full validation (`validate()`)
3. If invalid, return early
4. Set `isSubmitting = true`, call `onSubmit(values)`
5. On error: set `submitError`, report via `reportError('forms:submit', ...)`
6. Finally: `isSubmitting = false`

**FormState<T> interface:**

Reactive getters: `data`, `errors`, `warnings`, `touched`, `dirty`, `isValid`, `isDirty`, `isSubmitting`, `isValidating`, `isSubmitted`, `submitError`, `submitCount`.

Operations: `submit(event?)`, `reset(newValues?)`, `validate()`, `validateField(field)`, `setField(field, value)`, `setError(field, message|null)`, `setWarning(field, message|null)`, `touch(field)`, `clearErrors()`.

Array operations: `push(field, value)`, `remove(field, index)`, `insert(field, index, value)`, `move(field, from, to)`, `swap(field, indexA, indexB)`. Remove/insert trigger `reindexArrayErrors()`.

Field-centric access: `field<V>(path)` returns `FieldState<V>` with getters for `value`, `error`, `warning`, `touched`, `dirty`.

Lifecycle: `cleanup()` clears all error debounce timers.

### Proxy System (`src/proxy.ts`)

```typescript
function createDeepProxy<T extends object>(target: T, options: ProxyOptions, parentPath?: string): T
```

**ProxyOptions:**
- `onSet(path: string, value: unknown)`: Called after every property set. Path is dot notation (e.g., `'user.address.city'`).
- `onGet?(path: string, value: unknown)`: Optional callback on property access.

**Behavior:**
- Null/undefined/primitive targets pass through unchanged.
- Nested objects are recursively proxied on access (lazy proxy creation).
- Symbols pass through without callbacks (important for Svelte internal symbols).
- Path building: `parentPath ? parentPath.prop : prop`.

### Form Logic (`src/form-logic.ts`)

Pure functions extracted for unit testing without Svelte runtime.

- `shouldValidateField(options)`: Determines validation timing. See validation timing table above.
- `reindexArrayErrors(errors, field, fromIndex, delta)`: Updates error keys after array modification. For removal (`delta < 0`): skips removed index, shifts higher indices down. For insertion (`delta > 0`): shifts indices at/above insertion point up. Returns new errors object.
- `calculateDirtyState(current, initial, paths, getPath)`: Compares values at each path using `Object.is()`.
- `mergeInitialValues(schemaDefaults, initialValues)`: JSON clone + spread merge. User values override schema defaults.
- `createErrorDebouncer(delayMs)`: Returns `ErrorDebouncer` with `set(field, message, setError)`, `clear(field)`, `clearAll()`, `hasPending(field)`. Field-level timers stored in `Map`.
- `parseArrayErrorKey(key, prefix)`: Extracts index and suffix from error keys like `items.0.name`.
- `hasAnyTrue(record)`, `isEmptyRecord(record)`, `removeKey(record, key)`, `setKey(record, key, value)`: Immutable record helpers.

### Path Utilities (`src/paths.ts`)

Pure functions for nested value access via dot notation paths.

- `getPath(obj, path)`: Traverses dot-separated path, returns `undefined` if any segment is null/undefined. Empty path returns root object.
- `setPath(obj, path, value)`: Returns new object (immutable). Uses JSON clone for Svelte 5 proxy compatibility. Auto-creates intermediate objects or arrays based on whether next path segment is numeric.
- `pathToString(path[])`: Joins array of segments with `.`.
- `getAllPaths(obj, prefix?)`: Returns array of dot notation paths to all leaf values. Handles nested objects and arrays recursively. Empty objects/arrays are treated as leaves.
- `getStructuralSignature(obj, prefix?)`: Computes a string signature that changes only when structure changes (keys added/removed, array lengths changed), not when values change. Used for caching `getAllPaths()` results.

### Validation Integration (`src/validation.ts`)

Orchestrates form validation using StandardSchema.

- `validateSchema(schema, values)`: Synchronous validation. Throws if schema returns a Promise. Returns `ValidationResult = { valid: boolean, errors: Record<string, string> }`. Only keeps first error per path. Root-level errors keyed as `'_root'`.
- `validateSchemaAsync(schema, values)`: Async version. Handles both sync and async schemas.
- `shouldValidate(mode, event)`: Simple mode/event matching (separate from `shouldValidateField` in form-logic).
- `createErrorDebouncer(delayMs)`: Alternative debouncer implementation with `getErrors()` method (different from form-logic version).

**Path normalization:** `normalizePathArray()` handles StandardSchema's two path formats: simple `PropertyKey` values and `{ key: PropertyKey }` objects.

### Default Extraction (`src/defaults.ts`)

Extracts default values from TypeBox schemas. TypeBox only -- Zod, Valibot, and other StandardSchema implementations are not supported.

```typescript
function extractDefaults<T>(schema: TypeBoxSchemaLike | undefined): Partial<T>
```

**TypeBoxSchemaLike interface:** `{ default?, properties?, items?, type? }` -- minimal interface to avoid TypeBox dependency.

**Extraction logic:**
- Root-level `default` property: returns directly
- Object schemas with `properties`: recursively extracts from each property
- Array schemas with `items`: does not auto-expand (only array-level default)
- Returns empty partial if no defaults found

### Testing Utilities (`src/testing/`)

Exported via `@warpkit/forms/testing` entry point.

**Mock factories:**
- `createMockForm<T>(options?: MockFormOptions<T>)`: Creates `FormState<T>` without Svelte context. Configurable initial state. Operations are no-ops except `setError`, `setWarning`, `touch`, `clearErrors` which update internal `$state`.
- `createMockSchema<T>(options?: MockSchemaOptions<T>)`: Creates `StandardSchema<T>` with configurable issues, async delay, or custom validate function.
- `createMockIssue(path, message)`: Helper to create `StandardIssue` objects.

**Test helpers:**
- `waitForFormSubmit(form, timeoutMs?)`: Polls `isSubmitting` with 50ms intervals until `false`.
- `waitForFormValidation(form, timeoutMs?)`: Polls `isValidating` similarly.
- `setFormValues(form, values)`: Batch `setField` calls.
- `getFormErrors(form)`, `getFormWarnings(form)`, `getFormTouched(form)`, `getFormDirty(form)`: Shallow copies of form state for assertions.
- `assertFieldError(form, field, expectedMessage)`: Throws descriptive error on mismatch.

### Types (`src/types.ts`)

- `ValidationMode`: `'submit' | 'blur' | 'change' | 'touched'`
- `RevalidateMode`: `'change' | 'blur'`
- `FieldValidator<T, V>`: `(value: V, values: T) => string | undefined | Promise<string | undefined>`
- `FieldState<V>`: Getter-based interface: `value`, `error`, `warning`, `touched`, `dirty`
- `FormOptions<T>`: See useForm section above
- `FormState<T>`: Full form interface with reactive getters and methods (40+ members)

---

## @warpkit/validation

**Path:** `packages/validation/`

Library-agnostic validation abstraction. Provides the StandardSchema interface (compatible with Zod, TypeBox, Valibot, ArkType), typed definition wrappers, and core validation functions. Zero external dependencies.

### StandardSchema (`src/standard-schema.ts`)

Based on the [Standard Schema specification](https://github.com/standard-schema/standard-schema).

```typescript
type StandardSchema<T> = {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<T> | Promise<StandardResult<T>>;
  };
};
```

**Result types:**
- `StandardResult<T>`: `{ readonly value: T }` (success) or `{ readonly issues: ReadonlyArray<StandardIssue> }` (failure)
- `StandardIssue`: `{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> }`
- `StandardInfer<T>`: Extracts `T` from `StandardSchema<T>`

**Type guard:** `isStandardSchema(value): value is StandardSchema` -- checks for `'~standard'` property.

### ValidatedType (`src/validated-type.ts`)

Factory for creating type definitions with attached schemas.

```typescript
const ValidatedType = {
  wrap<TSchema extends StandardSchema>(key: string, schema: TSchema): ValidatedType<StandardInfer<TSchema>>,
  unwrap<T>(validated: ValidatedType<T>): StandardSchema<T>
};
```

- `wrap()`: Creates frozen `{ key, schema, _data }` object. `_data` is phantom type carrier (`undefined` at runtime).
- `unwrap()`: Extracts schema from validated type.

### TypeDefinition (`src/type-definition.ts`)

Factory for type-only definitions (no schema, no runtime validation).

```typescript
const TypeDefinition = {
  create<T>(key: string): TypeDefinition<T>
};
```

Creates frozen `{ key, _data }` object. Used when type inference is needed without validation.

### Core Types (`src/types.ts`)

```typescript
type TypeDefinition<T> = { readonly key: string; readonly _data: T };
type ValidatedType<T> = TypeDefinition<T> & { readonly schema: StandardSchema<T> };
```

### Validation Functions (`src/validate.ts`)

- `validate<T>(schema, data): T`: Synchronous. Throws `ValidationError` on failure, throws `Error` if schema returns Promise.
- `validateAsync<T>(schema, data): Promise<T>`: Async. Handles both sync and async schemas.
- `isValidatedType<T>(def): def is ValidatedType<T>`: Type guard checking for `schema` property.

### ValidationError (`src/errors.ts`)

```typescript
class ValidationError extends Error {
  readonly issues: ReadonlyArray<StandardIssue>;
  constructor(issues: ReadonlyArray<StandardIssue>);
}
```

Message format: `Validation failed: msg1, msg2, ...`

### Exports (`src/index.ts`)

Uses TypeScript declaration merging to export `ValidatedType` and `TypeDefinition` as both value (factory) and type.

---

## @warpkit/websocket

**Path:** `packages/websocket/`

Browser WebSocket client with automatic reconnection, type-safe message handling, room management, heartbeat keep-alive, and offline/visibility awareness.

### SocketClient (`src/client.ts`)

Full-featured browser WebSocket client.

**Constructor:**

```typescript
new SocketClient(url: string, options?: SocketClientOptions)
```

**SocketClientOptions (all optional):**

| Option | Default | Description |
|--------|---------|-------------|
| `reconnect` | `true` | Auto-reconnect on disconnect |
| `maxReconnectAttempts` | `Infinity` | Maximum retry attempts |
| `reconnectDelay` | `500` | Minimum backoff delay (ms) |
| `maxReconnectDelay` | `20000` | Maximum backoff delay (ms) |
| `connectionTimeout` | `5000` | Connection timeout (ms), 0 to disable |
| `heartbeatInterval` | `25000` | Ping interval (ms), 0 to disable |
| `heartbeatTimeout` | `5000` | Pong timeout (ms), 0 to disable |

**Connection lifecycle:**

1. `connect()`: No-op if already connected/connecting. Sets state to `'connecting'`. Creates `WebSocket`. Starts connection timeout.
2. On `onopen`: Clears timeout, resets backoff, starts heartbeat, rejoins rooms, flushes send buffer, emits `Connected` message (with `reconnected: boolean`).
3. On `onmessage`: Routes to `handleMessage()`.
4. On `onclose`: Clears timeout, stops heartbeat, sets state to `'disconnected'`, emits `Disconnected` (if was connected), calls `maybeReconnect()`.
5. On `onerror`: Reports error, does NOT change state (onclose handles that).
6. `disconnect()`: Sets `skipReconnect = true`, clears all timers, stops heartbeat, empties send buffer, closes WebSocket, sets state to `'disconnected'`.

**Reconnection (`maybeReconnect()`):**

Conditions that prevent reconnect: `!options.reconnect`, `skipReconnect` (intentional disconnect), `pageHidden`, `deviceWentOffline`, `navigator.onLine === false`, `attempts >= maxReconnectAttempts`, already reconnecting.

Uses full jitter backoff via `Backoff` class:
- `duration()`: `ceiling = min(max, min * 2^attempts)`, `interval = floor(random() * ceiling)`, returns `min(max, min + interval)`. Step capped at 31 to prevent overflow.
- After delay, sets state to `'reconnecting'`, emits `reconnect_attempt`, calls `connect()`.

**Browser event handling (`setupNetworkEvents()`):**

Run once on construction. Detects browser environment via `globalThis.addEventListener`.

- `offline` event: Sets `deviceWentOffline = true`, closes WebSocket if connected/connecting.
- `online` event: Clears `deviceWentOffline`, cancels pending reconnect timer, immediately calls `connect()`.
- `visibilitychange` event: Sets `pageHidden` based on `visibilityState`. On visible: cancels pending reconnect timer, immediately calls `connect()`.

**Message handling:**

Type-safe subscription: `on<TData>(message: ClientMessageDefinition<TData>, handler: MessageHandler<TData>): () => void`

Handler registry: `Map<string, Set<MessageHandler<unknown>>>`. Unsubscribe removes handler from set, deletes set if empty.

Incoming messages are parsed via `Json.parse()` (prototype pollution protection), then routed to handlers by `envelope.name`. Pong frames (`'3'`) are handled separately.

**Message sending:**

- `emit<TData>(message, data, options?)`: Type-safe message emission. Serializes as `{ type: message.name, ...data }`. If not connected and `buffer !== false` (default: `true`), queues in send buffer.
- `send(type, payload, options?)`: Deprecated. Raw message sending.
- `sendRaw(data, options?)`: Raw string sending. Default: NOT buffered.

Send buffer is flushed on connect. Copy-and-clear pattern avoids issues if callbacks add more messages.

**Room management:**

- `joinRoom(room)`: Adds to internal `rooms` Set, emits `JoinRoom` if connected.
- `leaveRoom(room)`: Removes from Set, emits `LeaveRoom` if connected.
- `clearRooms()`: Clears Set without sending leave messages.
- Auto-rejoin: On reconnect, iterates `rooms` and emits `JoinRoom` for each.

**Heartbeat:**

- Ping frame: `'2'` (single character)
- Pong frame: `'3'` (single character)
- `startHeartbeat()`: `setInterval` sending ping every `heartbeatInterval` ms.
- `sendPing()`: Sends `'2'`, sets `awaitingPong = true`, starts timeout timer.
- `handlePong()`: Clears `awaitingPong`, clears timeout timer.
- `handlePongTimeout()`: Reports error to handlers, force-closes WebSocket (triggers reconnect via `onclose`).

**State management:**

- `connectionState`: getter returning current `ConnectionState`
- `isConnected`: getter returning `state === 'connected'`
- `joinedRooms`: getter returning `ReadonlySet<string>`
- `onStateChange(handler)`: Subscribe to state changes, returns unsubscribe.
- `onError(handler)`: Subscribe to errors, returns unsubscribe.

**Error reporting:** All errors reported via `reportError('websocket', ...)` or `reportError('websocket:message', ...)`.

**Built-in message definitions (exported from client.ts):**

| Definition | Data Type | Internal Name |
|-----------|-----------|---------------|
| `Connected` | `{ reconnected?: boolean }` | `'__connected__'` |
| `Disconnected` | `Record<string, never>` | `'__disconnected__'` |
| `ReconnectAttempt` | `{ attempt: number }` | `'reconnect_attempt'` |
| `ReconnectFailed` | `{ attempts: number }` | `'reconnect_failed'` |

### Control Messages (`src/control-messages.ts`)

**`ClientMessage.define()` factory:**

Overloaded function supporting two modes:
- Without `ValidatedType`: `ClientMessage.define<TData>(name)` -- returns `ClientMessageDefinition<TData>` (validation-agnostic, type via generic)
- With `ValidatedType`: `ClientMessage.define(name, validatedType)` -- returns `ValidatedMessageDefinition<TData>` (with schema for runtime validation)

Both return frozen objects with `name` and `_data` phantom type carrier.

**Built-in control messages:**

| Export | Message Name | Data Type |
|--------|-------------|-----------|
| `JoinRoom` | `'room.join'` | `{ room: string }` |
| `LeaveRoom` | `'room.leave'` | `{ room: string }` |
| `Heartbeat` | `'heartbeat'` | `Record<string, never>` |

### JSON Safety (`src/json.ts`)

`Json.parse<T>(text, reviver?)`: Parses JSON then recursively sanitizes output to prevent prototype pollution.

**Sanitization (`sanitize<T>()`):**
- Primitives, null: pass through (no allocation)
- Built-in types (Date, RegExp, Map, Set, Error): pass through
- Arrays: `map(sanitize)` (new array)
- Objects: single-pass copy, skipping dangerous keys (`__proto__`, `constructor`, `prototype`) via `Set` lookup (O(1))

### Types (`src/types.ts`)

- `ClientMessageDefinition<TData>`: `{ readonly name: string; readonly _data: TData }` -- phantom type carrier
- `ValidatedMessageDefinition<TData>`: extends `ClientMessageDefinition` with `readonly schema: StandardSchema<TData>`
- `MessageEnvelope<TData>`: `{ name: string; data: TData; timestamp: number }`
- `MessageHandler<TData>`: `(data: TData, envelope: MessageEnvelope<TData>) => void`
- `ConnectionState`: `'connecting' | 'connected' | 'disconnected' | 'reconnecting'`
- `SocketClientOptions`: See constructor table above
- `ConnectionStateHandler`: `(state: ConnectionState) => void`
- `ErrorHandler`: `(error: Error) => void`
- `PING_FRAME` / `PONG_FRAME`: `'2'` / `'3'` -- exported for server implementations

---

## @warpkit/errors

**Path:** `packages/errors/`

Cross-package error reporting channel. Zero dependencies. Any WarpKit package can report errors; the core application subscribes and routes to error stores and UI overlays.

### Error Channel (`src/channel.ts`)

Singleton pub/sub pattern with pre-subscription buffering.

**`reportError(source, error, options?)`:**

Builds an `ErrorReport` from arguments. If handlers exist, delivers immediately. If no subscribers yet, buffers (max 100 entries). In DEV mode (`import.meta.env.DEV`), also `console.error`s buffered errors.

Error coercion: `unknown` -> `Error` via `toError()`. Strings become `new Error(string)`, non-errors become `new Error(String(value))`.

Default `showUI`: `true` for `'error'`/`'fatal'`, `false` for `'warning'`/`'info'`.

**`onErrorReport(handler): () => void`:**

First subscriber triggers buffer flush (all buffered errors delivered to first handler). Returns unsubscribe function.

**`_resetChannel()`:** Testing-only reset. Clears handlers and buffer.

### Types (`src/types.ts`)

**`ErrorChannelSource`:** Union of known source identifiers:
`'data:query' | 'data:mutation' | 'websocket' | 'websocket:message' | 'websocket:heartbeat' | 'forms:submit' | 'cache' | 'auth' | 'event-emitter' | 'state-machine' | 'navigation-lifecycle'`

**`ErrorReportSeverity`:** `'fatal' | 'error' | 'warning' | 'info'`

**`ErrorReportOptions`:**
- `severity?: ErrorReportSeverity` (default: `'error'`)
- `showUI?: boolean` (default: severity-dependent)
- `handledLocally?: boolean` (default: `false`) -- whether the package already displays this error
- `context?: Record<string, unknown>` -- debugging context

**`ErrorReport`:** Complete report: `source`, `error: Error`, `severity`, `showUI`, `handledLocally`, `context?`, `timestamp: number`

**`ErrorReportHandler`:** `(report: ErrorReport) => void`

---

## @warpkit/auth-firebase

**Path:** `packages/auth-firebase/`

Firebase Authentication adapter implementing `AuthAdapter` from `@warpkit/types`. Consumer provides Firebase app instance; adapter handles auth state management, token retrieval, and sign-in methods.

### FirebaseAuthAdapter (`src/adapter.ts`)

```typescript
class FirebaseAuthAdapter<TAppState, TStateData> implements AuthAdapter<unknown, TAppState, TStateData, FirebaseTokens>
```

**Constructor:**

```typescript
new FirebaseAuthAdapter(app: FirebaseApp, options: {
  getInitialState: (user: FirebaseUser | null) => Promise<AuthInitResult<TAppState, TStateData>>;
  getStateChange?: (user: FirebaseUser | null) => Promise<AuthInitResult<TAppState, TStateData> | undefined>;
  appCheck?: AppCheck | null;
  authEmulatorUrl?: string;
})
```

- `getInitialState`: Consumer callback to map Firebase user to initial app state.
- `getStateChange`: Consumer callback for subsequent auth changes. Default: maps to `'authenticated'`/`'unauthenticated'`.
- `appCheck`: Optional Firebase AppCheck instance for app verification tokens.
- `authEmulatorUrl`: If set, connects to auth emulator (e.g., `'http://127.0.0.1:9099'`). Skips if emulator already configured.

**AuthAdapter implementation:**

- `initialize()`: Creates a Promise, subscribes to `onAuthStateChanged` (one-time), waits for initial auth state, then calls `getInitialState(user)`.
- `onAuthStateChanged(callback)`: Subscribes to Firebase `onAuthStateChanged`. Skips first call (already handled by `initialize`). Calls `getStateChange(user)` and forwards result to callback.
- `signOut()`: Calls Firebase `signOut()`, clears `currentUser`.
- `getTokens()`: Returns `{ idToken, appCheckToken }`. Gets AppCheck token first (with force refresh if no user -- Firebase quirk workaround). Token errors are reported as warnings via `reportError('auth', ...)`.

**Sign-in methods:**

- `signInWithEmail(email, password)`: Tries `signInWithEmailAndPassword`. If `auth/user-not-found`, falls back to `createUserWithEmailAndPassword`. Returns `FirebaseSignInResult = { user, isNewUser }`.
- `signInWithGoogle()`: `signInWithPopup` with `GoogleAuthProvider`. Checks `_tokenResponse.isNewUser` (undocumented Firebase property).
- `createUserWithEmail(email, password)`: Direct account creation. Alias: `signUpWithEmail`.
- `getIdToken()`: Convenience wrapper returning just the ID token.
- `refreshUser()`: Reloads Firebase user profile.

**Persistence control:**

- `useMemoryPersistence()`: Sets `inMemoryPersistence`. For atomic sign-in with enrichment: sign in -> enrich -> commit.
- `commitSession()`: Promotes to `browserLocalPersistence`.
- `useLocalPersistence()`: Sets `browserLocalPersistence` (default Firebase behavior).

**Error handling:** Uses `mapFirebaseError()` which returns `FirebaseAuthError` with user-friendly messages. Cryptic Firebase codes like `auth/wrong-password` and `auth/user-not-found` both map to `'Invalid email or password'` to prevent user enumeration.

### Error Mapping (`src/error-mapping.ts`)

- `FirebaseAuthError`: Custom error class with `code`, `originalMessage`, and user-facing `message`.
- `getErrorMessage(code)`: Maps Firebase error code to user-friendly string. Falls back to `'Authentication failed. Please try again.'`.
- `mapFirebaseError(error)`: Coerces unknown error to `FirebaseAuthError`.
- `isFirebaseAuthError(error)`: Type guard checking for `code` property starting with `'auth/'`.

**Mapped error codes:** `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-credential`, `auth/invalid-email`, `auth/email-already-in-use`, `auth/user-disabled`, `auth/weak-password`, `auth/too-many-requests`, `auth/network-request-failed`, `auth/popup-closed-by-user`, `auth/popup-blocked`, `auth/cancelled-popup-request`, `auth/multi-factor-auth-required`.

### Types (`src/types.ts`)

- `FirebaseTokens`: `{ idToken: string | null; appCheckToken: string | null }`
- `FirebaseUser`: `{ uid, email, displayName, photoURL, emailVerified }` -- minimal subset of Firebase User
- `FirebaseSignInResult`: `{ user: FirebaseUser; isNewUser: boolean }`
- `FirebaseMfaError`: `{ code: 'auth/multi-factor-auth-required'; resolver: unknown }`

---

## @warpkit/vite-plugin

**Path:** `packages/vite-plugin/`

Vite plugin for WarpKit development experience. Handles error overlay delegation, route component pre-warming, HMR ID injection, and custom HMR events.

### warpkitPlugin (`src/index.ts`)

```typescript
function warpkitPlugin(options?: WarpKitPluginOptions): Plugin
```

**WarpKitPluginOptions:**
- `routeComponents?: string[]` -- glob patterns for route component files to pre-warm (e.g., `['./src/pages/**/*.svelte']`)

**Plugin hooks:**

| Hook | Enforce | Behavior |
|------|---------|----------|
| `config()` | - | Disables Vite's built-in error overlay (`server.hmr.overlay: false`). WarpKit handles errors via its own ErrorOverlay. If `routeComponents` is provided, adds to `server.warmup.clientFiles` to prevent dependency discovery reloads on first lazy-load navigation. |
| `transform(code, id)` | `'post'` | Runs after `@sveltejs/vite-plugin-svelte`. For `.svelte` files only, appends `export const __warpkitHmrId = "<file-id>";` to the compiled output. This ID is used by WarpKit's component swap logic. |
| `handleHotUpdate(ctx)` | - | For `.svelte` files, sends a custom HMR event `warpkit:component-update` with `{ file, timestamp }` data. Does NOT suppress default Svelte HMR -- both run in parallel. |

---

## @warpkit/types

**Path:** `packages/types/`

Shared TypeScript type definitions to avoid circular dependencies between packages. Zero dependencies.

### AuthAdapter Interface (`src/auth.ts`)

```typescript
interface AuthAdapter<TContext, TAppState extends string, TStateData, TTokens> {
  initialize?(context: TContext): Promise<AuthInitResult<TAppState, TStateData>>;
  getTokens(): Promise<TTokens>;
  onAuthStateChanged(callback): () => void;
  signOut?(): Promise<void>;
}
```

**`AuthInitResult<TAppState, TStateData>`:**
- `state: TAppState` -- the app state to transition to
- `stateData?: TStateData` -- optional data for state transition (e.g., project alias for dynamic route defaults)

**Type parameters:**
- `TContext`: Context passed to `initialize()` (WarpKit provides event emitter)
- `TAppState`: Union of valid state names (e.g., `'authenticated' | 'unauthenticated' | 'onboarding'`)
- `TStateData`: Data associated with state transitions
- `TTokens`: Token shape (default: `{ idToken: string | null }`)

**Contract:**
1. `initialize()` is called once during app startup. WarpKit waits for it before rendering.
2. `onAuthStateChanged()` is called after `initialize()` completes. Subsequent auth events are forwarded.
3. `getTokens()` is called by WebSocket client and API interceptors for authenticated requests.
4. `signOut()` is optional -- only needed for programmatic sign out.

### Exports (`src/index.ts`)

Type-only exports: `AuthAdapter`, `AuthInitResult`.
