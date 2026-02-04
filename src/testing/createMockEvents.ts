/**
 * Mock EventEmitter Factory for Testing
 *
 * Creates a pre-configured EventEmitter instance for testing components that use events.
 * Use this when you need to test event emission and subscription without the full WarpKit context.
 */

import { EventEmitter } from '../events/EventEmitter.js';
import type { EventRegistry, WarpKitEventRegistry } from '../events/types.js';

/**
 * Creates a mock EventEmitter for testing.
 *
 * Returns a fully functional EventEmitter instance. Unlike other "mock" utilities,
 * this is a real EventEmitter - "mock" refers to its use in test contexts rather
 * than production.
 *
 * @typeParam R - Event registry type (defaults to WarpKitEventRegistry)
 * @returns A new EventEmitter instance
 *
 * @example
 * ```typescript
 * import { createMockEvents } from '@warpkit/core/testing';
 *
 * describe('MyComponent', () => {
 *   it('should emit event on action', () => {
 *     const events = createMockEvents();
 *
 *     let receivedPayload: unknown;
 *     events.on('auth:signed-in', (payload) => {
 *       receivedPayload = payload;
 *     });
 *
 *     events.emit('auth:signed-in', { userId: 'test-user' });
 *     expect(receivedPayload).toEqual({ userId: 'test-user' });
 *   });
 * });
 * ```
 */
export function createMockEvents<R extends EventRegistry = WarpKitEventRegistry>(): EventEmitter<R> {
	return new EventEmitter<R>();
}
