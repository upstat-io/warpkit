# @warpkit/websocket

Typed WebSocket client with native reconnection, room subscriptions and heartbeat for WarpKit.

```ts
import { SocketClient, ClientMessage, Connected } from '@warpkit/websocket';

const Updated = ClientMessage.define<{ uuid: string }>('resource.updated');
const socket = new SocketClient(async () => ({
  url: 'wss://api.example.com/ws',
  protocols: ['app-v1', `bearer.${await getFreshToken()}`]
}));
socket.on(Updated, (data, envelope) => { /* Validate and refetch authorised state. */ });
socket.on(Connected, () => { /* TCP connected; wait for your server's subscription acknowledgement. */ });
socket.connect();
// On terminal session teardown:
socket.dispose();
```

The URL factory runs for every connection attempt. Credentials belong in an authenticated handshake such as the subprotocol header, never a URL query. The application defines and verifies its server protocol. Incoming messages use `{ name, data, timestamp }`; outgoing typed emission uses `{ type, ...data }`. Incoming definitions carry types; consumers validate untrusted payloads before using them.

`joinRoom()` remembers subscriptions for reconnection. Server-side authorisation is required for every protected room; automatic rejoin and buffered traffic precede `Connected`, so an asynchronous authentication message in that callback cannot protect that traffic. Heartbeat uses the exported `PING_FRAME`/`PONG_FRAME` constants.

`disconnect()` pauses automatic reconnection until an explicit `connect()`. `dispose()` permanently retires the client: it closes the socket, cancels pending connection results and timers, removes browser listeners and clears subscriptions/handlers. Create a new client for a new authenticated identity. Old connection callbacks cannot affect a replacement connection; sends after disposal throw.

Use `onStateChange()` and `onError()` for connection observation. Event registration returns an unsubscribe function. Reconnect, heartbeat and timeout bounds are configured through `SocketClientOptions`.
