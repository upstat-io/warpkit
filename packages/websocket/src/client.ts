/**
 * Browser WebSocket client for WarpKit.
 *
 * Provides a type-safe interface for consuming WebSocket messages from a server.
 * Handles connection management, reconnection, and message routing.
 *
 * Features:
 * - Full jitter backoff
 * - Browser offline/online detection
 * - Visibility change handling
 * - Send buffer for offline queueing
 * - Connection timeout
 *
 * @example
 * ```typescript
 * import { SocketClient, Connected, JoinRoom } from '@warpkit/websocket';
 *
 * // Define your message types
 * const IncidentCreated = { name: 'incident.created', _data: undefined as { uuid: string; title: string } };
 *
 * const client = new SocketClient('wss://api.example.com/ws');
 *
 * // Type-safe message handlers
 * client.on(IncidentCreated, (data) => {
 *   console.log('Incident created:', data.uuid, data.title);
 * });
 *
 * // Connection lifecycle
 * client.on(Connected, () => {
 *   client.joinRoom(`account:${accountUuid}`);
 * });
 *
 * client.connect();
 * ```
 */

import type {
	ClientMessageDefinition,
	MessageEnvelope,
	MessageHandler,
	ConnectionState,
	SocketClientOptions,
	ConnectionStateHandler,
	ErrorHandler
} from './types';
import { JoinRoom, LeaveRoom } from './control-messages';
import { Json } from './json';

/** Internal message name for connection established */
const CONNECTED_MESSAGE = '__connected__';

/** Internal message name for connection lost */
const DISCONNECTED_MESSAGE = '__disconnected__';

/**
 * Minimal ping/pong protocol.
 * Single character frames minimize bandwidth for heartbeats.
 */
const PING_FRAME = '2';
const PONG_FRAME = '3';

/** Default minimum backoff delay in milliseconds */
const DEFAULT_BACKOFF_MIN_MS = 500;

/** Default maximum backoff delay in milliseconds */
const DEFAULT_BACKOFF_MAX_MS = 20000;

/** Default connection timeout in milliseconds */
const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

/** Default heartbeat interval in milliseconds */
const DEFAULT_HEARTBEAT_INTERVAL_MS = 25000;

/** Default heartbeat timeout (waiting for pong) in milliseconds */
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5000;

/**
 * Full jitter backoff calculator.
 * Provides the best performance for distributed systems by completely
 * randomizing the retry interval within the exponential range.
 */
class Backoff {
	private ms: number;
	private max: number;
	public attempts = 0;

	constructor(options: { min?: number; max?: number } = {}) {
		this.ms = options.min ?? DEFAULT_BACKOFF_MIN_MS;
		this.max = options.max ?? DEFAULT_BACKOFF_MAX_MS;
	}

	/**
	 * Calculate the next backoff duration using full jitter.
	 * Returns a random value between 0 and min(max, min * 2^attempts).
	 */
	duration(): number {
		// Cap step at 31 to prevent overflow (2^31 is max safe)
		const step = Math.min(this.attempts++, 31);
		// Full jitter: random value between 0 and exponential ceiling
		const ceiling = Math.min(this.max, this.ms * Math.pow(2, step));
		const interval = Math.floor(Math.random() * ceiling);
		return Math.min(this.max, this.ms + interval) | 0;
	}

	/**
	 * Reset attempt counter.
	 */
	reset(): void {
		this.attempts = 0;
	}
}

/**
 * Browser WebSocket client with automatic reconnection and type-safe message handling.
 *
 * Features:
 * - Full jitter backoff
 * - Browser offline/online detection
 * - Page visibility handling - skip reconnect while hidden
 * - Send buffer for offline message queueing
 * - Connection timeout
 * - Automatic room rejoin on reconnect
 * - Heartbeat/ping-pong keep-alive
 * - Type-safe message handlers
 */
export class SocketClient {
	private ws: WebSocket | null = null;
	private readonly handlers = new Map<string, Set<MessageHandler<unknown>>>();
	private state: ConnectionState = 'disconnected';
	private readonly stateHandlers = new Set<ConnectionStateHandler>();
	private readonly errorHandlers = new Set<ErrorHandler>();

	/** Backoff calculator for reconnection delays */
	private backoff: Backoff;
	/** Whether reconnection is in progress */
	private reconnecting = false;
	/** Skip reconnect (for intentional disconnect) */
	private skipReconnect = false;
	/** Reconnect timer */
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	/** Connection timeout timer */
	private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

	/** Rooms the client has joined (for auto-rejoin on reconnect) */
	private readonly rooms = new Set<string>();

	/** Send buffer for messages queued while disconnected */
	private readonly sendBuffer: Array<() => void> = [];

	/** Heartbeat interval timer */
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	/** Heartbeat timeout timer (waiting for pong) */
	private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
	/** Whether we're waiting for a pong response */
	private awaitingPong = false;

	/** Page is hidden (skip reconnect while hidden) */
	private pageHidden = false;
	/** Device went offline (wait for online event) */
	private deviceWentOffline = false;
	/** Whether network events have been set up */
	private networkEventsSet = false;

	/** Resolved options with defaults */
	private readonly options: Required<SocketClientOptions>;

	/**
	 * Creates a new SocketClient.
	 *
	 * @param url - WebSocket server URL (ws:// or wss://)
	 * @param options - Connection options
	 */
	constructor(
		private readonly url: string,
		options: SocketClientOptions = {}
	) {
		this.options = {
			reconnect: options.reconnect ?? true,
			maxReconnectAttempts: options.maxReconnectAttempts ?? Infinity,
			reconnectDelay: options.reconnectDelay ?? DEFAULT_BACKOFF_MIN_MS,
			maxReconnectDelay: options.maxReconnectDelay ?? DEFAULT_BACKOFF_MAX_MS,
			connectionTimeout: options.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT_MS,
			heartbeatInterval: options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
			heartbeatTimeout: options.heartbeatTimeout ?? DEFAULT_HEARTBEAT_TIMEOUT_MS
		};

		this.backoff = new Backoff({
			min: this.options.reconnectDelay,
			max: this.options.maxReconnectDelay
		});

		// Set up browser network and visibility events
		this.setupNetworkEvents();
	}

	/**
	 * Current connection state.
	 */
	get connectionState(): ConnectionState {
		return this.state;
	}

	/**
	 * Whether the client is currently connected.
	 */
	get isConnected(): boolean {
		return this.state === 'connected';
	}

	/**
	 * Get the set of currently joined rooms.
	 */
	get joinedRooms(): ReadonlySet<string> {
		return this.rooms;
	}

	/**
	 * Connect to the WebSocket server.
	 * If already connected or connecting, this is a no-op.
	 */
	connect(): void {
		if (this.state === 'connected' || this.state === 'connecting') {
			return;
		}

		this.skipReconnect = false;
		this.deviceWentOffline = false;
		this.setState('connecting');

		this.ws = new WebSocket(this.url);

		// Connection timeout - fail fast if server doesn't respond
		if (this.options.connectionTimeout > 0) {
			this.connectionTimeoutTimer = setTimeout(() => {
				if (this.state === 'connecting' && this.ws) {
					const error = new Error(`Connection timeout after ${this.options.connectionTimeout}ms`);
					this.notifyError(error);
					this.ws.close();
				}
			}, this.options.connectionTimeout);
		}

		this.ws.onopen = () => {
			// Clear connection timeout
			this.clearConnectionTimeout();

			const wasReconnect = this.backoff.attempts > 0;
			this.setState('connected');
			this.backoff.reset();
			this.reconnecting = false;
			this.startHeartbeat();

			// Auto-rejoin rooms from previous session
			this.rejoinRooms();

			// Flush any buffered messages
			this.flushSendBuffer();

			this.emitInternal(CONNECTED_MESSAGE, { reconnected: wasReconnect });
		};

		this.ws.onmessage = (event) => {
			this.handleMessage(event.data as string);
		};

		this.ws.onclose = () => {
			// Clear connection timeout
			this.clearConnectionTimeout();

			const wasConnected = this.state === 'connected';
			this.ws = null;
			this.stopHeartbeat();
			this.setState('disconnected');

			if (wasConnected) {
				this.emitInternal(DISCONNECTED_MESSAGE, {});
			}

			this.maybeReconnect();
		};

		this.ws.onerror = () => {
			this.notifyError(new Error('WebSocket connection error'));
			// onclose will fire after onerror, so we don't change state here
		};
	}

	/**
	 * Clear the connection timeout timer.
	 */
	private clearConnectionTimeout(): void {
		if (this.connectionTimeoutTimer !== null) {
			clearTimeout(this.connectionTimeoutTimer);
			this.connectionTimeoutTimer = null;
		}
	}

	/**
	 * Notify all error handlers of an error.
	 */
	private notifyError(error: Error): void {
		for (const handler of this.errorHandlers) {
			try {
				handler(error);
			} catch {
				// Don't let one handler break others
			}
		}
	}

	/**
	 * Disconnect from the WebSocket server.
	 * Prevents automatic reconnection.
	 */
	disconnect(): void {
		// Prevent reconnection
		this.skipReconnect = true;
		this.reconnecting = false;

		// Cancel any pending timers
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.clearConnectionTimeout();

		// Stop heartbeat
		this.stopHeartbeat();

		// Clear send buffer (messages will be lost, but that's expected on intentional disconnect)
		this.sendBuffer.length = 0;

		// Close the WebSocket
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.setState('disconnected');
	}

	/**
	 * Subscribe to a message type.
	 *
	 * @template TData - The message data type (inferred from message definition)
	 * @param message - The message definition to subscribe to
	 * @param handler - Handler function called when message is received
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = client.on(IncidentCreated, (data) => {
	 *   console.log('Incident:', data.uuid);
	 * });
	 *
	 * // Later: stop listening
	 * unsubscribe();
	 * ```
	 */
	on<TData>(message: ClientMessageDefinition<TData>, handler: MessageHandler<TData>): () => void {
		const handlers = this.handlers.get(message.name) ?? new Set();
		handlers.add(handler as MessageHandler<unknown>);
		this.handlers.set(message.name, handlers);

		// Return unsubscribe function
		return () => {
			handlers.delete(handler as MessageHandler<unknown>);
			if (handlers.size === 0) {
				this.handlers.delete(message.name);
			}
		};
	}

	/**
	 * Subscribe to connection state changes.
	 *
	 * @param handler - Handler called when connection state changes
	 * @returns Unsubscribe function
	 */
	onStateChange(handler: ConnectionStateHandler): () => void {
		this.stateHandlers.add(handler);
		return () => {
			this.stateHandlers.delete(handler);
		};
	}

	/**
	 * Subscribe to connection errors.
	 *
	 * @param handler - Handler called when a connection error occurs
	 * @returns Unsubscribe function
	 */
	onError(handler: ErrorHandler): () => void {
		this.errorHandlers.add(handler);
		return () => {
			this.errorHandlers.delete(handler);
		};
	}

	/**
	 * Send a control message to the server.
	 * Used for joining rooms, heartbeats, etc.
	 *
	 * If not connected and buffering is enabled, the message will be queued
	 * and sent when the connection is established.
	 *
	 * @param type - Message type
	 * @param payload - Message payload
	 * @param options - Send options
	 * @deprecated Use emit() with typed message definitions instead
	 */
	send(type: string, payload: Record<string, unknown>, options?: { buffer?: boolean }): void {
		const message = JSON.stringify({ type, ...payload });
		const buffer = options?.buffer ?? true; // Default to buffering

		if (this.isConnected && this.ws) {
			this.ws.send(message);
		} else if (buffer) {
			// Buffer message for later
			this.sendBuffer.push(() => {
				if (this.ws && this.ws.readyState === WebSocket.OPEN) {
					this.ws.send(message);
				}
			});
		} else {
			throw new Error('Not connected');
		}
	}

	/**
	 * Emit a typed message to the server.
	 *
	 * Uses message definition for type safety. If not connected and buffering
	 * is enabled, the message will be queued and sent when connection is established.
	 *
	 * @template TData - The message data type (inferred from message definition)
	 * @param message - The message definition
	 * @param data - The message payload (typed)
	 * @param options - Send options
	 *
	 * @example
	 * ```typescript
	 * import { JoinRoom } from '@warpkit/websocket';
	 *
	 * client.emit(JoinRoom, { room: 'account:123' });
	 * ```
	 */
	emit<TData>(message: ClientMessageDefinition<TData>, data: TData, options?: { buffer?: boolean }): void {
		const envelope = JSON.stringify({ type: message.name, ...data });
		const buffer = options?.buffer ?? true; // Default to buffering

		if (this.isConnected && this.ws) {
			this.ws.send(envelope);
		} else if (buffer) {
			// Buffer message for later
			this.sendBuffer.push(() => {
				if (this.ws && this.ws.readyState === WebSocket.OPEN) {
					this.ws.send(envelope);
				}
			});
		} else {
			throw new Error('Not connected');
		}
	}

	/**
	 * Send raw data to the server.
	 *
	 * @param data - Raw message data
	 * @param options - Send options
	 */
	sendRaw(data: string, options?: { buffer?: boolean }): void {
		const buffer = options?.buffer ?? false; // Default to NOT buffering raw data

		if (this.isConnected && this.ws) {
			this.ws.send(data);
		} else if (buffer) {
			this.sendBuffer.push(() => {
				if (this.ws && this.ws.readyState === WebSocket.OPEN) {
					this.ws.send(data);
				}
			});
		} else {
			throw new Error('Not connected');
		}
	}

	/**
	 * Flush the send buffer (called when connection is established).
	 */
	private flushSendBuffer(): void {
		if (!this.isConnected || this.sendBuffer.length === 0) {
			return;
		}

		// Copy and clear buffer first to avoid issues if callbacks add more
		const buffer = [...this.sendBuffer];
		this.sendBuffer.length = 0;

		for (const send of buffer) {
			try {
				send();
			} catch {
				// Don't let one failed send break others
			}
		}
	}

	/**
	 * Join a room/topic to receive messages published to it.
	 * Room memberships are persisted and auto-rejoined on reconnect.
	 *
	 * @param room - Room name to join
	 */
	joinRoom(room: string): void {
		this.rooms.add(room); // Track for auto-rejoin
		if (this.isConnected) {
			this.emit(JoinRoom, { room });
		}
	}

	/**
	 * Leave a room/topic.
	 *
	 * @param room - Room name to leave
	 */
	leaveRoom(room: string): void {
		this.rooms.delete(room);
		if (this.isConnected) {
			this.emit(LeaveRoom, { room });
		}
	}

	/**
	 * Clear all room memberships.
	 * Does not send leave messages to server.
	 */
	clearRooms(): void {
		this.rooms.clear();
	}

	/**
	 * Rejoin all tracked rooms after reconnection.
	 */
	private rejoinRooms(): void {
		for (const room of this.rooms) {
			try {
				this.emit(JoinRoom, { room });
			} catch {
				// Connection may have closed during rejoin
			}
		}
	}

	/**
	 * Handle incoming WebSocket message.
	 */
	private handleMessage(data: string): void {
		// Handle minimal pong frame (single character, like Engine.IO)
		if (data === PONG_FRAME) {
			this.handlePong();
			return;
		}

		try {
			// Use Json.parse for prototype pollution protection
			const envelope = Json.parse<MessageEnvelope>(data);
			this.emitToHandlers(envelope.name, envelope.data, envelope);
		} catch {
			// Ignore malformed messages
		}
	}

	/**
	 * Emit a message to handlers.
	 */
	private emitToHandlers<TData>(name: string, data: TData, envelope: MessageEnvelope<TData>): void {
		const handlers = this.handlers.get(name);
		if (!handlers) {
			return;
		}

		for (const handler of handlers) {
			try {
				(handler as MessageHandler<TData>)(data, envelope);
			} catch {
				// Don't let one handler break others
			}
		}
	}

	/**
	 * Internal emit for connection lifecycle events.
	 */
	private emitInternal(name: string, data: Record<string, unknown>): void {
		const envelope: MessageEnvelope = {
			name,
			data,
			timestamp: Date.now()
		};
		this.emitToHandlers(name, data, envelope);
	}

	/**
	 * Set connection state and notify handlers.
	 */
	private setState(newState: ConnectionState): void {
		if (this.state === newState) {
			return;
		}

		this.state = newState;

		for (const handler of this.stateHandlers) {
			try {
				handler(newState);
			} catch {
				// Don't let one handler break others
			}
		}
	}

	/**
	 * Attempt to reconnect if configured.
	 * Uses full jitter backoff.
	 *
	 * Handles:
	 * - Page visibility - skips reconnect while page is hidden
	 * - Offline detection - waits for online event
	 */
	private maybeReconnect(): void {
		// Don't reconnect if disabled or intentionally disconnected
		if (!this.options.reconnect || this.skipReconnect) {
			return;
		}

		// Don't reconnect while page is hidden
		if (this.pageHidden) {
			return;
		}

		// Don't reconnect while offline - wait for 'online' event
		if (this.deviceWentOffline) {
			return;
		}

		// Check navigator.onLine if available
		if (typeof globalThis !== 'undefined' && 'navigator' in globalThis) {
			const nav = globalThis.navigator as { onLine?: boolean };
			if (nav.onLine === false) {
				this.deviceWentOffline = true;
				return;
			}
		}

		// Don't exceed max attempts (Infinity by default)
		if (this.backoff.attempts >= this.options.maxReconnectAttempts) {
			this.emitInternal('reconnect_failed', { attempts: this.backoff.attempts });
			return;
		}

		// Already reconnecting
		if (this.reconnecting) {
			return;
		}

		this.reconnecting = true;
		this.setState('reconnecting');

		// Calculate delay with full jitter backoff
		const delay = this.backoff.duration();

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			// Reset flag before connect so next close can trigger reconnect
			this.reconnecting = false;

			// Double-check we should still reconnect
			if (this.skipReconnect || this.pageHidden || this.deviceWentOffline) {
				return;
			}

			this.emitInternal('reconnect_attempt', { attempt: this.backoff.attempts });
			this.connect();
		}, delay);
	}

	/**
	 * Set up browser network and visibility events.
	 */
	private setupNetworkEvents(): void {
		// Only set up once, and only in browser environment
		if (this.networkEventsSet) {
			return;
		}

		// Check for browser environment
		const win =
			typeof globalThis !== 'undefined'
				? (globalThis as typeof globalThis & {
						addEventListener?: typeof addEventListener;
						document?: { addEventListener: typeof addEventListener; visibilityState?: string };
					})
				: null;

		if (!win || typeof win.addEventListener !== 'function') {
			return;
		}

		this.networkEventsSet = true;

		// Offline detection - close connection immediately when network is lost
		win.addEventListener('offline', () => {
			this.deviceWentOffline = true;
			if (this.state === 'connected' || this.state === 'connecting') {
				if (this.ws) {
					this.ws.close();
				}
			}
		});

		// Online detection - reconnect immediately when network is restored
		win.addEventListener('online', () => {
			if (this.deviceWentOffline) {
				this.deviceWentOffline = false;
				if (this.reconnectTimer !== null) {
					clearTimeout(this.reconnectTimer);
					this.reconnectTimer = null;
				}
				if (this.state === 'disconnected' || this.state === 'reconnecting') {
					this.reconnecting = false;
					this.connect();
				}
			}
		});

		// Visibility change - skip reconnecting while page is hidden
		if (win.document && typeof win.document.addEventListener === 'function') {
			win.document.addEventListener('visibilitychange', () => {
				if (win.document?.visibilityState === 'hidden') {
					this.pageHidden = true;
				} else {
					this.pageHidden = false;
					if (this.state === 'disconnected' || this.state === 'reconnecting') {
						if (this.reconnectTimer !== null) {
							clearTimeout(this.reconnectTimer);
							this.reconnectTimer = null;
						}
						this.reconnecting = false;
						this.connect();
					}
				}
			});
		}
	}

	// =========================================================================
	// Heartbeat / Keep-alive
	// =========================================================================

	/**
	 * Start the heartbeat interval.
	 */
	private startHeartbeat(): void {
		if (this.options.heartbeatInterval <= 0) {
			return;
		}

		this.stopHeartbeat(); // Clear any existing

		this.heartbeatTimer = setInterval(() => {
			this.sendPing();
		}, this.options.heartbeatInterval);
	}

	/**
	 * Stop the heartbeat interval and timeout.
	 */
	private stopHeartbeat(): void {
		if (this.heartbeatTimer !== null) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		if (this.heartbeatTimeoutTimer !== null) {
			clearTimeout(this.heartbeatTimeoutTimer);
			this.heartbeatTimeoutTimer = null;
		}
		this.awaitingPong = false;
	}

	/**
	 * Send a minimal ping frame and start the timeout timer.
	 * Uses single character for minimal bandwidth.
	 */
	private sendPing(): void {
		if (!this.isConnected || !this.ws || this.awaitingPong) {
			return;
		}

		this.awaitingPong = true;

		try {
			// Minimal ping frame - just 1 byte
			this.ws.send(PING_FRAME);
		} catch {
			// Connection may be dead, let onclose handle it
			return;
		}

		// Start timeout timer if configured
		if (this.options.heartbeatTimeout > 0) {
			this.heartbeatTimeoutTimer = setTimeout(() => {
				this.handlePongTimeout();
			}, this.options.heartbeatTimeout);
		}
	}

	/**
	 * Handle pong response - clear timeout and reset flag.
	 */
	private handlePong(): void {
		this.awaitingPong = false;
		if (this.heartbeatTimeoutTimer !== null) {
			clearTimeout(this.heartbeatTimeoutTimer);
			this.heartbeatTimeoutTimer = null;
		}
	}

	/**
	 * Handle pong timeout - connection is considered dead.
	 */
	private handlePongTimeout(): void {
		this.awaitingPong = false;
		this.heartbeatTimeoutTimer = null;

		// Force close the connection - onclose will trigger reconnect
		if (this.ws) {
			const error = new Error('Heartbeat timeout - no pong received');
			for (const handler of this.errorHandlers) {
				try {
					handler(error);
				} catch {
					// Don't let one handler break others
				}
			}
			this.ws.close();
		}
	}
}

/**
 * Create message definition helpers for internal connection events.
 * These can be used with client.on() for type-safe handling.
 */

/** Message definition for connection established event */
export const Connected: ClientMessageDefinition<{ reconnected?: boolean }> = {
	name: CONNECTED_MESSAGE,
	_data: undefined as unknown as { reconnected?: boolean }
};

/** Message definition for connection lost event */
export const Disconnected: ClientMessageDefinition<Record<string, never>> = {
	name: DISCONNECTED_MESSAGE,
	_data: undefined as unknown as Record<string, never>
};

/** Message definition for reconnect attempt event */
export const ReconnectAttempt: ClientMessageDefinition<{ attempt: number }> = {
	name: 'reconnect_attempt',
	_data: undefined as unknown as { attempt: number }
};

/** Message definition for reconnect failed event */
export const ReconnectFailed: ClientMessageDefinition<{ attempts: number }> = {
	name: 'reconnect_failed',
	_data: undefined as unknown as { attempts: number }
};
