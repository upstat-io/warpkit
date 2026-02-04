import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SocketClient, Connected, Disconnected } from '../src/client';
import type { ClientMessageDefinition, SocketClientOptions } from '../src/types';
import { waitFor, delay } from './test-helpers';
import type { ServerWebSocket } from 'bun';

/** Ping frame constant */
const PING_FRAME = '2';
/** Pong frame constant */
const PONG_FRAME = '3';

/** Socket data type for test server */
interface TestSocketData {
	id: string;
}

/** Server type for our test server */
type TestServer = ReturnType<typeof Bun.serve<TestSocketData>>;

// Track all clients for cleanup between tests
const allClients: SocketClient[] = [];

// Real WebSocket server for testing
let server: TestServer;
let serverPort: number;
let serverSockets: Set<ServerWebSocket<TestSocketData>>;
let receivedMessages: Array<{ socketId: string; data: string }>;

/**
 * Creates a real WebSocket server for testing.
 */
function createTestServer(): TestServer {
	serverSockets = new Set();
	receivedMessages = [];

	return Bun.serve<TestSocketData>({
		port: 0, // Random available port
		fetch(req, server) {
			const url = new URL(req.url);
			if (url.pathname === '/ws') {
				const upgraded = server.upgrade(req, {
					data: { id: crypto.randomUUID() }
				});
				if (!upgraded) {
					return new Response('WebSocket upgrade failed', { status: 400 });
				}
				return undefined;
			}
			return new Response('Not found', { status: 404 });
		},
		websocket: {
			open(ws) {
				serverSockets.add(ws);
			},
			message(ws, message) {
				const data = typeof message === 'string' ? message : message.toString();
				receivedMessages.push({ socketId: ws.data.id, data });

				// Handle ping/pong
				if (data === PING_FRAME) {
					ws.send(PONG_FRAME);
					return;
				}

				// Handle room join/leave (just acknowledge)
				try {
					const parsed = JSON.parse(data);
					// Handle both old format (joinRoom/leaveRoom) and new format (room.join/room.leave)
					if (
						parsed.type === 'joinRoom' ||
						parsed.type === 'leaveRoom' ||
						parsed.type === 'room.join' ||
						parsed.type === 'room.leave'
					) {
						// Server acknowledges room operations
						return;
					}
					// Echo other messages back
					if (parsed.type === 'echo') {
						ws.send(
							JSON.stringify({
								name: 'echo.response',
								data: parsed,
								timestamp: Date.now()
							})
						);
					}
				} catch {
					// Not JSON, ignore
				}
			},
			close(ws) {
				serverSockets.delete(ws);
			}
		}
	});
}

/**
 * Force close all server connections (simulates server restart/disconnect)
 */
function closeAllServerConnections(): void {
	for (const ws of serverSockets) {
		ws.close();
	}
}

/** Message with parsed JSON data */
interface ParsedServerMessage {
	socketId: string;
	data: string;
	parsed: unknown;
}

/**
 * Get messages received by the server for a specific type
 */
function getServerMessages(type?: string): ParsedServerMessage[] {
	return receivedMessages
		.map((m): ParsedServerMessage | null => {
			try {
				return { ...m, parsed: JSON.parse(m.data) };
			} catch {
				return null;
			}
		})
		.filter((m): m is ParsedServerMessage => m !== null)
		.filter((m) => !type || (m.parsed as { type?: string })?.type === type);
}

/**
 * Clear received messages
 */
function clearServerMessages(): void {
	receivedMessages = [];
}

describe('SocketClient with Real WebSocket', () => {
	beforeAll(() => {
		server = createTestServer();
		// Server is created with port: 0, Bun assigns a random port
		serverPort = server.port!;
	});

	afterAll(() => {
		server.stop();
	});

	beforeEach(() => {
		clearServerMessages();
	});

	afterEach(async () => {
		// Clean up all clients
		for (const client of allClients) {
			try {
				client.disconnect();
			} catch {
				// Ignore
			}
		}
		allClients.length = 0;

		// Wait for cleanup
		await delay(50);
	});

	function createClient(options?: SocketClientOptions): SocketClient {
		const client = new SocketClient(`ws://localhost:${serverPort}/ws`, options);
		allClients.push(client);
		return client;
	}

	describe('connection', () => {
		it('should connect to real WebSocket server', async () => {
			const client = createClient();
			client.connect();

			await waitFor(() => client.isConnected, { timeout: 1000 });

			expect(client.connectionState).toBe('connected');
			expect(client.isConnected).toBe(true);
		});

		it('should disconnect from server', async () => {
			const client = createClient();
			client.connect();

			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.disconnect();

			expect(client.connectionState).toBe('disconnected');
			expect(client.isConnected).toBe(false);
		});

		it('should fire Connected event on connect', async () => {
			const client = createClient();
			let connected = false;

			client.on(Connected, () => {
				connected = true;
			});

			client.connect();

			await waitFor(() => connected, { timeout: 1000 });

			expect(connected).toBe(true);
		});

		it('should fire Disconnected event on disconnect', async () => {
			const client = createClient();
			let disconnected = false;

			client.on(Disconnected, () => {
				disconnected = true;
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.disconnect();

			await waitFor(() => disconnected, { timeout: 1000 });

			expect(disconnected).toBe(true);
		});
	});

	describe('room management', () => {
		it('should send joinRoom message to server when connected', async () => {
			const client = createClient();
			client.connect();

			await waitFor(() => client.isConnected, { timeout: 1000 });
			clearServerMessages();

			client.joinRoom('account:123');

			await waitFor(() => getServerMessages('room.join').length > 0, { timeout: 1000 });

			const joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('account:123');
		});

		it('should track joined rooms', async () => {
			const client = createClient();
			client.connect();

			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('room1');
			client.joinRoom('room2');

			expect(client.joinedRooms.has('room1')).toBe(true);
			expect(client.joinedRooms.has('room2')).toBe(true);
			expect(client.joinedRooms.size).toBe(2);
		});

		it('should remove room on leave', async () => {
			const client = createClient();
			client.connect();

			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('room1');
			expect(client.joinedRooms.has('room1')).toBe(true);

			client.leaveRoom('room1');
			expect(client.joinedRooms.has('room1')).toBe(false);
		});
	});

	// =========================================================================
	// ROOM AUTO-REJOIN TESTS - These should expose the bug
	// =========================================================================

	describe('room auto-rejoin on reconnect', () => {
		it('should auto-rejoin rooms after server-initiated disconnect', async () => {
			const client = createClient({
				reconnect: true,
				reconnectDelay: 50,
				maxReconnectDelay: 100
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Join rooms
			client.joinRoom('account:123');
			client.joinRoom('project:456');

			await waitFor(() => getServerMessages('room.join').length === 2, { timeout: 1000 });

			// Clear messages and force disconnect from server side
			clearServerMessages();
			closeAllServerConnections();

			// Wait for reconnect
			await waitFor(() => client.isConnected, { timeout: 2000 });

			// Check that rooms were rejoined
			await waitFor(() => getServerMessages('room.join').length >= 2, { timeout: 1000 });

			const joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(2);

			const rooms = joinMessages.map((m) => (m.parsed as { room: string }).room).sort();
			expect(rooms).toEqual(['account:123', 'project:456']);
		});

		it('should auto-rejoin rooms on every reconnect cycle', async () => {
			const client = createClient({
				reconnect: true,
				reconnectDelay: 50,
				maxReconnectDelay: 100
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Join a room
			client.joinRoom('test-room');
			await waitFor(() => getServerMessages('room.join').length === 1, { timeout: 1000 });

			// First reconnect cycle
			clearServerMessages();
			closeAllServerConnections();
			await waitFor(() => client.isConnected, { timeout: 2000 });
			await waitFor(() => getServerMessages('room.join').length >= 1, { timeout: 1000 });

			let joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('test-room');

			// Second reconnect cycle
			clearServerMessages();
			closeAllServerConnections();
			await waitFor(() => client.isConnected, { timeout: 2000 });
			await waitFor(() => getServerMessages('room.join').length >= 1, { timeout: 1000 });

			joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('test-room');

			// Third reconnect cycle
			clearServerMessages();
			closeAllServerConnections();
			await waitFor(() => client.isConnected, { timeout: 2000 });
			await waitFor(() => getServerMessages('room.join').length >= 1, { timeout: 1000 });

			joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('test-room');
		});

		it('should rejoin rooms added before initial connect', async () => {
			const client = createClient({
				reconnect: true,
				reconnectDelay: 50
			});

			// Add rooms BEFORE connecting
			client.joinRoom('pre-connect-room');

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Check that the room was joined
			await waitFor(() => getServerMessages('room.join').length >= 1, { timeout: 1000 });

			const joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('pre-connect-room');
		});

		it('should rejoin rooms added while disconnected/reconnecting', async () => {
			const client = createClient({
				reconnect: true,
				reconnectDelay: 200, // Longer delay so we can add room while reconnecting
				maxReconnectDelay: 300
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('initial-room');
			await waitFor(() => getServerMessages('room.join').length === 1, { timeout: 1000 });

			// Force disconnect
			clearServerMessages();
			closeAllServerConnections();

			// Wait until we're in reconnecting state
			await waitFor(() => client.connectionState === 'reconnecting', { timeout: 1000 });

			// Add a new room WHILE reconnecting
			client.joinRoom('added-during-reconnect');

			// Wait for reconnect
			await waitFor(() => client.isConnected, { timeout: 2000 });

			// Both rooms should be joined
			await waitFor(() => getServerMessages('room.join').length >= 2, { timeout: 1000 });

			const joinMessages = getServerMessages('room.join');
			const rooms = joinMessages.map((m) => (m.parsed as { room: string }).room).sort();
			expect(rooms).toEqual(['added-during-reconnect', 'initial-room']);
		});

		it('should preserve room list through disconnect (not clear it)', async () => {
			const client = createClient({
				reconnect: true,
				reconnectDelay: 50
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('room1');
			client.joinRoom('room2');

			// Force disconnect
			closeAllServerConnections();

			// Rooms should still be tracked even when disconnected
			await waitFor(() => !client.isConnected, { timeout: 1000 });

			expect(client.joinedRooms.size).toBe(2);
			expect(client.joinedRooms.has('room1')).toBe(true);
			expect(client.joinedRooms.has('room2')).toBe(true);
		});

		it('should NOT clear rooms on explicit disconnect() call', async () => {
			const client = createClient({
				reconnect: false
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('room1');
			client.joinRoom('room2');

			client.disconnect();

			// Rooms should still be tracked
			expect(client.joinedRooms.size).toBe(2);
			expect(client.joinedRooms.has('room1')).toBe(true);
			expect(client.joinedRooms.has('room2')).toBe(true);
		});

		it('should rejoin rooms after manual reconnect following disconnect()', async () => {
			const client = createClient({
				reconnect: false // Manual reconnect
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('room1');
			await waitFor(() => getServerMessages('room.join').length === 1, { timeout: 1000 });

			// Explicit disconnect
			client.disconnect();
			await waitFor(() => !client.isConnected, { timeout: 1000 });

			clearServerMessages();

			// Manual reconnect
			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Room should be rejoined
			await waitFor(() => getServerMessages('room.join').length >= 1, { timeout: 1000 });

			const joinMessages = getServerMessages('room.join');
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('room1');
		});
	});

	describe('heartbeat', () => {
		it('should send heartbeat and receive pong', async () => {
			const client = createClient({
				heartbeatInterval: 100,
				heartbeatTimeout: 500
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Wait for heartbeat
			await waitFor(() => receivedMessages.some((m) => m.data === PING_FRAME), { timeout: 500 });

			expect(receivedMessages.some((m) => m.data === PING_FRAME)).toBe(true);
		});
	});

	describe('message handling', () => {
		it('should receive messages from server', async () => {
			const client = createClient();
			const EchoResponse: ClientMessageDefinition<{ type: string }> = {
				name: 'echo.response',
				_data: undefined as unknown as { type: string }
			};

			let received = false;
			client.on(EchoResponse, () => {
				received = true;
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Send echo message
			client.send('echo', { message: 'test' });

			// Wait for response
			await waitFor(() => received, { timeout: 1000 });

			expect(received).toBe(true);
		});

		it('should sanitize prototype pollution keys from incoming messages', async () => {
			const client = createClient();
			const MaliciousMessage: ClientMessageDefinition<{
				safe: string;
				nested?: { safe: string };
			}> = {
				name: 'malicious.test',
				_data: undefined as unknown as { safe: string; nested?: { safe: string } }
			};

			let receivedData: unknown = null;

			client.on(MaliciousMessage, (data) => {
				receivedData = data;
			});

			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			// Server sends a message with prototype pollution keys
			for (const ws of serverSockets) {
				ws.send(
					JSON.stringify({
						name: 'malicious.test',
						data: {
							safe: 'value',
							__proto__: { admin: true },
							constructor: { polluted: true },
							nested: {
								safe: 'nested-value',
								__proto__: { nestedAdmin: true }
							}
						},
						timestamp: Date.now()
					})
				);
			}

			await waitFor(() => receivedData !== null, { timeout: 1000 });

			// Verify dangerous keys were stripped (check own properties, not prototype chain)
			const data = receivedData as Record<string, unknown>;
			expect(data.safe).toBe('value');
			expect(Object.prototype.hasOwnProperty.call(data, '__proto__')).toBe(false);
			expect(Object.prototype.hasOwnProperty.call(data, 'constructor')).toBe(false);
			expect(Object.prototype.hasOwnProperty.call(data, 'prototype')).toBe(false);
			expect(Object.keys(data)).toEqual(['safe', 'nested']);

			// Verify nested dangerous keys were also stripped
			const nested = data.nested as Record<string, unknown>;
			expect(nested.safe).toBe('nested-value');
			expect(Object.prototype.hasOwnProperty.call(nested, '__proto__')).toBe(false);
			expect(Object.keys(nested)).toEqual(['safe']);

			// Verify prototype was not actually polluted
			const testObj = {};
			expect((testObj as { admin?: boolean }).admin).toBeUndefined();
		});
	});

	describe('debug: exact reconnect flow', () => {
		it('should log exact sequence of events during reconnect', async () => {
			const events: string[] = [];

			const client = createClient({
				reconnect: true,
				reconnectDelay: 50,
				maxReconnectDelay: 100
			});

			client.onStateChange((state) => {
				events.push(`state: ${state}`);
			});

			client.on(Connected, (data) => {
				events.push(`connected: reconnected=${data.reconnected}`);
			});

			client.on(Disconnected, () => {
				events.push('disconnected');
			});

			// Connect and join room
			client.connect();
			await waitFor(() => client.isConnected, { timeout: 1000 });

			client.joinRoom('test-room');
			await waitFor(() => getServerMessages('room.join').length === 1, { timeout: 1000 });
			events.push(`initial joinRoom sent, rooms tracked: ${[...client.joinedRooms].join(',')}`);

			// Clear and force reconnect
			clearServerMessages();
			events.push('forcing server disconnect');
			closeAllServerConnections();

			// Wait for reconnect
			await waitFor(() => client.isConnected, { timeout: 2000 });
			events.push(`reconnected, rooms tracked: ${[...client.joinedRooms].join(',')}`);

			// Wait for room rejoin
			await waitFor(() => getServerMessages('room.join').length >= 1, { timeout: 1000 });

			const joinMessages = getServerMessages('room.join');
			events.push(`server received ${joinMessages.length} joinRoom message(s)`);

			// Verify
			expect(joinMessages.length).toBe(1);
			expect((joinMessages[0]!.parsed as { room: string }).room).toBe('test-room');
		});
	});
});
