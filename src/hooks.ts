/**
 * WarpKit v2 Hooks
 *
 * Context hooks for accessing WarpKit from Svelte components.
 * Must be called within a WarpKitProvider.
 */

import { getContext } from 'svelte';
import { WARPKIT_CONTEXT, type WarpKit, type WarpKitContext } from './context';
import type { PageState } from './core/types';

// Re-export useEvent for convenient access
export { useEvent } from './events/useEvent.svelte.js';

/**
 * Get the WarpKit instance from context.
 *
 * @returns The WarpKit instance
 * @throws Error if called outside WarpKitProvider
 *
 * @example
 * ```svelte
 * <script>
 *   import { useWarpKit } from '@warpkit/core';
 *   const warpkit = useWarpKit();
 *
 *   function handleClick() {
 *     warpkit.navigate('/dashboard');
 *   }
 * </script>
 * ```
 */
export function useWarpKit<TAppState extends string = string>(): WarpKit<TAppState> {
	const ctx = getContext<WarpKitContext>(WARPKIT_CONTEXT);
	if (!ctx) {
		throw new Error('[WarpKit] useWarpKit must be called within WarpKitProvider');
	}
	return ctx.warpkit as WarpKit<TAppState>;
}

/**
 * Get the reactive PageState from context.
 *
 * This is a shorthand for `useWarpKit().page`.
 *
 * @returns The reactive PageState
 * @throws Error if called outside WarpKitProvider
 *
 * @example
 * ```svelte
 * <script>
 *   import { usePage } from '@warpkit/core';
 *   const page = usePage();
 * </script>
 *
 * <p>Current path: {page.pathname}</p>
 * <p>Is navigating: {page.isNavigating}</p>
 * ```
 */
export function usePage(): PageState {
	const ctx = getContext<WarpKitContext>(WARPKIT_CONTEXT);
	if (!ctx) {
		throw new Error('[WarpKit] usePage must be called within WarpKitProvider');
	}
	return ctx.page;
}

/**
 * Get the full WarpKit context (for internal/advanced use).
 *
 * @returns The full WarpKitContext
 * @throws Error if called outside WarpKitProvider
 */
export function useWarpKitContext(): WarpKitContext {
	const ctx = getContext<WarpKitContext>(WARPKIT_CONTEXT);
	if (!ctx) {
		throw new Error('[WarpKit] useWarpKitContext must be called within WarpKitProvider');
	}
	return ctx;
}
