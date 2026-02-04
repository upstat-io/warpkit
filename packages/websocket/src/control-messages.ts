/**
 * Client-Side Control Message Definitions
 *
 * These definitions are validation-agnostic - they only provide type inference.
 * The server validates all messages; clients trust the server.
 *
 * @example
 * ```typescript
 * import { SocketClient, JoinRoom, LeaveRoom } from '@warpkit/websocket';
 *
 * const client = new SocketClient('wss://api.example.com/ws');
 *
 * // Type-safe message emission
 * client.emit(JoinRoom, { room: 'account:123' });
 * client.emit(LeaveRoom, { room: 'account:123' });
 * ```
 */

import type { ValidatedType } from '@warpkit/validation';
import type { ClientMessageDefinition, ValidatedMessageDefinition } from './types';

// Overload signatures
function defineMessage<TData>(name: string): ClientMessageDefinition<TData>;
function defineMessage<TData>(
	name: string,
	validatedType: ValidatedType<TData>
): ValidatedMessageDefinition<TData>;
function defineMessage<TData>(
	name: string,
	validatedType?: ValidatedType<TData>
): ClientMessageDefinition<TData> | ValidatedMessageDefinition<TData> {
	if (validatedType) {
		return Object.freeze({
			name,
			schema: validatedType.schema,
			_data: undefined as unknown as TData
		});
	}
	return Object.freeze({
		name,
		_data: undefined as unknown as TData
	});
}

/**
 * Factory for creating client message definitions.
 *
 * Supports two modes:
 * - Without ValidatedType: validation-agnostic, type specified via generic
 * - With ValidatedType: type-safe with schema validation
 *
 * @example
 * ```typescript
 * import { ValidatedType } from '@warpkit/validation';
 * import { z } from 'zod';
 *
 * // Without ValidatedType (validation-agnostic)
 * const CustomMessage = ClientMessage.define<{ id: string; value: number }>('custom.event');
 *
 * // With ValidatedType (validated)
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * const UserType = ValidatedType.wrap('user', UserSchema);
 * const UserMessage = ClientMessage.define('user.updated', UserType);
 *
 * client.emit(CustomMessage, { id: '123', value: 42 });
 * client.emit(UserMessage, { id: '456', name: 'Alice' });
 * ```
 */
export const ClientMessage = {
	define: defineMessage
};

// =============================================================================
// Built-in Control Messages
// =============================================================================

/**
 * Join a room/topic to receive messages published to it.
 *
 * @example
 * ```typescript
 * client.emit(JoinRoom, { room: 'account:123' });
 * ```
 */
export const JoinRoom: ClientMessageDefinition<{ room: string }> = ClientMessage.define('room.join');

/**
 * Leave a room/topic to stop receiving messages from it.
 *
 * @example
 * ```typescript
 * client.emit(LeaveRoom, { room: 'account:123' });
 * ```
 */
export const LeaveRoom: ClientMessageDefinition<{ room: string }> = ClientMessage.define('room.leave');

/**
 * JSON-based heartbeat for keep-alive.
 *
 * Note: For minimal bandwidth, prefer the built-in ping/pong protocol
 * which uses single character frames ('2' for ping, '3' for pong).
 * The SocketClient handles this automatically via heartbeatInterval.
 *
 * @example
 * ```typescript
 * // Manual heartbeat (not typically needed)
 * client.emit(Heartbeat, {});
 * ```
 */
export const Heartbeat: ClientMessageDefinition<Record<string, never>> = ClientMessage.define('heartbeat');

// =============================================================================
// Type Exports
// =============================================================================

/** Data type for JoinRoom message */
export type JoinRoomData = { room: string };

/** Data type for LeaveRoom message */
export type LeaveRoomData = { room: string };

/** Data type for Heartbeat message */
export type HeartbeatData = Record<string, never>;
