/**
 * Browser WebSocket client types.
 *
 * These types are validation-agnostic - no schema validation on the client side.
 * The server validates all data before sending, so clients can trust incoming messages.
 */

import type { StandardSchema } from '@warpkit/validation';

/**
 * Minimal ping/pong protocol constants (like Engine.IO/Socket.IO).
 * Single character frames minimize bandwidth for heartbeats.
 *
 * Protocol:
 * - Client sends PING_FRAME ("2") periodically (default: every 30s)
 * - Server responds with PONG_FRAME ("3")
 * - If no pong received within timeout (default: 10s), connection is considered dead
 *
 * This reduces heartbeat overhead from ~50 bytes (JSON) to 1 byte per message.
 *
 * Proxy/Load Balancer Compatibility:
 * - Cloudflare: 100s idle timeout (non-configurable for non-Enterprise)
 * - AWS ALB: 60s default idle timeout (configurable up to 4000s)
 * - NGINX: configurable via proxy_read_timeout
 *
 * The default 30s heartbeat interval is safe for all common configurations.
 * Set heartbeatInterval < min(proxy_idle_timeout) to prevent disconnects.
 */
export const PING_FRAME = '2';
export const PONG_FRAME = '3';

/**
 * Client-side message definition (validation-agnostic).
 * Only needs name and type carrier for type inference.
 *
 * @template TData - The message data type
 *
 * @example
 * ```typescript
 * // Define client-only message types
 * const CustomMessage: ClientMessageDefinition<{ id: string }> = {
 *   name: 'custom.message',
 *   _data: undefined as unknown as { id: string }
 * };
 *
 * client.on(CustomMessage, (data) => {
 *   // data is typed: { id: string }
 * });
 * ```
 */
export interface ClientMessageDefinition<TData> {
	readonly name: string;
	readonly _data: TData;
}

/**
 * Client-side message definition with schema validation.
 * Extends ClientMessageDefinition with a StandardSchema for validation.
 *
 * @template TData - The message data type (inferred from ValidatedType)
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { ValidatedType } from '@warpkit/validation';
 * import { ClientMessage, ValidatedMessageDefinition } from '@warpkit/websocket';
 *
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * const UserType = ValidatedType.wrap('user', UserSchema);
 * const UserMessage = ClientMessage.define('user.updated', UserType);
 * // UserMessage is ValidatedMessageDefinition<{ id: string; name: string }>
 * ```
 */
export interface ValidatedMessageDefinition<TData> extends ClientMessageDefinition<TData> {
	readonly schema: StandardSchema<TData>;
}

/**
 * Incoming message envelope from server.
 */
export interface MessageEnvelope<TData = unknown> {
	/** Message name (e.g., 'incident.created') */
	name: string;
	/** Message payload */
	data: TData;
	/** Server-side timestamp when message was emitted */
	timestamp: number;
}

/**
 * Handler function for a specific message type.
 *
 * @template TData - The message data type
 * @param data - The message payload (typed based on the message definition)
 * @param envelope - The full message envelope including metadata
 */
export type MessageHandler<TData> = (data: TData, envelope: MessageEnvelope<TData>) => void;

/**
 * Connection state for the WebSocket client.
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * Options for configuring the SocketClient.
 */
export interface SocketClientOptions {
	/**
	 * Auto-reconnect on disconnect.
	 * @default true
	 */
	reconnect?: boolean;

	/**
	 * Maximum reconnect attempts before giving up.
	 * Set to Infinity for unlimited retries.
	 * @default Infinity
	 */
	maxReconnectAttempts?: number;

	/**
	 * Minimum reconnect delay in milliseconds.
	 * Uses full jitter backoff.
	 * @default 500
	 */
	reconnectDelay?: number;

	/**
	 * Maximum reconnect delay in milliseconds.
	 * Caps the exponential backoff.
	 * @default 20000
	 */
	maxReconnectDelay?: number;

	/**
	 * Connection timeout in milliseconds.
	 * If the WebSocket doesn't connect within this time, the attempt is aborted.
	 * Set to 0 to disable (not recommended).
	 * @default 5000
	 */
	connectionTimeout?: number;

	/**
	 * Heartbeat interval in milliseconds.
	 * Sends a ping message to keep the connection alive.
	 * Set to 0 to disable.
	 * @default 25000
	 */
	heartbeatInterval?: number;

	/**
	 * Heartbeat timeout in milliseconds.
	 * If no pong is received within this time, the connection is considered dead.
	 * Set to 0 to disable timeout checking.
	 * @default 5000
	 */
	heartbeatTimeout?: number;
}

/**
 * Event handler for connection state changes.
 */
export type ConnectionStateHandler = (state: ConnectionState) => void;

/**
 * Event handler for connection errors.
 */
export type ErrorHandler = (error: Error) => void;
