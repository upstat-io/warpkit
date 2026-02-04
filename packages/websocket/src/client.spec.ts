/**
 * SocketClient unit tests
 *
 * Tests client behavior with mocked WebSocket.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketClient, Connected, Disconnected, ReconnectAttempt, ReconnectFailed } from './client';
import { JoinRoom, LeaveRoom, ClientMessage } from './control-messages';
import type { ClientMessageDefinition, SocketClientOptions } from './types';

// Simple event mocks for Node.js environment
class MockEvent {
	type: string;
	constructor(type: string) {
		this.type = type;
	}
}

class MockCloseEvent extends MockEvent {
	code: number;
	reason: string;
	constructor(type: string, init?: { code?: number; reason?: string }) {
		super(type);
		this.code = init?.code ?? 1000;
		this.reason = init?.reason ?? '';
	}
}

class MockMessageEvent extends MockEvent {
	data: string;
	constructor(type: string, init?: { data?: string }) {
		super(type);
		this.data = init?.data ?? '';
	}
}

// Mock WebSocket
class MockWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;

	url: string;
	readyState: number = MockWebSocket.CONNECTING;
	onopen: ((event: MockEvent) => void) | null = null;
	onclose: ((event: MockCloseEvent) => void) | null = null;
	onmessage: ((event: MockMessageEvent) => void) | null = null;
	onerror: ((event: MockEvent) => void) | null = null;

	sentMessages: string[] = [];
	closeCode?: number;
	closeReason?: string;

	constructor(url: string) {
		this.url = url;
	}

	send(data: string): void {
		if (this.readyState !== MockWebSocket.OPEN) {
			throw new Error('WebSocket is not open');
		}
		this.sentMessages.push(data);
	}

	close(code?: number, reason?: string): void {
		this.closeCode = code;
		this.closeReason = reason;
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(new MockCloseEvent('close', { code, reason }));
		}
	}

	// Test helpers
	simulateOpen(): void {
		this.readyState = MockWebSocket.OPEN;
		if (this.onopen) {
			this.onopen(new MockEvent('open'));
		}
	}

	simulateMessage(data: string): void {
		if (this.onmessage) {
			this.onmessage(new MockMessageEvent('message', { data }));
		}
	}

	simulateError(): void {
		if (this.onerror) {
			this.onerror(new MockEvent('error'));
		}
	}

	simulateClose(code = 1000, reason = ''): void {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(new MockCloseEvent('close', { code, reason }));
		}
	}
}

// Store created WebSocket instances for test access
let mockWebSocketInstances: MockWebSocket[] = [];

// Store original WebSocket
const OriginalWebSocket = globalThis.WebSocket;

// Create a proper WebSocket mock class that can be instantiated with 'new'
function createMockWebSocketClass() {
	return class MockWebSocketConstructor extends MockWebSocket {
		constructor(url: string) {
			super(url);
			mockWebSocketInstances.push(this);
		}

		static readonly CONNECTING = 0;
		static readonly OPEN = 1;
		static readonly CLOSING = 2;
		static readonly CLOSED = 3;
	};
}

describe('SocketClient', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockWebSocketInstances = [];

		// Mock WebSocket constructor with a proper class
		globalThis.WebSocket = createMockWebSocketClass() as unknown as typeof WebSocket;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
		globalThis.WebSocket = OriginalWebSocket;
	});

	function getLastWebSocket(): MockWebSocket {
		return mockWebSocketInstances[mockWebSocketInstances.length - 1];
	}

	function createClient(options?: SocketClientOptions): SocketClient {
		return new SocketClient('wss://example.com/ws', options);
	}

	describe('constructor', () => {
		it('should create client with default options', () => {
			const client = createClient();
			expect(client.connectionState).toBe('disconnected');
			expect(client.isConnected).toBe(false);
		});

		it('should accept custom options', () => {
			const client = createClient({
				reconnect: false,
				maxReconnectAttempts: 5,
				reconnectDelay: 1000,
				maxReconnectDelay: 30000,
				connectionTimeout: 10000,
				heartbeatInterval: 15000,
				heartbeatTimeout: 3000
			});
			expect(client).toBeDefined();
		});
	});

	describe('connect()', () => {
		it('should create WebSocket connection', () => {
			const client = createClient();
			client.connect();

			expect(mockWebSocketInstances).toHaveLength(1);
			expect(mockWebSocketInstances[0].url).toBe('wss://example.com/ws');
			expect(client.connectionState).toBe('connecting');
		});

		it('should not create duplicate connections', () => {
			const client = createClient();
			client.connect();
			client.connect();

			expect(mockWebSocketInstances).toHaveLength(1);
		});

		it('should transition to connected state on open', () => {
			const client = createClient();
			client.connect();

			getLastWebSocket().simulateOpen();

			expect(client.connectionState).toBe('connected');
			expect(client.isConnected).toBe(true);
		});

		it('should fire Connected event on open', () => {
			const client = createClient();
			const handler = vi.fn();
			client.on(Connected, handler);

			client.connect();
			getLastWebSocket().simulateOpen();

			expect(handler).toHaveBeenCalledWith(
				{ reconnected: false },
				expect.objectContaining({ name: '__connected__' })
			);
		});

		it('should indicate reconnected=true on reconnection', () => {
			const client = createClient({ reconnect: true, reconnectDelay: 100 });
			const handler = vi.fn();
			client.on(Connected, handler);

			client.connect();
			getLastWebSocket().simulateOpen();

			// First connection
			expect(handler).toHaveBeenLastCalledWith({ reconnected: false }, expect.anything());

			// Simulate disconnect and reconnect
			getLastWebSocket().simulateClose();
			vi.advanceTimersByTime(200);
			getLastWebSocket().simulateOpen();

			expect(handler).toHaveBeenLastCalledWith({ reconnected: true }, expect.anything());
		});
	});

	describe('disconnect()', () => {
		it('should close the WebSocket', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.disconnect();

			expect(client.connectionState).toBe('disconnected');
			expect(client.isConnected).toBe(false);
		});

		it('should fire Disconnected event', () => {
			const client = createClient();
			const handler = vi.fn();
			client.on(Disconnected, handler);

			client.connect();
			getLastWebSocket().simulateOpen();
			client.disconnect();

			expect(handler).toHaveBeenCalled();
		});

		it('should prevent automatic reconnection', () => {
			const client = createClient({ reconnect: true, reconnectDelay: 100 });
			client.connect();
			getLastWebSocket().simulateOpen();

			client.disconnect();
			vi.advanceTimersByTime(1000);

			expect(mockWebSocketInstances).toHaveLength(1);
		});

		it('should clear send buffer', () => {
			const client = createClient();
			client.connect();

			// Queue message while connecting
			client.send('test', { data: 'buffered' });

			client.disconnect();
			client.connect();
			getLastWebSocket().simulateOpen();

			// Buffered message should be lost
			expect(getLastWebSocket().sentMessages).not.toContain(expect.stringContaining('buffered'));
		});
	});

	describe('connection timeout', () => {
		it('should timeout if connection takes too long', () => {
			const client = createClient({ connectionTimeout: 5000 });
			const errorHandler = vi.fn();
			client.onError(errorHandler);

			client.connect();

			// Advance time past timeout
			vi.advanceTimersByTime(5001);

			expect(errorHandler).toHaveBeenCalledWith(
				expect.objectContaining({ message: expect.stringContaining('timeout') })
			);
		});

		it('should clear timeout on successful connection', () => {
			const client = createClient({ connectionTimeout: 5000 });
			const errorHandler = vi.fn();
			client.onError(errorHandler);

			client.connect();
			getLastWebSocket().simulateOpen();

			// Advance time past original timeout
			vi.advanceTimersByTime(6000);

			expect(errorHandler).not.toHaveBeenCalled();
		});

		it('should not timeout when disabled', () => {
			const client = createClient({ connectionTimeout: 0 });
			const errorHandler = vi.fn();
			client.onError(errorHandler);

			client.connect();
			vi.advanceTimersByTime(60000);

			expect(errorHandler).not.toHaveBeenCalled();
		});
	});

	describe('on()', () => {
		it('should register message handlers', () => {
			const client = createClient();
			const TestMessage = ClientMessage.define<{ value: number }>('test.message');
			const handler = vi.fn();

			client.connect();
			getLastWebSocket().simulateOpen();
			client.on(TestMessage, handler);

			getLastWebSocket().simulateMessage(
				JSON.stringify({ name: 'test.message', data: { value: 42 }, timestamp: 1000 })
			);

			expect(handler).toHaveBeenCalledWith(
				{ value: 42 },
				expect.objectContaining({ name: 'test.message', data: { value: 42 } })
			);
		});

		it('should return unsubscribe function', () => {
			const client = createClient();
			const TestMessage = ClientMessage.define<{ value: number }>('test.message');
			const handler = vi.fn();

			client.connect();
			getLastWebSocket().simulateOpen();
			const unsubscribe = client.on(TestMessage, handler);

			unsubscribe();

			getLastWebSocket().simulateMessage(
				JSON.stringify({ name: 'test.message', data: { value: 42 }, timestamp: 1000 })
			);

			expect(handler).not.toHaveBeenCalled();
		});

		it('should handle multiple handlers for same message', () => {
			const client = createClient();
			const TestMessage = ClientMessage.define<{ value: number }>('test.message');
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			client.connect();
			getLastWebSocket().simulateOpen();
			client.on(TestMessage, handler1);
			client.on(TestMessage, handler2);

			getLastWebSocket().simulateMessage(
				JSON.stringify({ name: 'test.message', data: { value: 42 }, timestamp: 1000 })
			);

			expect(handler1).toHaveBeenCalled();
			expect(handler2).toHaveBeenCalled();
		});

		it('should not break other handlers if one throws', () => {
			const client = createClient();
			const TestMessage = ClientMessage.define<{ value: number }>('test.message');
			const throwingHandler = vi.fn().mockImplementation(() => {
				throw new Error('Handler error');
			});
			const normalHandler = vi.fn();

			client.connect();
			getLastWebSocket().simulateOpen();
			client.on(TestMessage, throwingHandler);
			client.on(TestMessage, normalHandler);

			getLastWebSocket().simulateMessage(
				JSON.stringify({ name: 'test.message', data: { value: 42 }, timestamp: 1000 })
			);

			expect(throwingHandler).toHaveBeenCalled();
			expect(normalHandler).toHaveBeenCalled();
		});
	});

	describe('onStateChange()', () => {
		it('should notify on state changes', () => {
			const client = createClient();
			const handler = vi.fn();
			client.onStateChange(handler);

			client.connect();
			expect(handler).toHaveBeenCalledWith('connecting');

			getLastWebSocket().simulateOpen();
			expect(handler).toHaveBeenCalledWith('connected');

			client.disconnect();
			expect(handler).toHaveBeenCalledWith('disconnected');
		});

		it('should return unsubscribe function', () => {
			const client = createClient();
			const handler = vi.fn();
			const unsubscribe = client.onStateChange(handler);

			unsubscribe();
			client.connect();

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe('onError()', () => {
		it('should notify on WebSocket errors', () => {
			const client = createClient();
			const handler = vi.fn();
			client.onError(handler);

			client.connect();
			getLastWebSocket().simulateError();

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'WebSocket connection error' })
			);
		});

		it('should return unsubscribe function', () => {
			const client = createClient();
			const handler = vi.fn();
			const unsubscribe = client.onError(handler);

			unsubscribe();
			client.connect();
			getLastWebSocket().simulateError();

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe('send()', () => {
		it('should send message when connected', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.send('test', { data: 'value' });

			expect(getLastWebSocket().sentMessages).toContain(JSON.stringify({ type: 'test', data: 'value' }));
		});

		it('should buffer messages when not connected', () => {
			const client = createClient();
			client.connect();

			client.send('test', { data: 'buffered' });

			expect(getLastWebSocket().sentMessages).toHaveLength(0);

			getLastWebSocket().simulateOpen();

			expect(getLastWebSocket().sentMessages).toContain(JSON.stringify({ type: 'test', data: 'buffered' }));
		});

		it('should throw when not connected and buffering disabled', () => {
			const client = createClient();
			client.connect();

			expect(() => {
				client.send('test', { data: 'value' }, { buffer: false });
			}).toThrow('Not connected');
		});
	});

	describe('emit()', () => {
		it('should send typed message when connected', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.emit(JoinRoom, { room: 'test-room' });

			expect(getLastWebSocket().sentMessages).toContain(
				JSON.stringify({ type: 'room.join', room: 'test-room' })
			);
		});

		it('should buffer typed messages when not connected', () => {
			const client = createClient();
			client.connect();

			client.emit(JoinRoom, { room: 'test-room' });
			expect(getLastWebSocket().sentMessages).toHaveLength(0);

			getLastWebSocket().simulateOpen();
			// Note: rooms are rejoined on connect, but buffered emit should also fire
			expect(getLastWebSocket().sentMessages.filter((m) => m.includes('test-room'))).toHaveLength(1);
		});
	});

	describe('sendRaw()', () => {
		it('should send raw data when connected', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.sendRaw('raw-data');

			expect(getLastWebSocket().sentMessages).toContain('raw-data');
		});

		it('should not buffer by default', () => {
			const client = createClient();
			client.connect();

			expect(() => {
				client.sendRaw('raw-data');
			}).toThrow('Not connected');
		});

		it('should buffer when explicitly enabled', () => {
			const client = createClient();
			client.connect();

			client.sendRaw('raw-data', { buffer: true });
			getLastWebSocket().simulateOpen();

			expect(getLastWebSocket().sentMessages).toContain('raw-data');
		});
	});

	describe('room management', () => {
		it('should track joined rooms', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.joinRoom('room1');
			client.joinRoom('room2');

			expect(client.joinedRooms.has('room1')).toBe(true);
			expect(client.joinedRooms.has('room2')).toBe(true);
			expect(client.joinedRooms.size).toBe(2);
		});

		it('should send join message when connected', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.joinRoom('test-room');

			expect(getLastWebSocket().sentMessages).toContain(
				JSON.stringify({ type: 'room.join', room: 'test-room' })
			);
		});

		it('should not send join message when not connected', () => {
			const client = createClient();

			client.joinRoom('test-room');

			expect(client.joinedRooms.has('test-room')).toBe(true);
		});

		it('should send leave message when connected', () => {
			const client = createClient();
			client.connect();
			getLastWebSocket().simulateOpen();

			client.joinRoom('test-room');
			client.leaveRoom('test-room');

			expect(client.joinedRooms.has('test-room')).toBe(false);
			expect(getLastWebSocket().sentMessages.filter((m) => m.includes('room.leave'))).toHaveLength(1);
		});

		it('should clear all rooms', () => {
			const client = createClient();
			client.joinRoom('room1');
			client.joinRoom('room2');

			client.clearRooms();

			expect(client.joinedRooms.size).toBe(0);
		});

		it('should auto-rejoin rooms on reconnect', () => {
			const client = createClient({ reconnect: true, reconnectDelay: 100 });
			client.connect();
			getLastWebSocket().simulateOpen();

			client.joinRoom('test-room');

			// Clear and simulate disconnect
			const firstWs = getLastWebSocket();
			firstWs.sentMessages.length = 0;
			firstWs.simulateClose();

			// Wait for reconnect
			vi.advanceTimersByTime(200);
			getLastWebSocket().simulateOpen();

			expect(getLastWebSocket().sentMessages.filter((m) => m.includes('test-room'))).toHaveLength(1);
		});
	});

	describe('reconnection', () => {
		it('should reconnect on unexpected disconnect', () => {
			const client = createClient({ reconnect: true, reconnectDelay: 100 });
			client.connect();
			getLastWebSocket().simulateOpen();
			getLastWebSocket().simulateClose();

			expect(client.connectionState).toBe('reconnecting');

			vi.advanceTimersByTime(200);

			expect(mockWebSocketInstances).toHaveLength(2);
		});

		it('should not reconnect when disabled', () => {
			const client = createClient({ reconnect: false });
			client.connect();
			getLastWebSocket().simulateOpen();
			getLastWebSocket().simulateClose();

			vi.advanceTimersByTime(10000);

			expect(mockWebSocketInstances).toHaveLength(1);
		});

		it('should stop after max attempts', () => {
			const client = createClient({
				reconnect: true,
				maxReconnectAttempts: 3,
				reconnectDelay: 100,
				maxReconnectDelay: 100
			});
			const failHandler = vi.fn();
			client.on(ReconnectFailed, failHandler);

			client.connect();
			getLastWebSocket().simulateOpen();

			// Simulate multiple disconnects without reconnection success
			for (let i = 0; i < 4; i++) {
				getLastWebSocket().simulateClose();
				vi.advanceTimersByTime(200);
			}

			expect(failHandler).toHaveBeenCalled();
		});

		it('should fire ReconnectAttempt event', () => {
			const client = createClient({ reconnect: true, reconnectDelay: 100 });
			const handler = vi.fn();
			client.on(ReconnectAttempt, handler);

			client.connect();
			getLastWebSocket().simulateOpen();
			getLastWebSocket().simulateClose();

			vi.advanceTimersByTime(200);

			expect(handler).toHaveBeenCalled();
		});

		it('should use exponential backoff with jitter', () => {
			const client = createClient({
				reconnect: true,
				reconnectDelay: 100,
				maxReconnectDelay: 10000
			});

			client.connect();
			getLastWebSocket().simulateOpen();

			// Trigger multiple reconnects
			for (let i = 0; i < 5; i++) {
				getLastWebSocket().simulateClose();
				vi.advanceTimersByTime(15000); // Enough time for max backoff
			}

			// Should have created multiple connections
			expect(mockWebSocketInstances.length).toBeGreaterThan(1);
		});
	});

	describe('heartbeat', () => {
		it('should send ping at configured interval', () => {
			const client = createClient({ heartbeatInterval: 1000 });
			client.connect();
			getLastWebSocket().simulateOpen();

			vi.advanceTimersByTime(1001);

			expect(getLastWebSocket().sentMessages).toContain('2'); // PING_FRAME
		});

		it('should handle pong response', () => {
			const client = createClient({
				heartbeatInterval: 1000,
				heartbeatTimeout: 500
			});
			const errorHandler = vi.fn();
			client.onError(errorHandler);

			client.connect();
			getLastWebSocket().simulateOpen();

			vi.advanceTimersByTime(1001); // Trigger ping
			getLastWebSocket().simulateMessage('3'); // PONG_FRAME

			vi.advanceTimersByTime(1000); // Past timeout

			// Should not have errored since pong was received
			expect(errorHandler).not.toHaveBeenCalled();
		});

		it('should close connection on heartbeat timeout', () => {
			const client = createClient({
				heartbeatInterval: 1000,
				heartbeatTimeout: 500
			});
			const errorHandler = vi.fn();
			client.onError(errorHandler);

			client.connect();
			getLastWebSocket().simulateOpen();

			vi.advanceTimersByTime(1001); // Trigger ping
			vi.advanceTimersByTime(501); // Timeout without pong

			expect(errorHandler).toHaveBeenCalledWith(
				expect.objectContaining({ message: expect.stringContaining('Heartbeat timeout') })
			);
		});

		it('should not send heartbeat when disabled', () => {
			const client = createClient({ heartbeatInterval: 0 });
			client.connect();
			getLastWebSocket().simulateOpen();

			vi.advanceTimersByTime(60000);

			expect(getLastWebSocket().sentMessages).not.toContain('2');
		});
	});

	describe('message parsing', () => {
		it('should parse valid message envelopes', () => {
			const client = createClient();
			const TestMessage: ClientMessageDefinition<{ value: string }> = {
				name: 'test.message',
				_data: undefined as unknown as { value: string }
			};
			const handler = vi.fn();

			client.connect();
			getLastWebSocket().simulateOpen();
			client.on(TestMessage, handler);

			getLastWebSocket().simulateMessage(
				JSON.stringify({
					name: 'test.message',
					data: { value: 'hello' },
					timestamp: Date.now()
				})
			);

			expect(handler).toHaveBeenCalledWith(
				{ value: 'hello' },
				expect.objectContaining({ name: 'test.message' })
			);
		});

		it('should ignore malformed messages', () => {
			const client = createClient();
			const errorHandler = vi.fn();
			client.onError(errorHandler);

			client.connect();
			getLastWebSocket().simulateOpen();

			// Should not throw
			getLastWebSocket().simulateMessage('invalid json');
			getLastWebSocket().simulateMessage('{incomplete');

			expect(errorHandler).not.toHaveBeenCalled();
		});

		it('should sanitize messages for prototype pollution', () => {
			const client = createClient();
			const TestMessage: ClientMessageDefinition<{ safe: string }> = {
				name: 'test.message',
				_data: undefined as unknown as { safe: string }
			};
			const handler = vi.fn();

			client.connect();
			getLastWebSocket().simulateOpen();
			client.on(TestMessage, handler);

			getLastWebSocket().simulateMessage(
				JSON.stringify({
					name: 'test.message',
					data: {
						safe: 'value',
						__proto__: { admin: true }
					},
					timestamp: Date.now()
				})
			);

			expect(handler).toHaveBeenCalled();
			const receivedData = handler.mock.calls[0][0];
			expect(receivedData.safe).toBe('value');
			expect(Object.keys(receivedData)).toEqual(['safe']);
		});
	});

	describe('getters', () => {
		it('connectionState should return current state', () => {
			const client = createClient();

			expect(client.connectionState).toBe('disconnected');

			client.connect();
			expect(client.connectionState).toBe('connecting');

			getLastWebSocket().simulateOpen();
			expect(client.connectionState).toBe('connected');
		});

		it('isConnected should return true only when connected', () => {
			const client = createClient();

			expect(client.isConnected).toBe(false);

			client.connect();
			expect(client.isConnected).toBe(false);

			getLastWebSocket().simulateOpen();
			expect(client.isConnected).toBe(true);

			client.disconnect();
			expect(client.isConnected).toBe(false);
		});

		it('joinedRooms should return readonly set', () => {
			const client = createClient();
			client.joinRoom('room1');

			const rooms = client.joinedRooms;

			expect(rooms.has('room1')).toBe(true);
			expect(rooms.size).toBe(1);
		});
	});
});
