/**
 * WarpKit v2 Provider Interfaces
 *
 * Provider contracts for browser, confirm dialog, and storage.
 * Providers abstract browser APIs for testability and customization.
 */

import type { NavigationContext, PageState } from '../core/types';

// ============================================================================
// Core Provider Interface
// ============================================================================

/**
 * Base interface all providers implement.
 */
export interface Provider {
	/** Unique identifier for this provider */
	readonly id: string;

	/**
	 * Provider IDs this provider depends on.
	 * If specified, this provider initializes after dependencies.
	 * By default, providers initialize in parallel.
	 */
	readonly dependsOn?: string[];

	/** Initialize the provider (called once during WarpKit.start) */
	initialize?(warpkit: WarpKitCore): void | Promise<void>;

	/** Cleanup (called when WarpKit.destroy is called) */
	destroy?(): void;
}

/**
 * Core interface - what providers receive during initialization.
 * This is a subset of WarpKit to prevent circular dependencies.
 *
 * Intentionally limited: Providers observe state and navigation events
 * but cannot navigate or setState. Providers emit events; the consumer
 * application reacts with full WarpKit access. This prevents provider->WarpKit
 * circular dependencies and keeps providers focused on observation, not control.
 */
export interface WarpKitCore {
	readonly page: PageState;
	getState(): string;
	getStateId(): number;
	/**
	 * Subscribe to navigation completion events (fires after Phase 9 - afterNavigate).
	 * This is a read-only observation hook, NOT the onNavigate pipeline hook (Phase 7).
	 * Providers receive notification after navigation is fully committed and cannot
	 * block or redirect. Use for analytics, logging, and state observation.
	 */
	onNavigationComplete(callback: (context: NavigationContext) => void): () => void;
}

// ============================================================================
// Browser Provider
// ============================================================================

/**
 * Abstracts browser history and URL manipulation.
 * Replace for testing (MemoryBrowserProvider) or custom history handling.
 */
export interface BrowserProvider extends Provider {
	readonly id: 'browser';

	/** Get current location from browser */
	getLocation(): BrowserLocation;

	/** Build URL with provider's strategy (hash mode, base path, etc.) */
	buildUrl(path: string): string;

	/** Parse URL to internal path */
	parseUrl(url: string): string;

	/** Push new history entry */
	push(path: string, state: HistoryState): void;

	/** Replace current history entry */
	replace(path: string, state: HistoryState): void;

	/** Go back/forward in history */
	go(delta: number): void;

	/** Get current history state (named getHistoryState to avoid collision with StateMachine.getState) */
	getHistoryState(): HistoryState | null;

	/** Listen for popstate events */
	onPopState(callback: PopStateCallback): () => void;
}

/**
 * Configuration for creating a BrowserProvider.
 */
export interface BrowserProviderConfig {
	/** Base path for deployment (e.g., '/app') */
	basePath?: string;
}

/**
 * Browser location components.
 */
export interface BrowserLocation {
	pathname: string;
	search: string;
	hash: string;
}

/**
 * History state stored in browser history entries.
 */
export interface HistoryState {
	/** WarpKit marker - identifies our history entries */
	__warpkit: true;
	/** Unique navigation ID */
	id: number;
	/** Position in history stack (for back/forward detection) */
	position: number;
	/** App state when this entry was created */
	appState: string;
	/** Consumer-provided state data */
	data?: Record<string, unknown>;
}

/**
 * Callback for popstate events.
 * Scroll positions are stored separately via StorageProvider (keyed by navigation ID), not in HistoryState.
 */
export type PopStateCallback = (state: HistoryState | null, direction: 'back' | 'forward') => void;

// ============================================================================
// Confirm Dialog Provider
// ============================================================================

/**
 * Abstracts confirmation dialogs for navigation blocking.
 * Replace with custom modal implementation.
 */
export interface ConfirmDialogProvider extends Provider {
	readonly id: 'confirmDialog';

	/** Show confirmation dialog, return true if user confirms */
	confirm(message: string): Promise<boolean>;
}

// ============================================================================
// Storage Provider
// ============================================================================

/**
 * Abstracts storage for scroll positions and intended path.
 * Replace with custom storage (IndexedDB, etc.) or no-op for testing.
 * Uses LRU eviction to bound storage size (default: 50 positions).
 */
export interface StorageProvider extends Provider {
	readonly id: 'storage';

	/** Save scroll position for a navigation ID (LRU eviction applies) */
	saveScrollPosition(navigationId: number, position: ScrollPosition): void;

	/** Get scroll position for a navigation ID */
	getScrollPosition(navigationId: number): ScrollPosition | null;

	/** Save intended path (for deep link support) */
	saveIntendedPath(path: string): void;

	/** Get and clear intended path */
	popIntendedPath(): string | null;
}

/**
 * Configuration for creating a StorageProvider.
 */
export interface StorageProviderConfig {
	/** Maximum scroll positions to store before LRU eviction (default: 50) */
	maxScrollPositions?: number;
}

/**
 * Scroll position coordinates.
 */
export interface ScrollPosition {
	x: number;
	y: number;
}

// ============================================================================
// Provider Registry
// ============================================================================

/**
 * Registry of providers passed to createWarpKit.
 * Core providers have well-known keys; custom providers use any string key.
 */
export interface ProviderRegistry {
	browser?: BrowserProvider;
	confirmDialog?: ConfirmDialogProvider;
	storage?: StorageProvider;
	/** Consumer can add custom providers */
	[key: string]: Provider | undefined;
}

/**
 * Resolved providers with guaranteed core providers (defaults applied).
 */
export interface ResolvedProviders {
	browser: BrowserProvider;
	confirmDialog: ConfirmDialogProvider;
	storage: StorageProvider;
	[key: string]: Provider;
}
