/**
 * @warpkit/websocket - Browser WebSocket client
 *
 * Provides a type-safe, browser-compatible WebSocket client with:
 *
 * - Type-safe message handlers using message definitions
 * - Automatic reconnection with exponential backoff
 * - Room/topic subscription support
 * - Connection state management
 * - Heartbeat/ping-pong keep-alive
 * - Browser offline/online detection
 * - Page visibility handling
 *
 * @example
 * ```typescript
 * import { SocketClient, ClientMessage, Connected } from '@warpkit/websocket';
 * import { ValidatedType } from '@warpkit/validation';
 * import { z } from 'zod';
 *
 * const client = new SocketClient('wss://api.example.com/ws');
 *
 * // Define your message types (without validation)
 * const IncidentCreated = ClientMessage.define<{ uuid: string; title: string }>('incident.created');
 *
 * // Define with ValidatedType (with validation)
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * const UserType = ValidatedType.wrap('user', UserSchema);
 * const UserUpdated = ClientMessage.define('user.updated', UserType);
 *
 * // Type-safe handlers - data type is inferred from message definition
 * client.on(IncidentCreated, (data) => {
 *   console.log('New incident:', data.uuid, data.title);
 * });
 *
 * client.on(UserUpdated, (data) => {
 *   console.log('User updated:', data.id, data.name);
 * });
 *
 * // Connection lifecycle - handle auth here
 * client.on(Connected, async () => {
 *   // Send auth if needed (define your own auth message)
 *   const MyAuth = ClientMessage.define<{ token: string }>('auth');
 *   const token = await getToken();
 *   if (token) client.emit(MyAuth, { token });
 *
 *   // Join rooms
 *   client.joinRoom(`account:${accountUuid}`);
 * });
 *
 * client.onStateChange((state) => {
 *   console.log('Connection state:', state);
 * });
 *
 * client.connect();
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { SocketClient, Connected, Disconnected, ReconnectAttempt, ReconnectFailed } from './client';

// Control Messages (built-in client-side message definitions)
export { ClientMessage, JoinRoom, LeaveRoom, Heartbeat } from './control-messages';
export type { JoinRoomData, LeaveRoomData, HeartbeatData } from './control-messages';

// Types
export type {
	ClientMessageDefinition,
	ValidatedMessageDefinition,
	MessageEnvelope,
	MessageHandler,
	ConnectionState,
	SocketClientOptions,
	ConnectionStateHandler,
	ErrorHandler
} from './types';

// Protocol constants (for server implementations)
export { PING_FRAME, PONG_FRAME } from './types';
