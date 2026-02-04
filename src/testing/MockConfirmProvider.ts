/**
 * Mock Confirm Dialog Provider for Testing
 *
 * Configurable confirmation mock that tracks call history for assertions.
 * Use in tests to control navigation blocking behavior.
 */

import type { ConfirmDialogProvider } from '../providers/interfaces';

/**
 * Options for creating a MockConfirmProvider.
 */
export interface MockConfirmProviderOptions {
	/** If true, confirm() always returns true (default: true) */
	alwaysConfirm?: boolean;
}

/**
 * Mock implementation of ConfirmDialogProvider for testing.
 *
 * Features:
 * - Configurable default return value via constructor
 * - Override next result with setNextResult()
 * - Track all confirm() calls via confirmCalls property
 * - Clear history with clearHistory()
 *
 * @example
 * ```typescript
 * const mock = new MockConfirmProvider({ alwaysConfirm: false });
 *
 * // Test that navigation was blocked
 * await warpkit.navigate('/leave');
 * expect(mock.confirmCalls).toContain('You have unsaved changes');
 *
 * // Allow next confirmation
 * mock.setNextResult(true);
 * await warpkit.navigate('/leave');
 * ```
 */
export class MockConfirmProvider implements ConfirmDialogProvider {
	public readonly id = 'confirmDialog' as const;

	/** History of messages passed to confirm(), for assertion */
	public readonly confirmCalls: string[] = [];

	private nextResult: boolean;
	private hasOverride = false;
	private overrideResult = false;

	public constructor(options: MockConfirmProviderOptions = {}) {
		this.nextResult = options.alwaysConfirm ?? true;
	}

	/**
	 * Mock confirmation that returns the configured result.
	 * Records the message in confirmCalls for later assertion.
	 */
	public async confirm(message: string): Promise<boolean> {
		this.confirmCalls.push(message);

		if (this.hasOverride) {
			this.hasOverride = false;
			return this.overrideResult;
		}

		return this.nextResult;
	}

	/**
	 * Set what the next confirm() call returns.
	 * This override is consumed after one call.
	 */
	public setNextResult(result: boolean): void {
		this.hasOverride = true;
		this.overrideResult = result;
	}

	/**
	 * Set the default result for all future confirm() calls.
	 */
	public setDefaultResult(result: boolean): void {
		this.nextResult = result;
	}

	/**
	 * Clear the confirm call history.
	 */
	public clearHistory(): void {
		this.confirmCalls.length = 0;
	}
}
