# @warpkit/websocket

Type-safe WebSocket client with auto-reconnect for Svelte 5.

## Installation

```bash
npm install @warpkit/websocket
```

## Features

- **Type-safe messages** - Define message types with TypeScript
- **Auto-reconnect** - Exponential backoff with jitter
- **Heartbeat** - Keep connections alive
- **Message buffering** - Queue messages during reconnection

## Usage

### Define Message Types

```typescript
// types.ts
import { ControlMessage } from '@warpkit/websocket';

// Server -> Client messages
type ServerMessage =
  | { type: 'user.online'; userId: string }
  | { type: 'monitor.alert'; monitorId: string; status: string }
  | ControlMessage;

// Client -> Server messages
type ClientMessage =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string };
```

### Create Client

```typescript
import { createWebSocketClient } from '@warpkit/websocket';

const ws = createWebSocketClient<ServerMessage, ClientMessage>({
  url: 'wss://api.example.com/ws',
  reconnect: {
    enabled: true,
    maxAttempts: 10
  },
  heartbeat: {
    enabled: true,
    interval: 30_000
  }
});

// Connect
ws.connect();

// Send messages
ws.send({ type: 'subscribe', channel: 'alerts' });

// Listen for messages
ws.on('monitor.alert', (message) => {
  console.log('Alert:', message.monitorId, message.status);
});

// Check connection
if (ws.isConnected) {
  // ...
}

// Disconnect
ws.disconnect();
```

### With Authentication

```typescript
const ws = createWebSocketClient<ServerMessage, ClientMessage>({
  url: () => `wss://api.example.com/ws?token=${getToken()}`,
  // URL is re-evaluated on each reconnect
});
```

## API

### createWebSocketClient(options)

Options:
- `url` - WebSocket URL or getter function
- `protocols` - WebSocket sub-protocols
- `reconnect` - Reconnection settings
  - `enabled` - Enable auto-reconnect
  - `maxAttempts` - Maximum reconnection attempts
  - `minDelay` - Initial delay (ms)
  - `maxDelay` - Maximum delay (ms)
- `heartbeat` - Heartbeat settings
  - `enabled` - Enable heartbeat
  - `interval` - Ping interval (ms)
  - `timeout` - Pong timeout (ms)

Returns:
- `connect()` - Open connection
- `disconnect()` - Close connection
- `send(message)` - Send typed message
- `on(type, handler)` - Listen for message type
- `off(type, handler)` - Remove listener
- `isConnected` - Connection state
- `readyState` - WebSocket ready state

## Control Messages

Built-in control message types:

```typescript
type ControlMessage =
  | { type: '__ping__' }
  | { type: '__pong__' }
  | { type: '__ack__'; id: string };
```
