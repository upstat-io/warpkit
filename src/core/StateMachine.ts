/**
 * StateMachine - Simple FSM for tracking app state
 *
 * Intentionally simple - just tracks which state we're in.
 * This is a plain TypeScript class (NOT a .svelte.ts file) for testability.
 * WarpKit mirrors state values as $state for Svelte 5 reactivity.
 *
 * Key features:
 * - stateId increments on every transition for cancellation detection
 * - Listeners notified on every transition
 * - Same-state transitions are allowed (increments stateId)
 */

import type { StateTransition } from '../core/types.js';

/**
 * Simple finite state machine for app-level state management.
 * Tracks current state and notifies listeners on transitions.
 */
export class StateMachine<TAppState extends string> {
	private currentState: TAppState;
	private stateId: number = 0;
	private listeners = new Set<(transition: StateTransition<TAppState>) => void>();

	/**
	 * Create a StateMachine with the given initial state.
	 * @param initialState - The starting application state
	 */
	public constructor(initialState: TAppState) {
		this.currentState = initialState;
	}

	/**
	 * Get the current state.
	 */
	public getState(): TAppState {
		return this.currentState;
	}

	/**
	 * State ID increments on every state change.
	 * Used by Navigator to detect stale navigations during state transitions.
	 */
	public getStateId(): number {
		return this.stateId;
	}

	/**
	 * Transition to a new state.
	 *
	 * Note: Same-state transitions are allowed.
	 * This increments stateId and triggers listeners even if state hasn't changed.
	 * Consumer can check previous === current if they want to short-circuit.
	 */
	public setState(newState: TAppState): StateTransition<TAppState> {
		const previous = this.currentState;

		this.currentState = newState;
		this.stateId++;

		const transition: StateTransition<TAppState> = {
			previous,
			current: newState,
			id: this.stateId,
			timestamp: Date.now()
		};

		// Notify listeners (catch errors to prevent blocking other listeners)
		for (const listener of this.listeners) {
			try {
				listener(transition);
			} catch (error) {
				console.error('[WarpKit] State listener threw error:', error);
			}
		}

		return transition;
	}

	/**
	 * Subscribe to state transitions.
	 * Returns an unsubscribe function.
	 */
	public subscribe(listener: (transition: StateTransition<TAppState>) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}
