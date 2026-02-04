/**
 * Async Test Helpers
 *
 * Deterministic helpers for async testing that replace setTimeout-based waits.
 * Use these instead of arbitrary delays to make tests more reliable.
 *
 * Usage:
 * ```typescript
 * import { waitForState, waitFor } from '@upstat/warpkit/testing';
 *
 * await waitForState(actor, 'authenticated');
 * await waitFor(() => someCondition);
 * ```
 */

import type { AppActor } from '../src/init';

// ============================================================================
// Wait Options
// ============================================================================

export interface WaitOptions {
	/** Maximum time to wait in milliseconds (default: 5000) */
	timeout?: number;
	/** Polling interval in milliseconds (default: 10) */
	interval?: number;
}

// ============================================================================
// waitForState
// ============================================================================

/**
 * Wait for an actor to reach a specific state.
 *
 * Uses polling to check the actor's state rather than relying on setTimeout.
 * This makes tests more deterministic and less flaky.
 *
 * @param actor - The app state machine actor
 * @param state - The state to wait for (string or nested state value)
 * @param options - Wait options (timeout, interval)
 * @throws If timeout is reached before state is achieved
 *
 * @example
 * // Wait for simple state
 * await waitForState(actor, 'authenticated');
 *
 * // Wait for nested state
 * await waitForState(actor, { authenticated: 'ready' });
 *
 * // With custom timeout
 * await waitForState(actor, 'unauthenticated', { timeout: 10000 });
 */
export async function waitForState(
	actor: AppActor,
	state: string | Record<string, string>,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = 5000, interval = 10 } = options;
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const snapshot = actor.getSnapshot();

		// Handle nested state matching
		if (typeof state === 'string') {
			if (snapshot.matches(state)) {
				return;
			}
		} else {
			// Check if nested state matches
			if (snapshot.matches(state)) {
				return;
			}
		}

		// Wait before next poll
		await new Promise((resolve) => setTimeout(resolve, interval));
	}

	// Timeout reached - throw with helpful error
	const currentState = actor.getSnapshot().value;
	throw new Error(
		`waitForState timed out after ${timeout}ms. ` +
			`Expected state: ${JSON.stringify(state)}, ` +
			`Current state: ${JSON.stringify(currentState)}`
	);
}

// ============================================================================
// waitFor
// ============================================================================

/**
 * Wait for a synchronous condition to be true.
 *
 * Polls the condition function until it returns true or timeout is reached.
 * This is useful for waiting on synchronous state changes.
 *
 * @param condition - Function that returns true when condition is met
 * @param options - Wait options (timeout, interval)
 * @throws If timeout is reached before condition is met
 *
 * @example
 * // Wait for a value to change
 * await waitFor(() => messages.length > 0);
 *
 * // Wait for a store to update
 * await waitFor(() => get(myStore) === 'expected');
 */
export async function waitFor(condition: () => boolean, options: WaitOptions = {}): Promise<void> {
	const { timeout = 5000, interval = 10 } = options;
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		if (condition()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, interval));
	}

	throw new Error(`waitFor timed out after ${timeout}ms. Condition never became true.`);
}

// ============================================================================
// waitForAsync
// ============================================================================

/**
 * Wait for an async condition to be true.
 *
 * Similar to waitFor but for async conditions.
 *
 * @param condition - Async function that returns true when condition is met
 * @param options - Wait options (timeout, interval)
 * @throws If timeout is reached before condition is met
 *
 * @example
 * // Wait for async state
 * await waitForAsync(async () => {
 *   const record = await db.findById(id);
 *   return record !== null;
 * });
 */
export async function waitForAsync(
	condition: () => Promise<boolean>,
	options: WaitOptions = {}
): Promise<void> {
	const { timeout = 5000, interval = 10 } = options;
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		if (await condition()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, interval));
	}

	throw new Error(`waitForAsync timed out after ${timeout}ms. Condition never became true.`);
}

// ============================================================================
// withTimeout
// ============================================================================

/**
 * Wrap a promise with a timeout.
 *
 * Useful for preventing tests from hanging on promises that never resolve.
 *
 * @param promise - The promise to wrap
 * @param timeout - Maximum time to wait in milliseconds
 * @param message - Error message if timeout is reached
 * @returns The resolved value of the promise
 * @throws If timeout is reached before promise resolves
 *
 * @example
 * const result = await withTimeout(
 *   longRunningOperation(),
 *   5000,
 *   'Operation timed out'
 * );
 */
export async function withTimeout<T>(promise: Promise<T>, timeout: number, message?: string): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout>;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(message ?? `Operation timed out after ${timeout}ms`));
		}, timeout);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		clearTimeout(timeoutId!);
	}
}

// ============================================================================
// flushPromises
// ============================================================================

/**
 * Flush all pending promises.
 *
 * Useful for ensuring all microtasks are processed before assertions.
 * This is more deterministic than arbitrary setTimeout delays.
 *
 * @example
 * triggerSomeAsyncOperation();
 * await flushPromises();
 * expect(result).toBe('expected');
 */
export async function flushPromises(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

// ============================================================================
// delay
// ============================================================================

/**
 * Wait for a specific amount of time.
 *
 * Use sparingly - prefer polling-based helpers (waitFor, waitForState).
 * Only use when you specifically need to wait for time to pass
 * (e.g., testing debounce behavior, rate limiting).
 *
 * @param ms - Time to wait in milliseconds
 *
 * @example
 * // Test debounce timing
 * trigger();
 * await delay(100); // Wait for debounce
 * expect(debouncedFn).toHaveBeenCalledTimes(1);
 */
export async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}
