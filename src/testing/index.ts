/**
 * WarpKit v2 Testing Utilities
 *
 * Provides mock providers, factories, and assertions for testing WarpKit applications.
 */

// ============================================================================
// Mock Providers
// ============================================================================

export { MockConfirmProvider } from './MockConfirmProvider';
export type { MockConfirmProviderOptions } from './MockConfirmProvider';

export { NoOpStorageProvider } from './NoOpStorageProvider';

// ============================================================================
// Factory Functions
// ============================================================================

export { createMockWarpKit } from './createMockWarpKit';
export type { MockWarpKitOptions, MockWarpKit } from './createMockWarpKit';

export { createMockEvents } from './createMockEvents';

export { createMockDataClient, createMockDataClient as createMockQueryClient } from './createMockDataClient';
export type {
	MockDataClient,
	MockDataClientOptions,
	MockDataClient as MockQueryClient,
	MockDataClientOptions as MockQueryClientOptions
} from './createMockDataClient';

export { createEventSpy } from './createEventSpy';
export type { EventSpy, EventCall } from './createEventSpy';

// ============================================================================
// Waiting Helpers
// ============================================================================

export { waitForNavigation, waitForNavigationWithTimeout } from './waitForNavigation';

// ============================================================================
// Render Helpers
// ============================================================================

export { renderWithWarpKit, createTestRoutes } from './renderWithWarpKit';
export type { RenderWithWarpKitOptions, RenderWithWarpKitResult } from './renderWithWarpKit';

// ============================================================================
// Test Wrapper Component
// ============================================================================

export { default as WarpKitTestWrapper } from './WarpKitTestWrapper.svelte';

// ============================================================================
// Error Codes (re-exported for testing convenience)
// ============================================================================

export { NavigationErrorCode } from '../core/types';

// ============================================================================
// Expectations (Assertion Helpers)
// ============================================================================

export {
	// Path & State
	expectNavigation,
	expectState,
	expectStateTransition,
	expectFullPath,

	// Search Params
	expectSearchParam,
	expectSearchParams,

	// Route Params
	expectParams,

	// Navigation Status
	expectIsNavigating,
	expectHasError,

	// Navigation Outcomes
	expectNavigationBlocked,
	expectNavigationError,

	// History (MockWarpKit)
	expectHistoryLength,
	expectHistoryIndex
} from './expectations';
