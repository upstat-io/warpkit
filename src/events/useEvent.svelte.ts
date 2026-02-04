/**
 * WarpKit v2 useEvent Hook
 *
 * Svelte 5 hook for subscribing to events with automatic cleanup.
 * Uses $effect() rune to automatically unsubscribe when the component
 * is destroyed, preventing memory leaks.
 */

import { useWarpKit } from '../hooks.js';
import type { EventHandler, UseEventOptions, WarpKitEventRegistry } from './types.js';

/**
 * Subscribe to WarpKit events with automatic cleanup.
 * Must be called during component initialization (in script setup).
 *
 * The subscription is automatically cleaned up when:
 * - The component is destroyed
 * - The $effect re-runs (e.g., when enabled changes)
 *
 * @param event - Event name to subscribe to
 * @param handler - Function called when event is emitted
 * @param options - Optional configuration (enabled)
 *
 * @example
 * ```svelte
 * <script>
 *   import { useEvent } from '@warpkit/core';
 *
 *   useEvent('auth:signed-in', (payload) => {
 *     console.log('User signed in:', payload.userId);
 *   });
 *
 *   // Conditional subscription
 *   useEvent('query:invalidated', handleInvalidation, { enabled: isActive });
 * </script>
 * ```
 */
export function useEvent<K extends keyof WarpKitEventRegistry>(
	event: K,
	handler: EventHandler<WarpKitEventRegistry[K]>,
	options: UseEventOptions = {}
): void {
	const warpkit = useWarpKit();

	$effect(() => {
		// Evaluate enabled inside $effect for reactivity when using getter
		const enabled = typeof options.enabled === 'function' ? options.enabled() : (options.enabled ?? true);

		if (!enabled) return;

		const off = warpkit.events.on(event, handler);
		return off;
	});
}
