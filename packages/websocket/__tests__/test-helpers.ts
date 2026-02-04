/**
 * Test helpers for @warpkit/websocket tests.
 *
 * Provides async waiting utilities for deterministic testing.
 */

/**
 * Options for the waitFor helper.
 */
export interface WaitForOptions {
	/**
	 * Maximum time to wait in milliseconds before throwing.
	 * @default 5000
	 */
	readonly timeout?: number;

	/**
	 * Interval between condition checks in milliseconds.
	 * @default 50
	 */
	readonly interval?: number;

	/**
	 * Custom error message when timeout is reached.
	 */
	readonly message?: string;
}

/**
 * Waits for a synchronous condition to become true by polling.
 *
 * @param condition - Function that returns true when the wait should end
 * @param options - Configuration for timeout and polling interval
 * @throws Error if condition is not met within the timeout period
 */
export async function waitFor(condition: () => boolean, options: WaitForOptions = {}): Promise<void> {
	const { timeout = 5000, interval = 50, message } = options;
	const start = Date.now();

	while (!condition()) {
		const elapsed = Date.now() - start;
		if (elapsed > timeout) {
			const errorMessage = message ?? `waitFor timeout after ${timeout}ms`;
			throw new Error(errorMessage);
		}
		await new Promise((resolve) => setTimeout(resolve, interval));
	}
}

/**
 * Simple delay helper for cases where a fixed wait is actually appropriate.
 *
 * @param ms - Time to wait in milliseconds
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
