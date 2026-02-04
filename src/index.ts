/**
 * WarpKit v2 - Public API
 *
 * Main entry point for the WarpKit router framework.
 * Export all public components, hooks, utilities, and types.
 */

// ============================================================================
// Components
// ============================================================================

export { default as WarpKitProvider } from './components/WarpKitProvider.svelte';
export { default as WarpKitAppBoundary } from './components/WarpKitAppBoundary.svelte';
export { default as RouterView } from './components/RouterView.svelte';
export { default as Link } from './components/Link.svelte';
export { default as NavLink } from './components/NavLink.svelte';

// ============================================================================
// Hooks
// ============================================================================

export { useWarpKit, usePage, useWarpKitContext } from './hooks';
export { useEvent } from './events/useEvent.svelte';

// ============================================================================
// Events
// ============================================================================

export { EventEmitter } from './events/EventEmitter';
export type {
	EventRegistry,
	WarpKitEventRegistry,
	EventHandler,
	EventEmitterAPI,
	UseEventOptions,
	EventNames,
	EventPayload
} from './events/types';

// ============================================================================
// Core Classes
// ============================================================================

export { WarpKit } from './core/WarpKit.svelte';
export { PageState } from './core/PageState.svelte';
export { StateMachine } from './core/StateMachine';
export { RouteMatcher } from './core/RouteMatcher';
export { RouteCompiler } from './core/RouteCompiler';
export { Navigator } from './core/Navigator';
export { NavigationLifecycle } from './core/NavigationLifecycle';
export { LayoutManager } from './core/LayoutManager';
export { SvelteURLSearchParams } from './core/SvelteURLSearchParams.svelte';

// ============================================================================
// Route Factories
// ============================================================================

export { createRoute, createStateRoutes } from './route';

// ============================================================================
// Utilities
// ============================================================================

export { shouldHandleClick } from './shared/shouldHandleClick';

// ============================================================================
// Context
// ============================================================================

export { WARPKIT_CONTEXT } from './context';
export type { WarpKit as WarpKitInterface, WarpKitContext } from './context';

// ============================================================================
// Providers
// ============================================================================

export { DefaultBrowserProvider } from './providers/browser/BrowserProvider';
export { HashBrowserProvider } from './providers/browser/HashBrowserProvider';
export { MemoryBrowserProvider } from './providers/browser/MemoryBrowserProvider';
export { DefaultConfirmDialogProvider } from './providers/confirm/ConfirmDialogProvider';
export { DefaultStorageProvider } from './providers/storage/StorageProvider';

export type {
	BrowserProvider,
	ConfirmDialogProvider,
	StorageProvider,
	Provider,
	ResolvedProviders,
	HistoryState,
	WarpKitCore
} from './providers/interfaces';

// ============================================================================
// Error System
// ============================================================================

export { default as ErrorOverlay } from './errors/ErrorOverlay.svelte';
export { errorStore, currentError, showErrorUI, errorHistory, hasFatalError } from './errors/error-store';
export {
	setupGlobalErrorHandlers,
	removeGlobalErrorHandlers,
	areGlobalHandlersInstalled,
	setReportingProvider
} from './errors/global-handlers';
export type {
	ErrorSeverity,
	ErrorSource,
	NormalizedError,
	ErrorStoreState,
	ReportingProvider,
	ErrorHandlerOptions
} from './errors/types';

// ============================================================================
// Auth Adapter
// ============================================================================

export type { AuthAdapter, AuthAdapterContext, AuthInitResult } from './auth';

// ============================================================================
// Types
// ============================================================================

export type {
	// Route types
	Route,
	RouteMatch,
	StateRoutes,
	StateConfig,
	CompiledRoute,

	// Navigation types
	NavigateOptions,
	NavigationResult,
	NavigationContext,
	NavigationError,
	NavigationErrorContext,
	SetStateOptions,
	ResolvedLocation,

	// Hook types
	BeforeNavigateHook,
	AfterNavigateHook,
	OnNavigateHook,
	NavigationBlocker,
	BlockerRegistration,

	// Config types
	WarpKitConfig,

	// PageState types
	PageState as PageStateInterface
} from './core/types';
