# @warpkit/data

Type-safe data fetching hooks for Svelte 5 with caching and event-driven invalidation.

## Installation

```bash
bun add @warpkit/data
```

## Features

- **useQuery** - Reactive data fetching hook with caching and SWR
- **useMutation** - Standalone mutation hook with lifecycle callbacks
- **useData** - Query hook with call-site `invalidateOn` and `enabled` config
- **Type-safe** - Full TypeScript support with registry pattern
- **Caching** - Pluggable cache providers with E-Tag support
- **Svelte 5** - Built on runes ($state, $derived, $effect)

## Usage

### Define Data Registry

```typescript
// types.ts
declare module '@warpkit/data' {
  interface DataRegistry {
    user: { data: User };
    monitors: { data: Monitor[] };
  }
}
```

### Setup DataClient

```typescript
import { DataClient } from '@warpkit/data';

const client = new DataClient({
  baseUrl: '/api',
  keys: {
    user: { key: 'user', url: '/user' },
    monitors: { key: 'monitors', url: '/monitors', staleTime: 30000 }
  }
});
```

### Fetch Data with useQuery

```svelte
<script lang="ts">
  import { useQuery } from '@warpkit/data';

  const monitors = useQuery({ key: 'monitors' });
</script>

{#if monitors.isLoading}
  <Spinner />
{:else if monitors.isError}
  <Error message={monitors.error.message} />
{:else}
  {#each monitors.data as monitor}
    <Monitor {monitor} />
  {/each}
{/if}
```

### Mutations with useMutation

```svelte
<script lang="ts">
  import { useMutation } from '@warpkit/data';

  const createMonitor = useMutation({
    mutationFn: async (input) => {
      const res = await fetch('/api/monitors', { method: 'POST', body: JSON.stringify(input) });
      return res.json();
    },
    onSuccess: () => warpkit.events.emit('monitor:created')
  });
</script>

<button onclick={() => createMonitor.mutate({ name: 'New' })}>
  Add Monitor
</button>
```

### useData (query + call-site config)

`useData` is a thin wrapper over `useQuery` that accepts call-site `invalidateOn` events and an `enabled` flag:

```svelte
<script lang="ts">
  import { useData } from '@warpkit/data';

  const monitors = useData('monitors', {
    invalidateOn: ['monitor:created', 'monitor:deleted'],
    enabled: () => !!userId
  });
</script>
```

## API

### useQuery(options)

Returns reactive query state: `data`, `isLoading`, `isError`, `error`, `isSuccess`, `isRevalidating`, `refetch()`.

### useData(key, config)

Same return shape as `useQuery`. Config accepts `invalidateOn?: string[]` and `enabled?: boolean | (() => boolean)`.

### useMutation(options)

Returns mutation state: `mutate()`, `mutateAsync()`, `isPending`, `isSuccess`, `isError`, `error`, `data`, `reset()`.

### DataClient

Options:
- `baseUrl` - API base URL
- `cache` - Cache provider (optional)
- `keys` - Data key configurations
- `onRequest` - Request interceptor
- `retryOn429` - Auto-retry on 429 (default: true)
- `maxRetries` - Max 429 retries (default: 3)
