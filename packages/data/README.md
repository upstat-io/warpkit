# @warpkit/data

Type-safe data fetching hooks for Svelte 5 with caching and mutations.

## Installation

```bash
npm install @warpkit/data
```

## Features

- **useData** - Combined query + mutations hook
- **Type-safe** - Full TypeScript support with registry pattern
- **Caching** - Pluggable cache providers
- **Svelte 5** - Built on runes ($state, $derived)

## Usage

### Define Data Registry

```typescript
// types.ts
declare module '@warpkit/data' {
  interface DataRegistry {
    user: {
      data: User;
    };
    monitors: {
      data: Monitor[];
      mutations: {
        create: { input: CreateMonitorInput; output: Monitor };
        delete: { input: string; output: void };
      };
    };
  }
}
```

### Setup DataClient

```typescript
import { DataClient, DataClientProvider } from '@warpkit/data';

const client = new DataClient({
  baseUrl: '/api',
  keys: {
    user: { url: '/user' },
    monitors: { url: '/monitors' }
  }
});
```

### Use in Components

```svelte
<script lang="ts">
  import { useData } from '@warpkit/data';

  const monitors = useData('monitors', {
    mutations: {
      create: { method: 'POST' },
      delete: { method: 'DELETE', url: (id) => `/monitors/${id}` }
    }
  });
</script>

{#if monitors.isLoading}
  <Spinner />
{:else if monitors.isError}
  <Error message={monitors.error.message} />
{:else}
  {#each monitors.data as monitor}
    <Monitor {monitor} onDelete={() => monitors.delete(monitor.id)} />
  {/each}
{/if}

<button onclick={() => monitors.create({ name: 'New' })}>
  Add Monitor
</button>
```

## API

### useData(key, config)

Returns:
- `data` - The fetched data
- `isLoading` - Loading state
- `isError` - Error state
- `error` - Error object
- `refetch()` - Manually refetch
- `[mutation]` - Mutation handles

### DataClient

Options:
- `baseUrl` - API base URL
- `cache` - Cache provider (optional)
- `keys` - Data key configurations
- `onRequest` - Request interceptor
