/**
 * Control Messages unit tests
 *
 * Tests for client-side message definitions.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ClientMessage, JoinRoom, LeaveRoom, Heartbeat } from './control-messages';
import { isStandardSchema, validate, ValidatedType } from '@warpkit/validation';
import type { ValidatedMessageDefinition } from './types';

describe('ClientMessage', () => {
	describe('define()', () => {
		it('should create a message definition with the given name', () => {
			const TestMessage = ClientMessage.define<{ id: string }>('test.message');
			expect(TestMessage.name).toBe('test.message');
		});

		it('should create a frozen message definition', () => {
			const TestMessage = ClientMessage.define<{ id: string }>('test.message');
			expect(Object.isFrozen(TestMessage)).toBe(true);
		});

		it('should have undefined _data (type carrier only)', () => {
			const TestMessage = ClientMessage.define<{ count: number }>('test.typed');
			expect(TestMessage._data).toBeUndefined();
		});

		it('should create distinct definitions for different names', () => {
			const Message1 = ClientMessage.define<unknown>('message.one');
			const Message2 = ClientMessage.define<unknown>('message.two');

			expect(Message1.name).toBe('message.one');
			expect(Message2.name).toBe('message.two');
			expect(Message1).not.toBe(Message2);
		});

		it('should allow creating definitions with complex types', () => {
			interface ComplexData {
				id: string;
				nested: {
					value: number;
					items: string[];
				};
			}

			const ComplexMessage = ClientMessage.define<ComplexData>('complex.message');
			expect(ComplexMessage.name).toBe('complex.message');
			expect(Object.isFrozen(ComplexMessage)).toBe(true);
		});
	});

	describe('define() with ValidatedType', () => {
		const UserSchema = z.object({
			id: z.string(),
			name: z.string()
		});
		const UserType = ValidatedType.wrap('user', UserSchema);

		it('should create a validated message definition with ValidatedType', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);

			expect(UserMessage.name).toBe('user.message');
			expect(UserMessage.schema).toBe(UserSchema);
		});

		it('should create a frozen validated message definition', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);
			expect(Object.isFrozen(UserMessage)).toBe(true);
		});

		it('should have undefined _data (type carrier only)', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);
			expect(UserMessage._data).toBeUndefined();
		});

		it('should recognize schema as StandardSchema', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);
			expect(isStandardSchema(UserMessage.schema)).toBe(true);
		});

		it('should allow validation using the schema', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);
			const validData = { id: '123', name: 'Alice' };

			const result = validate(UserMessage.schema, validData);
			expect(result).toEqual(validData);
		});

		it('should infer correct types from ValidatedType', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);

			// Type check - this tests compile-time behavior
			const data: typeof UserMessage._data = { id: '123', name: 'Alice' };
			expect(data.id).toBe('123');
			expect(data.name).toBe('Alice');
		});

		it('should work with nested schemas', () => {
			const NestedSchema = z.object({
				user: UserSchema,
				metadata: z.object({
					createdAt: z.number()
				})
			});
			const NestedType = ValidatedType.wrap('nested', NestedSchema);

			const NestedMessage = ClientMessage.define('nested.message', NestedType);
			expect(NestedMessage.name).toBe('nested.message');
			expect(isStandardSchema(NestedMessage.schema)).toBe(true);

			const validData = {
				user: { id: '123', name: 'Alice' },
				metadata: { createdAt: Date.now() }
			};
			const result = validate(NestedMessage.schema, validData);
			expect(result).toEqual(validData);
		});

		it('should satisfy ValidatedMessageDefinition type', () => {
			const UserMessage = ClientMessage.define('user.message', UserType);

			// Type assertion - this tests compile-time behavior
			const validated: ValidatedMessageDefinition<{ id: string; name: string }> = UserMessage;
			expect(validated.name).toBe('user.message');
			expect(validated.schema).toBe(UserSchema);
		});
	});
});

describe('JoinRoom', () => {
	it('should have correct message name', () => {
		expect(JoinRoom.name).toBe('room.join');
	});

	it('should be frozen', () => {
		expect(Object.isFrozen(JoinRoom)).toBe(true);
	});

	it('should have expected type structure', () => {
		// Type check - this tests compile-time behavior
		const data: typeof JoinRoom._data = { room: 'test-room' };
		expect(data.room).toBe('test-room');
	});
});

describe('LeaveRoom', () => {
	it('should have correct message name', () => {
		expect(LeaveRoom.name).toBe('room.leave');
	});

	it('should be frozen', () => {
		expect(Object.isFrozen(LeaveRoom)).toBe(true);
	});

	it('should have expected type structure', () => {
		const data: typeof LeaveRoom._data = { room: 'test-room' };
		expect(data.room).toBe('test-room');
	});
});

describe('Heartbeat', () => {
	it('should have correct message name', () => {
		expect(Heartbeat.name).toBe('heartbeat');
	});

	it('should be frozen', () => {
		expect(Object.isFrozen(Heartbeat)).toBe(true);
	});
});
