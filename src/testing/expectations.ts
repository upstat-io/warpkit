/**
 * Test Expectations for WarpKit
 *
 * Custom assertion helpers for testing WarpKit navigation, state, and rendering.
 * All assertions provide clear error messages on failure.
 */

import { expect } from 'vitest';
import type { NavigationErrorCode } from '../core/types';
import type { WarpKit } from '../core/WarpKit.svelte';
import type { MockWarpKit } from './createMockWarpKit';

// ============================================================================
// Path & State Assertions
// ============================================================================

/**
 * Assert that WarpKit is at the expected path.
 *
 * @example
 * ```typescript
 * expectNavigation(warpkit, '/dashboard');
 * expectNavigation(warpkit, '/users/123');
 * ```
 */
export function expectNavigation<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expectedPath: string
): void {
	const actualPath = warpkit.page.pathname;
	expect(actualPath, `Expected path to be "${expectedPath}" but was "${actualPath}"`).toBe(expectedPath);
}

/**
 * Assert that WarpKit is in the expected application state.
 *
 * @example
 * ```typescript
 * expectState(warpkit, 'authenticated');
 * expectState(warpkit, 'onboarding');
 * ```
 */
export function expectState<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expectedState: TAppState
): void {
	const actualState = warpkit.getState();
	expect(actualState, `Expected state to be "${expectedState}" but was "${actualState}"`).toBe(expectedState);
}

/**
 * Assert that WarpKit is in the expected state with at least the expected stateId.
 * Useful for verifying a state transition has occurred.
 *
 * @example
 * ```typescript
 * const initialStateId = warpkit.getStateId();
 * await warpkit.setAppState('authenticated');
 * expectStateTransition(warpkit, 'authenticated', initialStateId + 1);
 * ```
 */
export function expectStateTransition<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expectedState: TAppState,
	expectedMinStateId: number
): void {
	expectState(warpkit, expectedState);
	const actualStateId = warpkit.getStateId();
	expect(
		actualStateId,
		`Expected stateId >= ${expectedMinStateId} but was ${actualStateId}`
	).toBeGreaterThanOrEqual(expectedMinStateId);
}

// ============================================================================
// Search Param Assertions
// ============================================================================

/**
 * Assert a single search param has the expected value.
 *
 * @example
 * ```typescript
 * expectSearchParam(warpkit, 'tab', 'settings');
 * expectSearchParam(warpkit, 'removed', null); // Assert param is absent
 * ```
 */
export function expectSearchParam<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	key: string,
	expectedValue: string | null
): void {
	const actualValue = warpkit.getSearchParam(key);
	if (expectedValue === null) {
		expect(actualValue, `Expected search param "${key}" to be absent but was "${actualValue}"`).toBeNull();
	} else {
		expect(
			actualValue,
			`Expected search param "${key}" to be "${expectedValue}" but was "${actualValue}"`
		).toBe(expectedValue);
	}
}

/**
 * Assert that all search params match the expected object.
 * Fails if any params are missing or have wrong values.
 *
 * @example
 * ```typescript
 * expectSearchParams(warpkit, { tab: 'settings', sort: 'name' });
 * ```
 */
export function expectSearchParams<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expected: Record<string, string>
): void {
	const actual = warpkit.getSearchParams();

	for (const [key, expectedValue] of Object.entries(expected)) {
		expect(
			actual[key],
			`Expected search param "${key}" to be "${expectedValue}" but was "${actual[key]}"`
		).toBe(expectedValue);
	}

	// Also check for unexpected params
	const expectedKeys = new Set(Object.keys(expected));
	const actualKeys = Object.keys(actual);
	const unexpectedKeys = actualKeys.filter((k) => !expectedKeys.has(k));

	if (unexpectedKeys.length > 0) {
		expect.fail(
			`Found unexpected search params: ${unexpectedKeys.join(', ')}. Expected only: ${Object.keys(expected).join(', ')}`
		);
	}
}

// ============================================================================
// Full Path Assertions
// ============================================================================

/**
 * Assert the full path including search and hash.
 *
 * @example
 * ```typescript
 * expectFullPath(warpkit, '/users?tab=settings#section');
 * ```
 */
export function expectFullPath<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expectedPath: string
): void {
	const actualPath = warpkit.page.path;
	expect(actualPath, `Expected full path to be "${expectedPath}" but was "${actualPath}"`).toBe(expectedPath);
}

// ============================================================================
// Route Param Assertions
// ============================================================================

/**
 * Assert that route params match the expected object.
 *
 * @example
 * ```typescript
 * expectParams(warpkit, { id: '123', slug: 'test-post' });
 * ```
 */
export function expectParams<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expected: Record<string, string>
): void {
	const actual = warpkit.page.params;

	for (const [key, expectedValue] of Object.entries(expected)) {
		expect(
			actual[key],
			`Expected route param "${key}" to be "${expectedValue}" but was "${actual[key]}"`
		).toBe(expectedValue);
	}
}

// ============================================================================
// Navigation Status Assertions
// ============================================================================

/**
 * Assert that WarpKit is currently navigating.
 *
 * @example
 * ```typescript
 * warpkit.navigate('/dashboard'); // Don't await
 * expectIsNavigating(warpkit, true);
 * ```
 */
export function expectIsNavigating<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expected: boolean
): void {
	const actual = warpkit.page.isNavigating;
	expect(actual, `Expected isNavigating to be ${expected} but was ${actual}`).toBe(expected);
}

/**
 * Assert that WarpKit has an error.
 *
 * @example
 * ```typescript
 * expectHasError(warpkit, true);
 * expect(warpkit.page.error?.code).toBe(NavigationErrorCode.NOT_FOUND);
 * ```
 */
export function expectHasError<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	expected: boolean
): void {
	const hasError = warpkit.page.error !== null;
	expect(hasError, `Expected hasError to be ${expected} but was ${hasError}`).toBe(expected);
}

// ============================================================================
// Navigation Outcome Assertions
// ============================================================================

/**
 * Navigate to a path and assert it was blocked (user stayed on current page).
 * The MockWarpKit must have a blocker registered and confirm set to deny.
 *
 * @example
 * ```typescript
 * warpkit.registerBlocker(() => 'You have unsaved changes');
 * warpkit.setConfirmResult(false);
 * await expectNavigationBlocked(warpkit, '/leave');
 * expect(warpkit.page.pathname).toBe('/current'); // Still on current page
 * ```
 */
export async function expectNavigationBlocked<TAppState extends string>(
	warpkit: MockWarpKit<TAppState>,
	targetPath: string
): Promise<void> {
	const beforePath = warpkit.page.pathname;
	const result = await warpkit.navigate(targetPath);

	expect(result.success, `Expected navigation to "${targetPath}" to be blocked but it succeeded`).toBe(false);

	expect(
		warpkit.page.pathname,
		`Expected to stay on "${beforePath}" after blocked navigation but moved to "${warpkit.page.pathname}"`
	).toBe(beforePath);
}

/**
 * Navigate to a path and assert it resulted in a specific error code.
 *
 * @example
 * ```typescript
 * await expectNavigationError(warpkit, '/nonexistent', NavigationErrorCode.NOT_FOUND);
 * ```
 */
export async function expectNavigationError<TAppState extends string>(
	warpkit: WarpKit<TAppState>,
	targetPath: string,
	expectedCode: NavigationErrorCode
): Promise<void> {
	const result = await warpkit.navigate(targetPath);

	expect(
		result.success,
		`Expected navigation to "${targetPath}" to fail with error ${expectedCode} but it succeeded`
	).toBe(false);

	expect(result.error?.code, `Expected error code ${expectedCode} but got ${result.error?.code}`).toBe(
		expectedCode
	);
}

// ============================================================================
// History Assertions (MockWarpKit only)
// ============================================================================

/**
 * Assert the length of the history stack.
 *
 * @example
 * ```typescript
 * await warpkit.navigate('/a');
 * await warpkit.navigate('/b');
 * expectHistoryLength(warpkit, 3); // Initial + 2 navigations
 * ```
 */
export function expectHistoryLength<TAppState extends string>(
	warpkit: MockWarpKit<TAppState>,
	expectedLength: number
): void {
	const actualLength = warpkit.getHistory().length;
	expect(actualLength, `Expected history length to be ${expectedLength} but was ${actualLength}`).toBe(
		expectedLength
	);
}

/**
 * Assert the current index in the history stack.
 *
 * @example
 * ```typescript
 * await warpkit.navigate('/a');
 * await warpkit.navigate('/b');
 * warpkit.back();
 * expectHistoryIndex(warpkit, 1); // Back from index 2 to 1
 * ```
 */
export function expectHistoryIndex<TAppState extends string>(
	warpkit: MockWarpKit<TAppState>,
	expectedIndex: number
): void {
	const actualIndex = warpkit.getCurrentIndex();
	expect(actualIndex, `Expected history index to be ${expectedIndex} but was ${actualIndex}`).toBe(
		expectedIndex
	);
}
