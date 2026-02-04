# Data Fetching

WarpKit provides a powerful data layer with config-driven fetching, E-Tag caching, and type-safe mutations.

## DataClient

The `DataClient` is the core of WarpKit's data layer.

### Configuration

```typescript
import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

const client = new DataClient(
  {
    baseUrl: '/api',
    timeout: 30000,
    keys: {
      'monitors': { key: 'monitors', url: '/monitors' },
      'monitors/:id': { key: 'monitors/:id', url: '/monitors/:id' },
      'projects': { key: 'projects', url: '/projects', staleTime: 60000 }
    },
    onRequest: async (request) => {
      // Add auth header
      const token = await getToken();
      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    }
  },
  {
    cache: new ETagCacheProvider()
  }
);
```

### Type Registry

Define your data types with module augmentation:

```typescript
declare module '@warpkit/data' {
  interface DataRegistry {
    'monitors': {
      data: Monitor[];
      mutations: {
        create: { input: CreateMonitorInput; output: Monitor };
        delete: { input: string; output: void };
      };
    };
    'monitors/:id': {
      data: Monitor;
      mutations: {
        update: { input: UpdateMonitorInput; output: Monitor };
      };
    };
  }
}
```

## Caching

### Cache Providers

| Provider | Description |
|----------|-------------|
| `MemoryCache` | In-memory LRU cache |
| `StorageCache` | localStorage-backed cache |
| `ETagCacheProvider` | Two-tier (Memory + Storage) with E-Tag support |
| `NoCacheProvider` | Disables caching |

### ETagCacheProvider

Recommended for production - combines fast memory access with persistence:

```typescript
import { ETagCacheProvider } from '@warpkit/cache';

const cache = new ETagCacheProvider({
  memory: { maxEntries: 200 },
  storage: {
    prefix: 'myapp:cache:',
    maxEntries: 100
  }
});
```

### How E-Tag Caching Works

1. First request: Server returns data + E-Tag header
2. Subsequent requests: Client sends `If-None-Match` with cached E-Tag
3. Server returns:
   - `304 Not Modified` if unchanged (use cached data)
   - `200 OK` with new data if changed

### Cache Invalidation

```typescript
// Invalidate specific key
await client.invalidate('monitors/:id', { id: '123' });

// Invalidate by prefix
await client.invalidateByPrefix('monitors');
```

## useData Hook

The primary hook for data fetching in components.

### Basic Usage

```svelte
<script lang="ts">
  import { useData } from '@warpkit/data';

  const monitors = useData('monitors', {
    url: '/monitors'
  });
</script>

{#if monitors.isLoading}
  <p>Loading...</p>
{:else if monitors.isError}
  <p>Error: {monitors.error?.message}</p>
{:else}
  {#each monitors.data ?? [] as monitor}
    <div>{monitor.name}</div>
  {/each}
{/if}
```

### With Parameters

```svelte
<script lang="ts">
  import { useData } from '@warpkit/data';
  import { usePage } from '@warpkit/core';

  const page = usePage();

  // Reactive - refetches when params change
  const monitor = useData('monitors/:id', {
    url: `/monitors/${page.params.id}`
  });
</script>
```

### Configuration Options

```typescript
interface UseDataConfig {
  url: string;                    // Fetch URL
  enabled?: boolean | (() => boolean);  // Enable/disable fetching
  staleTime?: number;             // Milliseconds until data is stale
  invalidateOn?: string[];        // Events that trigger refetch
}
```

### Conditional Fetching

```typescript
// Disable fetching until ready
const data = useData('users/:id', {
  url: `/users/${userId}`,
  enabled: () => !!userId
});
```

### Event-Based Invalidation

```typescript
const monitors = useData('monitors', {
  url: '/monitors',
  invalidateOn: ['monitor:created', 'monitor:deleted']
});

// Somewhere else, emit the event
warpkit.events.emit('monitor:created', { id: '123' });
// monitors will refetch automatically
```

### Return Value

```typescript
interface DataState<T> {
  data: T | undefined;        // The fetched data
  error: Error | null;        // Error if fetch failed
  isLoading: boolean;         // Initial load in progress
  isError: boolean;           // Has error
  isSuccess: boolean;         // Has data, no error
  refetch: () => Promise<void>;  // Manual refetch
}
```

## useMutation Hook

For POST/PUT/PATCH/DELETE operations.

### Basic Usage

```svelte
<script lang="ts">
  import { useMutation } from '@warpkit/data';

  const createMonitor = useMutation({
    url: '/monitors',
    method: 'POST',
    onSuccess: (data) => {
      console.log('Created:', data);
    },
    onError: (error) => {
      console.error('Failed:', error);
    }
  });
</script>

<button
  onclick={() => createMonitor.mutate({ name: 'New Monitor' })}
  disabled={createMonitor.isPending}
>
  {createMonitor.isPending ? 'Creating...' : 'Create Monitor'}
</button>
```

### Configuration Options

```typescript
interface UseMutationOptions<TInput, TOutput> {
  url: string | ((input: TInput) => string);
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: TOutput, input: TInput) => void;
  onError?: (error: Error, input: TInput) => void;
  onSettled?: (data: TOutput | undefined, error: Error | null) => void;
}
```

### Dynamic URL

```typescript
const updateMonitor = useMutation({
  url: (input) => `/monitors/${input.id}`,
  method: 'PUT'
});

await updateMonitor.mutate({ id: '123', name: 'Updated' });
```

### Return Value

```typescript
interface MutationState<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>;
  data: TOutput | undefined;
  error: Error | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}
```

## useQuery Hook

Lower-level hook for custom query logic (similar to useData but more flexible).

```typescript
import { useQuery } from '@warpkit/data';

const query = useQuery({
  queryKey: ['custom', id],
  queryFn: async () => {
    const response = await fetch(`/api/custom/${id}`);
    return response.json();
  },
  enabled: () => !!id
});
```

## Optimistic Updates

Update the cache immediately, then sync with server:

```typescript
const updateMonitor = useMutation({
  url: (input) => `/monitors/${input.id}`,
  method: 'PUT',
  onMutate: async (input) => {
    // Cancel outgoing refetches
    await client.cancelQueries('monitors/:id', { id: input.id });

    // Snapshot previous value
    const previous = await client.getQueryData('monitors/:id', { id: input.id });

    // Optimistically update
    await client.setQueryData('monitors/:id', input, { id: input.id });

    return { previous };
  },
  onError: (error, input, context) => {
    // Rollback on error
    client.setQueryData('monitors/:id', context.previous, { id: input.id });
  }
});
```

## DataClientProvider

Provides the DataClient to components via context:

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { DataClientProvider } from '@warpkit/data';
  import { dataClient } from './lib/data/client';
</script>

<DataClientProvider client={dataClient}>
  <slot />
</DataClientProvider>
```

Access in components:

```typescript
import { getDataClient } from '@warpkit/data';

const client = getDataClient();
```

## Error Handling

### In Components

```svelte
{#if monitors.isError}
  <div class="error">
    {#if monitors.error?.message.includes('401')}
      <p>Please log in to view monitors</p>
    {:else if monitors.error?.message.includes('404')}
      <p>No monitors found</p>
    {:else}
      <p>Failed to load: {monitors.error?.message}</p>
    {/if}
    <button onclick={monitors.refetch}>Retry</button>
  </div>
{/if}
```

### Global Error Handling

```typescript
const client = new DataClient(config, {
  cache,
  onError: (error, context) => {
    if (error.message.includes('401')) {
      warpkit.setState('unauthenticated');
    }
  }
});
```

## Best Practices

1. **Define all keys upfront** - Use the registry pattern for type safety
2. **Use staleTime wisely** - Balance freshness vs. performance
3. **Invalidate on mutations** - Keep data in sync
4. **Handle loading states** - Show skeletons, not spinners
5. **Handle errors gracefully** - Provide retry options
6. **Use E-Tag caching** - Reduce bandwidth and improve performance
