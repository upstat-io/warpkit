# Configuration

Complete configuration reference for all WarpKit packages.

## WarpKit Core

### createWarpKit Options

```typescript
createWarpKit({
  // Required
  routes: StateRoutes,        // Route configuration by state
  initialState: string,       // Starting application state

  // Optional
  providers: {
    browser: BrowserProvider,       // Default: DefaultBrowserProvider
    storage: StorageProvider,       // Default: DefaultStorageProvider
    confirmDialog: ConfirmDialogProvider  // Default: DefaultConfirmDialogProvider
  },

  // Error handling
  onError: (error, context) => void  // Global error handler
});
```

### Route Configuration

```typescript
// State routes
createStateRoutes({
  [stateName]: {
    routes: Route[],                 // Routes for this state
    default: string | ((data) => string) | null,  // Default path
    layout: {                        // State-level layout
      id: string,
      load: () => Promise<{ default: Component }>
    },
    redirects: Record<string, string>  // Path redirects
  }
});

// Individual routes
createRoute({
  path: string,                      // Path pattern
  component: () => Promise<{ default: Component }>,  // Lazy component
  layout: {                          // Route-level layout override
    id: string,
    load: () => Promise<{ default: Component }>
  },
  meta: {
    title?: string,                  // Document title
    guards?: RouteGuard[],           // Route guards
    scrollRestore?: boolean          // Enable scroll restoration
  }
});
```

### Browser Provider

```typescript
new DefaultBrowserProvider({
  basePath?: string  // Base path for deployment (e.g., '/app')
});
```

### Storage Provider

```typescript
new DefaultStorageProvider({
  maxScrollPositions?: number  // Max scroll positions to store (default: 50)
});
```

---

## DataClient

### DataClientConfig

```typescript
new DataClient({
  // API
  baseUrl?: string,           // Base URL for all requests
  timeout?: number,           // Request timeout in ms (default: 30000)

  // Keys
  keys: {
    [key: string]: {
      key: string,            // Key identifier
      url: string | ((params) => string),  // URL or URL function
      staleTime?: number      // Stale time in ms
    }
  },

  // Request interceptor
  onRequest?: (request: Request) => Request | Promise<Request>
}, {
  // Cache provider
  cache?: CacheProvider,      // Default: NoCacheProvider

  // Event emitter for invalidation
  events?: EventEmitter
});
```

### useData Options

```typescript
useData(key, {
  url: string,                         // Fetch URL
  enabled?: boolean | (() => boolean), // Enable/disable (default: true)
  staleTime?: number,                  // Override key's staleTime
  invalidateOn?: string[]              // Events that trigger refetch
});
```

### useMutation Options

```typescript
useMutation({
  url: string | ((input) => string),   // Mutation URL
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',

  // Callbacks
  onSuccess?: (data, input) => void,
  onError?: (error, input) => void,
  onSettled?: (data, error) => void,

  // Optimistic updates
  onMutate?: (input) => Promise<context>
});
```

---

## Cache

### MemoryCache

```typescript
new MemoryCache({
  maxEntries?: number  // Max entries before LRU eviction (default: 100)
});
```

### StorageCache

```typescript
new StorageCache({
  storage?: StorageAdapter,  // Custom storage (default: localStorage)
  prefix?: string,           // Key prefix (default: 'warpkit:cache:')
  maxEntries?: number        // Max entries (default: 50)
});
```

### ETagCacheProvider

```typescript
new ETagCacheProvider({
  memory?: {
    maxEntries?: number      // Memory cache size (default: 100)
  },
  storage?: {
    prefix?: string,         // Storage key prefix
    maxEntries?: number      // Storage cache size (default: 50)
  }
});
```

---

## Forms

### useForm Options

```typescript
useForm({
  // Initial values
  initialValues?: T,

  // Validation
  schema?: StandardSchema<T>,        // TypeBox, Zod, etc.
  validators?: Record<string, FieldValidator<T>>,  // Custom validators
  warners?: Record<string, FieldValidator<T>>,     // Warning validators

  // Validation timing
  mode?: ValidationMode,             // 'blur' | 'change' | 'submit' | 'touched' | 'all'
  revalidateMode?: RevalidateMode,   // 'change' | 'blur' | 'submit'
  delayError?: number,               // Error debounce in ms

  // Submit
  onSubmit: (values: T) => Promise<void>
});
```

### Validation Modes

| Mode | Description |
|------|-------------|
| `'blur'` | Validate on field blur (default) |
| `'change'` | Validate on every change |
| `'submit'` | Only validate on submit |
| `'touched'` | Validate after field is touched |
| `'all'` | Validate on blur and change |

### Revalidate Modes

| Mode | Description |
|------|-------------|
| `'change'` | Revalidate on change (default) |
| `'blur'` | Revalidate on blur |
| `'submit'` | Only revalidate on submit |

---

## WebSocket

### SocketClient Options

```typescript
new SocketClient(url, {
  // Reconnection
  reconnect?: boolean,               // Enable reconnection (default: true)
  maxReconnectAttempts?: number,     // Max attempts (default: Infinity)
  reconnectDelay?: number,           // Initial delay ms (default: 500)
  maxReconnectDelay?: number,        // Max delay ms (default: 20000)

  // Connection
  connectionTimeout?: number,        // Timeout ms (default: 5000)

  // Keep-alive
  heartbeatInterval?: number,        // Ping interval ms (default: 25000)
  heartbeatTimeout?: number          // Pong timeout ms (default: 5000)
});
```

### Defaults

| Option | Default | Description |
|--------|---------|-------------|
| `reconnect` | `true` | Enable automatic reconnection |
| `maxReconnectAttempts` | `Infinity` | Never stop trying |
| `reconnectDelay` | `500` | Start at 500ms |
| `maxReconnectDelay` | `20000` | Cap at 20 seconds |
| `connectionTimeout` | `5000` | 5 second connection timeout |
| `heartbeatInterval` | `25000` | Ping every 25 seconds |
| `heartbeatTimeout` | `5000` | Wait 5 seconds for pong |

---

## Firebase Auth

### FirebaseAuthAdapter Options

```typescript
new FirebaseAuthAdapter(firebaseApp, {
  // Required
  getInitialState: async (user) => {
    return { state: 'authenticated' | 'unauthenticated', stateData?: any };
  },

  // Optional
  getStateChange?: async (user) => {
    return { state: '...', stateData?: any } | undefined;
  },

  // Firebase services
  appCheck?: AppCheck,               // AppCheck instance

  // Development
  authEmulatorUrl?: string           // Emulator URL (e.g., 'http://127.0.0.1:9099')
});
```

---

## Testing

### createMockWarpKit Options

```typescript
await createMockWarpKit({
  // Required
  routes: StateRoutes,
  initialState: string,

  // Optional
  initialPath?: string,              // Starting path (default: '/')
  componentLoadDelay?: number,       // Artificial load delay in ms
  onError?: (error, context) => void
});
```

### createMockDataClient Options

```typescript
createMockDataClient({
  mockData: {
    [key: string]: T | (() => T) | (() => Promise<T>)
  },
  mockErrors?: {
    [key: string]: Error
  }
});
```

---

## Environment Variables

WarpKit doesn't require environment variables, but your app might:

```bash
# API
VITE_API_URL=https://api.example.com

# WebSocket
VITE_WS_URL=wss://api.example.com/ws

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Usage:

```typescript
const dataClient = new DataClient({
  baseUrl: import.meta.env.VITE_API_URL
});

const socket = new SocketClient(import.meta.env.VITE_WS_URL);
```
