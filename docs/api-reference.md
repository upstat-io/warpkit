# API Reference

Complete API documentation for all WarpKit packages.

## @warpkit/core

### createWarpKit(config)

Create a WarpKit router instance.

```typescript
function createWarpKit<TAppState extends string>(config: WarpKitConfig<TAppState>): WarpKit<TAppState>

interface WarpKitConfig<TAppState> {
  routes: StateRoutes<TAppState>;
  initialState: TAppState;
  providers?: ProviderRegistry;
  onError?: (error: NavigationError, context: NavigationErrorContext) => void;
}
```

### createRoute(config)

Create a typed route.

```typescript
function createRoute<TPath extends string, TMeta extends RouteMeta>(
  config: RouteConfig<TPath, TMeta>
): TypedRoute<TPath, TMeta>

interface RouteConfig<TPath, TMeta> {
  path: TPath;
  component: () => Promise<{ default: Component }>;
  layout?: { id: string; load: () => Promise<{ default: Component }> };
  meta: TMeta;
}
```

### createStateRoutes(config)

Organize routes by application state.

```typescript
function createStateRoutes<TAppState extends string, TStateData = unknown>(
  config: StateRoutes<TAppState, TStateData>
): StateRoutes<TAppState, TStateData>

interface StateConfig<TStateData> {
  routes: Route[];
  default: string | ((data: TStateData) => string) | null;
  layout?: { id: string; load: () => Promise<{ default: Component }> };
  redirects?: Record<string, string>;
}
```

### WarpKit Class

```typescript
class WarpKit<TAppState extends string> {
  // Lifecycle
  start(options?: { authAdapter?: AuthAdapter }): Promise<void>;
  destroy(): void;

  // State
  readonly page: PageState;
  getState(): TAppState;
  getStateId(): number;
  setState(state: TAppState, stateData?: unknown): void;

  // Navigation
  navigate(path: string, options?: NavigateOptions): Promise<void>;
  back(): void;
  forward(): void;
  go(delta: number): void;

  // Blockers
  block(config: BlockerConfig): () => void;

  // Events
  readonly events: EventEmitter<WarpKitEventRegistry>;
}

interface PageState {
  pathname: string;
  params: Record<string, string>;
  search: URLSearchParams;
  hash: string;
  meta: RouteMeta;
  state: string;
}

interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
  skipBlockers?: boolean;
}
```

### Hooks

```typescript
// Get WarpKit instance
function useWarpKit(): WarpKit;

// Get page state (reactive)
function usePage(): PageState;

// Subscribe to events with cleanup
function useEvent<K extends keyof WarpKitEventRegistry>(
  event: K,
  handler: EventHandler<WarpKitEventRegistry[K]>,
  options?: { enabled?: boolean | (() => boolean) }
): void;
```

### Components

```svelte
<!-- WarpKitProvider: Provide WarpKit context -->
<WarpKitProvider warpkit={WarpKit}>
  <slot />
</WarpKitProvider>

<!-- RouterView: Render current route -->
<RouterView />

<!-- Link: Declarative navigation -->
<Link href="/path" replace={false} disabled={false}>
  Link Text
</Link>
```

### EventEmitter

```typescript
class EventEmitter<R extends EventRegistry> {
  on<K extends keyof R>(event: K, handler: EventHandler<R[K]>): () => void;
  once<K extends keyof R>(event: K, handler: EventHandler<R[K]>): () => void;
  off<K extends keyof R>(event: K, handler: EventHandler<R[K]>): void;
  emit<K extends keyof R>(event: K, ...args: R[K] extends void ? [] : [payload: R[K]]): void;
  clear(event: keyof R): void;
  clearAll(): void;
  listenerCount(event: keyof R): number;
  eventNames(): Array<keyof R>;
}
```

---

## @warpkit/data

### DataClient

```typescript
class DataClient {
  constructor(config: DataClientConfig, options?: DataClientOptions);

  fetch<K extends DataKey>(key: K, params?: Record<string, string>): Promise<FetchResult<DataType<K>>>;
  mutate<T>(url: string, options: MutateOptions): Promise<T>;

  getQueryData<K extends DataKey>(key: K, params?: Record<string, string>): Promise<DataType<K> | undefined>;
  setQueryData<K extends DataKey>(key: K, data: DataType<K>, params?: Record<string, string>): Promise<void>;

  invalidate(key: DataKey, params?: Record<string, string>): Promise<void>;
  invalidateByPrefix(prefix: string): Promise<void>;

  getKeyConfig<K extends DataKey>(key: K): DataKeyConfig<K> | undefined;
  getEvents(): DataEventEmitter | null;
  getBaseUrl(): string;

  setCache(cache: CacheProvider): void;
  setEvents(events: DataEventEmitter): void;
}

interface DataClientConfig {
  baseUrl?: string;
  timeout?: number;
  keys: Record<string, DataKeyConfig>;
  onRequest?: (request: Request) => Request | Promise<Request>;
}

interface MutateOptions {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}
```

### Hooks

```typescript
// Data fetching with caching
function useData<K extends DataKey>(key: K, config: UseDataConfig<K>): DataState<K>;

interface UseDataConfig<K> {
  url: string;
  enabled?: boolean | (() => boolean);
  staleTime?: number;
  invalidateOn?: string[];
}

interface DataState<K> {
  data: DataType<K> | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

// Mutations
function useMutation<TInput, TOutput>(options: UseMutationOptions<TInput, TOutput>): MutationState<TInput, TOutput>;

interface UseMutationOptions<TInput, TOutput> {
  url: string | ((input: TInput) => string);
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: TOutput, input: TInput) => void;
  onError?: (error: Error, input: TInput) => void;
  onSettled?: (data: TOutput | undefined, error: Error | null) => void;
}

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

---

## @warpkit/cache

### MemoryCache

```typescript
class MemoryCache {
  constructor(options?: { maxEntries?: number });

  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, entry: CacheEntry<T>): void;
  delete(key: string): void;
  deleteByPrefix(prefix: string): void;
  clear(): void;
  size(): number;
}
```

### StorageCache

```typescript
class StorageCache {
  constructor(options?: {
    storage?: StorageAdapter;
    prefix?: string;
    maxEntries?: number;
  });

  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, entry: CacheEntry<T>): void;
  delete(key: string): void;
  deleteByPrefix(prefix: string): void;
  clear(): void;
}
```

### ETagCacheProvider

```typescript
class ETagCacheProvider implements CacheProvider {
  constructor(options?: {
    memory?: { maxEntries?: number };
    storage?: { prefix?: string; maxEntries?: number };
  });

  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  clear(): Promise<void>;
}

interface CacheEntry<T> {
  data: T;
  etag?: string;
  timestamp: number;
  staleTime?: number;
}
```

---

## @warpkit/forms

### useForm

```typescript
function useForm<T extends object>(options: FormOptions<T>): FormState<T>;

interface FormOptions<T> {
  initialValues?: T;
  schema?: StandardSchema<T>;
  onSubmit: (values: T) => Promise<void>;
  mode?: 'blur' | 'change' | 'submit' | 'touched' | 'all';
  revalidateMode?: 'change' | 'blur' | 'submit';
  delayError?: number;
  validators?: Record<string, FieldValidator<T>>;
  warners?: Record<string, FieldValidator<T>>;
}

interface FormState<T> {
  // Data (reactive)
  data: T;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;

  // Status (reactive)
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  isSubmitted: boolean;
  submitError: Error | null;
  submitCount: number;

  // Methods
  submit(event?: Event): Promise<void>;
  reset(values?: Partial<T>): void;
  validate(): Promise<boolean>;
  validateField(field: string): Promise<boolean>;
  setField<K extends keyof T>(field: K, value: T[K]): void;
  setError(field: string, message: string | null): void;
  setWarning(field: string, message: string | null): void;
  touch(field: string): void;
  clearErrors(): void;

  // Array operations
  push(field: string, value: unknown): void;
  remove(field: string, index: number): void;
  insert(field: string, index: number, value: unknown): void;
  move(field: string, from: number, to: number): void;
  swap(field: string, indexA: number, indexB: number): void;

  // Field-centric access
  field<V>(path: string): FieldState<V>;
}

interface FieldState<V> {
  value: V;
  error: string | undefined;
  warning: string | undefined;
  touched: boolean;
  dirty: boolean;
}
```

---

## @warpkit/validation

```typescript
// Check if value is StandardSchema
function isStandardSchema(value: unknown): value is StandardSchema;

// Validate data against schema
function validate<T>(schema: StandardSchema<T>, data: unknown): { value: T } | { errors: Record<string, string> };

// Type definition factory
const TypeDefinition = {
  create<T>(name: string, validate: (value: unknown) => T): TypeDefinition<T>;
};

// Validated type factory (wraps schema)
const ValidatedType = {
  wrap<T>(name: string, schema: StandardSchema<T>): ValidatedType<T>;
};

// Validation error
class ValidationError extends Error {
  constructor(message: string, errors: Record<string, string>);
  readonly errors: Record<string, string>;
}
```

---

## @warpkit/websocket

### SocketClient

```typescript
class SocketClient {
  constructor(url: string, options?: SocketClientOptions);

  // Connection
  connect(): void;
  disconnect(): void;
  readonly isConnected: boolean;
  readonly connectionState: ConnectionState;
  readonly joinedRooms: ReadonlySet<string>;

  // Messages
  on<TData>(message: ClientMessageDefinition<TData>, handler: MessageHandler<TData>): () => void;
  emit<TData>(message: ClientMessageDefinition<TData>, data: TData, options?: { buffer?: boolean }): void;
  send(type: string, payload: Record<string, unknown>, options?: { buffer?: boolean }): void;
  sendRaw(data: string, options?: { buffer?: boolean }): void;

  // Rooms
  joinRoom(room: string): void;
  leaveRoom(room: string): void;
  clearRooms(): void;

  // Events
  onStateChange(handler: ConnectionStateHandler): () => void;
  onError(handler: ErrorHandler): () => void;
}

interface SocketClientOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
```

### Message Definitions

```typescript
// Define message without validation
const MyMessage = ClientMessage.define<{ id: string }>('message.name');

// Built-in connection events
const Connected: ClientMessageDefinition<{ reconnected?: boolean }>;
const Disconnected: ClientMessageDefinition<Record<string, never>>;
const ReconnectAttempt: ClientMessageDefinition<{ attempt: number }>;
const ReconnectFailed: ClientMessageDefinition<{ attempts: number }>;

// Built-in control messages
const JoinRoom: ClientMessageDefinition<{ room: string }>;
const LeaveRoom: ClientMessageDefinition<{ room: string }>;
const Heartbeat: ClientMessageDefinition<Record<string, never>>;
```

---

## @warpkit/auth-firebase

### FirebaseAuthAdapter

```typescript
class FirebaseAuthAdapter<TAppState extends string, TStateData = unknown>
  implements AuthAdapter<unknown, TAppState, TStateData, FirebaseTokens> {

  constructor(app: FirebaseApp, options: {
    getInitialState: (user: FirebaseUser | null) => Promise<AuthInitResult<TAppState, TStateData>>;
    getStateChange?: (user: FirebaseUser | null) => Promise<AuthInitResult<TAppState, TStateData> | undefined>;
    appCheck?: AppCheck | null;
    authEmulatorUrl?: string;
  });

  // AuthAdapter interface
  initialize(): Promise<AuthInitResult<TAppState, TStateData>>;
  onAuthStateChanged(callback: (result: AuthInitResult<TAppState, TStateData> | undefined) => void): () => void;
  signOut(): Promise<void>;

  // Sign-in methods
  signInWithEmail(email: string, password: string): Promise<FirebaseSignInResult>;
  signInWithGoogle(): Promise<FirebaseSignInResult>;
  createUserWithEmail(email: string, password: string): Promise<FirebaseSignInResult>;
  signUpWithEmail(email: string, password: string): Promise<FirebaseSignInResult>;

  // Token management
  getTokens(): Promise<FirebaseTokens>;
  getIdToken(): Promise<string | null>;

  // User
  getCurrentUser(): FirebaseUser | null;
  refreshUser(): Promise<FirebaseUser | null>;

  // Persistence
  useMemoryPersistence(): Promise<void>;
  commitSession(): Promise<void>;
  useLocalPersistence(): Promise<void>;

  // Firebase app access
  getApp(): FirebaseApp;
}

interface FirebaseTokens {
  idToken: string | null;
  appCheckToken: string | null;
}

interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

interface FirebaseSignInResult {
  user: FirebaseUser;
  isNewUser: boolean;
}
```
