# WebSockets & Real-Time

Modern applications are expected to be live. When a teammate creates an incident, you should see it immediately. When a monitor goes down, the dashboard should update without a refresh. When someone edits a shared resource, the stale data on your screen should be replaced.

HTTP polling can approximate this, but it wastes bandwidth, introduces latency proportional to the polling interval, and does not scale well when you have dozens of data sources that could change at any time. WebSockets give you a persistent, bidirectional channel where the server pushes updates the moment they happen.

WarpKit's `@warpkit/websocket` package provides a production-grade WebSocket client that handles the hard parts: reconnection with exponential backoff, browser offline/online detection, tab visibility management, heartbeat keep-alive, room subscriptions with automatic rejoin, message buffering during disconnection, and type-safe message definitions.

## SocketClient

The `SocketClient` class is the entry point. Create one instance per WebSocket connection (most applications need only one).

```typescript
import { SocketClient, Connected, Disconnected } from '@warpkit/websocket';

const client = new SocketClient('wss://api.example.com/ws', {
  reconnect: true,             // Auto-reconnect on disconnect (default: true)
  reconnectDelay: 500,         // Minimum backoff delay in ms (default: 500)
  maxReconnectDelay: 20000,    // Maximum backoff delay in ms (default: 20000)
  maxReconnectAttempts: Infinity, // Give up after N attempts (default: Infinity)
  connectionTimeout: 5000,     // Abort connect after N ms (default: 5000)
  heartbeatInterval: 25000,    // Send ping every N ms (default: 25000)
  heartbeatTimeout: 5000       // Close if no pong after N ms (default: 5000)
});

// Handle connection established
client.on(Connected, ({ reconnected }) => {
  console.log(reconnected ? 'Reconnected' : 'Connected');
  // Authenticate and join rooms here
});

// Handle connection lost
client.on(Disconnected, () => {
  console.log('Disconnected');
});

// Start connecting
client.connect();
```

The `connect()` method is idempotent -- calling it while already connected or connecting is a no-op. When you are done, call `client.disconnect()` to close the connection and prevent automatic reconnection.

## Type-Safe Message Definitions

WebSocket messages are defined as typed constants using `ClientMessage.define()`. This gives you compile-time type safety for both incoming and outgoing messages.

```typescript
import { ClientMessage } from '@warpkit/websocket';

// Define a message type with its payload shape
const IncidentCreated = ClientMessage.define<{
  uuid: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
}>('incident.created');

const MonitorStatusChanged = ClientMessage.define<{
  monitorUuid: string;
  status: 'up' | 'down' | 'degraded';
  changedAt: number;
}>('monitor.status-changed');

// Subscribe to typed messages
client.on(IncidentCreated, (data) => {
  // TypeScript knows: data.uuid, data.title, data.severity
  incidents = [...incidents, data];
});

client.on(MonitorStatusChanged, (data) => {
  // TypeScript knows: data.monitorUuid, data.status, data.changedAt
  updateMonitorStatus(data.monitorUuid, data.status);
});
```

The handler receives two arguments: `data` (the typed payload) and `envelope` (the full message envelope including `name`, `data`, and `timestamp`). Most handlers only need `data`.

### Validated Messages

For messages where you want runtime validation (not just compile-time types), combine `ClientMessage.define()` with a `ValidatedType` from `@warpkit/validation`:

```typescript
import { ClientMessage } from '@warpkit/websocket';
import { ValidatedType } from '@warpkit/validation';
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'member', 'viewer'])
});

const UserType = ValidatedType.wrap('user', UserSchema);
const UserUpdated = ClientMessage.define('user.updated', UserType);

// data is validated at runtime AND typed at compile time
client.on(UserUpdated, (data) => {
  // data.id, data.name, data.role -- all validated
});
```

This is useful when you want to catch malformed messages from the server during development, or when dealing with untrusted data sources.

### Sending Messages

Use `client.emit()` to send typed messages to the server:

```typescript
const AuthMessage = ClientMessage.define<{ token: string }>('auth');

client.emit(AuthMessage, { token: await getIdToken() });
```

Messages sent while disconnected are buffered by default and delivered when the connection is established. Disable buffering with `{ buffer: false }`:

```typescript
// Will throw if not connected
client.emit(AuthMessage, { token }, { buffer: false });
```

The `send()` method also works for untyped messages, though `emit()` is preferred for type safety:

```typescript
// Untyped (deprecated in favor of emit)
client.send('auth', { token: '...' });
```

## Room Subscriptions

Rooms scope real-time updates so clients only receive messages relevant to them. A monitoring dashboard might join rooms for the current account and the active project:

```typescript
client.on(Connected, async ({ reconnected }) => {
  // Authenticate first
  const token = await getIdToken();
  client.send('auth', { token });

  // Join relevant rooms
  client.joinRoom(`account:${accountUuid}`);
  client.joinRoom(`project:${projectUuid}`);
});
```

Room memberships are tracked internally. When the client reconnects (after a network drop, for example), all rooms are automatically rejoined. You do not need to re-subscribe manually.

```typescript
// Leave a room
client.leaveRoom(`project:${oldProjectUuid}`);

// Join a different room
client.joinRoom(`project:${newProjectUuid}`);

// Check current rooms
console.log(client.joinedRooms); // ReadonlySet<string>

// Clear all room memberships (does not send leave messages)
client.clearRooms();
```

## Reconnection Strategy

Network connections fail. Wi-Fi drops. Laptops go to sleep. Servers restart. A production WebSocket client must handle all of these gracefully.

WarpKit uses **full jitter exponential backoff** for reconnection delays. The formula is:

```
delay = random(0, min(maxDelay, minDelay * 2^attempts))
```

Why full jitter? When a server restarts and hundreds of clients disconnect simultaneously, you do not want them all reconnecting at the same time. That would create a thundering herd that could overwhelm the server. Full jitter spreads reconnection attempts randomly across the backoff window, preventing synchronized retries.

With the default settings (`reconnectDelay: 500`, `maxReconnectDelay: 20000`):

| Attempt | Max Delay | Actual Delay (random) |
|---------|-----------|----------------------|
| 1 | 500ms | 0--500ms |
| 2 | 1000ms | 0--1000ms |
| 3 | 2000ms | 0--2000ms |
| 4 | 4000ms | 0--4000ms |
| 5 | 8000ms | 0--8000ms |
| 6 | 16000ms | 0--16000ms |
| 7+ | 20000ms | 0--20000ms (capped) |

### Browser-Aware Reconnection

The client is aware of the browser's network state and visibility state:

**Offline detection**: When the browser fires an `offline` event (the device lost network), the client closes the connection immediately and stops attempting to reconnect. When the `online` event fires, the client reconnects immediately without waiting for a backoff delay. There is no point in retrying while the device has no network.

**Tab visibility**: When the page is hidden (user switched tabs or minimized the browser), the client pauses reconnection attempts. This saves battery and network bandwidth for background tabs. When the page becomes visible again, reconnection resumes immediately.

**Intentional disconnect**: When you call `client.disconnect()`, reconnection is permanently disabled until you call `client.connect()` again. This prevents the client from reconnecting after a deliberate sign-out.

### Connection State

The client exposes its current connection state as a `ConnectionState`:

```typescript
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
```

Subscribe to state changes for UI indicators:

```typescript
client.onStateChange((state) => {
  connectionStatus = state; // Update a reactive variable
});

// Or check directly
if (client.isConnected) { ... }
console.log(client.connectionState); // 'connected' | 'disconnected' | ...
```

### Lifecycle Events

In addition to `Connected` and `Disconnected`, the client emits reconnection lifecycle events:

```typescript
import { Connected, Disconnected, ReconnectAttempt, ReconnectFailed } from '@warpkit/websocket';

client.on(ReconnectAttempt, ({ attempt }) => {
  console.log(`Reconnection attempt #${attempt}`);
});

client.on(ReconnectFailed, ({ attempts }) => {
  console.log(`Gave up after ${attempts} attempts`);
  showReconnectButton(); // Let the user retry manually
});
```

### Error Handling

Subscribe to connection errors:

```typescript
client.onError((error) => {
  console.error('WebSocket error:', error.message);
});
```

Errors include connection failures, connection timeouts, and heartbeat timeouts. The client reports errors through WarpKit's error reporting system as well, so they are captured even without explicit error handlers.

## Heartbeat

WebSocket connections can silently die. The TCP connection might still appear open on the client side, but the server has already cleaned up the session. Proxies and load balancers (Cloudflare, AWS ALB, NGINX) close idle connections after a timeout -- typically 60 to 100 seconds.

The heartbeat mechanism prevents this. Every `heartbeatInterval` milliseconds (default: 25,000), the client sends a minimal ping frame (`"2"` -- a single character). The server responds with a pong frame (`"3"`). If no pong is received within `heartbeatTimeout` milliseconds (default: 5,000), the connection is considered dead and the client closes it, triggering reconnection.

This protocol is intentionally minimal. A JSON heartbeat message like `{"type":"heartbeat"}` would be ~25 bytes. The single-character ping/pong is 1 byte per message, reducing heartbeat overhead by 96%.

The default 25-second interval is safe for all common proxy configurations:
- **Cloudflare**: 100-second idle timeout (non-configurable for non-Enterprise)
- **AWS ALB**: 60-second default idle timeout
- **NGINX**: Configurable via `proxy_read_timeout`

Set `heartbeatInterval` to a value lower than your shortest proxy idle timeout to prevent disconnections.

## Buffered Messages

When the client is disconnected, calls to `emit()` and `send()` buffer messages by default. The buffer is flushed when the connection is established:

```typescript
// Even if disconnected, this message will be queued
client.emit(AuthMessage, { token });

// When the connection opens, the auth message is sent automatically
```

This is useful for messages that must be delivered (like authentication). For messages where delivery during reconnection is not meaningful (like presence updates), disable buffering:

```typescript
client.emit(PresenceUpdate, { status: 'online' }, { buffer: false });
// Throws "Not connected" if disconnected
```

The buffer is cleared on intentional disconnect (`client.disconnect()`). Messages queued before a deliberate disconnect are lost, which is the expected behavior -- if the user is signing out, queued messages are no longer relevant.

## Server Message Envelope

The server sends messages as JSON with this envelope format:

```json
{
  "name": "incident.created",
  "data": {
    "uuid": "abc-123",
    "title": "Database connection timeout",
    "severity": "critical"
  },
  "timestamp": 1706803200000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Message name that matches the `ClientMessage.define()` name. |
| `data` | `object` | The message payload. |
| `timestamp` | `number` | Unix timestamp (milliseconds) when the server emitted the message. |

The client parses incoming JSON with prototype pollution protection (dangerous keys like `__proto__`, `constructor`, and `prototype` are stripped from parsed objects).

## Real-World Example: Live Dashboard

Here is a complete Svelte component that connects to a WebSocket server, displays connection status, and updates a list of incidents in real time:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { SocketClient, ClientMessage, Connected, Disconnected } from '@warpkit/websocket';

  interface Incident {
    uuid: string;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    createdAt: number;
  }

  const IncidentCreated = ClientMessage.define<Incident>('incident.created');
  const IncidentResolved = ClientMessage.define<{ uuid: string }>('incident.resolved');

  let connectionStatus = $state<string>('disconnected');
  let incidents = $state<Incident[]>([]);

  const client = new SocketClient('wss://api.example.com/ws', {
    heartbeatInterval: 25000
  });

  client.onStateChange((state) => {
    connectionStatus = state;
  });

  client.on(Connected, async ({ reconnected }) => {
    const token = await getIdToken();
    client.send('auth', { token });
    client.joinRoom(`account:${accountUuid}`);

    if (reconnected) {
      // After reconnection, fetch any incidents we might have missed
      await refreshIncidents();
    }
  });

  client.on(IncidentCreated, (data) => {
    incidents = [data, ...incidents];
  });

  client.on(IncidentResolved, ({ uuid }) => {
    incidents = incidents.filter((i) => i.uuid !== uuid);
  });

  client.connect();

  onDestroy(() => {
    client.disconnect();
  });
</script>

<div class="dashboard">
  <div class="status-bar">
    <span class="status-dot" class:connected={connectionStatus === 'connected'}></span>
    {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
  </div>

  <h2>Active Incidents ({incidents.length})</h2>

  {#each incidents as incident (incident.uuid)}
    <div class="incident" class:critical={incident.severity === 'critical'}>
      <span class="severity">{incident.severity}</span>
      <span class="title">{incident.title}</span>
    </div>
  {:else}
    <p>No active incidents.</p>
  {/each}
</div>
```

Key patterns in this example:

1. **Authentication on connect**: The `Connected` handler sends an auth message before joining rooms. This ensures the server knows who the client is before delivering any messages.
2. **Room subscription**: The client joins a room scoped to the account. The server only sends messages relevant to that account.
3. **Reconnection recovery**: When `reconnected` is `true`, the component fetches fresh data to catch up on anything missed while disconnected.
4. **Cleanup**: `onDestroy` calls `client.disconnect()` to prevent the client from reconnecting after the component is destroyed.

## Compared to Other Frameworks

### Socket.IO Client

Socket.IO is the most popular WebSocket library. It includes automatic reconnection, rooms, acknowledgements, and binary support. However, it requires a Socket.IO server (it uses a custom protocol on top of WebSockets) and does not provide type-safe message definitions. WarpKit's `SocketClient` works with any standard WebSocket server, uses plain JSON, and provides compile-time type safety through `ClientMessage.define()`.

### Phoenix Channels

Phoenix Channels provide real-time features for Elixir applications. They are server-rendered (LiveView) rather than client-driven, which is a fundamentally different paradigm. If your backend is Elixir, Phoenix Channels are the natural choice. WarpKit's WebSocket client is backend-agnostic.

### DIY WebSocket

You can always create a `new WebSocket(url)` directly. But you will end up building reconnection logic, heartbeat handling, offline detection, visibility handling, message buffering, and room management yourself. These are not trivial to get right. WarpKit's `SocketClient` provides all of this in a tested, production-ready package.
