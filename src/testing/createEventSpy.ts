/**
 * Event Spy Factory for Testing
 *
 * Creates an event spy that tracks emitted events for assertions.
 * Use with EventEmitter.on() to capture events, then assert on them.
 */

import type { EventHandler, EventRegistry, WarpKitEventRegistry } from '../events/types.js';

/**
 * Recorded event call with event name and payload.
 */
export interface EventCall<R extends EventRegistry, K extends keyof R = keyof R> {
	/** The event name */
	event: K;
	/** The event payload (unknown for heterogeneous storage) */
	payload: unknown;
}

/**
 * Event spy for testing event emissions.
 *
 * Use `forEvent()` to create a handler for a specific event.
 * The spy tracks all events passed through its handlers, allowing assertions.
 *
 * @typeParam R - Event registry type
 */
export interface EventSpy<R extends EventRegistry = EventRegistry> {
	/** All recorded event calls */
	readonly calls: Array<EventCall<R>>;

	/**
	 * Create a handler for a specific event.
	 *
	 * Register this with EventEmitter.on() to track emissions.
	 *
	 * @param event - The event name to track
	 * @returns Handler function that records calls
	 *
	 * @example
	 * ```typescript
	 * const spy = createEventSpy();
	 * events.on('auth:signed-in', spy.forEvent('auth:signed-in'));
	 * ```
	 */
	forEvent<K extends keyof R>(event: K): EventHandler<R[K]>;

	/**
	 * Check if an event was emitted, optionally with a specific payload.
	 *
	 * @param event - The event name to check
	 * @param payload - Optional payload to match (deep equality via JSON.stringify)
	 * @returns True if event was emitted with matching payload
	 *
	 * @example
	 * ```typescript
	 * expect(spy.calledWith('auth:signed-in')).toBe(true);
	 * expect(spy.calledWith('auth:signed-in', { userId: 'test' })).toBe(true);
	 * ```
	 */
	calledWith<K extends keyof R>(event: K, payload?: R[K]): boolean;

	/**
	 * Count how many times an event was emitted.
	 *
	 * @param event - The event name to count
	 * @returns Number of times the event was emitted
	 *
	 * @example
	 * ```typescript
	 * expect(spy.calledTimes('auth:signed-in')).toBe(1);
	 * ```
	 */
	calledTimes(event: keyof R): number;

	/**
	 * Get all calls for a specific event.
	 *
	 * @param event - The event name to filter by
	 * @returns Array of payloads for that event
	 *
	 * @example
	 * ```typescript
	 * const signInCalls = spy.getCallsForEvent('auth:signed-in');
	 * expect(signInCalls[0]).toEqual({ userId: 'test' });
	 * ```
	 */
	getCallsForEvent<K extends keyof R>(event: K): Array<R[K]>;

	/**
	 * Clear all recorded events.
	 *
	 * Call between tests to reset state.
	 *
	 * @example
	 * ```typescript
	 * afterEach(() => {
	 *   spy.clear();
	 * });
	 * ```
	 */
	clear(): void;
}

/**
 * Creates an event spy for testing.
 *
 * @typeParam R - Event registry type (defaults to WarpKitEventRegistry)
 * @returns A new EventSpy instance
 *
 * @example
 * ```typescript
 * import { createMockEvents, createEventSpy } from '@warpkit/core/testing';
 *
 * describe('MyComponent', () => {
 *   it('should emit event on action', () => {
 *     const events = createMockEvents();
 *     const spy = createEventSpy();
 *
 *     // Register spy handler
 *     events.on('auth:signed-in', spy.forEvent('auth:signed-in'));
 *
 *     // Trigger the event
 *     events.emit('auth:signed-in', { userId: 'test-123' });
 *
 *     // Assert
 *     expect(spy.calledWith('auth:signed-in')).toBe(true);
 *     expect(spy.calledWith('auth:signed-in', { userId: 'test-123' })).toBe(true);
 *     expect(spy.calledTimes('auth:signed-in')).toBe(1);
 *   });
 * });
 * ```
 */
export function createEventSpy<R extends EventRegistry = WarpKitEventRegistry>(): EventSpy<R> {
	const calls: Array<EventCall<R>> = [];

	return {
		get calls() {
			return calls;
		},

		forEvent<K extends keyof R>(event: K): EventHandler<R[K]> {
			return (payload: R[K]) => {
				calls.push({ event, payload });
			};
		},

		calledWith<K extends keyof R>(event: K, payload?: R[K]): boolean {
			return calls.some(
				(call) =>
					call.event === event &&
					(payload === undefined || JSON.stringify(call.payload) === JSON.stringify(payload))
			);
		},

		calledTimes(event: keyof R): number {
			return calls.filter((call) => call.event === event).length;
		},

		getCallsForEvent<K extends keyof R>(event: K): Array<R[K]> {
			return calls.filter((call) => call.event === event).map((call) => call.payload as R[K]);
		},

		clear(): void {
			calls.length = 0;
		}
	};
}
