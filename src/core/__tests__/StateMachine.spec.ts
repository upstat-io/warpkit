/**
 * StateMachine Unit Tests
 *
 * Tests state transitions, stateId tracking, and listener notifications.
 */
import { describe, it, expect, mock } from 'bun:test';
import { StateMachine } from '../StateMachine';

type TestState = 'initializing' | 'unauthenticated' | 'authenticated';

describe('StateMachine', () => {
	describe('constructor', () => {
		it('should initialize with given state', () => {
			const machine = new StateMachine<TestState>('initializing');
			expect(machine.getState()).toBe('initializing');
		});

		it('should initialize stateId to 0', () => {
			const machine = new StateMachine<TestState>('initializing');
			expect(machine.getStateId()).toBe(0);
		});
	});

	describe('getState', () => {
		it('should return current state', () => {
			const machine = new StateMachine<TestState>('unauthenticated');
			expect(machine.getState()).toBe('unauthenticated');
		});
	});

	describe('getStateId', () => {
		it('should return current state ID', () => {
			const machine = new StateMachine<TestState>('initializing');
			expect(machine.getStateId()).toBe(0);

			machine.setState('authenticated');
			expect(machine.getStateId()).toBe(1);
		});
	});

	describe('setState', () => {
		it('should update current state', () => {
			const machine = new StateMachine<TestState>('initializing');
			machine.setState('authenticated');
			expect(machine.getState()).toBe('authenticated');
		});

		it('should increment stateId on each transition', () => {
			const machine = new StateMachine<TestState>('initializing');
			expect(machine.getStateId()).toBe(0);

			machine.setState('unauthenticated');
			expect(machine.getStateId()).toBe(1);

			machine.setState('authenticated');
			expect(machine.getStateId()).toBe(2);

			machine.setState('unauthenticated');
			expect(machine.getStateId()).toBe(3);
		});

		it('should return StateTransition with correct fields', () => {
			const machine = new StateMachine<TestState>('initializing');
			const beforeTime = Date.now();
			const transition = machine.setState('authenticated');
			const afterTime = Date.now();

			expect(transition.previous).toBe('initializing');
			expect(transition.current).toBe('authenticated');
			expect(transition.id).toBe(1);
			expect(transition.timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(transition.timestamp).toBeLessThanOrEqual(afterTime);
		});

		it('should allow same-state transitions', () => {
			const machine = new StateMachine<TestState>('authenticated');
			const initialId = machine.getStateId();

			const transition = machine.setState('authenticated');

			expect(transition.previous).toBe('authenticated');
			expect(transition.current).toBe('authenticated');
			expect(machine.getStateId()).toBe(initialId + 1);
		});

		it('should increment stateId even for same-state transitions', () => {
			const machine = new StateMachine<TestState>('authenticated');
			expect(machine.getStateId()).toBe(0);

			machine.setState('authenticated');
			expect(machine.getStateId()).toBe(1);

			machine.setState('authenticated');
			expect(machine.getStateId()).toBe(2);
		});
	});

	describe('subscribe', () => {
		it('should notify listener on state change', () => {
			const machine = new StateMachine<TestState>('initializing');
			const listener = mock(() => {});

			machine.subscribe(listener);
			machine.setState('authenticated');

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith({
				previous: 'initializing',
				current: 'authenticated',
				id: 1,
				timestamp: expect.any(Number)
			});
		});

		it('should notify multiple listeners', () => {
			const machine = new StateMachine<TestState>('initializing');
			const listener1 = mock(() => {});
			const listener2 = mock(() => {});

			machine.subscribe(listener1);
			machine.subscribe(listener2);
			machine.setState('authenticated');

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
		});

		it('should notify listener for every transition', () => {
			const machine = new StateMachine<TestState>('initializing');
			const listener = mock(() => {});

			machine.subscribe(listener);
			machine.setState('unauthenticated');
			machine.setState('authenticated');
			machine.setState('unauthenticated');

			expect(listener).toHaveBeenCalledTimes(3);
		});

		it('should notify listener for same-state transitions', () => {
			const machine = new StateMachine<TestState>('authenticated');
			const listener = mock(() => {});

			machine.subscribe(listener);
			machine.setState('authenticated');

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					previous: 'authenticated',
					current: 'authenticated'
				})
			);
		});

		it('should return unsubscribe function', () => {
			const machine = new StateMachine<TestState>('initializing');
			const listener = mock(() => {});

			const unsubscribe = machine.subscribe(listener);
			machine.setState('authenticated');
			expect(listener).toHaveBeenCalledTimes(1);

			unsubscribe();
			machine.setState('unauthenticated');
			expect(listener).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should handle unsubscribe called multiple times', () => {
			const machine = new StateMachine<TestState>('initializing');
			const listener = mock(() => {});

			const unsubscribe = machine.subscribe(listener);
			unsubscribe();
			unsubscribe(); // Should not throw
			unsubscribe();

			machine.setState('authenticated');
			expect(listener).not.toHaveBeenCalled();
		});

		it('should continue notifying other listeners after one unsubscribes', () => {
			const machine = new StateMachine<TestState>('initializing');
			const listener1 = mock(() => {});
			const listener2 = mock(() => {});

			const unsubscribe1 = machine.subscribe(listener1);
			machine.subscribe(listener2);

			machine.setState('unauthenticated');
			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);

			unsubscribe1();

			machine.setState('authenticated');
			expect(listener1).toHaveBeenCalledTimes(1); // Not called again
			expect(listener2).toHaveBeenCalledTimes(2); // Still receiving updates
		});
	});

	describe('stateId for cancellation detection', () => {
		it('should provide unique ID for detecting stale navigations', () => {
			const machine = new StateMachine<TestState>('initializing');

			// Simulate navigation starting
			const navigationStartStateId = machine.getStateId();

			// State changes mid-navigation
			machine.setState('authenticated');

			// Navigation checks if it's stale
			const currentStateId = machine.getStateId();
			expect(currentStateId).not.toBe(navigationStartStateId);
		});

		it('should have stable ID when state does not change', () => {
			const machine = new StateMachine<TestState>('authenticated');
			const id1 = machine.getStateId();
			const id2 = machine.getStateId();
			const id3 = machine.getStateId();

			expect(id1).toBe(id2);
			expect(id2).toBe(id3);
		});
	});

	describe('type safety', () => {
		it('should enforce state type at compile time', () => {
			type StrictState = 'a' | 'b' | 'c';
			const machine = new StateMachine<StrictState>('a');

			// These should compile
			machine.setState('b');
			machine.setState('c');
			machine.setState('a');

			expect(machine.getState()).toBe('a');
		});
	});
});
