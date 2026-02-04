/**
 * WarpKit v2 Event System Types
 *
 * Type definitions for the pub/sub event system.
 * Provides compile-time safety for event names and payloads.
 */

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Base interface for event registries.
 * Consumers can extend this to define custom events.
 *
 * @example
 * interface MyEvents extends EventRegistry {
 *   'user:logged-in': { userId: string };
 *   'user:logged-out': void;
 * }
 */
export interface EventRegistry {
	[event: string]: unknown;
}

/**
 * Built-in WarpKit events.
 *
 * Naming convention: `namespace:event-name` (lowercase kebab-case)
 *
 * Consumers can extend this interface via module augmentation:
 * @example
 * declare module '@warpkit/core' {
 *   interface WarpKitEventRegistry {
 *     'monitor:created': { uuid: string };
 *     'monitor:updated': { uuid: string };
 *   }
 * }
 */
export interface WarpKitEventRegistry extends EventRegistry {
	// Auth events
	'auth:signed-in': { userId: string };
	'auth:signed-out': void;
	'auth:token-refreshed': void;

	// App state events
	'app:state-changed': { from: string; to: string };
	'app:error': { error: Error; context?: string };

	// Query events (emitted by useQuery internally)
	'query:invalidated': { key: string; params?: Record<string, string> };
	'query:fetched': { key: string; fromCache: boolean };
}

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Event handler function type.
 * Can be synchronous or return a Promise.
 *
 * @example
 * // Synchronous handler
 * const handler: EventHandler<{ userId: string }> = (payload) => {
 *   console.log('User signed in:', payload.userId);
 * };
 *
 * // Async handler
 * const asyncHandler: EventHandler<{ userId: string }> = async (payload) => {
 *   await saveToDatabase(payload.userId);
 * };
 */
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

// ============================================================================
// EventEmitter API
// ============================================================================

/**
 * Public API interface for EventEmitter.
 * Generic over the event registry for type-safe event names and payloads.
 */
export interface EventEmitterAPI<R extends EventRegistry = EventRegistry> {
	/**
	 * Subscribe to an event.
	 * @param event - Event name to subscribe to
	 * @param handler - Function called when event is emitted
	 * @returns Unsubscribe function
	 */
	on<K extends keyof R>(event: K, handler: EventHandler<R[K]>): () => void;

	/**
	 * Subscribe to an event once.
	 * Handler is automatically removed after first invocation.
	 * @param event - Event name to subscribe to
	 * @param handler - Function called when event is emitted (once)
	 * @returns Unsubscribe function
	 */
	once<K extends keyof R>(event: K, handler: EventHandler<R[K]>): () => void;

	/**
	 * Unsubscribe a specific handler from an event.
	 * @param event - Event name to unsubscribe from
	 * @param handler - The handler function to remove
	 */
	off<K extends keyof R>(event: K, handler: EventHandler<R[K]>): void;

	/**
	 * Emit an event with optional payload.
	 * Events with void payload require no second argument.
	 * Events with data payload require the payload argument.
	 * @param event - Event name to emit
	 * @param args - Payload (required for events with data, omit for void events)
	 */
	emit<K extends keyof R>(event: K, ...args: R[K] extends void ? [] : [payload: R[K]]): void;

	/**
	 * Remove all handlers for a specific event.
	 * @param event - Event name to clear handlers for
	 */
	clear(event: keyof R): void;

	/**
	 * Remove all handlers for all events.
	 */
	clearAll(): void;

	/**
	 * Get the number of handlers for an event.
	 * @param event - Event name to count handlers for
	 * @returns Number of registered handlers
	 */
	listenerCount(event: keyof R): number;

	/**
	 * Get all event names that have handlers.
	 * @returns Array of event names with at least one handler
	 */
	eventNames(): Array<keyof R>;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for useEvent hook.
 *
 * @example
 * // Static enabled value
 * useEvent('auth:signed-in', handleSignIn, { enabled: false });
 *
 * // Reactive enabled value (re-evaluated on each $effect run)
 * useEvent('auth:signed-in', handleSignIn, { enabled: () => isActive });
 */
export interface UseEventOptions {
	/**
	 * If false, subscription is disabled.
	 * Can be a boolean or a getter function for reactive behavior.
	 * When a function is provided, it's called inside $effect for reactivity.
	 * @default true
	 */
	enabled?: boolean | (() => boolean);
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Get all event names from a registry as strings.
 *
 * @example
 * type Names = EventNames<WarpKitEventRegistry>;
 * // 'auth:signed-in' | 'auth:signed-out' | 'auth:token-refreshed' | ...
 */
export type EventNames<R extends EventRegistry> = keyof R & string;

/**
 * Get the payload type for a specific event.
 *
 * @example
 * type SignInPayload = EventPayload<WarpKitEventRegistry, 'auth:signed-in'>;
 * // { userId: string }
 */
export type EventPayload<R extends EventRegistry, K extends keyof R> = R[K];

/**
 * Get event names that have a payload (not void).
 *
 * @example
 * type WithData = EventsWithPayload<WarpKitEventRegistry>;
 * // 'auth:signed-in' | 'app:state-changed' | 'app:error' | 'query:invalidated' | 'query:fetched'
 */
export type EventsWithPayload<R extends EventRegistry> = {
	[K in keyof R]: R[K] extends void ? never : K;
}[keyof R];

/**
 * Get event names that have no payload (void).
 *
 * @example
 * type NoData = EventsWithoutPayload<WarpKitEventRegistry>;
 * // 'auth:signed-out' | 'auth:token-refreshed'
 */
export type EventsWithoutPayload<R extends EventRegistry> = {
	[K in keyof R]: R[K] extends void ? K : never;
}[keyof R];

/**
 * Handler with typed payload from registry.
 * Convenience alias for EventHandler<R[K]>.
 *
 * @example
 * const handler: TypedEventHandler<WarpKitEventRegistry, 'auth:signed-in'> = (payload) => {
 *   console.log('User ID:', payload.userId);
 * };
 */
export type TypedEventHandler<R extends EventRegistry, K extends keyof R> = EventHandler<R[K]>;
