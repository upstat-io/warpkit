/**
 * Test Utility: mockRouter
 *
 * Provides mock functions for router navigation and hooks.
 * Use vi.mock() to inject these into your tests.
 *
 * Usage:
 * ```typescript
 * import { vi } from 'vitest';
 * import { createMockRouter, createMockNavigationHooks } from '@upstat/warpkit/testing';
 *
 * const { mockPush, mockReplace, mockBack } = createMockRouter();
 *
 * vi.mock('@upstat/warpkit', async (importOriginal) => {
 *   const original = await importOriginal();
 *   return {
 *     ...original,
 *     push: mockPush,
 *     replace: mockReplace,
 *     back: mockBack
 *   };
 * });
 * ```
 */

import { vi, type Mock } from 'vitest';
import type { NavigationContext, NavigateOptions, NavigationHook } from '../src/types';

export interface MockRouter {
	/** Mock for push() navigation */
	mockPush: Mock<(path: string, options?: NavigateOptions) => Promise<void>>;

	/** Mock for replace() navigation */
	mockReplace: Mock<(path: string, options?: NavigateOptions) => Promise<void>>;

	/** Mock for back() navigation */
	mockBack: Mock<() => void>;

	/** Mock for forward() navigation */
	mockForward: Mock<() => void>;

	/** Mock for go() navigation */
	mockGo: Mock<(delta: number) => void>;

	/** Reset all mocks */
	reset: () => void;

	/** Get all navigation calls (push + replace) */
	getNavigationHistory: () => Array<{ type: 'push' | 'replace'; path: string; options?: NavigateOptions }>;
}

/**
 * Create mock router navigation functions
 *
 * @returns Object with all mock navigation functions
 */
export function createMockRouter(): MockRouter {
	const navigationHistory: Array<{ type: 'push' | 'replace'; path: string; options?: NavigateOptions }> = [];

	const mockPush = vi.fn(async (path: string, options?: NavigateOptions) => {
		navigationHistory.push({ type: 'push', path, options });
	});

	const mockReplace = vi.fn(async (path: string, options?: NavigateOptions) => {
		navigationHistory.push({ type: 'replace', path, options });
	});

	const mockBack = vi.fn();
	const mockForward = vi.fn();
	const mockGo = vi.fn();

	return {
		mockPush,
		mockReplace,
		mockBack,
		mockForward,
		mockGo,
		reset: () => {
			mockPush.mockClear();
			mockReplace.mockClear();
			mockBack.mockClear();
			mockForward.mockClear();
			mockGo.mockClear();
			navigationHistory.length = 0;
		},
		getNavigationHistory: () => [...navigationHistory]
	};
}

export interface MockNavigationHooks {
	/** Mock for onBeforeNavigate */
	mockBeforeNavigate: Mock<(callback: NavigationHook) => () => void>;

	/** Mock for onAfterNavigate */
	mockAfterNavigate: Mock<(callback: NavigationHook) => () => void>;

	/** Registered before navigate callbacks */
	beforeNavigateCallbacks: NavigationHook[];

	/** Registered after navigate callbacks */
	afterNavigateCallbacks: NavigationHook[];

	/** Trigger all before navigate callbacks with context */
	triggerBeforeNavigate: (context: NavigationContext) => Promise<void>;

	/** Trigger all after navigate callbacks with context */
	triggerAfterNavigate: (context: NavigationContext) => Promise<void>;

	/** Reset all mocks and callbacks */
	reset: () => void;
}

/**
 * Create mock navigation hooks
 *
 * @returns Object with mock hook functions and trigger utilities
 */
export function createMockNavigationHooks(): MockNavigationHooks {
	const beforeNavigateCallbacks: NavigationHook[] = [];
	const afterNavigateCallbacks: NavigationHook[] = [];

	const mockBeforeNavigate = vi.fn((callback: NavigationHook) => {
		beforeNavigateCallbacks.push(callback);
		return () => {
			const index = beforeNavigateCallbacks.indexOf(callback);
			if (index > -1) beforeNavigateCallbacks.splice(index, 1);
		};
	});

	const mockAfterNavigate = vi.fn((callback: NavigationHook) => {
		afterNavigateCallbacks.push(callback);
		return () => {
			const index = afterNavigateCallbacks.indexOf(callback);
			if (index > -1) afterNavigateCallbacks.splice(index, 1);
		};
	});

	return {
		mockBeforeNavigate,
		mockAfterNavigate,
		beforeNavigateCallbacks,
		afterNavigateCallbacks,
		triggerBeforeNavigate: async (context: NavigationContext) => {
			for (const callback of beforeNavigateCallbacks) {
				await callback(context);
			}
		},
		triggerAfterNavigate: async (context: NavigationContext) => {
			for (const callback of afterNavigateCallbacks) {
				await callback(context);
			}
		},
		reset: () => {
			mockBeforeNavigate.mockClear();
			mockAfterNavigate.mockClear();
			beforeNavigateCallbacks.length = 0;
			afterNavigateCallbacks.length = 0;
		}
	};
}

/**
 * Create a mock navigation context for testing
 *
 * @param overrides - Partial context to override defaults
 * @returns Complete NavigationContext
 */
export function createMockNavigationContext(overrides: Partial<NavigationContext> = {}): NavigationContext {
	return {
		from: '/',
		to: '/test',
		route: null,
		params: {},
		query: new URLSearchParams(),
		hash: '',
		...overrides
	};
}

/**
 * Helper to create hoisted mocks for vi.mock factory
 *
 * Use with vi.hoisted() to ensure mocks are available in vi.mock:
 * ```typescript
 * const { mockReplace } = vi.hoisted(() => createHoistedRouterMocks());
 *
 * vi.mock('@upstat/warpkit', async (importOriginal) => ({
 *   ...(await importOriginal()),
 *   replace: mockReplace
 * }));
 * ```
 */
export function createHoistedRouterMocks() {
	return {
		mockPush: vi.fn(),
		mockReplace: vi.fn(),
		mockBack: vi.fn(),
		mockForward: vi.fn(),
		mockGo: vi.fn(),
		mockBeforeNavigate: vi.fn(() => () => {}),
		mockAfterNavigate: vi.fn(() => () => {})
	};
}
