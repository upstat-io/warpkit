import { describe, it, expect, vi, beforeEach } from 'bun:test';
import type { Component } from 'svelte';
import { LayoutManager } from '../LayoutManager.js';
import type { Route, StateConfig, LayoutConfig } from '../types.js';

describe('LayoutManager', () => {
	let layoutManager: LayoutManager;

	// Mock components (cast to Component for type safety)
	const AppLayout = (() => {}) as unknown as Component;
	const AdminLayout = (() => {}) as unknown as Component;
	const FullscreenLayout = (() => {}) as unknown as Component;

	// Mock layout configs
	const appLayoutConfig: LayoutConfig = {
		id: 'app-layout',
		load: vi.fn().mockResolvedValue({ default: AppLayout })
	};

	const adminLayoutConfig: LayoutConfig = {
		id: 'admin-layout',
		load: vi.fn().mockResolvedValue({ default: AdminLayout })
	};

	const fullscreenLayoutConfig: LayoutConfig = {
		id: 'fullscreen-layout',
		load: vi.fn().mockResolvedValue({ default: FullscreenLayout })
	};

	// Mock routes
	const routeWithLayout: Route = {
		path: '/editor',
		component: () => Promise.resolve({ default: {} as any }),
		layout: fullscreenLayoutConfig,
		meta: {}
	};

	const routeWithoutLayout: Route = {
		path: '/login',
		component: () => Promise.resolve({ default: {} as any }),
		meta: {}
	};

	// Mock state config
	const stateWithLayout: StateConfig = {
		routes: [],
		default: '/dashboard',
		layout: appLayoutConfig
	};

	const stateWithoutLayout: StateConfig = {
		routes: [],
		default: '/login'
	};

	beforeEach(() => {
		layoutManager = new LayoutManager();
		vi.clearAllMocks();
	});

	describe('resolveLayout', () => {
		it('should return null when no layout specified', async () => {
			const result = await layoutManager.resolveLayout(routeWithoutLayout, stateWithoutLayout);

			expect(result).toBeNull();
		});

		it('should load state-level layout when route has no layout', async () => {
			const result = await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);

			expect(result).toBe(AppLayout);
			expect(appLayoutConfig.load).toHaveBeenCalledTimes(1);
		});

		it('should prefer route-level layout over state-level', async () => {
			const result = await layoutManager.resolveLayout(routeWithLayout, stateWithLayout);

			expect(result).toBe(FullscreenLayout);
			expect(fullscreenLayoutConfig.load).toHaveBeenCalledTimes(1);
			expect(appLayoutConfig.load).not.toHaveBeenCalled();
		});

		it('should cache layout and not reload on same ID', async () => {
			// First call - loads layout
			const result1 = await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(result1).toBe(AppLayout);
			expect(appLayoutConfig.load).toHaveBeenCalledTimes(1);

			// Second call - same layout ID, should use cache
			const result2 = await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(result2).toBe(AppLayout);
			expect(appLayoutConfig.load).toHaveBeenCalledTimes(1); // Still 1
		});

		it('should load new layout when ID changes', async () => {
			// Load first layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(appLayoutConfig.load).toHaveBeenCalledTimes(1);

			// Load different layout
			const stateWithAdmin: StateConfig = {
				routes: [],
				default: '/admin',
				layout: adminLayoutConfig
			};
			const result = await layoutManager.resolveLayout(routeWithoutLayout, stateWithAdmin);

			expect(result).toBe(AdminLayout);
			expect(adminLayoutConfig.load).toHaveBeenCalledTimes(1);
		});

		it('should clear cache when transitioning to no layout', async () => {
			// Load a layout first
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(layoutManager.getCurrentLayoutId()).toBe('app-layout');

			// Navigate to route with no layout
			const result = await layoutManager.resolveLayout(routeWithoutLayout, stateWithoutLayout);

			expect(result).toBeNull();
			expect(layoutManager.getCurrentLayoutId()).toBeNull();
		});

		it('should work without stateConfig parameter', async () => {
			// Route with layout, no state config
			const result = await layoutManager.resolveLayout(routeWithLayout);

			expect(result).toBe(FullscreenLayout);
		});

		it('should return null when route has no layout and no stateConfig', async () => {
			const result = await layoutManager.resolveLayout(routeWithoutLayout);

			expect(result).toBeNull();
		});
	});

	describe('willLayoutChange', () => {
		it('should return false when both have no layout', () => {
			const result = layoutManager.willLayoutChange(routeWithoutLayout, stateWithoutLayout);

			expect(result).toBe(false);
		});

		it('should return true when going from no layout to layout', async () => {
			// Start with no layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithoutLayout);

			// Check if going to layout would change
			const result = layoutManager.willLayoutChange(routeWithoutLayout, stateWithLayout);

			expect(result).toBe(true);
		});

		it('should return true when going from layout to no layout', async () => {
			// Start with layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);

			// Check if going to no layout would change
			const result = layoutManager.willLayoutChange(routeWithoutLayout, stateWithoutLayout);

			expect(result).toBe(true);
		});

		it('should return false when same layout ID', async () => {
			// Load layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);

			// Check same layout
			const result = layoutManager.willLayoutChange(routeWithoutLayout, stateWithLayout);

			expect(result).toBe(false);
		});

		it('should return true when different layout ID', async () => {
			// Load first layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);

			// Check different layout
			const stateWithAdmin: StateConfig = {
				routes: [],
				default: '/admin',
				layout: adminLayoutConfig
			};
			const result = layoutManager.willLayoutChange(routeWithoutLayout, stateWithAdmin);

			expect(result).toBe(true);
		});

		it('should prefer route layout over state layout', async () => {
			// Load state layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);

			// Route with different layout should show change
			const result = layoutManager.willLayoutChange(routeWithLayout, stateWithLayout);

			expect(result).toBe(true);
		});
	});

	describe('getCurrentLayoutId', () => {
		it('should return null initially', () => {
			expect(layoutManager.getCurrentLayoutId()).toBeNull();
		});

		it('should return layout ID after resolving', async () => {
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);

			expect(layoutManager.getCurrentLayoutId()).toBe('app-layout');
		});

		it('should return null after resolving to no layout', async () => {
			// Load layout first
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(layoutManager.getCurrentLayoutId()).toBe('app-layout');

			// Resolve to no layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithoutLayout);

			expect(layoutManager.getCurrentLayoutId()).toBeNull();
		});
	});

	describe('clearCache', () => {
		it('should clear the cached layout', async () => {
			// Load layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(layoutManager.getCurrentLayoutId()).toBe('app-layout');

			// Clear cache
			layoutManager.clearCache();

			expect(layoutManager.getCurrentLayoutId()).toBeNull();
		});

		it('should force reload on next resolve', async () => {
			// Load layout
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(appLayoutConfig.load).toHaveBeenCalledTimes(1);

			// Clear cache
			layoutManager.clearCache();

			// Resolve same layout - should reload
			await layoutManager.resolveLayout(routeWithoutLayout, stateWithLayout);
			expect(appLayoutConfig.load).toHaveBeenCalledTimes(2);
		});
	});
});
