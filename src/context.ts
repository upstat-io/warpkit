/**
 * WarpKit v2 Context
 *
 * Svelte context symbol and interface for WarpKit v2.
 * Used by WarpKitProvider to provide context to child components.
 *
 * @remarks
 * **Dependency Order**: core/types.ts → providers/interfaces.ts → context.ts
 *
 * This file is at the TOP of the dependency hierarchy for consumer-facing types.
 * Do NOT import context.ts from core/ or providers/ to avoid circular dependencies.
 * The WarpKit implementation (WarpKit.svelte.ts in Phase 4) imports from here.
 */

import type { Component } from 'svelte';
import type { PageState, Route } from './core/types';
import type { EventEmitterAPI, WarpKitEventRegistry } from './events/types.js';

// ============================================================================
// Context Key
// ============================================================================

/**
 * Svelte context key for WarpKit v2.
 * Use with getContext(WARPKIT_CONTEXT) to access the context.
 */
export const WARPKIT_CONTEXT: unique symbol = Symbol('warpkit-v2');

// ============================================================================
// Context Types
// ============================================================================

/**
 * WarpKit instance interface (forward declaration).
 * The actual implementation is in WarpKit.svelte.ts.
 */
export interface WarpKit<TAppState extends string = string> {
	/** Reactive page state */
	readonly page: PageState;

	/** Event emitter for cross-component communication */
	readonly events: EventEmitterAPI<WarpKitEventRegistry>;

	/**
	 * Whether WarpKit is ready to render.
	 * When an authAdapter is provided, this is false until auth initialization completes.
	 * When no authAdapter is provided, this is true immediately after start().
	 */
	readonly ready: boolean;

	/**
	 * Currently loaded route component (null during navigation or error).
	 * Used by WarpKitProvider to expose to RouterView.
	 */
	readonly loadedComponent: Component | null;

	/**
	 * Currently loaded layout component (null if route has no layout).
	 * Used by WarpKitProvider to expose to RouterView.
	 */
	readonly loadedLayout: Component | null;

	/** Navigate to a path */
	navigate(path: string, options?: NavigateOptions): Promise<NavigationResult>;

	/** Change app state */
	setState(state: TAppState, options?: SetStateOptions): Promise<void>;

	/** Build a URL using the browser provider's strategy */
	buildUrl(path: string): string;

	/** Register a navigation blocker */
	registerBlocker(blocker: NavigationBlocker): BlockerRegistration;

	/** Get current app state */
	getState(): TAppState;

	/** Get current state ID (increments on each state change) */
	getStateId(): number;

	/** Start WarpKit (initializes providers, performs initial navigation) */
	start(): Promise<void>;

	/** Destroy WarpKit (cleans up providers, event listeners) */
	destroy(): void;

	/** Retry the last navigation (useful after error recovery) */
	retry(): Promise<NavigationResult>;
}

/**
 * Svelte context type provided by WarpKitProvider.
 *
 * This is the bridge between the core layer and the component layer.
 * WarpKitProvider creates this context once; RouterView, Link, NavLink,
 * useWarpKit, and usePage all consume it via getContext(WARPKIT_CONTEXT).
 *
 * All properties are reactive: either backed by $state on WarpKit/PageState,
 * or are getter functions that read $state properties.
 */
export interface WarpKitContext {
	/** Full WarpKit instance - provides navigate, setState, buildUrl, etc. */
	warpkit: WarpKit;

	/** Reactive page state - shorthand for warpkit.page */
	readonly page: PageState;

	/**
	 * Currently loaded route component. Set by Navigator after lazy import.
	 * Maps to warpkit.loadedComponent - renamed for template clarity.
	 */
	readonly routeComponent: Component | null;

	/**
	 * Currently loaded layout component. Set by Navigator via LayoutManager.
	 * Maps to warpkit.loadedLayout - renamed for template clarity.
	 */
	readonly layoutComponent: Component | null;

	/**
	 * Current state ID - used by RouterView {#key} to remount on state changes.
	 * Maps to warpkit.stateId (a $state field).
	 */
	readonly stateId: number;

	/** Retry the last failed navigation */
	retryLoad: () => void;
}

// ============================================================================
// Re-export common types for convenience
// ============================================================================

import type {
	NavigateOptions,
	NavigationResult,
	SetStateOptions,
	NavigationBlocker,
	BlockerRegistration
} from './core/types';

export type { NavigateOptions, NavigationResult, SetStateOptions, NavigationBlocker, BlockerRegistration };
