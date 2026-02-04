/**
 * Wait for Navigation Helper
 *
 * Returns a Promise that resolves after the next navigation completes.
 * Useful for testing navigation flows.
 */

import type { NavigationContext } from '../core/types';
import type { WarpKit } from '../core/WarpKit.svelte';

/**
 * Wait for the next navigation to complete.
 *
 * Returns a Promise that resolves with the NavigationContext after
 * the afterNavigate hook fires.
 *
 * @example
 * ```typescript
 * // Trigger navigation and wait for completion
 * const navigationPromise = waitForNavigation(warpkit);
 * warpkit.navigate('/dashboard');
 * const context = await navigationPromise;
 *
 * expect(context.to.pathname).toBe('/dashboard');
 * ```
 *
 * @example
 * ```typescript
 * // For navigations that happen in response to events
 * const promise = waitForNavigation(warpkit);
 * button.click(); // Triggers navigation internally
 * await promise;
 * ```
 *
 * @param warpkit - The WarpKit instance to observe
 * @returns Promise that resolves with NavigationContext after navigation completes
 */
export function waitForNavigation<TAppState extends string>(
	warpkit: WarpKit<TAppState>
): Promise<NavigationContext> {
	return new Promise((resolve) => {
		const removeAfter = warpkit.afterNavigate((ctx) => {
			removeAfter();
			resolve(ctx);
		});
	});
}

/**
 * Wait for navigation with a timeout.
 *
 * Like waitForNavigation but rejects if navigation doesn't complete
 * within the specified timeout.
 *
 * @example
 * ```typescript
 * try {
 *   const context = await waitForNavigationWithTimeout(warpkit, 1000);
 *   expect(context.to.pathname).toBe('/dashboard');
 * } catch (error) {
 *   // Navigation didn't complete within 1 second
 * }
 * ```
 *
 * @param warpkit - The WarpKit instance to observe
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves with NavigationContext or rejects on timeout
 */
export function waitForNavigationWithTimeout<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	timeout: number
): Promise<NavigationContext> {
	return new Promise((resolve, reject) => {
		let resolved = false;

		const timer = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				removeAfter();
				reject(new Error(`Navigation did not complete within ${timeout}ms`));
			}
		}, timeout);

		const removeAfter = warpkit.afterNavigate((ctx) => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timer);
				removeAfter();
				resolve(ctx);
			}
		});
	});
}
