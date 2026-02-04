# @warpkit/cache

Cache implementations for @warpkit/data with E-Tag support and two-tier caching.

## Installation

```bash
npm install @warpkit/cache
```

## Features

- **MemoryCache** - In-memory cache with TTL support
- **StorageCache** - localStorage/sessionStorage-based cache
- **ETagCacheProvider** - Two-tier cache with E-Tag validation

## Usage

```typescript
import { ETagCacheProvider, MemoryCache, StorageCache } from '@warpkit/cache';
import { DataClient } from '@warpkit/data';

// Create two-tier cache: memory (fast) + storage (persistent)
const cache = new ETagCacheProvider({
  memory: new MemoryCache({ maxAge: 60_000 }), // 1 minute
  storage: new StorageCache({
    storage: localStorage,
    prefix: 'app-cache:'
  })
});

// Use with DataClient
const client = new DataClient({
  baseUrl: '/api',
  cache
});
```

## API

### ETagCacheProvider

Combines memory and storage caches with E-Tag validation for efficient caching.

### MemoryCache

Options:
- `maxAge` - TTL in milliseconds (default: 5 minutes)
- `maxSize` - Maximum entries (default: 100)

### StorageCache

Options:
- `storage` - localStorage or sessionStorage
- `prefix` - Key prefix (default: 'warpkit:')
- `maxAge` - TTL in milliseconds

## Types

Import types from `@warpkit/data`:
```typescript
import type { CacheProvider, CacheEntry } from '@warpkit/data';
```
