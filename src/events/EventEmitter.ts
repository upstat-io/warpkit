/**
 * WarpKit v2 EventEmitter Implementation
 *
 * Type-safe event emitter with error isolation.
 * Handlers that throw do not affect other handlers.
 */

import type { EventEmitterAPI, EventHandler, EventRegistry } from './types.js';

// ============================================================================
// EventEmitter Class
// ============================================================================

/**
 * Type-safe event emitter with error isolation.
 *
 * Features:
 * - Type-safe event names and payloads via generic registry
 * - Error isolation: handler errors don't break other handlers
 * - Async handler support with error logging
 * - Mutation-safe iteration (handlers copied before emit)
 *
 * @example
 * interface MyEvents extends EventRegistry {
 *   'user:signed-in': { userId: string };
 *   'user:signed-out': void;
 * }
 *
 * const emitter = new EventEmitter<MyEvents>();
 *
 * const off = emitter.on('user:signed-in', (payload) => {
 *   console.log('User signed in:', payload.userId);
 * });
 *
 * emitter.emit('user:signed-in', { userId: '123' });
 * off(); // Unsubscribe
 */
export class EventEmitter<R extends EventRegistry = EventRegistry> implements EventEmitterAPI<R> {
	private handlers = new Map<keyof R, Set<EventHandler<unknown>>>();

	/**
	 * Subscribe to an event.
	 * @param event - Event name to subscribe to
	 * @param handler - Function called when event is emitted
	 * @returns Unsubscribe function
	 */
	public on<K extends keyof R>(event: K, handler: EventHandler<R[K]>): () => void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, new Set());
		}
		const set = this.handlers.get(event)!;
		set.add(handler as EventHandler<unknown>);

		return () => set.delete(handler as EventHandler<unknown>);
	}

	/**
	 * Subscribe to an event once.
	 * Handler is automatically removed after first invocation.
	 * @param event - Event name to subscribe to
	 * @param handler - Function called when event is emitted (once)
	 * @returns Unsubscribe function
	 */
	public once<K extends keyof R>(event: K, handler: EventHandler<R[K]>): () => void {
		const wrapper = ((payload: R[K]) => {
			this.off(event, wrapper as EventHandler<R[K]>);
			return handler(payload);
		}) as EventHandler<R[K]>;

		return this.on(event, wrapper);
	}

	/**
	 * Unsubscribe a specific handler from an event.
	 * @param event - Event name to unsubscribe from
	 * @param handler - The handler function to remove
	 */
	public off<K extends keyof R>(event: K, handler: EventHandler<R[K]>): void {
		const set = this.handlers.get(event);
		if (set) {
			set.delete(handler as EventHandler<unknown>);
		}
	}

	/**
	 * Emit an event with optional payload.
	 * Events with void payload require no second argument.
	 * Events with data payload require the payload argument.
	 *
	 * Error handling: Each handler is called in a try/catch.
	 * If a handler throws, the error is logged and other handlers still execute.
	 *
	 * @param event - Event name to emit
	 * @param args - Payload (required for events with data, omit for void events)
	 */
	public emit<K extends keyof R>(event: K, ...args: R[K] extends void ? [] : [payload: R[K]]): void {
		const set = this.handlers.get(event);
		if (!set) return;

		const payload = args[0] as R[K];
		// Copy handlers to prevent modification during iteration
		const handlers = [...set];

		for (const handler of handlers) {
			try {
				const result = handler(payload);
				if (result instanceof Promise) {
					result.catch((error) => {
						console.error(`[WarpKit Events] Async handler error for '${String(event)}':`, error);
					});
				}
			} catch (error) {
				console.error(`[WarpKit Events] Handler error for '${String(event)}':`, error);
			}
		}
	}

	/**
	 * Remove all handlers for a specific event.
	 * @param event - Event name to clear handlers for
	 */
	public clear(event: keyof R): void {
		this.handlers.delete(event);
	}

	/**
	 * Remove all handlers for all events.
	 */
	public clearAll(): void {
		this.handlers.clear();
	}

	/**
	 * Get the number of handlers for an event.
	 * @param event - Event name to count handlers for
	 * @returns Number of registered handlers
	 */
	public listenerCount(event: keyof R): number {
		return this.handlers.get(event)?.size ?? 0;
	}

	/**
	 * Get all event names that have handlers.
	 * @returns Array of event names with at least one handler
	 */
	public eventNames(): Array<keyof R> {
		return [...this.handlers.keys()];
	}
}
