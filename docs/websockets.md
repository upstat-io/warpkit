# WebSockets

WarpKit provides a robust WebSocket client with automatic reconnection, type-safe messages, and room subscriptions.

## SocketClient

### Basic Setup

```typescript
import { SocketClient, Connected } from '@warpkit/websocket';

const client = new SocketClient('wss://api.example.com/ws');

// Handle connection lifecycle
client.on(Connected, async ({ reconnected }) => {
  console.log('Connected', reconnected ? '(reconnected)' : '');

  // Authenticate if needed
  const token = await getToken();
  if (token) {
    client.emit(AuthMessage, { token });
  }

  // Join rooms
  client.joinRoom(`account:${accountUuid}`);
});

// Connect
client.connect();
```

### Configuration Options

```typescript
interface SocketClientOptions {
  reconnect?: boolean;           // Enable reconnection (default: true)
  maxReconnectAttempts?: number; // Max attempts (default: Infinity)
  reconnectDelay?: number;       // Initial delay ms (default: 500)
  maxReconnectDelay?: number;    // Max delay ms (default: 20000)
  connectionTimeout?: number;    // Timeout ms (default: 5000)
  heartbeatInterval?: number;    // Ping interval ms (default: 25000)
  heartbeatTimeout?: number;     // Pong timeout ms (default: 5000)
}

const client = new SocketClient('wss://api.example.com/ws', {
  reconnect: true,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000
});
```

## Message Definitions

Define type-safe message handlers:

### Without Validation

```typescript
import { ClientMessage } from '@warpkit/websocket';

// Define message shape
const IncidentCreated = ClientMessage.define<{
  uuid: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
}>('incident.created');

// Type-safe handler - data type is inferred
client.on(IncidentCreated, (data) => {
  console.log('Incident:', data.uuid, data.title);
  // data is typed as { uuid: string; title: string; severity: ... }
});
```

### With Validation

```typescript
import { ClientMessage, ValidatedType } from '@warpkit/websocket';
import { z } from 'zod';

// Define schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

// Create validated type
const UserType = ValidatedType.wrap('user', UserSchema);

// Define message with validation
const UserUpdated = ClientMessage.define('user.updated', UserType);

// Handler receives validated data
client.on(UserUpdated, (data) => {
  console.log('User updated:', data.id, data.name);
});
```

## Built-in Events

### Connection Lifecycle

```typescript
import { Connected, Disconnected, ReconnectAttempt, ReconnectFailed } from '@warpkit/websocket';

client.on(Connected, ({ reconnected }) => {
  console.log('Connected', reconnected ? '(reconnected)' : '');
});

client.on(Disconnected, () => {
  console.log('Disconnected');
});

client.on(ReconnectAttempt, ({ attempt }) => {
  console.log('Reconnecting... attempt', attempt);
});

client.on(ReconnectFailed, ({ attempts }) => {
  console.log('Gave up after', attempts, 'attempts');
});
```

### State Changes

```typescript
client.onStateChange((state) => {
  // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  console.log('Connection state:', state);
});

// Check current state
if (client.isConnected) {
  // ...
}
```

### Errors

```typescript
client.onError((error) => {
  console.error('Connection error:', error.message);
});
```

## Room Subscriptions

### Joining Rooms

```typescript
client.on(Connected, () => {
  // Join rooms after connecting
  client.joinRoom(`account:${accountUuid}`);
  client.joinRoom(`project:${projectUuid}`);
});

// Rooms are automatically rejoined on reconnect
```

### Leaving Rooms

```typescript
client.leaveRoom(`project:${oldProjectUuid}`);
```

### Clearing All Rooms

```typescript
// Clear locally tracked rooms (doesn't send leave messages)
client.clearRooms();
```

## Sending Messages

### Type-Safe Emit

```typescript
const SendChat = ClientMessage.define<{ message: string }>('chat.send');

client.emit(SendChat, { message: 'Hello!' });
```

### Buffered Messages

Messages are buffered while disconnected and sent when connection is established:

```typescript
// This will be queued if disconnected
client.emit(SendChat, { message: 'Will be sent when connected' });

// Disable buffering
client.emit(SendChat, { message: 'Fail if not connected' }, { buffer: false });
```

### Raw Messages

```typescript
// Send raw string (not buffered by default)
client.sendRaw('{"type":"ping"}');

// Buffer raw message
client.sendRaw('{"type":"ping"}', { buffer: true });
```

## Reconnection

WarpKit uses **full jitter exponential backoff** for reconnection:

```
delay = random(0, min(maxDelay, minDelay * 2^attempts))
```

### Reconnection Behavior

1. On disconnect, wait `delay` before reconnecting
2. Each attempt doubles the max delay (up to `maxReconnectDelay`)
3. Reconnection resets on successful connection

### Browser-Aware Reconnection

The client handles browser events:

- **Offline** - Stops reconnecting, closes connection
- **Online** - Immediately attempts reconnection
- **Page Hidden** - Skips reconnection while tab is hidden
- **Page Visible** - Resumes reconnection when tab is visible

## Heartbeat

WarpKit uses minimal ping/pong frames for keep-alive:

```
Client: "2" (ping)
Server: "3" (pong)
```

If no pong is received within `heartbeatTimeout`, the connection is considered dead and reconnection begins.

## Server Protocol

### Message Envelope

Server messages should follow this format:

```json
{
  "name": "incident.created",
  "data": { "uuid": "123", "title": "Server Down" },
  "timestamp": 1706634567890
}
```

### Room Management

```json
// Join room (client -> server)
{ "type": "join", "room": "account:123" }

// Leave room (client -> server)
{ "type": "leave", "room": "account:123" }
```

### Heartbeat

```
Client: "2"
Server: "3"
```

## Example: Real-Time Dashboard

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { SocketClient, Connected, ClientMessage } from '@warpkit/websocket';
  import { useWarpKit } from '@warpkit/core';

  const warpkit = useWarpKit();

  // Define messages
  const IncidentCreated = ClientMessage.define<{ uuid: string; title: string }>('incident.created');
  const IncidentResolved = ClientMessage.define<{ uuid: string }>('incident.resolved');

  // Reactive state
  let incidents = $state<Array<{ uuid: string; title: string }>>([]);
  let connectionStatus = $state<'connected' | 'disconnected' | 'connecting'>('disconnected');

  // Create client
  const client = new SocketClient('wss://api.example.com/ws');

  // Connection handler
  client.on(Connected, async () => {
    connectionStatus = 'connected';

    // Get auth token
    const token = await getIdToken();
    if (token) {
      client.send('auth', { token });
    }

    // Join account room
    client.joinRoom(`account:${accountUuid}`);
  });

  // State change handler
  client.onStateChange((state) => {
    connectionStatus = state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : 'disconnected';
  });

  // Message handlers
  client.on(IncidentCreated, (data) => {
    incidents = [...incidents, data];
  });

  client.on(IncidentResolved, (data) => {
    incidents = incidents.filter(i => i.uuid !== data.uuid);
  });

  // Connect on mount
  $effect(() => {
    client.connect();
    return () => client.disconnect();
  });
</script>

<div class="dashboard">
  <div class="status" class:connected={connectionStatus === 'connected'}>
    {connectionStatus}
  </div>

  <h2>Active Incidents</h2>
  {#each incidents as incident}
    <div class="incident">{incident.title}</div>
  {/each}
</div>
```

## Best Practices

1. **Define message types** - Use `ClientMessage.define` for type safety
2. **Handle reconnection** - Rejoin rooms in `Connected` handler
3. **Buffer important messages** - They'll be sent when connection resumes
4. **Use rooms for scoping** - Subscribe to specific data streams
5. **Handle offline gracefully** - Show connection status to users
6. **Validate incoming data** - Use `ValidatedType` for untrusted data
7. **Clean up** - Call `disconnect()` on component destroy
