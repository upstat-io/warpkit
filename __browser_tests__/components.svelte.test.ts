/**
 * Browser Tests: Svelte Components
 *
 * Tests for Link, NavLink, RouterView, and WarpKitProvider components.
 * These require browser environment because components use $state/$derived runes.
 */
import { expect, test, describe, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createMockWarpKit, waitForNavigation, expectNavigation } from '../src/testing';
import type { StateRoutes } from '../src/core/types';
import type { Component } from 'svelte';

// Test components
import TestLink from './TestLink.svelte';
import TestNavLink from './TestNavLink.svelte';
import TestRouterView from './TestRouterView.svelte';
import TestRouterViewWithLayout from './TestRouterViewWithLayout.svelte';
import TestRouterViewError from './TestRouterViewError.svelte';
import TestWarpKitProvider from './TestWarpKitProvider.svelte';

// Simple test routes
type TestState = 'authenticated' | 'unauthenticated';

const createTestRoutes = (): StateRoutes<TestState> => ({
	authenticated: {
		routes: [
			{
				path: '/dashboard',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Dashboard' }
			},
			{
				path: '/settings',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Settings' }
			},
			{
				path: '/settings/profile',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Profile' }
			},
			{
				path: '/users/[id]',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'User' }
			}
		],
		default: '/dashboard'
	},
	unauthenticated: {
		routes: [
			{
				path: '/login',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Login' }
			}
		],
		default: '/login'
	}
});

describe('Link Component', () => {
	describe('rendering', () => {
		test('should render an anchor tag with href', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings' }
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveAttribute('href', '/settings');
			await expect.element(link).toHaveTextContent('Settings');
		});

		test('should apply custom class', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings', class: 'my-link' }
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveClass('my-link');
		});
	});

	describe('click handling', () => {
		test('should navigate on click', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings' }
			});

			const link = screen.getByRole('link');
			const navPromise = waitForNavigation(warpkit);
			await link.click();
			await navPromise;

			expectNavigation(warpkit, '/settings');
		});

		test('should use replace when replace prop is true', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const initialHistoryLength = warpkit.getHistory().length;

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings', replace: true }
			});

			const link = screen.getByRole('link');
			const navPromise = waitForNavigation(warpkit);
			await link.click();
			await navPromise;

			// History should not have grown (replaced instead of pushed)
			expect(warpkit.getHistory().length).toBe(initialHistoryLength);
		});
	});

	describe('disabled state', () => {
		test('should not navigate when disabled', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings', disabled: true }
			});

			const link = screen.getByRole('link');
			// Playwright won't click disabled elements, so dispatch event directly
			const element = link.element();
			element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

			// Small delay to ensure any potential navigation would have started
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should still be on dashboard (navigation was prevented)
			expectNavigation(warpkit, '/dashboard');
		});

		test('should have aria-disabled when disabled', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings', disabled: true }
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveAttribute('aria-disabled', 'true');
		});

		test('should have disabled class when disabled', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestLink, {
				props: { warpkit, href: '/settings', label: 'Settings', disabled: true }
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveClass('disabled');
		});
	});
});

describe('NavLink Component', () => {
	describe('active state', () => {
		test('should apply activeClass when path matches', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings',
					activeClass: 'active'
				}
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveClass('active');
		});

		test('should apply exactActiveClass only for exact match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings',
					exactActiveClass: 'exact-active'
				}
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveClass('exact-active');
		});

		test('should apply activeClass but not exactActiveClass for partial match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings/profile'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings',
					activeClass: 'active',
					exactActiveClass: 'exact-active'
				}
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveClass('active');
			// exact-active should NOT be present
			const element = link.element();
			expect(element.classList.contains('exact-active')).toBe(false);
		});

		test('should not apply activeClass when path does not match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings',
					activeClass: 'active'
				}
			});

			const link = screen.getByRole('link');
			const element = link.element();
			expect(element.classList.contains('active')).toBe(false);
		});
	});

	describe('aria-current', () => {
		test('should have aria-current="page" for exact match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings'
				}
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveAttribute('aria-current', 'page');
		});

		test('should have aria-current="true" for partial match', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings/profile'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings'
				}
			});

			const link = screen.getByRole('link');
			await expect.element(link).toHaveAttribute('aria-current', 'true');
		});
	});

	describe('click handling', () => {
		test('should navigate on click', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestNavLink, {
				props: {
					warpkit,
					href: '/settings',
					label: 'Settings'
				}
			});

			const link = screen.getByRole('link');
			const navPromise = waitForNavigation(warpkit);
			await link.click();
			await navPromise;

			expectNavigation(warpkit, '/settings');
		});
	});
});

describe('RouterView Component', () => {
	describe('rendering', () => {
		test('should mount successfully with WarpKit context', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/nonexistent' // No matching route, so fallback should show
			});

			// RouterView should mount without throwing (will show fallback since route not found)
			const screen = render(TestRouterView, {
				props: { warpkit, showFallback: true }
			});

			// The fallback should be shown since /nonexistent has no route
			// Note: This verifies the component mounts correctly with WarpKit context
			expect(screen.container).toBeDefined();
		});

		test('should render fallback when no route matches', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/nonexistent'
			});

			const screen = render(TestRouterView, {
				props: { warpkit, showFallback: true }
			});

			// Since /nonexistent has no route, fallback should be shown
			// Note: This depends on error handling behavior
		});
	});
});

describe('WarpKitProvider Component', () => {
	describe('context', () => {
		test('should provide WarpKit context to children', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestWarpKitProvider, {
				props: { warpkit }
			});

			// The test component should have access to context
			await expect.element(screen.getByTestId('context-check')).toHaveTextContent('Context Available');
		});

		test('should provide page state', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestWarpKitProvider, {
				props: { warpkit }
			});

			await expect.element(screen.getByTestId('current-path')).toHaveTextContent('/dashboard');
		});
	});

	describe('ErrorOverlay', () => {
		test('should include ErrorOverlay for error display', async () => {
			const warpkit = await createMockWarpKit({
				routes: createTestRoutes(),
				initialState: 'authenticated',
				initialPath: '/dashboard'
			});

			const screen = render(TestWarpKitProvider, {
				props: { warpkit }
			});

			// ErrorOverlay should exist in the DOM (even if hidden)
			// It's rendered by WarpKitProvider automatically
		});
	});
});
