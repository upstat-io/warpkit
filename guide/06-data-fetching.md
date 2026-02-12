# Data Fetching & Caching

Every SPA needs to fetch data from APIs. The naive approach -- call `fetch()` inside a component, manage loading and error state manually, sprinkle in some `try/catch` blocks -- works for small applications. But it falls apart quickly:

- **Duplicated loading/error logic.** Every component that fetches data reimplements the same `isLoading`, `isError`, `data` pattern. Multiply this by dozens of components and you have a maintenance problem.
- **No caching.** The same data gets fetched multiple times as users navigate between pages. The monitor list fetched on the dashboard is fetched again when the user navigates back from the detail page.
- **Race conditions.** When parameters change faster than requests complete, old responses arrive after new ones and overwrite the current state with stale data.
- **No type safety.** Response data is `any` by default. You either cast everywhere or build a custom type layer.
- **No invalidation strategy.** When a mutation changes server state, there is no systematic way to mark related queries as stale.

WarpKit's `@warpkit/data` package solves all of these problems with a config-driven data layer built for Svelte 5.

## WarpKit's Approach: Config-Driven Data Layer

Instead of writing `fetch()` calls scattered across components, you configure a `DataClient` that knows about your API's shape. Every data endpoint is defined once in a central configuration, and components access data through type-safe hooks.

```typescript
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

const dataClient = new DataClient(
  {
    baseUrl: '/api',
    timeout: 10000,
    keys: {
      'monitors': {
        key: 'monitors',
        url: '/monitors',
        staleTime: 30000,
        invalidateOn: ['monitor:created', 'monitor:deleted']
      },
      'monitors/:id': {
        key: 'monitors/:id',
        url: (params) => `/monitors/${params.id}`,
        invalidateOn: ['monitor:updated']
      },
      'projects': {
        key: 'projects',
        url: '/projects',
        staleTime: 60000
      }
    },
    onRequest: async (request) => {
      const token = await getAuthToken();
      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    }
  },
  { cache: new ETagCacheProvider() }
);
```

This configuration tells the `DataClient`:
- The base URL for all requests
- The URL pattern for each data key (with support for parameterized URLs)
- How long data should be considered fresh (`staleTime`)
- Which events trigger cache invalidation (`invalidateOn`)
- How to modify outgoing requests (for auth headers, custom headers, etc.)
- Which cache implementation to use

Once configured, components never think about URLs, headers, or caching again. They just ask for data by key.

## Type Registry

WarpKit uses TypeScript module augmentation to provide full type inference for data keys. You declare a `DataRegistry` that maps key names to their data types:

```typescript
declare module '@warpkit/data' {
  interface DataRegistry {
    'monitors': {
      data: Monitor[];
      mutations: {
        create: { input: CreateMonitorInput; output: Monitor };
        update: { input: UpdateMonitorInput; output: Monitor };
        remove: { input: string; output: void };
      };
    };
    'monitors/:id': {
      data: Monitor;
    };
    'projects': {
      data: Project[];
    };
  }
}
```

With this declaration in place, `useData('monitors')` returns a state object where `.data` is typed as `Monitor[] | undefined`. `useData('monitors/:id')` returns `Monitor | undefined`. The key name is the only thing connecting the component to the type -- there are no manual type annotations needed at the call site.

The `mutations` field is optional. When present, it defines the input and output types for mutation operations that are semantically associated with this data key. More on this in the mutations section below.

## DataClientProvider

Before any component can use data hooks, the `DataClient` must be provided to the component tree via Svelte context:

```svelte
<script lang="ts">
  import { DataClientProvider } from '@warpkit/data';
  import { WarpKitProvider, RouterView } from '@upstat/warpkit';

  const { warpkit, dataClient } = $props();
</script>

<WarpKitProvider {warpkit}>
  <DataClientProvider client={dataClient}>
    <RouterView />
  </DataClientProvider>
</WarpKitProvider>
```

All child components can now call `useData()`, `useQuery()`, `useMutation()`, or `getDataClient()` to access the data layer.

## useQuery -- The Lower-Level Hook

`useQuery` is the foundational data fetching hook. It fetches data for a configured key and maintains reactive state:

```svelte
<script lang="ts">
  import { useQuery } from '@warpkit/data';

  const monitors = useQuery({ key: 'monitors' });
</script>

{#if monitors.isLoading}
  <LoadingSkeleton />
{:else if monitors.isError}
  <ErrorMessage error={monitors.error} onRetry={monitors.refetch} />
{:else}
  {#each monitors.data ?? [] as monitor}
    <MonitorCard {monitor} />
  {/each}
{/if}
```

The returned object has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T \| undefined` | The fetched data. `undefined` while loading. |
| `isLoading` | `boolean` | `true` while the initial fetch is in progress |
| `isError` | `boolean` | `true` if the fetch resulted in an error |
| `isSuccess` | `boolean` | `true` if data was fetched successfully |
| `error` | `Error \| null` | The error object if fetch failed, `null` otherwise |
| `refetch` | `() => Promise<void>` | Manually trigger a refetch |

### CRITICAL: Never Destructure the Return Value

This is the single most important rule when using data hooks in WarpKit.

```typescript
// WRONG -- breaks reactivity
const { data, isLoading } = useQuery({ key: 'monitors' });

// CORRECT -- maintains reactivity
const monitors = useQuery({ key: 'monitors' });
// Always access through the original object: monitors.data, monitors.isLoading
```

Svelte 5's `$state` reactivity requires property access through the original object. When you destructure, you capture the _current value_ of each property at the moment of destructuring. Those local variables are not reactive -- they will never update when new data arrives or when loading state changes. Always access properties through the returned object.

### Parameterized Queries

For data keys with URL parameters, pass them in the `params` option:

```typescript
const monitor = useQuery({
  key: 'monitors/:id',
  params: { id: monitorId }
});
```

The `DataClient` resolves the URL by replacing `:id` in the configured URL pattern with the provided value.

### Reactive Parameters

When parameters come from reactive sources (like page params or component state), use a getter function so the `$effect` inside `useQuery` tracks the dependency:

```svelte
<script lang="ts">
  import { useQuery } from '@warpkit/data';
  import { usePage } from '@upstat/warpkit';

  const page = usePage();

  // Re-fetches automatically when page.params.id changes
  const monitor = useQuery({
    key: 'monitors/:id',
    params: () => ({ id: page.params.id })
  });
</script>
```

When the params getter returns new values, the hook automatically aborts any in-flight request and starts a new fetch with the updated parameters. Race conditions are handled internally via fetch ID tracking.

### Conditional Fetching

Sometimes you do not want to fetch data until certain conditions are met. The `enabled` option controls this:

```typescript
// Static condition -- fetch only if monitorId is truthy
const monitor = useQuery({
  key: 'monitors/:id',
  params: { id: monitorId },
  enabled: !!monitorId
});

// Reactive condition -- re-evaluated by Svelte 5's $effect
const monitor = useQuery({
  key: 'monitors/:id',
  params: () => ({ id: selectedId }),
  enabled: () => !!selectedId
});
```

When `enabled` is `false`, the hook sets `isLoading` to `false` and does not fetch. When `enabled` transitions from `false` to `true`, the fetch begins.

### Polling with refetchInterval

For data that needs to stay fresh without relying on events, use `refetchInterval`:

```typescript
const monitors = useQuery({
  key: 'monitors',
  refetchInterval: 15000 // Re-fetch every 15 seconds
});
```

The interval fetch bypasses the cache (invalidates before fetching) to ensure fresh data. The initial fetch still uses cache for a fast first paint. The timer is cleaned up when the component unmounts or when `enabled` becomes `false`.

### Fetch Delay

For development and design work, the `delay` option adds a pause before each fetch. This is useful for previewing loading skeletons and transitions:

```typescript
const monitors = useQuery({
  key: 'monitors',
  delay: 1000 // Wait 1 second before fetching (development only)
});
```

## useData -- The Combined Hook

`useData` combines query fetching with integrated mutation support. It is the higher-level hook that most application code should use:

```svelte
<script lang="ts">
  import { useData } from '@warpkit/data';

  const monitors = useData('monitors', {
    url: '/monitors',
    staleTime: 30000,
    invalidateOn: ['monitor:created', 'monitor:deleted'],
    mutations: {
      create: { method: 'POST' },
      update: { method: 'PUT', url: (input) => `/monitors/${input.id}` },
      remove: { method: 'DELETE', url: (input) => `/monitors/${input}` }
    }
  });
</script>

<!-- Query state -->
{#if monitors.isLoading}
  <LoadingSkeleton />
{:else}
  {#each monitors.data ?? [] as monitor}
    <MonitorCard {monitor} />
  {/each}
{/if}
```

The `useData` hook returns the same query state properties as `useQuery` (`data`, `isLoading`, `isError`, `isSuccess`, `error`, `refetch`) plus typed mutation handles for each configured mutation.

### useData Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string \| ((params) => string)` | The fetch URL |
| `staleTime` | `number` | Milliseconds before data is considered stale |
| `invalidateOn` | `string[]` | Event names that trigger a refetch |
| `mutations` | `Record<string, MutationConfig>` | Mutation configurations |
| `enabled` | `boolean \| (() => boolean)` | Whether the query is active (default: `true`) |

## useMutation -- Standalone Mutations

For write operations that do not belong to a specific data key -- authentication, form submissions, one-off API calls -- use the standalone `useMutation` hook:

```svelte
<script lang="ts">
  import { useMutation } from '@warpkit/data';

  const createMonitor = useMutation({
    mutationFn: async (input: { name: string; url: string }) => {
      const response = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    onSuccess: (data) => {
      // Emit event to invalidate monitor lists
      warpkit.events.emit('monitor:created', { id: data.id });
    },
    onError: (error) => {
      console.error('Failed to create monitor:', error);
    }
  });
</script>

<button
  onclick={() => createMonitor.mutate({ name: 'My Monitor', url: 'https://example.com' })}
  disabled={createMonitor.isPending}
>
  {createMonitor.isPending ? 'Creating...' : 'Create Monitor'}
</button>

{#if createMonitor.isError}
  <p class="text-red-500">{createMonitor.error?.message}</p>
{/if}
```

### useMutation Options

| Option | Type | Description |
|--------|------|-------------|
| `mutationFn` | `(variables: TVariables) => Promise<TData>` | The async function that performs the mutation |
| `onSuccess` | `(data, variables) => void` | Called when mutation succeeds |
| `onError` | `(error, variables) => void` | Called when mutation fails |
| `onSettled` | `(data, error, variables) => void` | Called when mutation completes (success or error) |

### Mutation State

The returned object has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `mutate` | `(variables) => Promise<TData>` | Execute the mutation |
| `mutateAsync` | `(variables) => Promise<TData>` | Alias for `mutate` |
| `isPending` | `boolean` | `true` while mutation is executing |
| `isSuccess` | `boolean` | `true` if mutation succeeded |
| `isError` | `boolean` | `true` if mutation failed |
| `isIdle` | `boolean` | `true` if mutation has not been called yet |
| `error` | `TError \| null` | Error if mutation failed |
| `data` | `TData \| undefined` | Last successful result |
| `reset` | `() => void` | Reset state back to idle |

Note that `mutate` re-throws errors after calling `onError`. If you call `await createMonitor.mutate(input)`, wrap it in a `try/catch` if you need to handle errors at the call site rather than in the `onError` callback.

## Caching Deep Dive

Caching is one of the hardest problems in client-side data management. WarpKit provides a layered caching system that handles common scenarios out of the box while remaining fully customizable.

### Cache Providers

WarpKit ships with four cache implementations:

| Provider | Description | Use Case |
|----------|-------------|----------|
| `NoCacheProvider` | Never stores or returns data | Debugging, always-fresh data |
| `MemoryCache` | In-memory LRU cache | Short-lived data, development |
| `StorageCache` | localStorage-backed cache | Persist across page loads |
| `ETagCacheProvider` | Two-tier (Memory + Storage) with E-Tag support | **Production recommended** |

The `NoCacheProvider` is the default when you do not specify a cache. Every fetch hits the network. This is safe but slow.

For production, use `ETagCacheProvider`:

```typescript
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

const dataClient = new DataClient(config, {
  cache: new ETagCacheProvider({
    memory: { maxEntries: 200 },
    storage: { prefix: 'myapp:cache:' }
  })
});
```

### How the ETagCacheProvider Works

The `ETagCacheProvider` combines two tiers of caching:

**L1: Memory Cache (fast, volatile)** -- An in-memory LRU cache using a `Map`. Lookups are synchronous and nearly instant. Limited to a configurable number of entries (default: 100). Lost on page refresh.

**L2: Storage Cache (slower, persistent)** -- A localStorage-backed cache that survives page reloads and browser restarts. Handles quota exceeded and corrupted JSON gracefully.

The lookup order is: Memory -> Storage -> Network.

When a cache hit occurs in the storage tier but not in memory, the entry is **promoted** to memory for faster subsequent access. Writes use a **write-through** strategy: every cache update writes to both tiers simultaneously.

### How E-Tag Caching Works

E-Tag caching is where the real efficiency gains come from. Here is the full flow:

**First request:**
1. Component calls `useQuery({ key: 'monitors' })`
2. DataClient checks cache -- nothing there
3. DataClient sends `GET /api/monitors`
4. Server returns `200 OK` with body and header `ETag: "abc123"`
5. DataClient stores the data and ETag in the cache
6. Component receives the data

**Subsequent request (data is stale or cache was invalidated):**
1. Component calls `useQuery({ key: 'monitors' })`
2. DataClient finds a stale cache entry with `etag: "abc123"`
3. DataClient sends `GET /api/monitors` with header `If-None-Match: "abc123"`
4. Server checks whether data has changed since that ETag

**If data has NOT changed:**
- Server returns `304 Not Modified` with no body
- DataClient returns the cached data
- Network bandwidth saved -- only headers were transferred

**If data HAS changed:**
- Server returns `200 OK` with new body and new `ETag: "def456"`
- DataClient updates the cache with new data and new ETag
- Component receives the new data

This gives you the best of both worlds: **freshness guarantees** (you always check with the server) and **bandwidth efficiency** (unchanged data is not re-downloaded). For APIs returning large datasets, 304 responses can be dramatically faster than full 200 responses.

### Stale Time

The `staleTime` option controls how long cached data is considered fresh. While data is fresh, the cache is returned immediately without any network request:

```typescript
keys: {
  'projects': {
    key: 'projects',
    url: '/projects',
    staleTime: 60000  // Fresh for 60 seconds
  }
}
```

- **No `staleTime`** (default): Data is always considered stale. Every fetch checks the network (with E-Tag for efficiency).
- **`staleTime: 30000`**: Data is served from cache without a network request for 30 seconds after being fetched. After that, the next fetch goes to the network.

Choose `staleTime` based on how frequently your data changes. Project lists that rarely change can have a long stale time. Monitor status data that changes every few seconds should have a short stale time or no stale time at all.

### Disabling Cache for Specific Keys

Some queries should never be cached -- point-in-time analytics, search results with dynamic filters, or any data where staleness is unacceptable:

```typescript
keys: {
  'analytics/snapshot': {
    key: 'analytics/snapshot',
    url: '/analytics/snapshot',
    cache: false  // Always hits the network
  }
}
```

### Cache Invalidation

There are two ways to invalidate cached data: programmatic and event-driven.

**Programmatic invalidation** -- call methods on the DataClient directly:

```typescript
// Invalidate a specific key with specific params
await dataClient.invalidate('monitors/:id', { id: '123' });

// Invalidate all entries matching a prefix
// This clears 'monitors', 'monitors/:id' for ALL ids, etc.
await dataClient.invalidateByPrefix('monitors');

// Clear the entire cache
await dataClient.clearCache();
```

**Event-driven invalidation** -- configure `invalidateOn` in your data keys:

```typescript
keys: {
  'monitors': {
    key: 'monitors',
    url: '/monitors',
    invalidateOn: ['monitor:created', 'monitor:deleted', 'monitor:updated']
  }
}
```

When any of these events fire, the DataClient automatically clears the cache for this key. If a component is currently mounted with `useQuery({ key: 'monitors' })`, it will also refetch to get fresh data.

Events are emitted from wherever the mutation happens:

```typescript
// After creating a monitor
warpkit.events.emit('monitor:created', { id: newMonitor.id });
// The monitors list cache is automatically cleared and refetched
```

This two-layer approach is important. The DataClient subscribes to invalidation events globally (not per-component), so the cache is cleared even when no component is mounted for that key. When a component does mount later, it sees the empty cache and fetches fresh data.

### Cache Scoping

In multi-tenant applications, you often need to scope the cache to the current user or project. The `scopeCache` method creates a scoped prefix:

```typescript
// After user logs in
dataClient.scopeCache(user.accountUuid);
// Cache keys become: warpkit:<accountUuid>:monitors, etc.

// After user logs out
await dataClient.clearCache();
```

WarpKit can automate this when you integrate the data client with the WarpKit instance:

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated',
  data: {
    client: dataClient,
    scopeKey: (stateData) => stateData?.cacheScope
  }
});
```

When the app state transitions, WarpKit automatically clears the old cache and scopes the new one using the `scopeKey` callback.

## DataClient API Reference

### Constructor

```typescript
new DataClient(config: DataClientConfig, options?: DataClientOptions)
```

**DataClientConfig:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `keys` | `Record<DataKey, DataKeyConfig>` | Yes | Map of data keys to their configurations |
| `baseUrl` | `string` | No | Base URL prepended to all data URLs |
| `timeout` | `number` | No | Request timeout in ms (default: 30000) |
| `onRequest` | `(request: Request) => Request \| Promise<Request>` | No | Request interceptor |

**DataClientOptions:**

| Property | Type | Description |
|----------|------|-------------|
| `cache` | `CacheProvider` | Cache implementation (default: `NoCacheProvider`) |
| `events` | `DataEventEmitter` | Event emitter for invalidation subscriptions |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `fetch` | `fetch<K>(key: K, params?): Promise<FetchResult>` | Fetch data for a configured key |
| `mutate` | `mutate<T>(url, options): Promise<T>` | Execute a mutation (POST/PUT/PATCH/DELETE) |
| `getQueryData` | `getQueryData<K>(key, params?): Promise<T \| undefined>` | Get cached data without fetching |
| `setQueryData` | `setQueryData<K>(key, data, params?): Promise<void>` | Set data in cache (for optimistic updates) |
| `invalidate` | `invalidate(key, params?): Promise<void>` | Invalidate a specific cache entry |
| `invalidateByPrefix` | `invalidateByPrefix(prefix): Promise<void>` | Invalidate all entries matching a prefix |
| `clearCache` | `clearCache(): Promise<void>` | Clear all cached data |
| `scopeCache` | `scopeCache(scope): void` | Scope cache to a key (requires ETagCacheProvider) |
| `resolveUrl` | `resolveUrl(template, params?): string` | Resolve a URL template with parameters |

### Direct DataClient Usage

While hooks are the primary API, you can use the DataClient directly for imperative operations:

```typescript
import { getDataClient } from '@warpkit/data';

// Inside a component (within DataClientProvider context)
const client = getDataClient();

// Fetch data directly
const result = await client.fetch('monitors');

// Execute a mutation
const newMonitor = await client.mutate('/monitors', {
  method: 'POST',
  body: { name: 'New Monitor', url: 'https://example.com' }
});

// Optimistic update
await client.setQueryData('monitors/:id', updatedMonitor, { id: '123' });

// Read cache
const cached = await client.getQueryData('monitors');
```

## Implementing a Custom CacheProvider

If the built-in cache providers do not meet your needs, you can implement the `CacheProvider` interface:

```typescript
import type { CacheProvider, CacheEntry } from '@warpkit/data';

class IndexedDBCache implements CacheProvider {
  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    // Read from IndexedDB
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Write to IndexedDB
  }

  async delete(key: string): Promise<void> {
    // Delete from IndexedDB
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    // Delete all entries with keys starting with prefix
  }

  async clear(): Promise<void> {
    // Clear all entries
  }
}

const dataClient = new DataClient(config, {
  cache: new IndexedDBCache()
});
```

The `CacheEntry` type includes the data, an optional ETag, a timestamp, and an optional stale time:

```typescript
interface CacheEntry<T = unknown> {
  data: T;
  etag?: string;
  timestamp: number;
  staleTime?: number;
}
```

Your cache implementation does not need to understand ETags or stale time -- it just stores and retrieves `CacheEntry` objects. The DataClient handles all the freshness and E-Tag logic internally.

## Global Error Handling

Handle errors globally through the `onRequest` interceptor or by wrapping the DataClient:

```typescript
const dataClient = new DataClient({
  baseUrl: '/api',
  keys: { /* ... */ },
  onRequest: async (request) => {
    const token = await getAuthToken();
    if (!token) {
      // Redirect to login if no token available
      warpkit.setState('unauthenticated');
      throw new Error('No auth token');
    }
    request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  }
});
```

For 401 handling specifically, you can check for auth errors in mutation callbacks:

```typescript
const updateMonitor = useMutation({
  mutationFn: async (input) => {
    const response = await fetch(`/api/monitors/${input.id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
    if (response.status === 401) {
      warpkit.setState('unauthenticated');
      throw new Error('Session expired');
    }
    return response.json();
  }
});
```

## Putting It All Together

Here is a complete example showing how all the pieces fit together in a real application:

**data-client.ts** -- Central configuration:

```typescript
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';
import type { Monitor, Project } from './types';

// Type registry
declare module '@warpkit/data' {
  interface DataRegistry {
    'monitors': { data: Monitor[] };
    'monitors/:id': { data: Monitor };
    'projects': { data: Project[] };
  }
}

export const dataClient = new DataClient(
  {
    baseUrl: '/api',
    timeout: 10000,
    keys: {
      'monitors': {
        key: 'monitors',
        url: '/monitors',
        staleTime: 30000,
        invalidateOn: ['monitor:created', 'monitor:deleted', 'monitor:updated']
      },
      'monitors/:id': {
        key: 'monitors/:id',
        url: (params) => `/monitors/${params.id}`,
        invalidateOn: ['monitor:updated']
      },
      'projects': {
        key: 'projects',
        url: '/projects',
        staleTime: 60000
      }
    },
    onRequest: async (request) => {
      const token = await getAuthToken();
      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    }
  },
  {
    cache: new ETagCacheProvider({
      memory: { maxEntries: 200 },
      storage: { prefix: 'myapp:' }
    }),
    events: warpkitEvents
  }
);
```

**MonitorList.svelte** -- A component that fetches and displays data:

```svelte
<script lang="ts">
  import { useQuery } from '@warpkit/data';
  import { useMutation } from '@warpkit/data';
  import { useWarpKit } from '@upstat/warpkit';

  const warpkit = useWarpKit();
  const monitors = useQuery({ key: 'monitors' });

  const deleteMonitor = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    },
    onSuccess: (_data, id) => {
      warpkit.events.emit('monitor:deleted', { id });
    }
  });
</script>

{#if monitors.isLoading}
  <div class="grid gap-4">
    {#each Array(3) as _}
      <div class="h-24 bg-gray-100 animate-pulse rounded-lg" />
    {/each}
  </div>
{:else if monitors.isError}
  <div class="p-4 bg-red-50 rounded-lg">
    <p class="text-red-700">{monitors.error?.message}</p>
    <button onclick={monitors.refetch} class="mt-2 text-red-600 underline">
      Try again
    </button>
  </div>
{:else}
  <div class="grid gap-4">
    {#each monitors.data ?? [] as monitor (monitor.id)}
      <div class="p-4 border rounded-lg flex justify-between items-center">
        <div>
          <h3 class="font-medium">{monitor.name}</h3>
          <p class="text-sm text-gray-500">{monitor.url}</p>
        </div>
        <button
          onclick={() => deleteMonitor.mutate(monitor.id)}
          disabled={deleteMonitor.isPending}
          class="text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </div>
    {/each}
  </div>
{/if}
```

**MonitorDetail.svelte** -- A component with parameterized query:

```svelte
<script lang="ts">
  import { useQuery } from '@warpkit/data';
  import { usePage } from '@upstat/warpkit';

  const page = usePage();

  const monitor = useQuery({
    key: 'monitors/:id',
    params: () => ({ id: page.params.id })
  });
</script>

{#if monitor.isLoading}
  <DetailSkeleton />
{:else if monitor.isError}
  <ErrorPanel error={monitor.error} />
{:else if monitor.data}
  <h1>{monitor.data.name}</h1>
  <p>URL: {monitor.data.url}</p>
  <p>Status: {monitor.data.status}</p>
{/if}
```

## Compared to Other Frameworks

### TanStack Query (React Query)

TanStack Query is the closest analog to WarpKit's data layer. Both provide hooks-based data fetching with caching, invalidation, and mutation support. The key differences:

- **Config-driven keys.** WarpKit defines all data keys and their URLs in a central configuration. TanStack Query defines URLs at the call site. WarpKit's approach means the data layer knows about all your endpoints at initialization time, enabling features like global event-based invalidation.
- **E-Tag support.** WarpKit's `ETagCacheProvider` handles conditional requests and 304 responses out of the box. TanStack Query does not have built-in E-Tag support.
- **Type registry.** WarpKit uses module augmentation for type inference. TanStack Query uses generics at each call site.
- **Svelte 5 native.** WarpKit's hooks use `$state` and `$effect` directly. TanStack Query's Svelte adapter wraps a React-centric core.

### SWR (React)

SWR popularized the stale-while-revalidate pattern. WarpKit shares the philosophy but differs in implementation:

- **No TypeScript registry.** SWR uses string keys with manual type annotations.
- **No built-in mutation support.** SWR focuses on fetching; mutations are your problem.
- **React-only.** No Svelte adapter.

### Apollo Client

Apollo Client is designed for GraphQL. If your API uses GraphQL, consider Apollo. If your API is REST or RPC, WarpKit is a better fit. Apollo's normalized cache is more sophisticated but only works with GraphQL's type system.

### Fetch + $effect (DIY)

The tempting approach: write `fetch()` calls inside `$effect()` and manage state manually. This works for simple cases but breaks down at scale:

- No race condition handling (old requests overwrite new data)
- No caching (same data fetched on every mount)
- No invalidation strategy (stale data after mutations)
- No loading/error state consistency
- No type safety
- No request deduplication

WarpKit's data layer solves all of these problems with a consistent, tested implementation.

## Next Steps

- [Forms & Validation](./07-forms.md) -- Schema-driven forms with deep proxy binding
- [Testing](./10-testing.md) -- Testing data hooks with mock clients
