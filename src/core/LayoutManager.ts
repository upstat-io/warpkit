/**
 * LayoutManager - Layout resolution and caching
 *
 * Resolves which layout applies to a route (route-level > state-level > none)
 * and caches loaded layouts to avoid re-imports on same-layout navigations.
 *
 * Uses explicit string IDs for layout identity since lazy import functions
 * create new references on each access, making reference equality unreliable.
 */

import type { Component } from 'svelte';
import type { Route, StateConfig, LayoutConfig } from './types.js';

/**
 * Manages layout resolution and caching for navigation.
 *
 * Called by Navigator in Phase 6 after the route component is loaded.
 * The resolved layout is set on WarpKit.loadedLayout ($state) and
 * consumed by RouterView for rendering.
 */
export class LayoutManager {
	private currentLayoutId: string | null = null;
	private currentLayout: Component | null = null;
	private currentLayoutHmrId: string | null = null;

	/**
	 * Resolve which layout to use for a route, loading it if necessary.
	 *
	 * Priority: route-level > state-level > none
	 *
	 * Returns the cached layout component if the layout ID hasn't changed,
	 * avoiding unnecessary re-imports on same-layout navigations.
	 *
	 * @param route - The matched route (may specify route-level layout)
	 * @param stateConfig - The current state config (may specify state-level layout)
	 * @returns The layout component, or null if no layout applies
	 */
	public async resolveLayout(route: Route, stateConfig?: StateConfig): Promise<Component | null> {
		// Priority: route > state > none
		const layoutConfig: LayoutConfig | undefined = route.layout ?? stateConfig?.layout;

		if (!layoutConfig) {
			// No layout - clear cache so willLayoutChange detects the transition
			this.currentLayoutId = null;
			this.currentLayout = null;
			this.currentLayoutHmrId = null;
			return null;
		}

		// Compare by explicit ID - not function reference
		const layoutId = layoutConfig.id;

		// Same layout - reuse cached component (no re-import, no remount)
		if (layoutId === this.currentLayoutId && this.currentLayout) {
			return this.currentLayout;
		}

		// Different layout - load new one via lazy import
		try {
			const module = await layoutConfig.load();
			this.currentLayout = module.default;
			this.currentLayoutId = layoutId;
			this.currentLayoutHmrId = (module as Record<string, unknown>).__warpkitHmrId as string ?? null;
			return this.currentLayout;
		} catch (error) {
			throw this.enhanceLayoutLoadError(error, layoutId);
		}
	}

	/**
	 * Wrap load error with layout context.
	 */
	private enhanceLayoutLoadError(error: unknown, layoutId: string): Error {
		const message = error instanceof Error ? error.message : String(error);
		const enhanced = new Error(`[layout:${layoutId}] ${message}`);
		if (error instanceof Error) {
			enhanced.cause = error;
		}
		return enhanced;
	}

	/**
	 * Check if the layout will change without actually loading it.
	 *
	 * Used by onNavigate hooks (Phase 7) to determine if a layout transition
	 * animation should run (e.g., via View Transitions API).
	 *
	 * @param route - The target route
	 * @param stateConfig - The target state config
	 * @returns True if navigating to this route would change the layout
	 */
	public willLayoutChange(route: Route, stateConfig?: StateConfig): boolean {
		const layoutConfig: LayoutConfig | undefined = route.layout ?? stateConfig?.layout;

		if (!layoutConfig) {
			// Going to no layout - changed if we currently have one
			return this.currentLayoutId !== null;
		}

		// Changed if ID differs
		return layoutConfig.id !== this.currentLayoutId;
	}

	/**
	 * Get the current layout ID.
	 * Returns null if no layout is active.
	 */
	public getCurrentLayoutId(): string | null {
		return this.currentLayoutId;
	}

	/**
	 * Get the current layout's HMR module ID.
	 * Returns null if no layout is active or if not running in dev mode.
	 */
	public getLayoutHmrId(): string | null {
		return this.currentLayoutHmrId;
	}

	/**
	 * Clear the layout cache.
	 * Forces next resolveLayout to load fresh even if same ID.
	 */
	public clearCache(): void {
		this.currentLayoutId = null;
		this.currentLayout = null;
		this.currentLayoutHmrId = null;
	}
}
