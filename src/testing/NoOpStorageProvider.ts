/**
 * No-Op Storage Provider for Testing
 *
 * Silent storage mock that does nothing on write and returns null on read.
 * Use in tests where scroll position and intended path storage aren't needed.
 */

import type { ScrollPosition, StorageProvider } from '../providers/interfaces';

/**
 * No-op implementation of StorageProvider for testing.
 *
 * All writes are silently ignored.
 * All reads return null.
 * Never throws.
 *
 * @example
 * ```typescript
 * const storage = new NoOpStorageProvider();
 *
 * // Writes do nothing
 * storage.saveScrollPosition(1, { x: 0, y: 100 });
 *
 * // Reads return null
 * storage.getScrollPosition(1); // null
 * storage.popIntendedPath(); // null
 * ```
 */
export class NoOpStorageProvider implements StorageProvider {
	public readonly id = 'storage' as const;

	/**
	 * No-op: does nothing.
	 */
	public saveScrollPosition(_navigationId: number, _position: ScrollPosition): void {
		// Intentionally empty - no-op for testing
	}

	/**
	 * Always returns null.
	 */
	public getScrollPosition(_navigationId: number): ScrollPosition | null {
		return null;
	}

	/**
	 * No-op: does nothing.
	 */
	public saveIntendedPath(_path: string): void {
		// Intentionally empty - no-op for testing
	}

	/**
	 * Always returns null.
	 */
	public popIntendedPath(): string | null {
		return null;
	}
}
