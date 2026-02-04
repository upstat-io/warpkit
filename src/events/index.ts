/**
 * WarpKit v2 Events Module
 *
 * Pub/sub event system for cross-component communication.
 */

// ============================================================================
// Types
// ============================================================================

export type {
	EventRegistry,
	WarpKitEventRegistry,
	EventHandler,
	EventEmitterAPI,
	UseEventOptions,
	EventNames,
	EventPayload,
	EventsWithPayload,
	EventsWithoutPayload,
	TypedEventHandler
} from './types.js';

// ============================================================================
// Classes
// ============================================================================

export { EventEmitter } from './EventEmitter.js';

// ============================================================================
// Hooks
// ============================================================================

export { useEvent } from './useEvent.svelte.js';
