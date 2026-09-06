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

Returns reactive query state: `data`, `dataParams`, `pendingParams`, `isLoading`, `isError`, `error`, `isSuccess`, `isRevalidating`, `refetch()`.

`dataParams` identifies the parameters associated with the displayed data; `pendingParams` identifies an in-flight request when it has parameters. Both can be undefined. Use them to distinguish retained data from the current request; background failures can retain earlier data. A reactive `params` getter may return undefined.

### useData(key, config)

Returns the existing data/loading/error state and `refetch`; its declared `DataState` does not expose query-parameter metadata. Config accepts `invalidateOn?: string[]` and `enabled?: boolean | (() => boolean)`.

### useMutation(options)

Returns mutation state: `mutate()`, `mutateAsync()`, `isPending`, `isSuccess`, `isError`, `error`, `data`, `reset()`.

`mutate` reports failures through state and callbacks, resolving to undefined. `mutateAsync` rejects after failure callbacks and is the awaited entry point for callers that need the outcome.

### DataClient

Options:
- `baseUrl` - API base URL
- `cache` - Cache provider (optional)
- `keys` - Data key configurations
- `onRequest` - Request interceptor
- `retryOn429` - Auto-retry on 429 (default: true)
- `maxRetries` - Max 429 retries (default: 3)

## Package verification

Build `@warpkit/errors`, `@warpkit/validation` and `@warpkit/data`, then run `bun run --filter @warpkit/data check:types`. This consumer check resolves compiled package exports without source aliases. Declarations are generated from canonical TypeScript; do not add a same-basename declaration file beside a TypeScript source file.

The data integration tests additionally need a built `@warpkit/cache`. Run them from the repository root with `bun run test:data`.

The request deadline remains active through JSON, text or blob body consumption. A `raw` mutation transfers response-body ownership to the caller; its deadline ends when the response is returned. A timeout aborts the request signal, so custom transports must honour that signal.
