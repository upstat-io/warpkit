/**
 * WarpKit Test Utilities
 *
 * This module provides test utilities for testing applications built with WarpKit.
 * Import from '@upstat/warpkit/testing' in your test files.
 *
 * Usage:
 * ```typescript
 * import {
 *   createTestWarpKit,
 *   createMockAuthProvider,
 *   waitForState,
 *   renderWithRouter,
 *   createMockFormSubmit
 * } from '@upstat/warpkit/testing';
 * ```
 */

// ============================================================================
// Test WarpKit Factory
// ============================================================================

export {
	createTestWarpKit,
	type TestWarpKitOptions,
	type TestWarpKitResult,
	type TestAuthState
} from './createTestWarpKit';

// ============================================================================
// Auth Helpers
// ============================================================================

export {
	createMockAuthProvider,
	createMockDataLayer,
	createMockUserData,
	createMockAccount,
	createMockAppUser,
	type MockAuthProvider
} from './authHelpers';

// ============================================================================
// Async Helpers
// ============================================================================

export {
	waitForState,
	waitFor,
	waitForAsync,
	withTimeout,
	flushPromises,
	delay,
	type WaitOptions
} from './asyncHelpers';

// ============================================================================
// Router Utilities
// ============================================================================

export {
	renderWithRouter,
	resetRouterState,
	setRouterState,
	waitForNavigation,
	routerState,
	params,
	query,
	pathname,
	hash,
	currentRoute,
	loaderData,
	routeMeta,
	type RouterTestOptions,
	type RenderWithRouterOptions
} from './renderWithRouter';

// Router mocks
export {
	createMockRouter,
	createMockNavigationHooks,
	createMockNavigationContext,
	createHoistedRouterMocks,
	type MockRouter,
	type MockNavigationHooks
} from './mockRouter';

// ============================================================================
// Form Utilities
// ============================================================================

export {
	createMockFormSubmit,
	waitForFormSuccess,
	waitForFormError,
	createMockBlockerHandler,
	mockWindowConfirm,
	type MockFormSubmit,
	type MockFormSubmitOptions,
	type MockBlockerHandler
} from './mockForms';

// ============================================================================
// Vitest Re-exports
// ============================================================================

// Re-export vitest utilities for convenience
export { vi, type Mock } from 'vitest';
