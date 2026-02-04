/**
 * Browser Tests: Path Expansion
 *
 * Tests for WarpKit's path expansion feature which automatically prepends
 * param values from stateData to paths like /incidents -> /ip/incidents.
 *
 * Regression test for: Greedy param route matching bug
 * When both /[projectAlias] and /[projectAlias]/incidents exist, navigating
 * to /incidents should expand to /ip/incidents, not match /[projectAlias]
 * with params.projectAlias='incidents'.
 */
import { expect, test, describe } from 'vitest';
import { createMockWarpKit, waitForNavigation, expectNavigation } from '../../src/testing';
import type { StateRoutes } from '../../src/core/types';
import type { Component } from 'svelte';

type TestState = 'authenticated';

/**
 * Create routes that have a greedy param route (/[projectAlias]) alongside
 * more specific expandable routes (/[projectAlias]/incidents).
 *
 * This is the exact scenario from the Upstat app where:
 * - /[projectAlias] is the project home page
 * - /[projectAlias]/incidents is the incidents list
 * - Sidebar links have hrefs like /incidents (without project alias)
 */
const createProjectRoutes = (): StateRoutes<TestState> => ({
	authenticated: {
		routes: [
			// Greedy param route - matches any single segment
			{
				path: '/[projectAlias]',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Project Home' }
			},
			// More specific routes that should be reached via expansion
			{
				path: '/[projectAlias]/incidents',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Incidents' }
			},
			{
				path: '/[projectAlias]/monitors',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Monitors' }
			},
			{
				path: '/[projectAlias]/on-call/rosters',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'On-Call Rosters' }
			},
			// Static route (no expansion needed)
			{
				path: '/settings',
				component: async () => ({ default: {} as Component }),
				meta: { title: 'Settings' }
			}
		],
		default: '/settings'
	}
});

describe('Path Expansion', () => {
	describe('greedy param route bug (regression)', () => {
		/**
		 * This is the core regression test for the navigation bug.
		 *
		 * BUG: When navigating to /incidents with stateData.projectAlias='ip':
		 * - EXPECTED: Expand to /ip/incidents and show Incidents page
		 * - ACTUAL: Match /[projectAlias] with params.projectAlias='incidents' (wrong!)
		 *
		 * The bug occurs because WarpKit checks direct match BEFORE trying expansion.
		 * Single-segment paths like /incidents incorrectly match /[projectAlias].
		 */
		test('should expand /incidents to /ip/incidents when projectAlias is set', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip' // Start at project home
			});

			// Set state data with projectAlias
			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			// Navigate to /incidents (without project alias)
			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/incidents');
			await navPromise;

			// Should have expanded to /ip/incidents
			expectNavigation(warpkit, '/ip/incidents');

			// Verify we're on the Incidents page, not Project Home
			expect(warpkit.page.route?.meta?.title).toBe('Incidents');
		});

		test('should expand /monitors to /ip/monitors when projectAlias is set', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/monitors');
			await navPromise;

			expectNavigation(warpkit, '/ip/monitors');
			expect(warpkit.page.route?.meta?.title).toBe('Monitors');
		});

		test('should expand multi-segment paths like /on-call/rosters', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/on-call/rosters');
			await navPromise;

			// Multi-segment paths should also expand
			expectNavigation(warpkit, '/ip/on-call/rosters');
			expect(warpkit.page.route?.meta?.title).toBe('On-Call Rosters');
		});
	});

	describe('expansion with different param values', () => {
		test('should use lowercase param value for expansion', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			// Set uppercase projectAlias
			await warpkit.setAppState('authenticated', { projectAlias: 'IP' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/incidents');
			await navPromise;

			// Should lowercase the value
			expectNavigation(warpkit, '/ip/incidents');
		});

		test('should work with different project aliases', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/myproject'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'myproject' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/incidents');
			await navPromise;

			expectNavigation(warpkit, '/myproject/incidents');
		});
	});

	describe('no expansion when not needed', () => {
		test('should not expand static routes', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/settings');
			await navPromise;

			// /settings should NOT be expanded
			expectNavigation(warpkit, '/settings');
			expect(warpkit.page.route?.meta?.title).toBe('Settings');
		});

		test('should not expand already-prefixed paths', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/ip/incidents');
			await navPromise;

			// Should stay as /ip/incidents (not /ip/ip/incidents)
			expectNavigation(warpkit, '/ip/incidents');
		});
	});

	describe('expansion without stateData', () => {
		test('should not expand when stateData is not set', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/settings' // Start on static route
			});

			// Don't set stateData - navigate without projectAlias
			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/incidents');
			await navPromise;

			// Without stateData, /incidents matches /[projectAlias] with projectAlias='incidents'
			// This is expected behavior when no expansion data is available
			expectNavigation(warpkit, '/incidents');
			expect(warpkit.page.params).toEqual({ projectAlias: 'incidents' });
		});
	});

	describe('expansion preserves query and hash', () => {
		test('should preserve query string during expansion', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/incidents?filter=open&sort=date');
			await navPromise;

			// Path should expand and preserve query
			expect(warpkit.page.pathname).toBe('/ip/incidents');
			expect(warpkit.page.search.get('filter')).toBe('open');
			expect(warpkit.page.search.get('sort')).toBe('date');
		});

		test('should preserve hash during expansion', async () => {
			const warpkit = await createMockWarpKit<TestState>({
				routes: createProjectRoutes(),
				initialState: 'authenticated',
				initialPath: '/ip'
			});

			await warpkit.setAppState('authenticated', { projectAlias: 'ip' });

			const navPromise = waitForNavigation(warpkit);
			await warpkit.navigate('/incidents#details');
			await navPromise;

			// Path should expand and preserve hash
			expect(warpkit.page.pathname).toBe('/ip/incidents');
			expect(warpkit.page.hash).toBe('#details');
		});
	});
});
